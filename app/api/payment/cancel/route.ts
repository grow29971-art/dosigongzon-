// ══════════════════════════════════════════
// 주문 취소 API
// - pending 주문: 상태만 취소로 변경 (결제 전이라 PG 호출 없음)
// - paid 주문: 토스 결제 취소(환불) API 호출 후 취소 처리 + 재고 복구
// 본인 주문 또는 관리자만 가능.
// ══════════════════════════════════════════

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as serviceClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });

  let body: { orderId?: string; orderNumber?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }
  if (!body.orderId && !body.orderNumber) {
    return NextResponse.json({ error: "주문 정보가 누락됐어요." }, { status: 400 });
  }

  const svc = serviceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // 주문 조회 (id 또는 order_number)
  let query = svc.from("orders").select("*, items:order_items(*)");
  query = body.orderId ? query.eq("id", body.orderId) : query.eq("order_number", body.orderNumber!);
  const { data: order, error: orderError } = await query.maybeSingle();

  if (orderError || !order) {
    return NextResponse.json({ error: "주문을 찾을 수 없어요." }, { status: 404 });
  }

  // 권한: 본인 또는 관리자
  if (order.user_id !== user.id) {
    const { data: admin } = await svc
      .from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
    if (!admin) return NextResponse.json({ error: "권한이 없어요." }, { status: 403 });
  }

  if (order.status === "cancelled" || order.status === "refunded") {
    return NextResponse.json({ ok: true, status: order.status });
  }

  // ── pending: PG 호출 없이 취소 ──
  if (order.status === "pending") {
    const { error } = await svc
      .from("orders")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", order.id);
    if (error) {
      console.error("[payment/cancel] pending cancel failed:", error);
      return NextResponse.json({ error: "주문 취소에 실패했어요." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, status: "cancelled" });
  }

  // ── paid: 토스 환불 후 취소 ──
  if (order.status !== "paid") {
    return NextResponse.json(
      { error: "배송이 시작된 주문은 고객센터를 통해 취소할 수 있어요." },
      { status: 409 },
    );
  }
  if (!order.payment_key) {
    return NextResponse.json({ error: "결제 정보를 찾을 수 없어요." }, { status: 409 });
  }

  const secretKey = process.env.TOSS_SECRET_KEY;
  if (!secretKey) {
    console.error("[payment/cancel] TOSS_SECRET_KEY missing");
    return NextResponse.json({ error: "결제 설정이 아직 완료되지 않았어요." }, { status: 503 });
  }

  const basicAuth = Buffer.from(`${secretKey}:`).toString("base64");
  try {
    const res = await fetch(
      `https://api.tosspayments.com/v1/payments/${encodeURIComponent(order.payment_key)}/cancel`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${basicAuth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ cancelReason: "구매자 주문 취소" }),
      },
    );
    if (!res.ok) {
      const toss = (await res.json().catch(() => ({}))) as { message?: string };
      console.error("[payment/cancel] toss cancel failed:", toss);
      return NextResponse.json(
        { error: toss.message ?? "결제 취소에 실패했어요. 고객센터로 문의해주세요." },
        { status: 400 },
      );
    }
  } catch (e) {
    console.error("[payment/cancel] toss request error:", e);
    return NextResponse.json({ error: "결제 취소 중 오류가 발생했어요. 잠시 후 다시 시도해주세요." }, { status: 502 });
  }

  // 취소 확정 + 재고 복구
  const { error: updateError } = await svc
    .from("orders")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", order.id);
  if (updateError) {
    console.error("[payment/cancel] status update failed after refund:", updateError, order.id);
  }

  type Item = { product_id: string | null; quantity: number };
  for (const item of (order.items ?? []) as Item[]) {
    if (!item.product_id) continue;
    const { data: p } = await svc.from("products").select("stock").eq("id", item.product_id).maybeSingle();
    if (!p) continue;
    const { error: stockError } = await svc
      .from("products")
      .update({ stock: (p.stock as number) + item.quantity })
      .eq("id", item.product_id);
    if (stockError) console.error("[payment/cancel] stock restore failed:", stockError);
  }

  return NextResponse.json({ ok: true, status: "cancelled" });
}
