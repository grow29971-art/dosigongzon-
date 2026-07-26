export const DISCOVERY_RECORD_STEPS = [
  { id: "location", label: "발견 위치" },
  { id: "identity", label: "기본 정보" },
  { id: "visibility", label: "공개 범위" },
] as const;

export type DiscoveryRecordStep = (typeof DISCOVERY_RECORD_STEPS)[number]["id"];

export function getDiscoveryRecordStepIndex(step: DiscoveryRecordStep): number {
  return DISCOVERY_RECORD_STEPS.findIndex(({ id }) => id === step);
}

export function getAdjacentDiscoveryRecordStep(
  step: DiscoveryRecordStep,
  direction: "next" | "previous",
): DiscoveryRecordStep {
  const currentIndex = getDiscoveryRecordStepIndex(step);
  const offset = direction === "next" ? 1 : -1;
  const nextIndex = Math.min(
    DISCOVERY_RECORD_STEPS.length - 1,
    Math.max(0, currentIndex + offset),
  );

  return DISCOVERY_RECORD_STEPS[nextIndex].id;
}
