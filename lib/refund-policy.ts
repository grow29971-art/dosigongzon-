// ══════════════════════════════════════════
// 환불(청약철회) 정책 — 순수 로직. DB·네트워크 없음.
//
// 이 파일이 유일한 정책 근거다. 유저 화면(주문 상세 버튼 노출), 서버 API(/api/payment/refund),
// 관리자 승인 화면이 전부 이 함수를 공유해야 판정이 갈리지 않는다.
//
// ⚠ 여기 값은 /shop/policy 페이지에 고지된 문구와 **반드시 일치**해야 한다.
//   고지: "받은 날부터 7일 이내"(policy/page.tsx:83), "단순변심은 왕복 배송비 구매자 부담"(:84),
//         "하자·오배송은 배송비 전액 판매자 부담"(:85).
//   고지와 코드가 다르면 그 자체가 전자상거래법 위반 소지다. 한쪽만 고치지 말 것.
// ══════════════════════════════════════════

// 전자상거래법 제17조 1항 — 단순변심 청약철회 기간(공급받은 날부터)
export const WITHDRAWAL_DAYS = 7;

// 같은 법 3항 — 하자·오배송 등 판매자 귀책은 훨씬 길다.
// "안 날부터 30일 / 받은 날부터 3개월" 중 먼저 오는 날. 여기선 보수적으로 받은 날 기준 3개월.
export const DEFECT_CLAIM_DAYS = 90;

// 반품 배송비(단순변심 시 구매자 부담분). products.shipping_fee 기본값과 맞춤.
export const RETURN_SHIPPING_FEE = 3000;

export type RefundReasonCode =
  | "change_of_mind"    // 단순변심
  | "defect"            // 상품 하자
  | "wrong_delivery"    // 오배송
  | "delayed"           // 배송 지연
  | "out_of_stock"      // 품절(판매자 귀책)
  | "admin_discretion"  // 관리자 직권
  | "other";

// 유저 화면·관리자 화면 공용 사유 라벨
export const REFUND_REASON_LABELS: Record<RefundReasonCode, string> = {
  change_of_mind: "단순 변심",
  defect: "상품에 문제가 있어요",
  wrong_delivery: "다른 상품이 왔어요",
  delayed: "배송이 너무 늦어요",
  out_of_stock: "품절 안내를 받았어요",
  admin_discretion: "관리자 직권",
  other: "기타",
};

// 판매자 귀책 = 배송비 판매자 부담 + 기한이 넉넉함
export const SELLER_FAULT_REASONS: RefundReasonCode[] = [
  "defect",
  "wrong_delivery",
  "delayed",
  "out_of_stock",
];

// 가상상품에는 성립할 수 없는 "배송 개념" 사유 (H-1).
// 배송이 없는 상품에 배송지연·오배송을 주장할 수 없으므로, 이 사유로는
// 판매자 귀책 기한(90일)을 적용하지 않는다 — 기한 우회로로 쓰이던 구멍.
export const VIRTUAL_INAPPLICABLE_REASONS: RefundReasonCode[] = [
  "wrong_delivery",
  "delayed",
];

export type OrderStatus =
  | "pending" | "paid" | "preparing" | "shipping" | "delivered" | "cancelled" | "refunded";

export interface RefundOrderInput {
  status: OrderStatus;
  refundStatus: "none" | "requested" | "rejected" | "partial_refunded" | "refunded";
  paymentAmount: number;
  refundAmount: number;        // 이미 환불된 누적액
  paidAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  // 송장이 발급됐는가. status가 아직 배송 전(paid/preparing)이어도 실물이 이미 나갔을 수 있어
  // 자동환불 여부를 가르는 근거가 된다(H-2). shippedAt만으로는 부족하다 —
  // 관리자가 운송장만 입력하고 상태를 안 바꾸면 shipped_at은 null로 남기 때문
  // (shop-admin-repo.ts:230-236은 status가 shipping/delivered로 갈 때만 shipped_at을 채운다).
  hasTracking: boolean;
  hasPhysicalItem: boolean;    // 실물 상품 포함 여부 (재고 복원·회수 필요)
  hasDonationItem: boolean;    // 후원 상품 포함 여부 (공개 집계 차감 필요)
  allVirtual: boolean;         // 전 품목이 가상상품
}

export type RefundDecision =
  | { allowed: true;  mode: "auto";   shippingFeeBearer: "buyer" | "seller" | "none"; returnShippingFee: number; note: string }
  | { allowed: true;  mode: "review"; shippingFeeBearer: "buyer" | "seller" | "none"; returnShippingFee: number; note: string }
  | { allowed: false; reason: string };

function daysSince(iso: string | null, now: number): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return (now - t) / 86_400_000;
}

// 청약철회 기산점 — "공급받은 날". 수령 시각이 없으면 발송 시각, 그것도 없으면 결제 시각.
// (배송 전 단계에서는 애초에 기한 제한이 없으므로 이 값이 쓰이지 않는다)
export function withdrawalBaseDate(o: Pick<RefundOrderInput, "deliveredAt" | "shippedAt" | "paidAt">): string | null {
  return o.deliveredAt ?? o.shippedAt ?? o.paidAt;
}

/**
 * 환불 가능 여부와 처리 방식(즉시 자동 / 관리자 심사)을 판정한다.
 *
 * mode="auto"   — 정책상 다툼의 여지가 없어 즉시 토스 취소까지 진행해도 되는 건.
 * mode="review" — 상품 회수·하자 확인이 필요해 관리자 승인을 거쳐야 하는 건.
 */
export function decideRefund(
  order: RefundOrderInput,
  reasonCode: RefundReasonCode,
  now: number = Date.now(),
): RefundDecision {
  // ── 0. 이미 끝난 주문 ──
  if (order.status === "cancelled") {
    return { allowed: false, reason: "이미 취소된 주문이에요." };
  }
  if (order.status === "refunded" || order.refundStatus === "refunded") {
    return { allowed: false, reason: "이미 환불이 완료된 주문이에요." };
  }
  if (order.status === "pending") {
    return { allowed: false, reason: "아직 결제가 완료되지 않은 주문이에요. 주문 취소를 이용해주세요." };
  }
  if (order.refundStatus === "requested") {
    return { allowed: false, reason: "이미 접수된 환불 요청이 있어요. 처리 결과를 기다려주세요." };
  }
  if (order.refundAmount >= order.paymentAmount) {
    return { allowed: false, reason: "환불 가능한 금액이 남아 있지 않아요." };
  }

  const sellerFault = SELLER_FAULT_REASONS.includes(reasonCode);
  const bearer: "buyer" | "seller" | "none" =
    sellerFault ? "seller" : order.hasPhysicalItem ? "buyer" : "none";
  // 배송 전이면 회수할 물건이 없으므로 반품 배송비도 없다.
  // "실제로 나갔는가"가 기준이라 상태뿐 아니라 송장·발송시각도 함께 본다(H-2와 같은 근거) —
  // 상태만 보면 송장이 나간 주문에서 반품비를 못 물려 판매자가 왕복 배송비를 떠안는다.
  const dispatched = order.hasTracking || !!order.shippedAt;
  const shipped = order.status === "shipping" || order.status === "delivered" || dispatched;
  const returnFee = bearer === "buyer" && shipped ? RETURN_SHIPPING_FEE : 0;

  // ── 1. 전 품목 가상상품 — 배송 개념이 없다 ──
  if (order.allVirtual) {
    // H-1 ①: 배송 개념 사유로 기한을 늘리지 못하게 막는다.
    //   배송지연·오배송은 배송이 없는 가상상품엔 성립할 수 없는 사유인데, 둘 다
    //   SELLER_FAULT_REASONS에 있어 예전엔 sellerFault로 분류돼 7일 기한 체크 자체를
    //   건너뛰었다(= 유저가 사유만 바꾸면 무기한 즉시환불). 이 우회로를 닫는다.
    //   단 진짜 하자(defect)·품절(out_of_stock)은 가상상품에도 성립하므로 법정 기한
    //   (전자상거래법 제17조 3항 → DEFECT_CLAIM_DAYS)을 그대로 인정한다. 여기서 7일로
    //   깎으면 법정 기간을 축소하는 약관이 되어 그 자체가 위법 소지다.
    const d = daysSince(order.paidAt, now);
    const virtualLimit = sellerFault && !VIRTUAL_INAPPLICABLE_REASONS.includes(reasonCode)
      ? DEFECT_CLAIM_DAYS
      : WITHDRAWAL_DAYS;
    if (d !== null && d > virtualLimit) {
      return {
        allowed: false,
        reason: virtualLimit === DEFECT_CLAIM_DAYS
          ? `상품 하자 신고 기한(${DEFECT_CLAIM_DAYS}일)이 지났어요. 고객센터로 문의해주세요.`
          : `가상상품은 결제 후 ${WITHDRAWAL_DAYS}일 이내에만 환불할 수 있어요.`,
      };
    }
    // H-1 ②: 【가상상품 등록 전 필수 선행】 사용 이력 확인이 생기기 전까지 auto 금지.
    //   지금은 사용 여부를 알 수 있는 스키마가 없다(user_items는 보유 수량만 있고
    //   소비 이력·used_at이 없음 — supabase_shop_coins_migration.sql:11-18).
    //   그래서 "이미 써버린 가상상품"도 무인 즉시환불될 수 있어, 관리자 확인으로 내린다.
    //   ⚠ 이 review 고정을 auto로 되돌리려면 아래가 먼저 충족돼야 한다:
    //      1) 가상상품 지급·사용 이력 테이블(또는 user_items.consumed_at) 추가
    //      2) RefundOrderInput에 virtualUsed(또는 usedCount) 전달
    //      3) 미사용이 확인된 건만 auto, 사용분은 review 유지
    //   체크리스트: box/가상상품_등록전_선행조건.md
    //   (현재 가상상품 0건이라 UX 손해 없음. 나중에 누구가 등록해도 안전판이 자동으로 걸린다.)
    return {
      allowed: true, mode: "review", shippingFeeBearer: "none", returnShippingFee: 0,
      note: "가상상품 — 사용 여부 확인 후 환불해요",
    };
  }

  // ── 2. 배송 전(paid/preparing) — 언제든 취소 가능, 위약금 없음 ──
  //    정책 페이지 "배송 시작 전 주문은 주문 상세에서 직접 취소"와 일치시킨다.
  //    (기존 UI는 paid에서만 버튼을 노출해 preparing이 누락돼 있었다)
  if (order.status === "paid" || order.status === "preparing") {
    // ⚠ H-2: 상태는 배송 전이지만 실물이 이미 나간 경우(송장 발급·발송 시각 기록)는
    //   즉시 자동환불이 곧 상품 편취가 된다. 회수 확인이 필요하므로 심사로 내린다.
    //   관리자가 운송장만 입력하고 상태를 안 바꾸는 운영 흐름이 실제로 존재하므로
    //   shippedAt "또는" 송장 유무 둘 다 봐야 한다(admin/orders/page.tsx:120-123).
    if (dispatched) {
      return {
        allowed: true, mode: "review", shippingFeeBearer: bearer, returnShippingFee: returnFee,
        note: "이미 발송된 상품이에요 — 회수 확인 후 환불해요",
      };
    }
    return {
      allowed: true, mode: "auto", shippingFeeBearer: "none", returnShippingFee: 0,
      note: "배송 전 — 전액 환불, 반품 배송비 없음",
    };
  }

  // ── 3. 배송 중 — 물건이 이동 중이라 회수 절차가 필요 ──
  if (order.status === "shipping") {
    return {
      allowed: true, mode: "review", shippingFeeBearer: bearer, returnShippingFee: returnFee,
      note: sellerFault
        ? "배송 중 · 판매자 귀책 — 회수 후 전액 환불"
        : "배송 중 · 단순변심 — 수령 후 반품 절차가 필요해요",
    };
  }

  // ── 4. 배송 완료 — 기한 판정 ──
  if (order.status === "delivered") {
    const base = withdrawalBaseDate(order);
    const d = daysSince(base, now);
    const limit = sellerFault ? DEFECT_CLAIM_DAYS : WITHDRAWAL_DAYS;

    // 기산점을 모르면(배송 시각 미기록) 유저에게 불리하게 판정하지 않는다 — 심사로 넘긴다.
    if (d === null) {
      return {
        allowed: true, mode: "review", shippingFeeBearer: bearer, returnShippingFee: returnFee,
        note: "수령일 기록이 없어 관리자가 기한을 확인해요",
      };
    }
    if (d > limit) {
      return {
        allowed: false,
        reason: sellerFault
          ? `상품 하자 신고 기한(${DEFECT_CLAIM_DAYS}일)이 지났어요. 고객센터로 문의해주세요.`
          : `단순 변심 반품 기한(수령 후 ${WITHDRAWAL_DAYS}일)이 지났어요.`,
      };
    }
    return {
      allowed: true, mode: "review", shippingFeeBearer: bearer, returnShippingFee: returnFee,
      note: sellerFault
        ? "배송 완료 · 판매자 귀책 — 회수 확인 후 전액 환불"
        : `배송 완료 · 단순변심 — 반품 도착 확인 후 환불(반품 배송비 ${returnFee.toLocaleString()}원 차감)`,
    };
  }

  return { allowed: false, reason: "환불할 수 없는 주문 상태예요." };
}

/**
 * 실제 환불할 금액. 단순변심 반품 배송비는 환불액에서 차감한다.
 * 부분환불이면 대상 품목 소계 합에서 차감.
 */
export function refundableAmount(
  itemsSubtotal: number,
  decision: Extract<RefundDecision, { allowed: true }>,
): number {
  return Math.max(0, itemsSubtotal - decision.returnShippingFee);
}

/**
 * 부분환불 후원 차감액 — 품목의 후원 스냅샷을 환불 수량 비율로 나눈다.
 * 반올림이 아니라 **버림**이다: 올리면 누적 차감이 원래 후원액을 넘어
 * 공개 집계가 음수로 갈 수 있다(DB CHECK에도 걸린다).
 */
export function donationDelta(
  donationAmount: number,
  refundQuantity: number,
  totalQuantity: number,
  alreadyRefundedDonation = 0,
): number {
  if (totalQuantity <= 0 || refundQuantity <= 0) return 0;
  const remaining = Math.max(0, donationAmount - alreadyRefundedDonation);
  // 마지막 수량까지 환불하면 잔액을 전부 털어 정확히 0으로 맞춘다(버림 누적 오차 제거).
  if (refundQuantity >= totalQuantity) return remaining;
  return Math.min(remaining, Math.floor((donationAmount * refundQuantity) / totalQuantity));
}

/**
 * 포인트 반환액 — 결제에 쓴 포인트를 환불 비율만큼 돌려준다.
 * 전액환불이면 전액, 부분환불이면 결제액 대비 비율(버림).
 */
export function pointsToRestore(
  pointsUsed: number,
  refundAmount: number,
  paymentAmount: number,
  isFullRefund: boolean,
): number {
  if (pointsUsed <= 0) return 0;
  if (isFullRefund) return pointsUsed;
  if (paymentAmount <= 0) return 0;
  return Math.min(pointsUsed, Math.floor((pointsUsed * refundAmount) / paymentAmount));
}

/**
 * 포인트 반환 원장 reason.
 *
 * ⚠ 전액환불은 기존 취소 경로(/api/payment/cancel, 웹훅 동기화)와 **같은 문자열**을 쓴다.
 *   point_ledger의 unique(user_id, reason)이 유일한 이중반환 방어선인데, 새 경로가
 *   다른 reason을 쓰면 "취소로 한 번 + 환불로 한 번" 두 번 돌려주게 된다.
 *   부분환불은 여러 번 일어날 수 있으므로 환불 건별로 분리한다.
 */
export function pointRefundReason(orderId: string, refundId: string, isFullRefund: boolean): string {
  return isFullRefund ? `order-cancel:${orderId}` : `order-refund:${refundId}`;
}
