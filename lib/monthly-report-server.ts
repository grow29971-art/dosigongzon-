// 월간 성장 리포트 — "이번 달 내가 얼마나 성장했는지"를 한눈에 보여주는 요약.
// journey-server.ts(전체 누적 타임라인)와 달리 특정 달로 범위를 좁혀서 집계한다.
// 코인/좋아요처럼 시각(timestamp)이 남지 않는 값은 정확히 "이번 달 몫"을 가를 수
// 없어서 일부러 뺐다 — 여기 있는 값은 전부 created_at/logged_at 기준으로
// 실제 그 달에 일어난 일만 센 정확한 숫자다.

import { createClient } from "@/lib/supabase/server";

export interface MonthlyGrowthReport {
  year: number;
  month: number; // 1~12
  careLogCount: number;   // 이번 달 돌봄다이어리 작성 수
  newCatCount: number;    // 이번 달 새로 등록한 고양이 수
  commentCount: number;   // 이번 달 커뮤니티 기록(돌봄기록+경보) 수
  // 이번 달 PVP 승리 수 — card_battles엔 PVP만 기록되고 PVE(고양이학대범/야생동물)는
  // 상대가 실제 DB 카드가 아니라 FK 제약상 기록을 안 남기므로, 여기 숫자는 PVP만 정확히 센 것.
  battleWinCount: number;
}

function monthRange(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return { start: start.toISOString(), end: end.toISOString() };
}

export async function getMonthlyGrowthReport(userId: string, year: number, month: number): Promise<MonthlyGrowthReport> {
  const supabase = await createClient();
  const { start, end } = monthRange(year, month);

  const [careLogsRes, catsRes, commentsRes, battlesRes] = await Promise.all([
    supabase.from("care_logs").select("id", { count: "exact", head: true })
      .eq("author_id", userId).gte("logged_at", start).lt("logged_at", end),
    supabase.from("cats").select("id", { count: "exact", head: true })
      .eq("caretaker_id", userId).gte("created_at", start).lt("created_at", end),
    supabase.from("cat_comments").select("id", { count: "exact", head: true })
      .eq("author_id", userId).gte("created_at", start).lt("created_at", end),
    supabase.from("card_battles").select("id", { count: "exact", head: true })
      .eq("winner_id", userId).gte("created_at", start).lt("created_at", end),
  ]);

  return {
    year, month,
    careLogCount: careLogsRes.count ?? 0,
    newCatCount: catsRes.count ?? 0,
    commentCount: commentsRes.count ?? 0,
    battleWinCount: battlesRes.count ?? 0,
  };
}

export function hasAnyActivity(r: MonthlyGrowthReport): boolean {
  return r.careLogCount > 0 || r.newCatCount > 0 || r.commentCount > 0 || r.battleWinCount > 0;
}

const MONTH_COMMENTS: { min: number; text: string }[] = [
  { min: 0,  text: "새로운 시작이었어요. 다음 달엔 더 채워봐요!" },
  { min: 5,  text: "꾸준히 발걸음을 남긴 한 달이었어요" },
  { min: 15, text: "동네를 든든하게 지킨 한 달이었어요" },
  { min: 30, text: "정말 부지런한 한 달을 보냈어요!" },
  { min: 60, text: "우리 동네 최고의 집사다운 한 달!" },
];
export function pickMonthComment(total: number): string {
  let text = MONTH_COMMENTS[0].text;
  for (const c of MONTH_COMMENTS) if (total >= c.min) text = c.text;
  return text;
}
