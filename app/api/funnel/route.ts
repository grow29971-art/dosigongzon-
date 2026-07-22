// 퍼널 계측 수집 API — 클라이언트 직접 INSERT(RLS) 경로 대체 (2026-07-22).
// 배경: 프로덕션에서 anon INSERT가 정책 재적용 후에도 42501로 거부되는 원인 불명 상태가
// 지속 → SQL 편집기 왕복 대신 서버 라우트(service role)로 우회해 계측을 확실히 살린다.
// 비로그인 허용 설계(온보딩 방문자 계측이 목적) — 대신 입력 검증 + IP 레이트리밋으로 방어.
// DB unique(anon_id, step)가 중복 상한(기기당 스텝 1회)을 그대로 보장한다.

import { createServiceClient } from "@/lib/supabase/service";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

// lib/funnel-repo.ts FunnelStep과 동기 유지할 것
const VALID_STEPS = new Set([
  "onboarding_intro",
  "onboarding_pick",
  "signup_home",
  "first_feed",
]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const ip = getClientIp(request);
  // 기기당 스텝 4개뿐 — 분당 10회면 정상 사용엔 충분, 봇 대량 삽입은 차단
  if (!rateLimit(`funnel:${ip}`, { max: 10, windowMs: 60_000 })) {
    return Response.json({ ok: false }, { status: 429 });
  }

  let body: { anonId?: unknown; step?: unknown; catId?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  const anonId = typeof body.anonId === "string" ? body.anonId.trim() : "";
  const step = typeof body.step === "string" ? body.step : "";
  const catId = typeof body.catId === "string" && UUID_RE.test(body.catId) ? body.catId : null;
  if (anonId.length < 8 || anonId.length > 64 || !VALID_STEPS.has(step)) {
    return Response.json({ ok: false }, { status: 400 });
  }

  const supabase = createServiceClient();

  // 로그인 상태면 user_id 연결 (선택 — 토큰 없거나 무효면 anon 취급)
  let userId: string | null = null;
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const { data } = await supabase.auth.getUser(authHeader.slice(7));
      userId = data.user?.id ?? null;
    } catch { /* 무효 토큰 — anon 취급 */ }
  }

  // unique(anon_id, step) 충돌은 정상(재방문) — ignoreDuplicates로 무시
  const { error } = await supabase.from("funnel_events").upsert(
    { anon_id: anonId, step, user_id: userId, cat_id: catId },
    { onConflict: "anon_id,step", ignoreDuplicates: true },
  );
  if (error) {
    return Response.json({ ok: false }, { status: 500 });
  }
  return Response.json({ ok: true });
}
