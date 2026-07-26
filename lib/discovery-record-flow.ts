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

export interface DiscoveryCandidate {
  id: string;
  lat: number;
  lng: number;
}

function distanceMeters(
  origin: Pick<DiscoveryCandidate, "lat" | "lng">,
  candidate: Pick<DiscoveryCandidate, "lat" | "lng">,
): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadiusM = 6_371_000;
  const deltaLat = toRadians(candidate.lat - origin.lat);
  const deltaLng = toRadians(candidate.lng - origin.lng);
  const originLat = toRadians(origin.lat);
  const candidateLat = toRadians(candidate.lat);
  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(originLat) *
      Math.cos(candidateLat) *
      Math.sin(deltaLng / 2) ** 2;

  return 2 * earthRadiusM * Math.asin(Math.sqrt(haversine));
}

export function findNearbyDiscoveryCandidates<T extends DiscoveryCandidate>(
  origin: Pick<DiscoveryCandidate, "lat" | "lng">,
  candidates: readonly T[],
  radiusM = 300,
  limit = 3,
): T[] {
  return candidates
    .map((candidate) => ({
      candidate,
      distance: distanceMeters(origin, candidate),
    }))
    .filter(({ distance }) => distance <= radiusM)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit)
    .map(({ candidate }) => candidate);
}
