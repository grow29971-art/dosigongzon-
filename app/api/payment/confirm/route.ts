// ══════════════════════════════════════════
// 토스페이먼츠 결제 승인 API
// 프론트에서 결제 성공 리다이렉트 후 호출 —
// 서버에서 금액 검증 후 토스 승인 API를 호출해야 결제가 확정됨.
// ══════════════════════════════════════════

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as serviceClient } from "@supabase/supabase-js";

const TOSS_CONFIRM_URL = "https://api.tosspayments.com/v1/payments/confirm";

interface TossPaymentResponse {
  paymentKey: string;
  orderId: string;
  method?: string;
  easyPay?: { provider?: string } | null;
  code?: string;
  message?: string;
}

export async function POST(req: Request) {
  // 1. 인증
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });

  const secretKey = process.env.TOSS_SECRET_KEY;
  if (!secretKey) {
    console.error("[payment/confirm] TOSS_SECRET_KEY missing");
    return NextResponse.json({ error: "결제 설정이 아직 완료되지 않았어요." }, { status: 503 });
  }

  // 2. 입력 파싱
  let body: { paymentKey?: string; orderId?: string; amount?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }
  const { paymentKey, orderId, amount } = body;
  if (!paymentKey || !orderId || typeof amount !== "number" || !Number.isInteger(amount) || amount <= 0) {
    return NextResponse.json({ error: "필수 정보가 누락됐어요." }, { status: 400 });
  }

  const svc = serviceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // 3. 주문 조회 (토스 orderId = 우리 order_number)
  const { data: order, error: orderError } = await svc
    .from("orders")
    .select("*, items:order_items(*)")
    .eq("order_number", orderId)
    .maybeSingle();

  if (orderError || !order) {
    return NextResponse.json({ error: "주문을 찾을 수 없어요." }, { status: 404 });
  }
  if (order.user_id !== user.id) {
    return NextResponse.json({ error: "본인 주문만 결제할 수 있어요." }, { status: 403 });
  }

  // 이미 같은 paymentKey로 승인된 주문이면 성공으로 응답 (중복 요청 방지 — 새로고침 등)
  if (order.status === "paid" && order.payment_key === paymentKey) {
    return NextResponse.json({ ok: true, orderId: order.id, orderNumber: order.order_number });
  }
  if (order.status !== "pending") {
    return NextResponse.json({ error: "이미 처리된 주문이에요." }, { status: 409 });
  }

  // 4. 금액 위변조 검증 — 요청 금액과 주문의 결제금액이 다르면 승인 거부
  if (order.payment_amount !== amount) {
    console.error(`[payment/confirm] amount mismatch: order=${order.payment_amount} req=${amount} (${orderId})`);
    return NextResponse.json({ error: "결제 금액이 주문과 일치하지 않아요." }, { status: 400 });
  }

  // 5. 토스 승인 API 호출
  const basicAuth = Buffer.from(`${secretKey}:`).toString("base64");
  let toss: TossPaymentResponse;
  try {
    const res = await fetch(TOSS_CONFIRM_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    });
    toss = (await res.json()) as TossPaymentResponse;

    if (!res.ok) {
      // 승인 실패 → 주문 취소 처리
      console.error("[payment/confirm] toss confirm failed:", toss.code, toss.message);
      await svc.from("orders")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", order.id);
      return NextResponse.json(
        { error: toss.message ?? "결제 승인에 실패했어요." },
        { status: 400 },
      );
    }
  } catch (e) {
    console.error("[payment/confirm] toss request error:", e);
    return NextResponse.json({ error: "결제 승인 중 오류가 발생했어요. 잠시 후 다시 시도해주세요." }, { status: 502 });
  }

  // 6. 승인 성공 — 주문 확정
  const paymentMethod = toss.easyPay?.provider
    ? `${toss.method ?? "간편결제"}(${toss.easyPay.provider})`
    : (toss.method ?? null);

  const { error: updateError } = await svc
    .from("orders")
    .update({
      status: "paid",
      payment_key: paymentKey,
      payment_method: paymentMethod,
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", order.id);

  if (updateError) {
    // 결제는 됐는데 DB 반영 실패 — 로그 남기고 성공 응답 (관리자가 토스 콘솔과 대조 가능)
    console.error("[payment/confirm] order update failed after toss confirm:", updateError, orderId, paymentKey);
  }

  // 7. 재고 차감 + 장바구니 비우기 (실패해도 결제 성공은 유지, 로그만)
  type Item = { product_id: string | null; quantity: number };
  for (const item of (order.items ?? []) as Item[]) {
    if (!item.product_id) continue;
    const { data: p } = await svc.from("products").select("stock").eq("id", item.product_id).maybeSingle();
    if (!p) continue;
    const newStock = Math.max(0, (p.stock as number) - item.quantity);
    const { error: stockError } = await svc
      .from("products").update({ stock: newStock }).eq("id", item.product_id);
    if (stockError) console.error("[payment/confirm] stock decrement failed:", stockError);
  }

  const orderedIds = ((order.items ?? []) as Item[])
    .map((i) => i.product_id)
    .filter((id): id is string => !!id);
  if (orderedIds.length > 0) {
    const { error: cartError } = await svc
      .from("cart_items")
      .delete()
      .eq("user_id", user.id)
      .in("product_id", orderedIds);
    if (cartError) console.error("[payment/confirm] cart clear failed:", cartError);
  }

  return NextResponse.json({ ok: true, orderId: order.id, orderNumber: order.order_number });
}
