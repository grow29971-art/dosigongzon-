// 앱인토스 미니앱 토스 로그인 브릿지 — 인가 코드 → 토스 사용자 → Supabase 세션.
// POST 본문: { authorizationCode, referrer }
// 응답: { ok: true, token_hash }  → 미니앱이 supabase.auth.verifyOtp({ type: "magiclink" })로 세션 생성.
//
// 무인증 라우트인 이유: 로그인 전이라 우리 세션이 없다. 대신 인가 코드는 토스가 1회성으로 발급하고
// mTLS 파트너 API에서만 교환되므로, 코드를 위조해 남의 계정을 얻을 수 없다. IP rate limit 추가.
//
// 계정 매핑: toss_identities(user_key → user_id). 첫 로그인이면 Supabase 유저를 새로 만든다.
// 이메일은 토스 가입 필수가 아니라 null일 수 있어, 계정 식별은 userKey로만 하고 내부용 가짜 주소
// (toss-<userKey>@toss.dosigongzon.com)를 auth 이메일로 쓴다 — 어디에도 표시되지 않는다.
// 실명은 저장하지 않는다(닉네임은 '길집사NNNN' 자동 부여, 트리거가 유일성 보장).

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { exchangeAuthorizationCode, fetchTossUser, isTossAitConfigured } from "@/lib/toss-ait";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

const PSEUDO_EMAIL_DOMAIN = "toss.dosigongzon.com";

function pseudoEmail(userKey: string): string {
  return `toss-${userKey}@${PSEUDO_EMAIL_DOMAIN}`;
}

function randomNickname(): string {
  return `길집사${Math.floor(1000 + Math.random() * 9000)}`;
}

export async function OPTIONS() {
  // CORS 헤더는 next.config.ts(/api/toss/:path*, tossmini 오리진)가 붙인다.
  return new NextResponse(null, { status: 204 });
}

export async function POST(req: Request) {
  if (!isTossAitConfigured()) {
    return NextResponse.json({ ok: false, error: "토스 로그인이 아직 준비되지 않았어요." }, { status: 503 });
  }
  if (!rateLimit(`toss-login:${getClientIp(req)}`, { max: 10, windowMs: 60_000 })) {
    return NextResponse.json({ ok: false, error: "잠시 후 다시 시도해 주세요." }, { status: 429 });
  }

  let body: { authorizationCode?: string; referrer?: string };
  try { body = (await req.json()) as typeof body; }
  catch { return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 }); }
  const code = body.authorizationCode?.trim();
  const referrer = body.referrer?.trim() || "DEFAULT";
  if (!code || code.length > 512) {
    return NextResponse.json({ ok: false, error: "authorizationCode required" }, { status: 400 });
  }

  // 1) 토스: 인가 코드 → 액세스 토큰 → 사용자(userKey)
  let userKey: string;
  try {
    const tokens = await exchangeAuthorizationCode(code, referrer);
    const tossUser = await fetchTossUser(tokens.accessToken);
    userKey = tossUser.userKey;
  } catch (e) {
    console.error("[toss/login] 토스 API 실패:", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "토스 로그인 확인에 실패했어요." }, { status: 502 });
  }

  const service = createServiceClient();

  // 2) 매핑 조회 → 없으면 유저 생성
  let userId: string | null = null;
  let email: string | null = null;
  {
    const { data } = await service.from("toss_identities").select("user_id").eq("user_key", userKey).maybeSingle();
    userId = (data as { user_id: string } | null)?.user_id ?? null;
  }

  if (!userId) {
    email = pseudoEmail(userKey);
    const nowIso = new Date().toISOString();
    const { data: created, error: createErr } = await service.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { nickname: randomNickname(), provider: "toss", terms_agreed_at: nowIso },
      app_metadata: { provider: "toss", providers: ["toss"], toss_user_key: userKey },
    });
    if (createErr || !created.user) {
      console.error("[toss/login] createUser 실패:", createErr?.message);
      return NextResponse.json({ ok: false, error: "계정을 만들지 못했어요." }, { status: 500 });
    }
    userId = created.user.id;
    const { error: mapErr } = await service.from("toss_identities").insert({ user_key: userKey, user_id: userId });
    if (mapErr) {
      // unique 충돌 = 다른 요청이 먼저 만듦 → 그쪽 유저를 쓰고 방금 만든 계정은 지운다
      const { data: again } = await service.from("toss_identities").select("user_id").eq("user_key", userKey).maybeSingle();
      const winner = (again as { user_id: string } | null)?.user_id;
      if (winner && winner !== userId) {
        await service.auth.admin.deleteUser(userId);
        userId = winner;
        email = null;
      } else {
        console.error("[toss/login] toss_identities insert 실패:", mapErr.message);
        return NextResponse.json({ ok: false, error: "계정 연결에 실패했어요." }, { status: 500 });
      }
    }
  }

  if (!email) {
    const { data: u } = await service.auth.admin.getUserById(userId);
    email = u.user?.email ?? null;
    if (!email) return NextResponse.json({ ok: false, error: "계정 정보를 찾지 못했어요." }, { status: 500 });
  }

  // 3) 세션 토큰 — magiclink token_hash (1회용, 클라이언트 verifyOtp)
  const { data: link, error: linkErr } = await service.auth.admin.generateLink({ type: "magiclink", email });
  const tokenHash = link?.properties?.hashed_token;
  if (linkErr || !tokenHash) {
    console.error("[toss/login] generateLink 실패:", linkErr?.message);
    return NextResponse.json({ ok: false, error: "세션을 만들지 못했어요." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, token_hash: tokenHash });
}
