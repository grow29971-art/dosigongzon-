// ══════════════════════════════════════════
// 환불(청약철회) 셀프 요청 API
// - decideRefund() 판정이 auto  → 즉시 토스 취소까지 실행 (배송 전·가상상품)
// - 판정이 review → order_refunds에 접수하고 관리자 심사 대기
// 본인 주문만 가능. 전액환불만 취급한다(부분환불은 관리자 경로에서 처리 예정).
//
// pending 주문의 취소는 기존 /api/payment/cancel 경로를 그대로 쓴다(결제 전이라 환불이 아님).
// ══════════════════════════════════════════

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { rateLimit } from "@/lib/rate-limit";
import {
  decideRefund,
  refundableAmount,
  type RefundReasonCode,
} from "@/lib/refund-policy";
import {
  buildRefundOrderInput,
  executeFullRefund,
  loadProductFlags,
  type RefundOrderItemRow,
  type RefundOrderRow,
} from "@/lib/refund-executor";

// 유저가 직접 고를 수 있는 사유 — admin_discretion(관리자 직권)은 제외
const USER_REASONS: RefundReasonCode[] = [
  "change_of_mind", "defect", "wrong_delivery", "delayed", "other",
];

const REASON_CANCEL_LABEL: Record<string, string> = {
  change_of_mind: "구매자 단순변심 환불",
  defect: "상품 하자 환불",
  wrong_delivery: "오배송 환불",
  delayed: "배송 지연 환불",
  other: "구매자 요청 환불",
};

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });

  // 토스 환불 API 반복 호출 방지 — cancel 라우트와 같은 한도
  if (!rateLimit(`payment-refund:${user.id}`, { max: 10, windowMs: 60_000 })) {
    return NextResponse.json({ error: "요청이 너무 많아요. 잠시 후 다시 시도해주세요." }, { status: 429 });
  }

  let body: { orderId?: string; reasonCode?: string; reasonNote?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }
  if (!body.orderId || typeof body.orderId !== "string") {
    return NextResponse.json({ error: "주문 정보가 누락됐어요." }, { status: 400 });
  }
  const reasonCode = body.reasonCode as RefundReasonCode;
  if (!USER_REASONS.includes(reasonCode)) {
    return NextResponse.json({ error: "환불 사유를 선택해주세요." }, { status: 400 });
  }
  const reasonNote =
    typeof body.reasonNote === "string" ? body.reasonNote.trim().slice(0, 500) : null;

  const svc = createServiceClient();

  const { data: order, error: orderError } = await svc
    .from("orders")
    .select("*, items:order_items(*)")
    .eq("id", body.orderId)
    .maybeSingle();
  if (orderError || !order) {
    return NextResponse.json({ error: "주문을 찾을 수 없어요." }, { status: 404 });
  }
  // 본인 주문만 — 게스트 주문(user_id null)은 셀프 환불 대상이 아님
  if (order.user_id !== user.id) {
    return NextResponse.json({ error: "권한이 없어요." }, { status: 403 });
  }

  const orderRow = order as unknown as RefundOrderRow & { items: RefundOrderItemRow[] };
  const items = orderRow.items ?? [];
  const flags = await loadProductFlags(svc, items);
  const input = buildRefundOrderInput(orderRow, items, flags);

  const decision = decideRefund(input, reasonCode);
  if (!decision.allowed) {
    return NextResponse.json({ error: decision.reason }, { status: 409 });
  }

  // 전액환불 — 남은 결제액에서 반품 배송비(단순변심·배송 후)만 차감
  const remaining = orderRow.payment_amount - (orderRow.refund_amount ?? 0);
  const amount = refundableAmount(remaining, decision);
  if (amount <= 0) {
    return NextResponse.json(
      { error: "환불 금액이 반품 배송비보다 작아요. 고객센터로 문의해주세요." },
      { status: 409 },
    );
  }

  // 원장 접수 — idempotency_key는 토스 Idempotency-Key와 같은 값(이중 청구 원천 차단).
  // 부분 유니크 인덱스(주문당 열린 요청 1건)가 중복 접수를 DB에서 거부한다.
  const idempotencyKey = `refund:${orderRow.id}:${crypto.randomUUID()}`;
  const { data: refundRow, error: insertError } = await svc
    .from("order_refunds")
    .insert({
      order_id: orderRow.id,
      requested_by: user.id,
      requested_by_role: "user",
      status: decision.mode === "auto" ? "approved" : "requested",
      kind: "full",
      amount,
      reason_code: reasonCode,
      reason_note: reasonNote,
      shipping_fee_bearer: decision.shippingFeeBearer,
      return_shipping_fee: decision.returnShippingFee,
      idempotency_key: idempotencyKey,
    })
    .select("id, amount, idempotency_key")
    .single();
  if (insertError || !refundRow) {
    // 23505 = 열린 요청이 이미 있음(unique index)
    if (insertError?.code === "23505") {
      return NextResponse.json(
        { error: "이미 접수된 환불 요청이 있어요. 처리 결과를 기다려주세요." },
        { status: 409 },
      );
    }
    console.error("[payment/refund] ledger insert failed:", insertError, orderRow.id);
    return NextResponse.json({ error: "환불 접수에 실패했어요. 잠시 후 다시 시도해주세요." }, { status: 500 });
  }

  // ── review: 접수만 하고 관리자 심사 대기 ──
  if (decision.mode === "review") {
    const { error: markError } = await svc
      .from("orders")
      .update({
        refund_status: "requested",
        refund_requested_at: new Date().toISOString(),
        refund_reason: reasonCode,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderRow.id);
    if (markError) {
      console.error("[payment/refund] order mark requested failed:", markError, orderRow.id);
    }
    return NextResponse.json({ ok: true, mode: "review", note: decision.note, amount });
  }

  // ── auto: 즉시 토스 취소까지 실행 ──
  const result = await executeFullRefund(
    svc, orderRow, items,
    refundRow as { id: string; amount: number; idempotency_key: string },
    REASON_CANCEL_LABEL[reasonCode] ?? "구매자 요청 환불",
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true, mode: "auto", status: "refunded", amount });
}
