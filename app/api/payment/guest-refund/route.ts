// ══════════════════════════════════════════
// 비회원 환불(청약철회) 요청 API — 주문번호 + 게스트 토큰으로 본인 확인
// 처리 규칙은 회원과 같다(lib/refund-request.ts): 배송 전이면 즉시 환불, 그 외엔 관리자 심사.
// 토큰은 주문한 기기(localStorage)와 결제 완료 화면에만 있다. 기기를 잃은 경우는 이메일 문의 →
// 관리자 직권 환불(/api/admin/refunds action=create)로 처리한다.
// ══════════════════════════════════════════

import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/service";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import type { RefundReasonCode } from "@/lib/refund-policy";
import type { RefundOrderItemRow, RefundOrderRow } from "@/lib/refund-executor";
import { requestFullRefund, USER_REASONS } from "@/lib/refund-request";

function sameToken(a: string, b: string): boolean {
  const x = Buffer.from(a, "utf8");
  const y = Buffer.from(b, "utf8");
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function POST(req: Request) {
  // 토큰 추측·토스 환불 API 반복 호출 방지 — IP 기준
  if (!rateLimit(`payment-guest-refund:${getClientIp(req)}`, { max: 10, windowMs: 60_000 })) {
    return NextResponse.json({ error: "요청이 너무 많아요. 잠시 후 다시 시도해주세요." }, { status: 429 });
  }

  let body: { orderNumber?: string; guestToken?: string; reasonCode?: string; reasonNote?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }
  if (typeof body.orderNumber !== "string" || typeof body.guestToken !== "string" || !body.orderNumber || !body.guestToken) {
    return NextResponse.json({ error: "주문 정보가 누락됐어요." }, { status: 400 });
  }
  const reasonCode = body.reasonCode as RefundReasonCode;
  if (!USER_REASONS.includes(reasonCode)) {
    return NextResponse.json({ error: "환불 사유를 선택해주세요." }, { status: 400 });
  }
  const reasonNote =
    typeof body.reasonNote === "string" ? body.reasonNote.trim().slice(0, 500) : null;

  const svc = createServiceClient();
  const { data: order } = await svc
    .from("orders")
    .select("*, items:order_items(*)")
    .eq("order_number", body.orderNumber)
    .is("user_id", null)
    .maybeSingle();
  // 주문이 없든 토큰이 틀리든 같은 응답 — 주문번호 존재 여부를 흘리지 않는다
  const token = (order as { guest_token?: string | null } | null)?.guest_token;
  if (!order || !token || !sameToken(token, body.guestToken)) {
    return NextResponse.json({ error: "주문을 찾을 수 없어요." }, { status: 404 });
  }

  const orderRow = order as unknown as RefundOrderRow & { items: RefundOrderItemRow[] };
  return requestFullRefund(svc, orderRow, reasonCode, reasonNote, null);
}
