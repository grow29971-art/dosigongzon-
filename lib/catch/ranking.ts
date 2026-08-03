// 주간 배틀 랭킹 공용 로직 — 냥줍 lib/ranking.ts 이식 (2026-08-04 P4).
// 실시간 조회(/api/catch/battle/ranking)와 주간 정산 크론(/api/cron/catch-ranking-settle)이
// 반드시 같은 주 경계·같은 점수 규칙을 쓰도록 lib로 고정 (냥줍 2026-07-15 감사 교훈).
//
// 주 경계 = KST(UTC+9, DST 없음) 월요일 00:00. 서버 로컬 타임존에 기대지 않고
// epoch 산술로만 계산해 어디서 실행해도(로컬 dev·Vercel·테스트) 결과가 같다.

const KST_OFFSET_MS = 9 * 3600 * 1000;
const WEEK_MS = 7 * 24 * 3600 * 1000;

/** now가 속한 주의 시작(월요일 00:00 KST)을 UTC Date로 반환. */
export function weekStartUtc(now: Date = new Date()): Date {
  // now에 +9h를 더한 뒤 UTC 필드로 읽으면 그 값이 곧 KST 벽시계.
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  const daysSinceMonday = (kst.getUTCDay() + 6) % 7; // 월=0 … 일=6
  const mondayKstMidnight = Date.UTC(
    kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate() - daysSinceMonday,
  );
  return new Date(mondayKstMidnight - KST_OFFSET_MS);
}

/** 이번 주 시작 ISO — 랭킹 라우트가 catch_battles.created_at >= 이 값으로 집계. */
export function thisMondayKstISO(now: Date = new Date()): string {
  return weekStartUtc(now).toISOString();
}

/** 주 식별 키 = 그 주 월요일의 KST 날짜(YYYY-MM-DD). catch_ranking_settlements.week_key로 사용. */
export function weekKeyOf(weekStart: Date): string {
  return new Date(weekStart.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/** 지난주 [시작, 끝) 반개구간과 멱등 키. 끝 = 이번 주 시작. KST는 DST가 없어 한 주는 항상 정확히 7일. */
export function lastWeekRange(now: Date = new Date()): { startISO: string; endISO: string; weekKey: string } {
  const end = weekStartUtc(now);
  const start = new Date(end.getTime() - WEEK_MS);
  return { startISO: start.toISOString(), endISO: end.toISOString(), weekKey: weekKeyOf(start) };
}

export interface BattleRow {
  challenger_id: string | null;
  opponent_id: string | null;
  winner_id: string | null;
}

export interface RankEntry {
  userId: string;
  score: number;
  wins: number;
  losses: number;
}

/**
 * 참가자별 승 3점 / 패 1점 집계 후 점수 내림차순 정렬.
 * 동점은 첫 등장(먼저 배틀한) 순 — sort는 안정 정렬이라 Map 삽입 순서가 유지되고,
 * 실시간 랭킹 페이지와 정산이 같은 함수를 쓰므로 유저가 본 순위 그대로 지급된다.
 */
export function rankBattleScores(rows: BattleRow[]): RankEntry[] {
  const scoreMap = new Map<string, { wins: number; losses: number }>();
  for (const row of rows) {
    const uids = new Set([row.challenger_id, row.opponent_id].filter((v): v is string => !!v));
    for (const uid of uids) {
      const cur = scoreMap.get(uid) ?? { wins: 0, losses: 0 };
      if (row.winner_id === uid) cur.wins += 1; else cur.losses += 1;
      scoreMap.set(uid, cur);
    }
  }
  return Array.from(scoreMap, ([userId, s]) => ({
    userId,
    score: s.wins * 3 + s.losses * 1,
    wins: s.wins,
    losses: s.losses,
  })).sort((a, b) => b.score - a.score);
}

// ── 배틀 보상 상수 (냥줍 lib/shop-config.ts 이식 — city shop-config는 배틀과 무관해
//    여기(catch 전용 순수 모듈)에 둔다. 지급은 전부 서버 라우트 + increment_coins) ──

/** PVP/일반 PVE 배틀 코인 — 이겨도 져도 조금은 받는다(참가 보상) */
export const COINS_BATTLE_WIN = 3;
export const COINS_BATTLE_LOSE = 1;
export const COINS_BATTLE_DRAW = 2; // 승/패의 중간

/** 진짜 보스(고양이학대범) 격퇴 보상 — 일반 야생동물보다 크게 */
export const COINS_BOSS_WIN = 8;
export const COINS_BOSS_LOSE = 1;
export const COINS_BOSS_DRAW = 3;

/** 주간 랭킹 TOP 10 정산 코인 — 1위부터 순서대로. 랭킹 페이지 표기와 정산 크론의 단일 소스 */
export const WEEKLY_RANK_REWARDS = [200, 150, 120, 100, 80, 60, 50, 40, 30, 20];
