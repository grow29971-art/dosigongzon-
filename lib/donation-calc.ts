// ══════════════════════════════════════════
// 후원 적립 공식 — 이익(판매가−매입가) 기준 (2026-08-25, D-day 게이트 9)
// 대외 고지 "수익(이익)의 10%"와 1:1 대응. 이 식은 DB 트리거(enforce_order_item_snapshot)·
// 게스트 RPC(create_guest_order)와 반드시 동일해야 한다 — 한쪽만 다르면
// confirm/webhook의 후원액 교정이 DB 스냅샷과 어긋난다.
// (box/supabase_shop_profit_donation_migration.sql 상단 공식 주석 참조)
//
// 매입가(cost_price)는 마진 정보라 product_costs 테이블에 관리자·서버 전용으로 격리.
// 이 함수는 service_role로 조회한 값으로만 호출된다(클라이언트는 매입가를 모른다).
// ══════════════════════════════════════════

export interface DonationProduct {
  price: number;
  sale_price: number | null;
  is_donation: boolean;
  donation_percent: number;
  /** product_costs.cost_price — 행이 없으면 0 (기존 판매액 기준과 동일해짐) */
  cost_price: number;
}

// PostgREST 임베드(product_costs(cost_price))는 1:1 관계 감지 여부에 따라
// 객체 또는 단일 원소 배열로 온다 — 양쪽 모두 흡수해서 매입가를 꺼낸다.
export type EmbeddedCost = { cost_price: number } | { cost_price: number }[] | null;

export function embeddedCostPrice(pc: EmbeddedCost | undefined): number {
  if (!pc) return 0;
  const row = Array.isArray(pc) ? pc[0] : pc;
  return row?.cost_price ?? 0;
}

export function donationForItem(p: DonationProduct, quantity: number): number {
  if (!p.is_donation) return 0;
  const unit = p.sale_price ?? p.price;
  // 전액 후원 상품은 "결제 금액 전액" — 고지 문구 계약 (매입가와 무관)
  if (p.donation_percent >= 100) return unit * quantity;
  const profitUnit = Math.max(unit - Math.max(p.cost_price, 0), 0);
  return Math.floor((profitUnit * quantity * p.donation_percent) / 100);
}
