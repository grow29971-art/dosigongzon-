// ══════════════════════════════════════════
// 도시공존 — 다마고치형 케어 시스템 순수 모듈 (2026-07-16)
// 냥줍(스핀오프)에서 검증된 설계 이식. React/DB import 금지 — 클라·서버가 같은 함수 사용.
//
// 설계 철학 (변경 금지):
// - 크론 없는 lazy decay: 게이지 값을 저장하지 않는다. "기준 타임스탬프"만 저장하고
//   읽는 쪽이 경과 시간으로 현재값을 계산한다. 서버 부담 0, 크론 0.
// - 죄책감보다 귀여움: 방치 페널티는 "시무룩"까지. 죽음·질병·가출 없음.
// - 부분 회복은 역함수(gaugeTs)로: "+38 회복"도 새 컬럼 없이 타임스탬프 하나로 표현.
//
// ⚠️ 도시공존 특수성: 케어 대상이 '실존 등록 고양이(대표묘)'라서, UI 문구는
//   "실제 아이 상태가 아닌 우리 둘만의 다마고치"임이 드러나야 한다 (오해 방지).
// ══════════════════════════════════════════

// ── 상수 ──
export const FEED_LIMIT_PER_DAY = 3;     // 하루 무료 급여 한도
export const FEED_FULLNESS_GAIN = 38;    // 급여 1회 회복량 (기본 55 + 38 = 93, 만점엔 2회)
export const FEED_MOOD_GAIN = 12;        // 급여의 기분 소폭 회복 (밥도 케어니까)
export const FEED_EXP = 3;               // 급여 카드 EXP — 실물 돌봄기록 보상보다 낮게 유지
export const FULLNESS_DECAY_HOURS = 24;  // 포만감 100→0 선형 감쇠
export const MOOD_DECAY_HOURS = 48;      // 기분은 이틀에 걸쳐 천천히
export const CLEANLINESS_DECAY_HOURS = 36; // 청결 — 밥(24)보다 느리고 기분(48)보다 빠르게, 하루 반이면 청소 타이밍
export const CARE_DEFAULT_GAUGE = 55;    // 타임스탬프 null(처음 만난 상태)의 기본값
export const FEED_FULL_BLOCK = 95;       // 이 이상이면 급여 거절 (이미 배부름)
export const PLAY_MOOD_GAIN = 22;        // 놀아주기 기분 회복 (한도·보상 없음 — 게이지만, 파밍 불가)
export const CLEAN_MOOD_GAIN = 6;        // 치워주면 개운해서 기분도 소폭
export const POOP_THRESHOLD = 55;        // 청결이 이 밑이면 바닥에 오브젝트(💩·🍂) 등장
export const POOP_MAX = 3;               // 화면에 최대 3개

// ── 게이지 계산 (lazy decay) ──

function gaugeAt(ts: string | null, decayHours: number, now?: number): number {
  if (!ts) return CARE_DEFAULT_GAUGE;
  const base = new Date(ts).getTime();
  if (!Number.isFinite(base)) return CARE_DEFAULT_GAUGE;
  const elapsed = (now ?? Date.now()) - base;
  const value = 100 - (elapsed / (decayHours * 3_600_000)) * 100;
  return Math.max(0, Math.min(100, value));
}

/** fedAt 시점 100에서 24h 선형 감쇠한 현재 포만감. null → 55. */
export function fullnessAt(fedAt: string | null, now?: number): number {
  return gaugeAt(fedAt, FULLNESS_DECAY_HOURS, now);
}

/** moodTs 시점 100에서 48h 선형 감쇠한 현재 기분. null → 55. */
export function moodAt(moodTs: string | null, now?: number): number {
  return gaugeAt(moodTs, MOOD_DECAY_HOURS, now);
}

/** cleanedAt 시점 100에서 36h 선형 감쇠한 현재 청결. null → 55. */
export function cleanlinessAt(cleanedAt: string | null, now?: number): number {
  return gaugeAt(cleanedAt, CLEANLINESS_DECAY_HOURS, now);
}

/**
 * 청결도에 따라 바닥에 보일 오브젝트(💩·🍂) 개수. 순수 UI 파생값 — DB 저장 안 함.
 * 55 이상=0개, 낮아질수록 최대 3개. 청소 액션(cleaned_at=now)으로 0으로.
 */
export function poopCount(cleanliness: number): number {
  if (cleanliness >= POOP_THRESHOLD) return 0;
  // 55→0 구간을 3등분: <55 1개, <37 2개, <18 3개
  const below = POOP_THRESHOLD - cleanliness;      // 0..55
  const step = POOP_THRESHOLD / POOP_MAX;          // ~18.3
  return Math.min(POOP_MAX, Math.floor(below / step) + 1);
}

/**
 * 역함수: "그 값을 만드는 가상의 만점 시각"을 역산해 반환.
 * fullnessAt(gaugeTs(70, 24)) === 70. 부분 회복을 컬럼 추가 없이 표현하는 열쇠.
 * ⚠️ 급여 성공 시 fed_at = now 로 저장하면 안 됨(항상 100이 되어 +38이 무의미).
 *    반드시 newValue = min(100, 현재값 + GAIN) → fed_at = gaugeTs(newValue, 24).
 */
export function gaugeTs(value: number, decayHours: number, now?: number): string {
  const clamped = Math.max(0, Math.min(100, value));
  const backMs = ((100 - clamped) / 100) * decayHours * 3_600_000;
  return new Date((now ?? Date.now()) - backMs).toISOString();
}

// ── 게임의 하루 (도시공존 규약: KST 자정 경계) ──

/** KST 기준 날짜 번호 (에폭 이후 일수). fed_day/pet_day 게이트용. */
export function currentCareDay(now?: number): number {
  return Math.floor(((now ?? Date.now()) + 9 * 3_600_000) / 86_400_000);
}

// ── 상태 판정 (5단계) ──

export type CareStateKey = "messy" | "lonely" | "hungry" | "sulky" | "excited" | "calm";

// 캐릭터 표정 — 씬 컴포넌트가 이 값으로 눈/입 모양을 바꾼다.
export type CareFace = "happy" | "calm" | "hungry" | "pouty";

export interface CareState {
  key: CareStateKey;
  emoji: string;
  label: string;
  line: string; // 귀여운 한 줄 — 죄책감 주는 표현 금지 ("굶는다" 류 금지)
  face: CareFace;
}

/**
 * 상태 판정. cleanliness는 선택 인자(기본 100) — 마이그레이션 전/미전달 시 청결 무시.
 * 우선순위: 꾀죄죄(청소) > 그리움 > 밥 > 시무룩 > 신남 > 평온.
 * 어떤 최저 상태도 "아픔·굶주림"이 아닌 회복 가능한 순한 상태로 표현(실존묘 오해 방지).
 */
export function careState(fullness: number, mood: number, cleanliness = 100): CareState {
  if (cleanliness < 35) {
    return { key: "messy", emoji: "🫧", label: "꾀죄죄", line: "주변이 꾀죄죄해요. 치워주면 개운할 거예요!", face: "pouty" };
  }
  if (fullness < 35 && mood < 35) {
    return { key: "lonely", emoji: "🥺", label: "그리움", line: "오랜만이에요… 밥 한 끼랑 쓰담 한 번이면 금방 신나요!", face: "pouty" };
  }
  if (fullness < 35) {
    return { key: "hungry", emoji: "🍚", label: "밥 시간", line: "슬슬 밥 시간이에요! 간단한 한 끼 어때요?", face: "hungry" };
  }
  if (mood < 35) {
    return { key: "sulky", emoji: "😿", label: "시무룩", line: "살짝 심심해요… 쓰다듬거나 놀아주면 금방 풀려요", face: "pouty" };
  }
  if (fullness >= 70 && mood >= 70 && cleanliness >= 70) {
    return { key: "excited", emoji: "😸", label: "신남", line: "기분 최고! 골골송이 절로 나와요 🎶", face: "happy" };
  }
  return { key: "calm", emoji: "😺", label: "평온", line: "느긋하게 그루밍하며 쉬는 중이에요", face: "calm" };
}

// ── 성장 단계 ──
// ⚠️ 이 앱의 카드 레벨 커브는 Lv1~10 (checkin/battle computeLevel 공통 thresholds 10개).
//    냥줍(12·18 도달 불가 함정)과 달리 전 단계가 커브 안에 있도록 Lv9까지만 사용.

export interface GrowthStage {
  minLevel: number;
  name: string;
  emoji: string;
}

export const GROWTH_STAGES: GrowthStage[] = [
  { minLevel: 1, name: "아기냥", emoji: "🐣" },
  { minLevel: 3, name: "개구쟁이", emoji: "😼" },
  { minLevel: 5, name: "어른냥", emoji: "😺" },
  { minLevel: 7, name: "의젓냥", emoji: "😽" },
  { minLevel: 9, name: "전설냥", emoji: "👑" },
];

export function growthStage(level: number): GrowthStage {
  let stage = GROWTH_STAGES[0];
  for (const s of GROWTH_STAGES) {
    if (level >= s.minLevel) stage = s;
  }
  return stage;
}
