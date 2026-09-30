// ══════════════════════════════════════════
// 환불(청약철회) 셀프 요청 API
// - decideRefund() 판정이 auto  → 즉시 토스 취소까지 실행 (송장 안 나간 배송 전 주문)
// - 판정이 review → order_refunds에 접수하고 관리자 심사 대기
//   (가상상품은 사용 이력 확인 수단이 생길 때까지 전건 review — box/가상상품_등록전_선행조건.md)
// 본인 주문만 가능(비회원은 /api/payment/guest-refund). 처리 본체는 lib/refund-request.ts.
//
// pending 주문의 취소는 기존 /api/payment/cancel 경로를 그대로 쓴다(결제 전이라 환불이 아님).
// ══════════════════════════════════════════

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { rateLimit } from "@/lib/rate-limit";
import type { RefundReasonCode } from "@/lib/refund-policy";
import type { RefundOrderItemRow, RefundOrderRow } from "@/lib/refund-executor";
import { requestFullRefund, USER_REASONS } from "@/lib/refund-request";

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
  // 본인 주문만 — 게스트 주문(user_id null)은 /api/payment/guest-refund
  if (order.user_id !== user.id) {
    return NextResponse.json({ error: "권한이 없어요." }, { status: 403 });
  }

  const orderRow = order as unknown as RefundOrderRow & { items: RefundOrderItemRow[] };
  return requestFullRefund(svc, orderRow, reasonCode, reasonNote, user.id);
}
