// ══════════════════════════════════════════
// P4 돌봄팀 통합 — 순수 섹션 계약 모듈
// 설계: box/개발일지_20260726_핵심여정개편.md P4
//
// 목표: 서클(돌봄 서클) · 동네 채팅 · 고양이 커뮤니티를 하나의 "돌봄팀" 화면으로
//   묶어 보여주기 위한 섹션 순서/식별 계약을 순수 함수로 고정한다.
//   React/DB import 금지 — 클라·서버가 같은 계약을 공유한다.
//
// 불변식(변경 금지):
//  - 기존 URL 보존: 각 섹션은 기존 경로(href)를 그대로 가리킨다. 새 라우트를
//    만들지 않으며 데이터/스키마 변경도 없다. P4는 "묶어 보여주기"일 뿐이다.
//  - 순서 고정: 돌봄 서클 → 동네 채팅 → 고양이 커뮤니티. 회귀 테스트로 고정.
//  - fail-safe: 알 수 없는 key 조회는 undefined를 반환하고 예외를 던지지 않는다.
// ══════════════════════════════════════════

export type CareTeamSectionKey = "circle" | "neighborhood" | "community";

export interface CareTeamSection {
  key: CareTeamSectionKey;
  /** 화면 표기용 한국어 라벨 */
  label: string;
  /** 짧은 설명 — 각 섹션이 무엇인지 한 줄 */
  description: string;
  /** 기존 경로. 새 URL을 만들지 않고 현재 라우트를 그대로 가리킨다. */
  href: string;
}

// 통합 화면의 고정 순서. 돌봄에 가장 밀접한 서클을 먼저, 넓은 커뮤니티를 뒤로.
export const CARE_TEAM_SECTIONS: readonly CareTeamSection[] = [
  {
    key: "circle",
    label: "돌봄 서클",
    description: "함께 돌보는 이웃과 교대·기록을 나눠요",
    href: "/circle",
  },
  {
    key: "neighborhood",
    label: "동네 채팅",
    description: "같은 동네 이웃과 실시간으로 이야기해요",
    href: "/map",
  },
  {
    key: "community",
    label: "고양이 커뮤니티",
    description: "동네 고양이 소식과 글을 함께 봐요",
    href: "/community",
  },
] as const;

/** 통합 화면에 그릴 섹션 순서(불변 계약). 항상 새 배열을 반환한다. */
export function careTeamSections(): CareTeamSection[] {
  return CARE_TEAM_SECTIONS.map((section) => ({ ...section }));
}

/**
 * key로 섹션 하나를 찾는다. own property만 조회해 프로토타입 키
 * (toString 등)에 안전하며, 없으면 undefined를 반환한다(예외 없음).
 */
export function findCareTeamSection(
  key: string | null | undefined,
): CareTeamSection | undefined {
  if (typeof key !== "string") return undefined;
  return CARE_TEAM_SECTIONS.find((section) => section.key === key);
}

/**
 * href(현재 경로)로 통합 화면 섹션을 찾는다. 링크 대상 페이지가 돌봄팀
 * 하위 섹션 중 어디에 있는지 판별해 강조 표시 등에 쓸 수 있다.
 * - 쿼리스트링/해시(`/map?foo`, `/circle#bar`)는 경로 부분만 비교한다.
 * - 끝의 슬래시(`/circle/`)는 무시하고 계약 경로와 같게 취급한다.
 * - 알 수 없는 경로·비문자열은 undefined를 반환하고 예외를 던지지 않는다.
 * - 새 URL을 만들지 않으며 계약의 href만 참조한다(불변식 유지).
 */
export function careTeamSectionByHref(
  href: string | null | undefined,
): CareTeamSection | undefined {
  if (typeof href !== "string") return undefined;
  const rawPath = href.split(/[?#]/, 1)[0];
  if (!rawPath) return undefined;
  // 끝 슬래시 정규화: `/circle/` → `/circle` (루트 `/`는 그대로 둔다).
  const path =
    rawPath.length > 1 ? rawPath.replace(/\/+$/, "") || "/" : rawPath;
  return CARE_TEAM_SECTIONS.find((section) => section.href === path);
}
