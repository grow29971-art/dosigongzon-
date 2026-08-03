import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import { thisMondayKstISO, rankBattleScores, type BattleRow } from "@/lib/catch/ranking";
import { CATCH_BATTLE_ENABLED } from "@/lib/catch/features";

// 주간 배틀 랭킹 — 냥줍 app/api/battle-ranking 이식 (2026-08-04 P4).
// catch_battles의 RLS는 본인 배틀만 조회라 랭킹 집계는 service_role로만 가능.
// 이번 주(월~일, KST) 참가자별 승3점/패1점 집계. PVE는 catch_battles에 기록되지
// 않으므로(상대 카드가 DB에 없음) 자동으로 PVP만 집계된다.
// 주 경계·점수 규칙은 정산 크론(/api/cron/catch-ranking-settle)과 lib/catch/ranking.ts로
// 공유 — 유저가 화면에서 본 순위와 월요일 지급 순위가 어긋나면 안 되기 때문.

export async function GET() {
  if (!CATCH_BATTLE_ENABLED) return NextResponse.json({ error: "배틀은 잠시 쉬고 있어요." }, { status: 503 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const svc = createServiceClient();

  const since = thisMondayKstISO();
  const { data, error } = await svc
    .from("catch_battles")
    .select("challenger_id, opponent_id, winner_id")
    .gte("created_at", since)
    .limit(10000);

  if (error) {
    // 테이블 마이그레이션 전 — 랭킹은 빈 보드로 (배틀 자체는 이미 동작)
    if (["42P01", "PGRST205"].includes((error as { code?: string }).code ?? "")) {
      return NextResponse.json({ ranks: [] });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const scored = rankBattleScores((data ?? []) as BattleRow[]).slice(0, 50);
  if (scored.length === 0) return NextResponse.json({ ranks: [] });

  const { data: profiles } = await svc
    .from("profiles")
    .select("id, nickname")
    .in("id", scored.map((r) => r.userId));
  const profileMap = new Map(
    ((profiles ?? []) as { id: string; nickname: string | null }[]).map((p) => [p.id, p]),
  );

  const ranked = scored.map((r) => ({
    // userId(=auth uid) 원문은 응답에 싣지 않는다 — 본인 강조는 서버가 계산한 isMe로만
    // 내려 타 유저 식별자 노출을 없앤다 (냥줍 2026-07-16 보안점검 계승).
    isMe: r.userId === user.id,
    name: profileMap.get(r.userId)?.nickname ?? "이름없는 집사",
    score: r.score,
    wins: r.wins,
    losses: r.losses,
  }));

  return NextResponse.json({ ranks: ranked });
}
