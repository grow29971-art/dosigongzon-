// 핵심 여정 개편 P1 — "중복 안내 단일 3단계 온보딩"의 순수 로직 레이어.
//
// 기존 온보딩 안내는 MapIntroSheet 1장 + 홈의 여러 유도 배너(지역설정·첫밥·둘러보기)로
// 흩어져 있었다. 이 모듈은 온보딩 안내의 "단일 진실원본(canonical 3-step)"과,
// 같은 안내가 여러 진입면에서 중복 노출되지 않도록 걸러 주는 순수 함수만 담는다.
// UI·flag·URL·데이터는 여기서 건드리지 않는다(라이브러리 우선, 이후 화면에서 소비).

// 온보딩 3단계의 안정적 식별자. UI 문구가 바뀌어도 키는 유지한다.
export type OnboardingStepKey = "explore" | "care" | "protect";

export interface OnboardingStep {
  key: OnboardingStepKey;
  /** 이 단계가 안내하는 대표 in-app 경로 (앱 내부 절대경로만). */
  href: string;
}

// 단일 3단계 정의 — 순서가 곧 노출 우선순위다.
// 1) explore: 지도에서 우리 동네 고양이 둘러보기
// 2) care:    내 아이 밥/돌봄 기록 남기기
// 3) protect: 보호지침·응급 안내
const CANONICAL_ONBOARDING_STEPS: readonly OnboardingStep[] = [
  { key: "explore", href: "/map" },
  { key: "care", href: "/mypage" },
  { key: "protect", href: "/protection" },
] as const;

/** 방어 복사본으로 3단계 정의를 반환한다(호출부가 배열을 변형해도 원본 불변). */
export function onboardingSteps(): OnboardingStep[] {
  return CANONICAL_ONBOARDING_STEPS.map((s) => ({ ...s }));
}

/** 유효한 온보딩 단계 키인지 판별한다. */
export function isOnboardingStepKey(value: unknown): value is OnboardingStepKey {
  return (
    value === "explore" || value === "care" || value === "protect"
  );
}

/**
 * 이미 안내(노출)된 단계 키 집합을 받아, 아직 안내하지 않은 단계만 정규 순서대로 돌려준다.
 * 여러 진입면에서 같은 온보딩 안내가 중복 노출되는 것을 막는 fail-safe 필터.
 * - shown 에 담긴 알 수 없는 값은 무시한다.
 * - 중복 shown 키는 한 번만 반영된다.
 */
export function pendingOnboardingSteps(
  shown: Iterable<string> = [],
): OnboardingStep[] {
  const seen = new Set<OnboardingStepKey>();
  for (const raw of shown) {
    if (isOnboardingStepKey(raw)) seen.add(raw);
  }
  return onboardingSteps().filter((step) => !seen.has(step.key));
}

/** 모든 3단계 안내가 끝났는지(=더 이상 노출할 단계가 없는지) 여부. */
export function isOnboardingComplete(shown: Iterable<string> = []): boolean {
  return pendingOnboardingSteps(shown).length === 0;
}
