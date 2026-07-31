// ══════════════════════════════════════════
// 환불 요청 승인/거부 API (admin 전용)
// - approve: 원장 requested/failed → approved 선점 후 토스 취소 실행(refund-executor 공유)
//   failed 재시도는 같은 idempotency_key로 나가므로 토스가 멱등 처리(이중 청구 없음).
// - reject: requested → rejected + 사유 기록, 주문의 환불 축을 rejected로 되돌림
//   (유저는 다시 요청할 수 있다 — decideRefund가 rejected를 재요청 가능으로 판정)
// 인증: 쿠키 세션 + admins 테이블 확인 (payment/cancel 라우트와 동일 패턴)
// ══════════════════════════════════════════

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { REFUND_REASON_LABELS, type RefundReasonCode } from "@/lib/refund-policy";
import {
  executeFullRefund,
  type RefundOrderItemRow,
  type RefundOrderRow,
} from "@/lib/refund-executor";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });

  const svc = createServiceClient();
  const { data: admin } = await svc
    .from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!admin) return NextResponse.json({ error: "관리자 권한이 필요해요." }, { status: 403 });

  let body: { refundId?: string; action?: string; rejectReason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
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
      console.error("[admin/refunds] reject failed:", error, refundRow.id);
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
      console.error("[admin/refunds] order reject mark failed:", orderError, refundRow.order_id);
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
    console.error("[admin/refunds] approve claim failed:", claimError, refundRow.id);
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
  return NextResponse.json({ ok: true, action: "approved", amount: refundRow.amount });
}
