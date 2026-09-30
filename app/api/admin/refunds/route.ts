// ══════════════════════════════════════════
// 환불 요청 승인/거부 API (admin 전용)
// - approve: 원장 requested/failed → approved 선점 후 토스 취소 실행(refund-executor 공유)
//   failed 재시도는 같은 idempotency_key로 나가므로 토스가 멱등 처리(이중 청구 없음).
// - create: 요청 없이 관리자 직권 전액 환불(admin_discretion) — 기기를 잃어 셀프 환불을 못 하는
//   비회원 주문, 전화·이메일로 접수된 건. 원장 행을 approved로 만들고 곧바로 토스 취소. (2026-09-30)
// - reject: requested → rejected + 사유 기록, 주문의 환불 축을 rejected로 되돌림
//   (유저는 다시 요청할 수 있다 — decideRefund가 rejected를 재요청 가능으로 판정)
// 인증: 쿠키 세션 + admins 테이블 확인 (payment/cancel 라우트와 동일 패턴)
// ══════════════════════════════════════════

import { NextResponse } from "next/server";
import { safePgError } from "@/lib/log-sanitize";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { REFUND_REASON_LABELS, type RefundReasonCode } from "@/lib/refund-policy";
import {
  executeFullRefund,
  type RefundOrderItemRow,
  type RefundOrderRow,
} from "@/lib/refund-executor";
import { notifyUserRefund } from "@/lib/refund-notify";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });

  const svc = createServiceClient();
  const { data: admin } = await svc
    .from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!admin) return NextResponse.json({ error: "관리자 권한이 필요해요." }, { status: 403 });

  let body: { refundId?: string; orderId?: string; action?: string; rejectReason?: string; note?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  // ── 직권 환불 ──
  if (body.action === "create") {
    if (!body.orderId || typeof body.orderId !== "string") {
      return NextResponse.json({ error: "주문 정보가 누락됐어요." }, { status: 400 });
    }
    const { data: order } = await svc
      .from("orders").select("*, items:order_items(*)").eq("id", body.orderId).maybeSingle();
    if (!order) return NextResponse.json({ error: "주문을 찾을 수 없어요." }, { status: 404 });
    const orderRow = order as unknown as RefundOrderRow & { items: RefundOrderItemRow[] };
    if (!["paid", "preparing", "shipping", "delivered"].includes(orderRow.status) || !orderRow.payment_key) {
      return NextResponse.json({ error: "결제 완료된 주문만 환불할 수 있어요." }, { status: 409 });
    }
    // 직권은 판매자 판단이라 반품비를 차감하지 않고 남은 결제액 전부를 돌려준다
    const amount = orderRow.payment_amount - (orderRow.refund_amount ?? 0);
    if (amount <= 0) return NextResponse.json({ error: "환불할 잔액이 없어요." }, { status: 409 });

    const { count: prior } = await svc
      .from("order_refunds").select("id", { count: "exact", head: true }).eq("order_id", orderRow.id);
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : null;
    const { data: row, error: insertError } = await svc
      .from("order_refunds")
      .insert({
        order_id: orderRow.id,
        requested_by: user.id,
        requested_by_role: "admin",
        status: "approved",
        kind: "full",
        amount,
        reason_code: "admin_discretion",
        reason_note: note,
        shipping_fee_bearer: "seller",
        return_shipping_fee: 0,
        idempotency_key: `refund:full:${orderRow.id}:${prior ?? 0}`,
        processed_by: user.id,
      })
      .select("id, amount, idempotency_key")
      .single();
    if (insertError || !row) {
      if (insertError?.code === "23505") {
        return NextResponse.json({ error: "이미 열린 환불 요청이 있어요. 위 목록에서 승인·거부해 주세요." }, { status: 409 });
      }
      console.error("[admin/refunds] discretion insert failed:", safePgError(insertError), orderRow.id);
      return NextResponse.json({ error: "환불 접수에 실패했어요." }, { status: 500 });
    }
    const result = await executeFullRefund(
      svc, orderRow, orderRow.items ?? [],
      row as { id: string; amount: number; idempotency_key: string },
      "판매자 직권 환불",
    );
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    if (orderRow.user_id) {
      await notifyUserRefund(svc, user.id, orderRow.user_id, [
        `주문 ${orderRow.order_number}이 환불 처리됐어요.`,
        `${amount.toLocaleString()}원이 결제수단으로 며칠 내에 입금돼요.`,
      ].join("\n"));
    }
    return NextResponse.json({ ok: true, action: "created", amount });
  }
  if (!body.refundId || typeof body.refundId !== "string") {
    return NextResponse.json({ error: "환불 요청 정보가 누락됐어요." }, { status: 400 });
  }
  if (body.action !== "approve" && body.action !== "reject") {
    return NextResponse.json({ error: "처리 방식(approve/reject)을 지정해주세요." }, { status: 400 });
  }

  const { data: refund, error: refundError } = await svc
    .from("order_refunds")
    .select("*")
    .eq("id", body.refundId)
    .maybeSingle();
  if (refundError || !refund) {
    return NextResponse.json({ error: "환불 요청을 찾을 수 없어요." }, { status: 404 });
  }
  const refundRow = refund as {
    id: string; order_id: string; status: string; amount: number;
    idempotency_key: string; reason_code: RefundReasonCode;
  };

  // ── 거부 ──
  if (body.action === "reject") {
    const rejectReason =
      typeof body.rejectReason === "string" ? body.rejectReason.trim().slice(0, 500) : "";
    const { data: done, error } = await svc
      .from("order_refunds")
      .update({
        status: "rejected",
        reject_reason: rejectReason || null,
        processed_by: user.id,
        processed_at: new Date().toISOString(),
      })
      .eq("id", refundRow.id)
      .eq("status", "requested")
      .select("id");
    if (error) {
      console.error("[admin/refunds] reject failed:", safePgError(error), refundRow.id);
      return NextResponse.json({ error: "거부 처리에 실패했어요." }, { status: 500 });
    }
    if (!done || done.length === 0) {
      return NextResponse.json({ error: "이미 처리된 요청이에요." }, { status: 409 });
    }
    // 주문의 환불 축을 rejected로 — 유저 화면 배너·재요청 허용의 근거
    const { error: orderError } = await svc
      .from("orders")
      .update({ refund_status: "rejected", updated_at: new Date().toISOString() })
      .eq("id", refundRow.order_id)
      .eq("refund_status", "requested");
    if (orderError) {
      console.error("[admin/refunds] order reject mark failed:", safePgError(orderError), refundRow.order_id);
    }
    // 유저에게 처리 결과 쪽지 (게스트 주문은 user_id 없음 — 스킵)
    const { data: rejectedOrder } = await svc
      .from("orders")
      .select("user_id, order_number")
      .eq("id", refundRow.order_id)
      .maybeSingle();
    const rejectedRow = rejectedOrder as { user_id: string | null; order_number: string } | null;
    if (rejectedRow?.user_id) {
      await notifyUserRefund(svc, user.id, rejectedRow.user_id, [
        `주문 ${rejectedRow.order_number}의 환불 요청이 반려됐어요.`,
        rejectReason ? `사유: ${rejectReason}` : "",
        ``,
        `궁금한 점은 이 쪽지에 답장으로 문의해주세요.`,
      ].filter(Boolean).join("\n"));
    }
    return NextResponse.json({ ok: true, action: "rejected" });
  }

  // ── 승인 ──
  // requested/failed → approved 선점. 이미 approved(서버 사망 등으로 중단된 건)는 그대로 재개.
  const { data: claimed, error: claimError } = await svc
    .from("order_refunds")
    .update({ status: "approved", processed_by: user.id })
    .eq("id", refundRow.id)
    .in("status", ["requested", "failed"])
    .select("id");
  if (claimError) {
    console.error("[admin/refunds] approve claim failed:", safePgError(claimError), refundRow.id);
    return NextResponse.json({ error: "승인 처리에 실패했어요." }, { status: 500 });
  }
  if ((!claimed || claimed.length === 0) && refundRow.status !== "approved") {
    return NextResponse.json({ error: "이미 처리된 요청이에요." }, { status: 409 });
  }

  const { data: order, error: orderError } = await svc
    .from("orders")
    .select("*, items:order_items(*)")
    .eq("id", refundRow.order_id)
    .maybeSingle();
  if (orderError || !order) {
    return NextResponse.json({ error: "주문을 찾을 수 없어요." }, { status: 404 });
  }
  const orderRow = order as unknown as RefundOrderRow & { items: RefundOrderItemRow[] };

  const reasonLabel = REFUND_REASON_LABELS[refundRow.reason_code] ?? "기타";
  const result = await executeFullRefund(
    svc, orderRow, orderRow.items ?? [],
    { id: refundRow.id, amount: refundRow.amount, idempotency_key: refundRow.idempotency_key },
    `관리자 승인 환불 (${reasonLabel})`,
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  if (orderRow.user_id) {
    await notifyUserRefund(svc, user.id, orderRow.user_id, [
      `주문 ${orderRow.order_number}의 환불이 승인됐어요.`,
      `${refundRow.amount.toLocaleString()}원이 결제수단으로 며칠 내에 입금돼요.`,
    ].join("\n"));
  }
  return NextResponse.json({ ok: true, action: "approved", amount: refundRow.amount });
}
