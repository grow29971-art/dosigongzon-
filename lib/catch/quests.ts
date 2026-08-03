// 주간 의뢰 — "이번 주엔 이런 플레이를 해보라" (포획·쓰다듬기에 방향성 부여).
// 냥줍 lib/quests.ts 이식 (2026-08-04 P3). ISO 주차에서 결정적으로 뽑으므로
// 서버/클라 계산이 항상 일치하고 의뢰 정의용 DB가 필요 없다.
//
// [냥줍 2026-07-15 감사 교훈 계승] **판정 코드가 라우트에 연결되지 않은 의뢰는
// 풀에 넣지 않는다.** city가 실제로 발행하는 이벤트는 두 가지뿐:
//   capture — app/api/catch/capture (로밍 포획 성공)
//   pet     — app/api/catch/pet (하루 1회 쿨다운 통과분만)
// 냥줍의 photo-1(실사 촬영)·reunion-1(재회)은 해당 라우트가 없어 제외했다.
// 재회를 이식(P4+)하면 그때 의뢰도 함께 복원할 것.
//
// 진행도 저장 — catch_profiles.quest_week 한 컬럼(냥줍 last_quest_week 인코딩 그대로):
//   "2026-W32"    → 이번 주 의뢰 완료(보상 지급됨)
//   "2026-W32:1"  → 이번 주 1회 진행(다회 의뢰의 중간 상태)
// 서버측 지급 훅은 lib/catch/quest-server.ts의 applyQuestEvent 참조.

export const QUEST_REWARD_COINS = 100;

/** 의뢰 판정용 서버측 이벤트 — 각 보상 라우트가 성공 직후 발행한다 */
export type QuestEvent =
  | {
      type: "capture";
      /** 종 키 (lib/catch/spawn-species.ts key) */
      speciesKey?: string | null;
      /** 최종 카드 등급 (common/uncommon/rare/legendary — 완벽 포획 승급 반영값) */
      rarity?: string | null;
      isPerfect?: boolean;
    }
  | { type: "pet" }; // 내 냥이 쓰다듬기 성공 (카드당 하루 1회 쿨다운 통과분만)

export interface WeeklyQuest {
  id: string;
  title: string;     // 의뢰 문구
  emoji: string;
  /** 주간 목표 횟수 — 1이면 한 번에 완료 */
  target: number;
  /** 이 이벤트가 의뢰 진행에 해당하는가 */
  matches: (e: QuestEvent) => boolean;
}

// 종 지정 의뢰는 스폰 확률이 높은 common 종만 — uncommon+ 종을 지정하면
// 주간 달성이 운에 좌우된다. 종 키·이름은 lib/catch/spawn-species.ts 기준.
export const QUEST_POOL: WeeklyQuest[] = [
  {
    id: "catch-allblack", emoji: "🖤", title: "이번 주 까망냥 포획하기", target: 1,
    matches: e => e.type === "capture" && e.speciesKey === "allblack",
  },
  {
    id: "catch-cheese", emoji: "🧡", title: "이번 주 치즈냥 포획하기", target: 1,
    matches: e => e.type === "capture" && e.speciesKey === "cheese",
  },
  {
    id: "catch-mackerel", emoji: "🐟", title: "이번 주 고등어냥 포획하기", target: 1,
    matches: e => e.type === "capture" && e.speciesKey === "mackerel",
  },
  {
    id: "catch-tuxedo", emoji: "🤵", title: "이번 주 턱시도냥 포획하기", target: 1,
    matches: e => e.type === "capture" && e.speciesKey === "tuxedo",
  },
  {
    // "희귀" = RARITY_LABEL의 uncommon 이상 (승급 카드도 인정 — 최종 등급 기준)
    id: "catch-uncommon", emoji: "💎", title: "희귀 등급 이상 냥이 포획하기", target: 1,
    matches: e => e.type === "capture" && !!e.rarity && e.rarity !== "common",
  },
  {
    id: "perfect-2", emoji: "🎯", title: "완벽 포획 2번 성공하기", target: 2,
    matches: e => e.type === "capture" && e.isPerfect === true,
  },
  {
    id: "catch-3", emoji: "🐾", title: "냥이 3마리 포획하기", target: 3,
    matches: e => e.type === "capture",
  },
  {
    id: "pet-3", emoji: "💗", title: "내 냥이 3번 쓰다듬어주기", target: 3,
    matches: e => e.type === "pet",
  },
];

/** ISO 주차 키 — 예: "2026-W32" (KST 기준) */
export function currentWeekKey(now: Date = new Date()): string {
  const kst = new Date(now.getTime() + 9 * 3600_000);
  // ISO 8601 주차 계산 (목요일 기준)
  const d = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** 이번 주의 의뢰 — 주차 문자열 해시로 풀에서 결정적으로 선택 */
export function currentQuest(now: Date = new Date()): WeeklyQuest {
  const key = currentWeekKey(now);
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return QUEST_POOL[h % QUEST_POOL.length];
}

/** 이번 주 의뢰 완료 여부 — 순수 주차 키와 일치할 때만 (진행 중 "W32:1"은 미완료) */
export function isQuestDoneThisWeek(
  questWeek: string | null | undefined,
  weekKey: string = currentWeekKey(),
): boolean {
  return questWeek === weekKey;
}

/** 이번 주 진행 횟수 — "2026-W32:2" → 2. 완료됐거나 다른 주 기록이면 0. */
export function questProgressCount(
  questWeek: string | null | undefined,
  weekKey: string = currentWeekKey(),
): number {
  if (!questWeek || !questWeek.startsWith(`${weekKey}:`)) return 0;
  const n = Number(questWeek.slice(weekKey.length + 1));
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** 다회 의뢰의 중간 진행도 저장 값 — 예: encodeQuestProgress("2026-W32", 1) → "2026-W32:1" */
export function encodeQuestProgress(weekKey: string, count: number): string {
  return `${weekKey}:${count}`;
}
