import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { reportError } from "@/lib/error-report";
import { lastWeekRange, rankBattleScores, WEEKLY_RANK_REWARDS, type BattleRow } from "@/lib/catch/ranking";

export const maxDuration = 60;

// catch 주간 배틀 랭킹 정산 — 냥줍 app/api/ranking/settle 이식 (2026-08-04 P4).
// city 크론 규약(/api/cron/* + Authorization: Bearer CRON_SECRET, proxy.ts 하트비트)에
// 맞춰 배치. vercel.json 스케줄: 매주 일 15:05 UTC = 월요일 00:05 KST에
// "지난주(월 00:00 ~ 월 00:00 KST)" 랭킹을 집계해 TOP 10에게 WEEKLY_RANK_REWARDS대로
// 코인 지급. 랭킹 페이지의 "매주 월요일 TOP 10은 코인" 약속을 이 라우트가 이행한다.
//
// 멱등성: catch_ranking_settlements.week_key(지난주 월요일 KST 날짜, PK)를 지급 *전에*
// insert — PK 충돌(23505)이면 이미 정산된(또는 동시 실행 중인) 주라 스킵.
// insert가 락 역할이라 크론 중복 발화·수동 재실행이 겹쳐도 이중 지급이 없다.
// 테이블 자체가 없으면(마이그레이션 전) 멱등 보장 불가 → 503 안전 거절.

interface PaidEntry {
  rank: number;
  userId: string;
  reward: number;
  score: number;
  wins: number;
  losses: number;
}

async function handle(request: Request) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const svc = createServiceClient();
  const { startISO, endISO, weekKey } = lastWeekRange();

  // 1) 멱등 락 — 지급 전에 week_key를 선점한다.
  const { error: lockErr } = await svc
    .from("catch_ranking_settlements")
    .insert({ week_key: weekKey, settled_at: new Date().toISOString(), paid: [] });
  if (lockErr) {
    if (lockErr.code === "23505") {
      // 이미 정산된 주 — 정상 스킵 (재실행·중복 발화 방어)
      return NextResponse.json({ ok: true, skipped: true, weekKey });
    }
    // 테이블 없음(42P01/PGRST205) 등 — 멱등 보장 불가이므로 지급하지 않고 거절
    reportError("catch-ranking-settle:lock", lockErr, { weekKey });
    return NextResponse.json(
      { error: "정산 준비 중이에요. (box/supabase_catch_battle_migration.sql 실행 필요)" },
      { status: 503 },
    );
  }

  // 2) 지난주 배틀 집계 — 실시간 랭킹과 같은 주 경계·점수 규칙(lib/catch/ranking.ts)
  const { data, error } = await svc
    .from("catch_battles")
    .select("challenger_id, opponent_id, winner_id")
    .gte("created_at", startISO)
    .lt("created_at", endISO)
    .limit(10000);
  if (error) {
    reportError("catch-ranking-settle:battles", error, { weekKey });
    return NextResponse.json({ error: "배틀 집계 실패" }, { status: 500 });
  }

  const top = rankBattleScores((data ?? []) as BattleRow[]).slice(0, WEEKLY_RANK_REWARDS.length);

  // 3) TOP 10 코인 지급 — 순위표의 지급액 그대로. increment_coins 원자 증분 단일 경로
  //    (냥줍의 read-modify-write 폴백은 이식하지 않음 — city 코인 불변식).
  const paid: PaidEntry[] = [];
  for (let i = 0; i < top.length; i++) {
    const entry = top[i];
    const reward = WEEKLY_RANK_REWARDS[i];
    if (!reward) continue;
    const rpc = await svc.rpc("increment_coins", { p_user_id: entry.userId, p_amount: reward });
    if (rpc.error) {
      reportError("catch-ranking-settle:pay", rpc.error, { weekKey, userId: entry.userId, reward });
      continue;
    }
    // 반환 NULL = 프로필 없음(탈퇴 등) → 해당 순위 지급만 생략 (순위 승계 없음 — 페이지 표기와 일치)
    if (typeof rpc.data !== "number") continue;
    paid.push({ rank: i + 1, userId: entry.userId, reward, score: entry.score, wins: entry.wins, losses: entry.losses });
  }

  // 4) 지급 내역 기록 (실패해도 지급 자체는 완료 — 로그만 남김)
  const { error: recErr } = await svc
    .from("catch_ranking_settlements")
    .update({ paid })
    .eq("week_key", weekKey);
  if (recErr) reportError("catch-ranking-settle:record", recErr, { weekKey });

  return NextResponse.json({
    ok: true,
    weekKey,
    range: { start: startISO, end: endISO },
    battles: data?.length ?? 0,
    paidCount: paid.length,
    paid,
  });
}

// Vercel Cron은 GET으로 호출, 수동/디스패처 재실행은 POST도 허용 (city 크론 관례)
export async function GET(request: Request) { return handle(request); }
export async function POST(request: Request) { return handle(request); }
