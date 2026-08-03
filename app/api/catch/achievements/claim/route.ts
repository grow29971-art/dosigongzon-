import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import { computeAchievements, achievementInput, type AchievementCardRow } from "@/lib/catch/achievements";
import { rateLimit } from "@/lib/rate-limit";
import { reportError } from "@/lib/error-report";

// 업적 보상 수령 (냥줍 app/api/achievements/claim 이식, 2026-08-04 P3).
// GET: 수령한 업적 키 목록 / POST {key}: 해당 업적 보상 수령.
// 진행도는 catch_cards/catch_profiles에서 service_role로 재계산(위조 불가),
// 수령 기록은 catch_profiles.achievement_claims(JSONB 배열)에 저장. 업적당 평생 1회.
//
// [지급 원자성] claim_catch_achievement RPC가 "키 append + increment_coins"를 한
// 트랜잭션으로 처리하고, append UPDATE의 WHERE NOT(claims ? key)가 원자 게이트다 —
// 동시 N발 중 1발만 true. 냥줍의 read-modify-write 코인 폴백은 이식하지 않았다
// (city 코인 불변식: 절대값 쓰기 금지, 원자 증분 RPC 단일 경로). RPC 미배포면 503.
// (마이그레이션: box/supabase_catch_profile_migration.sql)

// catch_cards는 단일 마이그레이션 파일이라 냥줍처럼 컬럼별 폴백 재조회가 필요 없다 —
// 테이블 자체가 없으면(마이그레이션 전) 정직하게 503.
const CARD_COLS = "card_rarity, caught_geohash7, species_key, is_shiny";

async function loadClaims(userId: string) {
  const s = createServiceClient();
  const { data, error } = await s.from("catch_profiles")
    .select("achievement_claims, perfect_catch_count")
    .eq("user_id", userId).maybeSingle();
  // 테이블 마이그레이션 전 — "준비 중"으로 판정 (data가 null인 것은 정상: lazy 생성 전)
  if (error) return { s, notReady: true as const, claimed: [] as string[], perfect: 0 };
  const claimed = Array.isArray(data?.achievement_claims)
    ? (data.achievement_claims as string[]) : [];
  return {
    s, notReady: false as const, claimed,
    perfect: (data?.perfect_catch_count as number | null) ?? 0,
  };
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
    const { notReady, claimed } = await loadClaims(user.id);
    if (notReady) return NextResponse.json({ error: "업적 보상 준비 중이에요." }, { status: 503 });
    return NextResponse.json({ claimed });
  } catch (e) {
    reportError("catch-achievement:get", e);
    return NextResponse.json({ error: "서버 오류가 발생했어요." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });

    if (!rateLimit(`catch-ach-claim:${user.id}`, { max: 10, windowMs: 60_000 })) {
      return NextResponse.json({ error: "잠시 후 다시 시도해주세요." }, { status: 429 });
    }

    const { key } = await request.json().catch(() => ({})) as { key?: string };
    if (typeof key !== "string" || !key) {
      return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
    }

    const { s, notReady, claimed, perfect } = await loadClaims(user.id);
    if (notReady) {
      return NextResponse.json(
        { error: "업적 보상 준비 중이에요. (box/supabase_catch_profile_migration.sql 실행 필요)" },
        { status: 503 },
      );
    }
    if (claimed.includes(key)) {
      return NextResponse.json({ error: "이미 받은 보상이에요." }, { status: 409 });
    }

    // 진행값 재계산 — 도감 클라이언트와 동일 규칙(lib/catch/achievements.achievementInput)
    const cardsRes = await s.from("catch_cards")
      .select(CARD_COLS).eq("owner_id", user.id).limit(2000);
    if (cardsRes.error) {
      reportError("catch-achievement:cards", cardsRes.error);
      return NextResponse.json({ error: "카드 조회에 실패했어요." }, { status: 500 });
    }
    const input = achievementInput(
      (cardsRes.data ?? []) as unknown as AchievementCardRow[],
      { perfect_catch_count: perfect },
    );
    const ach = computeAchievements(input).find(a => a.key === key);
    if (!ach) return NextResponse.json({ error: "없는 업적이에요." }, { status: 400 });
    if (!ach.done) return NextResponse.json({ error: "아직 조건을 못 채웠어요!" }, { status: 400 });

    // 지급 — 원자 RPC 단일 경로 (키 append + 코인 증분을 한 트랜잭션으로)
    const rpc = await s.rpc("claim_catch_achievement", {
      p_user: user.id, p_key: key, p_reward: ach.reward,
    });
    if (rpc.error) {
      // RPC 미배포(마이그레이션 전) — 폴백 없이 안전 거절
      if (["42883", "PGRST202"].includes((rpc.error as { code?: string }).code ?? "")) {
        return NextResponse.json({ error: "업적 보상 준비 중이에요. 잠시 후 다시 시도해주세요." }, { status: 503 });
      }
      reportError("catch-achievement:rpc", rpc.error, { key, userId: user.id });
      return NextResponse.json({ error: "보상 지급에 실패했어요." }, { status: 500 });
    }
    // RPC가 행을 못 바꿨으면(false) 다른 기기/동시 요청이 먼저 수령한 것
    if (!rpc.data) return NextResponse.json({ error: "이미 받은 보상이에요." }, { status: 409 });
    return NextResponse.json({ ok: true, reward: ach.reward, title: ach.title });
  } catch (e) {
    reportError("catch-achievement:claim", e);
    return NextResponse.json({ error: "서버 오류가 발생했어요." }, { status: 500 });
  }
}
