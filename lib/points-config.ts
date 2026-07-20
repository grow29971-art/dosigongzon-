// 포인트(1P=1원) 사용 정책 — 한 곳에서 관리.
// 체크아웃 UI(shop/checkout), 주문 생성(order-repo), 결제 승인 서버 검증(payment/confirm)이
// 전부 이 값을 공유해야 함. 서버 검증(payment/confirm)이 최종 관문.

// 주문당 포인트 사용 한도 — 주문 금액(상품+배송)의 30%까지.
// 포인트는 실돈 부채라 한 주문에서 전액 소진되면 매출 대비 할인 비중이 커짐 → 상한으로 방어.
export const POINTS_MAX_USE_RATE = 0.3;

// 토스 최소 결제 금액 — 포인트 사용 후 최종 결제액이 이 밑으로 내려가면 안 됨.
export const POINTS_MIN_REMAINING_PAY = 100;

// 주문 금액(grandTotal = 상품+배송) 기준 사용 가능한 최대 포인트.
// 30% 상한과 "최종 결제액 100원 이상" 두 제약 중 더 낮은 쪽.
export function maxPointsUsable(grandTotal: number): number {
  return Math.max(
    0,
    Math.min(Math.floor(grandTotal * POINTS_MAX_USE_RATE), grandTotal - POINTS_MIN_REMAINING_PAY),
  );
}
