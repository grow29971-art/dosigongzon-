// 여정 A(신규 7일) 순수 로직 — DB·네트워크 없이 테스트 가능하게 분리.
// 설계: city-marketing/reports/2026-09-29_growth-design.md 3절. 크론: app/api/cron/journey.

export type JourneyStep = "welcome" | "d1" | "d3" | "d7";

export const JOURNEY_NAME = "A";
export const HOLDOUT_MOD = 10; // 10% 대조군
const DAY_MS = 864e5;

// 순서가 곧 진행 순서. minDay 이상이면 "도래".
const STEPS: readonly { step: JourneyStep; minDay: number }[] = [
  { step: "welcome", minDay: 0 },
  { step: "d1", minDay: 1 },
  { step: "d3", minDay: 3 },
  { step: "d7", minDay: 7 },
];

/** user_id 기반 안정 해시(FNV-1a) — 같은 사람은 항상 같은 군. */
export function isHoldout(userId: string): boolean {
  let h = 0x811c9dc5;
  for (let i = 0; i < userId.length; i++) {
    h ^= userId.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h % HOLDOUT_MOD === 0;
}

export function journeyDay(createdAt: string | Date, now: Date = new Date()): number {
  return Math.floor((+now - +new Date(createdAt)) / DAY_MS);
}

/**
 * 이번 실행에서 보낼 단계 1개(도래한 것 중 가장 늦은 것)와, 그보다 앞서 놓친 단계(skipped)를 고른다.
 * done 에 이미 기록된 단계는 제외 — 폭탄 발송 없이 하루 최대 1통.
 */
export function planJourney(input: {
  userId: string;
  createdAt: string | Date;
  now?: Date;
  done?: Iterable<string>;
}): { holdout: boolean; day: number; send: JourneyStep | null; skipped: JourneyStep[] } {
  const day = journeyDay(input.createdAt, input.now);
  const done = new Set(input.done ?? []);
  const due = STEPS.filter((s) => day >= s.minDay && !done.has(s.step)).map((s) => s.step);
  const send = due.length ? due[due.length - 1] : null;
  return { holdout: isHoldout(input.userId), day, send, skipped: due.slice(0, -1) };
}

/** 단계별 문구·링크. 정보성 안내 톤(해요체, 광고 아님, 느낌표·이모지 없음). */
export function journeyMessage(
  step: JourneyStep,
  ctx: { hasCat: boolean; catId?: string | null },
): { title: string; body: string; url: string } {
  if (step === "welcome") {
    return {
      title: "우리 동네 고양이 지도",
      body: "가까운 곳에 사는 길고양이를 지도에서 확인해 보세요. 이웃이 남긴 기록도 볼 수 있어요.",
      url: "/map",
    };
  }
  if (step === "d7") {
    return {
      title: "같이 돌볼 이웃 초대",
      body: "함께 돌보면 기록을 나눠서 남길 수 있어요. 이웃을 초대해 보세요.",
      url: "/mypage/circle",
    };
  }
  // d1·d3: 고양이가 있으면 첫 기록, 없으면 등록 유도(기록은 고양이 상세에서만 남길 수 있다)
  if (ctx.hasCat && ctx.catId) {
    return {
      title: "첫 밥 기록 30초",
      body: "오늘 챙겨 준 밥을 남겨 보세요. 30초면 충분해요.",
      url: `/cats/${ctx.catId}`,
    };
  }
  return {
    title: "우리 동네 아이 등록해 보기",
    body: "동네에서 자주 만나는 아이가 있나요? 지도에서 1분이면 등록할 수 있어요.",
    url: "/map?add=1",
  };
}
