// 환불 정책 순수 모듈 테스트 — node --test tests/refund-policy.test.mjs
// (.mjs에서 .ts를 직접 import — Node 23.6+ 타입 스트리핑. 빌드·tsc와 무관하게 실행)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  decideRefund,
  refundableAmount,
  donationDelta,
  pointsToRestore,
  pointRefundReason,
  withdrawalBaseDate,
  WITHDRAWAL_DAYS,
  DEFECT_CLAIM_DAYS,
  returnShippingFeeFor,
} from "../lib/refund-policy.ts";

const NOW = Date.UTC(2026, 6, 31, 0, 0, 0); // 2026-07-31
const daysAgo = (d) => new Date(NOW - d * 86_400_000).toISOString();

const base = {
  status: "paid",
  refundStatus: "none",
  paymentAmount: 30000,
  refundAmount: 0,
  paidAt: daysAgo(1),
  shippedAt: null,
  deliveredAt: null,
  hasPhysicalItem: true,
  hasDonationItem: false,
  allVirtual: false,
  hasTracking: false,
  shippingFee: 3000, // 게이트 6(2026-08-20): 반품비는 주문 배송비 연동 — 고정 상수 폐지
};
const order = (o) => ({ ...base, ...o });
// 구매자 부담 반품비 기대값 — 유료배송 주문은 그 배송비(편도), 무료배송은 왕복 실비
const RETURN_FEE = returnShippingFeeFor(base.shippingFee);

// ══════════════════════════════════════════
// 1. 종료된 주문 — 재환불 차단
// ══════════════════════════════════════════
test("이미 취소·환불된 주문은 환불 불가 (재결제 악용 차단)", () => {
  assert.equal(decideRefund(order({ status: "cancelled" }), "change_of_mind", NOW).allowed, false);
  assert.equal(decideRefund(order({ status: "refunded" }), "change_of_mind", NOW).allowed, false);
  assert.equal(decideRefund(order({ refundStatus: "refunded" }), "change_of_mind", NOW).allowed, false);
});

test("결제 전(pending)은 환불이 아니라 주문 취소 경로로 안내", () => {
  const r = decideRefund(order({ status: "pending" }), "change_of_mind", NOW);
  assert.equal(r.allowed, false);
  assert.match(r.reason, /주문 취소/);
});

test("이미 접수된 요청이 있으면 중복 접수 불가", () => {
  assert.equal(decideRefund(order({ refundStatus: "requested" }), "change_of_mind", NOW).allowed, false);
});

test("환불 잔액이 0이면 불가 (부분환불 누적으로 소진된 경우)", () => {
  const r = decideRefund(order({ refundAmount: 30000, refundStatus: "partial_refunded" }), "change_of_mind", NOW);
  assert.equal(r.allowed, false);
  assert.match(r.reason, /남아 있지 않/);
});

// ══════════════════════════════════════════
// 2. 배송 단계별 판정
// ══════════════════════════════════════════
test("배송 전(paid/preparing)은 즉시 전액 환불 · 반품비 없음", () => {
  for (const status of ["paid", "preparing"]) {
    const r = decideRefund(order({ status }), "change_of_mind", NOW);
    assert.equal(r.allowed, true);
    assert.equal(r.mode, "auto");
    assert.equal(r.returnShippingFee, 0);
    assert.equal(r.shippingFeeBearer, "none");
  }
});

// H-2 (2026-08-04): 상태는 배송 전인데 실물이 이미 나간 주문 — 즉시환불하면 상품 편취
test("송장이 발급된 preparing 주문은 자동환불 금지 — 심사로 (H-2)", () => {
  const r = decideRefund(order({ status: "preparing", hasTracking: true }), "change_of_mind", NOW);
  assert.equal(r.allowed, true);
  assert.equal(r.mode, "review");
  assert.match(r.note, /발송/);
});

test("shipped_at만 있고 상태가 paid여도 자동환불 금지 (H-2)", () => {
  const r = decideRefund(order({ status: "paid", shippedAt: daysAgo(1) }), "change_of_mind", NOW);
  assert.equal(r.mode, "review");
});

test("송장 공백 문자열은 발송으로 보지 않는다 — 정상 즉시환불 유지 (H-2 오탐 방지)", () => {
  // hasTracking은 호출측에서 trim해 넘긴다(빈 문자열 → false). 정책은 boolean만 신뢰.
  const r = decideRefund(order({ status: "preparing", hasTracking: false }), "change_of_mind", NOW);
  assert.equal(r.mode, "auto");
});

test("발송된 배송전 주문의 단순변심은 반품비를 구매자가 부담 (H-2 회귀)", () => {
  const r = decideRefund(order({ status: "preparing", hasTracking: true }), "change_of_mind", NOW);
  assert.equal(r.shippingFeeBearer, "buyer");
  assert.equal(r.returnShippingFee, RETURN_FEE);
});

test("발송된 배송전 주문이라도 하자·오배송은 판매자 부담 (H-2 회귀)", () => {
  const r = decideRefund(order({ status: "preparing", hasTracking: true }), "defect", NOW);
  assert.equal(r.mode, "review");
  assert.equal(r.shippingFeeBearer, "seller");
  assert.equal(r.returnShippingFee, 0);
});

test("배송 중은 자동환불 금지 — 회수 필요하므로 심사", () => {
  const r = decideRefund(order({ status: "shipping", shippedAt: daysAgo(1) }), "change_of_mind", NOW);
  assert.equal(r.allowed, true);
  assert.equal(r.mode, "review");
  assert.equal(r.returnShippingFee, RETURN_FEE); // 단순변심 → 구매자 부담
});

test("배송 완료 + 단순변심 + 7일 이내 → 심사 후 환불, 반품비 차감", () => {
  const r = decideRefund(order({ status: "delivered", deliveredAt: daysAgo(3) }), "change_of_mind", NOW);
  assert.equal(r.allowed, true);
  assert.equal(r.mode, "review");
  assert.equal(r.shippingFeeBearer, "buyer");
  assert.equal(r.returnShippingFee, RETURN_FEE);
});

test("배송 완료 + 단순변심 + 7일 초과 → 거부 (청약철회 기간 경과)", () => {
  const r = decideRefund(order({ status: "delivered", deliveredAt: daysAgo(WITHDRAWAL_DAYS + 1) }), "change_of_mind", NOW);
  assert.equal(r.allowed, false);
  assert.match(r.reason, /기한/);
});

test("경계값: 정확히 7일째는 아직 가능", () => {
  const r = decideRefund(order({ status: "delivered", deliveredAt: daysAgo(WITHDRAWAL_DAYS) }), "change_of_mind", NOW);
  assert.equal(r.allowed, true);
});

// ══════════════════════════════════════════
// 3. 판매자 귀책 — 기한이 길고 배송비를 판매자가 부담
// ══════════════════════════════════════════
test("하자·오배송은 판매자 배송비 부담 + 반품비 차감 없음", () => {
  for (const reason of ["defect", "wrong_delivery", "delayed", "out_of_stock"]) {
    const r = decideRefund(order({ status: "delivered", deliveredAt: daysAgo(3) }), reason, NOW);
    assert.equal(r.allowed, true, reason);
    assert.equal(r.shippingFeeBearer, "seller", reason);
    assert.equal(r.returnShippingFee, 0, reason);
  }
});

test("하자는 7일이 지나도 가능 (90일 기한)", () => {
  const r = decideRefund(order({ status: "delivered", deliveredAt: daysAgo(30) }), "defect", NOW);
  assert.equal(r.allowed, true);
});

test("하자도 90일이 지나면 거부", () => {
  const r = decideRefund(order({ status: "delivered", deliveredAt: daysAgo(DEFECT_CLAIM_DAYS + 1) }), "defect", NOW);
  assert.equal(r.allowed, false);
});

// ══════════════════════════════════════════
// 4. 상품 유형별 분기
// ══════════════════════════════════════════
// H-1 ② (2026-08-04): 사용 이력 확인이 생기기 전까지 가상상품 auto 금지 — 하드 가드.
// 이 테스트가 깨진다면 box/가상상품_등록전_선행조건.md의 선행조건이 끝났는지 먼저 확인할 것.
const virtualOrder = (o) => order({ allVirtual: true, hasPhysicalItem: false, ...o });

test("가상상품은 반품비 없이 환불 가능하되 auto가 아니라 review (H-1 하드 가드)", () => {
  const r = decideRefund(virtualOrder({}), "change_of_mind", NOW);
  assert.equal(r.allowed, true);
  assert.equal(r.mode, "review");
  assert.equal(r.returnShippingFee, 0);
  assert.equal(r.shippingFeeBearer, "none");
});

test("가상상품도 7일 지나면 단순변심 거부", () => {
  const r = decideRefund(virtualOrder({ paidAt: daysAgo(WITHDRAWAL_DAYS + 1) }), "change_of_mind", NOW);
  assert.equal(r.allowed, false);
});

test("가상상품은 배송지연 사유로 7일 기한을 우회할 수 없다 (H-1 ①)", () => {
  const r = decideRefund(virtualOrder({ paidAt: daysAgo(WITHDRAWAL_DAYS + 1) }), "delayed", NOW);
  assert.equal(r.allowed, false);
  assert.match(r.reason, /7일/);
});

test("가상상품은 오배송 사유로도 7일 기한을 우회할 수 없다 (H-1 ①)", () => {
  const r = decideRefund(virtualOrder({ paidAt: daysAgo(30) }), "wrong_delivery", NOW);
  assert.equal(r.allowed, false);
});

test("가상상품의 진짜 하자는 법정 기한(90일)을 그대로 인정 — 법정 기간 축소 금지", () => {
  const ok = decideRefund(virtualOrder({ paidAt: daysAgo(30) }), "defect", NOW);
  assert.equal(ok.allowed, true);
  assert.equal(ok.mode, "review");
  const late = decideRefund(virtualOrder({ paidAt: daysAgo(DEFECT_CLAIM_DAYS + 1) }), "defect", NOW);
  assert.equal(late.allowed, false);
});

test("수령일 기록이 없으면 유저에게 불리하게 거부하지 않고 심사로 넘긴다", () => {
  const r = decideRefund(
    order({ status: "delivered", deliveredAt: null, shippedAt: null, paidAt: null }),
    "change_of_mind", NOW,
  );
  assert.equal(r.allowed, true);
  assert.equal(r.mode, "review");
});

test("기산점 우선순위: 수령일 > 발송일 > 결제일", () => {
  assert.equal(withdrawalBaseDate({ deliveredAt: "D", shippedAt: "S", paidAt: "P" }), "D");
  assert.equal(withdrawalBaseDate({ deliveredAt: null, shippedAt: "S", paidAt: "P" }), "S");
  assert.equal(withdrawalBaseDate({ deliveredAt: null, shippedAt: null, paidAt: "P" }), "P");
});

// ══════════════════════════════════════════
// 5. 금액 계산 — 과잉 환불 방어
// ══════════════════════════════════════════
test("반품 배송비는 환불액에서 차감되고 음수로 내려가지 않는다", () => {
  const dec = { allowed: true, mode: "review", shippingFeeBearer: "buyer", returnShippingFee: 3000, note: "" };
  assert.equal(refundableAmount(10000, dec), 7000);
  assert.equal(refundableAmount(1000, dec), 0); // 반품비가 상품가보다 커도 음수 아님
});

// ══════════════════════════════════════════
// 6. 후원 집계 무결성
// ══════════════════════════════════════════
test("후원 차감은 수량 비율 버림 — 올림하면 집계가 음수로 간다", () => {
  assert.equal(donationDelta(1000, 1, 3), 333);   // 1000*1/3 = 333.3 → 333
  assert.equal(donationDelta(1000, 2, 3), 666);
});

test("마지막 수량까지 환불하면 잔액을 전부 털어 정확히 0으로 맞춘다", () => {
  // 1개씩 세 번 환불: 333 + 333 + 나머지(334) = 1000. 버림 누적 오차가 남지 않아야 한다.
  const first = donationDelta(1000, 1, 3, 0);
  const second = donationDelta(1000, 1, 3, first);
  const third = donationDelta(1000, 3, 3, first + second); // 남은 수량 전부
  assert.equal(first + second + third, 1000);
});

test("후원 차감 누적이 원래 후원액을 절대 넘지 않는다", () => {
  assert.equal(donationDelta(1000, 5, 3, 900), 100); // 남은 100까지만
  assert.equal(donationDelta(1000, 1, 3, 1000), 0);  // 이미 전액 차감됨
});

test("수량 0·음수는 차감 없음", () => {
  assert.equal(donationDelta(1000, 0, 3), 0);
  assert.equal(donationDelta(1000, -1, 3), 0);
  assert.equal(donationDelta(1000, 1, 0), 0);
});

// ══════════════════════════════════════════
// 7. 포인트 반환 — 이중반환 차단
// ══════════════════════════════════════════
test("전액환불은 사용 포인트 전액 반환", () => {
  assert.equal(pointsToRestore(3000, 27000, 27000, true), 3000);
});

test("부분환불은 결제액 비율만큼 버림 반환", () => {
  assert.equal(pointsToRestore(3000, 9000, 27000, false), 1000);
  assert.equal(pointsToRestore(3000, 1, 27000, false), 0); // 소액이면 0
});

test("반환 포인트는 사용 포인트를 넘지 않는다", () => {
  assert.equal(pointsToRestore(3000, 999999, 27000, false), 3000);
});

test("전액환불 reason은 기존 취소 경로와 동일해야 이중반환이 막힌다", () => {
  // point_ledger unique(user_id, reason)이 유일한 방어선.
  // cancel/route.ts:159, webhook/route.ts:294가 쓰는 문자열과 반드시 같아야 한다.
  assert.equal(pointRefundReason("ORD1", "REF1", true), "order-cancel:ORD1");
});

test("부분환불 reason은 환불 건별로 분리 — 여러 번 부분환불 가능해야 하므로", () => {
  assert.equal(pointRefundReason("ORD1", "REF1", false), "order-refund:REF1");
  assert.notEqual(pointRefundReason("ORD1", "REF1", false), pointRefundReason("ORD1", "REF2", false));
});
