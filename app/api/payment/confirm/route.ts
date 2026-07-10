// ══════════════════════════════════════════
// 토스페이먼츠 결제 승인 API
// 프론트에서 결제 성공 리다이렉트 후 호출 —
// 서버에서 금액 검증 후 토스 승인 API를 호출해야 결제가 확정됨.
//
// 안전장치:
// 1. 금액 위변조 검증 (주문의 payment_amount와 대조)
// 2. 원자적 주문 선점 (payment_key 조건부 UPDATE) — 동시 승인 요청 경합 방지
// 3. 선(先) 재고 확보 (decrement_product_stock RPC, stock >= qty 조건) —
//    승인 전에 재고를 잡아서 "돈은 나갔는데 재고 없음" 원천 차단.
//    실패 시 이미 잡은 재고 원복 + 주문 취소, 결제는 청구되지 않음.
// 4. 토스 승인 실패 시 재고 원복 + 주문 취소
// ══════════════════════════════════════════

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as serviceClient, type SupabaseClient } from "@supabase/supabase-js";

const TOSS_CONFIRM_URL = "https://api.tosspayments.com/v1/payments/confirm";

interface TossPaymentResponse {
  paymentKey: string;
  orderId: string;
  method?: string;
  easyPay?: { provider?: string } | null;
  code?: string;
  message?: string;
}

type OrderItem = { product_id: string | null; quantity: number; donation_amount?: number };

// 주문의 후원 적립액 합계 (성공 화면 표시용)
function donationTotal(items: OrderItem[]): number {
  return items.reduce((sum, i) => sum + (i.donation_amount ?? 0), 0);
}

// 확보해둔 재고 원복 (부분 실패/승인 실패 롤백용)
async function restoreStock(svc: SupabaseClient, reserved: OrderItem[]): Promise<void> {
  for (const item of reserved) {
    if (!item.product_id) continue;
    const { error } = await svc.rpc("increment_product_stock", {
      p_product_id: item.product_id,
      p_qty: item.quantity,
    });
    if (error) console.error("[payment/confirm] stock restore failed:", error, item.product_id);
  }
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

  // 이미 같은 paymentKey로 승인된 주문이면 성공으로 응답 (새로고침 등 중복 요청)
  if (order.status === "paid" && order.payment_key === paymentKey) {
    return NextResponse.json({ ok: true, orderId: order.id, orderNumber: order.order_number, donation: donationTotal((order.items ?? []) as OrderItem[]) });
  }
  if (order.status !== "pending") {
    return NextResponse.json({ error: "이미 처리된 주문이에요." }, { status: 409 });
  }

  // 4. 금액 위변조 검증 — 요청 금액과 주문의 결제금액이 다르면 승인 거부
  if (order.payment_amount !== amount) {
    console.error(`[payment/confirm] amount mismatch: order=${order.payment_amount} req=${amount} (${orderId})`);
    return NextResponse.json({ error: "결제 금액이 주문과 일치하지 않아요." }, { status: 400 });
  }

  // 4.5 서버 측 금액 무결성 재검증 — 주문·스냅샷이 클라이언트에서 생성되므로
  // payment_amount만 믿으면 안 됨. order_items × "현재 products 가격"으로 기대 금액을
  // 재계산해 일치할 때만 승인 (조작된 저가 주문 차단).
  const items = (order.items ?? []) as OrderItem[];
  {
    if (items.length === 0) {
      return NextResponse.json({ error: "주문 상품이 없어요." }, { status: 400 });
    }
    const productIds = items.map((i) => i.product_id).filter((id): id is string => !!id);
    if (productIds.length !== items.length) {
      return NextResponse.json({ error: "주문 상품 정보가 올바르지 않아요." }, { status: 400 });
    }
    const { data: prods, error: prodError } = await svc
      .from("products")
      .select("id, price, sale_price, shipping_fee, is_active")
      .in("id", productIds);
    if (prodError) {
      console.error("[payment/confirm] product verify fetch failed:", prodError);
      return NextResponse.json({ error: "상품 확인 중 오류가 발생했어요." }, { status: 502 });
    }
    const priceMap = new Map(
      ((prods ?? []) as { id: string; price: number; sale_price: number | null; shipping_fee: number; is_active: boolean }[])
        .map((p) => [p.id, p]),
    );
    let expectedProducts = 0;
    let expectedShipping = 0;
    for (const item of items) {
      const p = item.product_id ? priceMap.get(item.product_id) : undefined;
      if (!p || !p.is_active) {
        return NextResponse.json({ error: "판매 중이 아닌 상품이 포함돼 있어요." }, { status: 409 });
      }
      const unit = p.sale_price ?? p.price;
      expectedProducts += unit * item.quantity;
      expectedShipping = Math.max(expectedShipping, p.shipping_fee);
    }
    const expected = expectedProducts + expectedShipping;
    if (expected !== order.payment_amount) {
      // 조작 시도 또는 주문 후 가격 변경 — 승인 거부 + 주문 취소 (결제 청구 없음)
      console.error(
        `[payment/confirm] integrity mismatch: expected=${expected} order=${order.payment_amount} (${orderId})`,
      );
      await svc.from("orders")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", order.id);
      return NextResponse.json(
        { error: "주문 금액 검증에 실패했어요. 상품 가격이 변경됐을 수 있으니 다시 주문해주세요." },
        { status: 409 },
      );
    }
  }

  // 5. 원자적 주문 선점 — 동시에 들어온 승인 요청 중 하나만 통과
  const { data: claimed, error: claimError } = await svc
    .from("orders")
    .update({ payment_key: paymentKey, updated_at: new Date().toISOString() })
    .eq("id", order.id)
    .eq("status", "pending")
    .is("payment_key", null)
    .select("id");

  if (claimError || !claimed || claimed.length === 0) {
    // 다른 요청이 먼저 선점 — 잠시 후 같은 키로 완료됐는지 확인
    const { data: recheck } = await svc
      .from("orders").select("id, order_number, status, payment_key").eq("id", order.id).maybeSingle();
    if (recheck?.status === "paid" && recheck.payment_key === paymentKey) {
      return NextResponse.json({ ok: true, orderId: recheck.id, orderNumber: recheck.order_number });
    }
    return NextResponse.json({ error: "이미 결제가 진행 중인 주문이에요." }, { status: 409 });
  }

  // 6. 선(先) 재고 확보 — 원자적 차감 (stock >= qty일 때만 성공)
  const reserved: OrderItem[] = [];
  for (const item of items) {
    if (!item.product_id) continue;
    const { data: ok, error: rpcError } = await svc.rpc("decrement_product_stock", {
      p_product_id: item.product_id,
      p_qty: item.quantity,
    });
    if (rpcError || ok !== true) {
      if (rpcError) console.error("[payment/confirm] stock rpc failed:", rpcError);
      await restoreStock(svc, reserved);
      await svc.from("orders")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", order.id);
      return NextResponse.json(
        { error: "재고가 부족해서 결제를 진행할 수 없어요. 결제 금액은 청구되지 않았어요." },
        { status: 409 },
      );
    }
    reserved.push(item);
  }

  // 7. 토스 승인 API 호출
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

    // 이전 시도에서 승인은 됐지만 응답을 못 받았던 경우(타임아웃 후 재시도) — 성공으로 처리
    if (!res.ok && toss.code === "ALREADY_PROCESSED_PAYMENT") {
      console.warn("[payment/confirm] already processed — treating as success:", orderId);
    } else if (!res.ok) {
      // 승인 실패 → 재고 원복 + 주문 취소
      console.error("[payment/confirm] toss confirm failed:", toss.code, toss.message);
      await restoreStock(svc, reserved);
      await svc.from("orders")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", order.id);
      return NextResponse.json(
        { error: toss.message ?? "결제 승인에 실패했어요." },
        { status: 400 },
      );
    }
  } catch (e) {
    // 네트워크 오류 — 승인 여부 불명이므로 주문은 pending 유지(재시도 가능), 재고만 원복
    console.error("[payment/confirm] toss request error:", e);
    await restoreStock(svc, reserved);
    await svc.from("orders")
      .update({ payment_key: null, updated_at: new Date().toISOString() })
      .eq("id", order.id);
    return NextResponse.json(
      { error: "결제 승인 중 오류가 발생했어요. 잠시 후 다시 시도해주세요." },
      { status: 502 },
    );
  }

  // 8. 승인 성공 — 주문 확정
  const paymentMethod = toss.easyPay?.provider
    ? `${toss.method ?? "간편결제"}(${toss.easyPay.provider})`
    : (toss.method ?? null);

  const { error: updateError } = await svc
    .from("orders")
    .update({
      status: "paid",
      payment_method: paymentMethod,
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", order.id)
    .eq("status", "pending");

  if (updateError) {
    // 결제는 됐는데 DB 반영 실패 — 로그 남기고 성공 응답 (관리자가 토스 콘솔과 대조 가능)
    console.error("[payment/confirm] order update failed after toss confirm:", updateError, orderId, paymentKey);
  }

  // 9. 장바구니 비우기 (실패해도 결제 성공은 유지, 로그만)
  const orderedIds = items
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

  return NextResponse.json({ ok: true, orderId: order.id, orderNumber: order.order_number, donation: donationTotal(items) });
}
