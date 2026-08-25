// ══════════════════════════════════════════
// 택배사 목록 + 배송 조회 링크 (2026-08-25)
// 택배사별 공식 조회 페이지는 URL이 자주 바뀌어 링크가 죽기 쉬우므로,
// 네이버 검색(운송장 조회 위젯이 뜬다)으로 일관되게 연결한다 — 유지보수 0.
// 실시간 API(스마트택배 등)로 앱 안에서 보여주는 건 키 발급이 필요해서 보류.
// ══════════════════════════════════════════

export const COURIERS = [
  "CJ대한통운",
  "우체국택배",
  "한진택배",
  "롯데택배",
  "로젠택배",
  "기타",
] as const;

export type Courier = (typeof COURIERS)[number];

export function trackingSearchUrl(courier: string | null | undefined, trackingNumber: string): string {
  const query = courier && courier !== "기타"
    ? `${courier} 운송장 ${trackingNumber}`
    : `운송장번호 조회 ${trackingNumber}`;
  return `https://search.naver.com/search.naver?query=${encodeURIComponent(query)}`;
}
