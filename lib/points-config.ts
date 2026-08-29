// 포인트(1P=1원) 사용 정책 — 한 곳에서 관리.
// 체크아웃 UI(shop/checkout), 주문 생성(order-repo), 결제 승인 서버 검증(payment/confirm)이
// 전부 이 값을 공유해야 함. 서버 검증(payment/confirm)이 최종 관문.

// 주문당 포인트 사용 한도 — 주문 금액(상품+배송)의 10%까지.
// 포인트는 실돈 부채라 한 주문에서 전액 소진되면 매출 대비 할인 비중이 커짐 → 상한으로 방어.
// 0.3→0.1 (2026-08-20, D-day 게이트 5): 30%는 상시 30% 할인과 같아 유일 흑자 상품(에코백)
// 이익 7,900→2,684원으로 깎였다. 10%면 에코백 기준 이익 > 0 유지.
export const POINTS_MAX_USE_RATE = 0.1;

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

// ── 구매 적립 (2026-08-30) — 산 만큼 포인트로 돌려주는 즉각 보상. 등급별 차등.
// 결제 성공 시 결제액(payment_amount)의 tier% 를 적립. 회원만(게스트는 지갑 없음).
// 등급 기준 = 이 유저의 과거 결제완료 주문 수. 실돈 부채라 요율은 보수적으로.
export const PURCHASE_REWARD_TIERS: { minPastOrders: number; rate: number; label: string }[] = [
  { minPastOrders: 10, rate: 0.05, label: "VIP" },
  { minPastOrders: 3, rate: 0.03, label: "단골" },
  { minPastOrders: 0, rate: 0.02, label: "기본" },
];

/** 과거 결제완료 주문 수 → 적립 등급·요율 (내림차순 첫 매치). */
export function purchaseRewardTier(pastPaidOrders: number): { rate: number; label: string } {
  for (const t of PURCHASE_REWARD_TIERS) {
    if (pastPaidOrders >= t.minPastOrders) return { rate: t.rate, label: t.label };
  }
  return { rate: PURCHASE_REWARD_TIERS[PURCHASE_REWARD_TIERS.length - 1].rate, label: "기본" };
}

/** 결제액 × 요율 → 적립 포인트(원 단위 내림). */
export function purchaseRewardPoints(payAmount: number, rate: number): number {
  if (!Number.isFinite(payAmount) || payAmount <= 0) return 0;
  return Math.floor(payAmount * rate);
}
