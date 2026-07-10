// ══════════════════════════════════════════
// 토스페이먼츠 웹훅 — 결제 상태 대사(reconciliation)
// 사용자가 결제 후 successUrl에 도달하지 못해도(앱 종료·네트워크 유실)
// 주문 상태가 토스 결제 상태와 어긋나지 않게 서버끼리 맞춰줌.
//
// 등록: 토스 개발자센터 > 웹훅 > https://dosigongzon.com/api/payment/webhook
//       (이벤트: 결제 상태 변경 PAYMENT_STATUS_CHANGED)
//
// 보안: 웹훅 본문은 신뢰하지 않음 — paymentKey만 뽑아서
// 토스 결제 조회 API(시크릿 키 인증)로 실제 상태·금액을 다시 확인한 뒤 처리.
// ══════════════════════════════════════════

import { NextResponse } from "next/server";
import { createClient as serviceClient, type SupabaseClient } from "@supabase/supabase-js";

export const maxDuration = 60;

interface TossPayment {
  paymentKey: string;
  orderId: string;       // = 우리 order_number
  status: string;        // DONE | CANCELED | PARTIAL_CANCELED | EXPIRED | ABORTED | ...
  totalAmount: number;
  method?: string;
  easyPay?: { provider?: string } | null;
}

type OrderItem = { product_id: string | null; quantity: number };

async function restoreStock(svc: SupabaseClient, items: OrderItem[]): Promise<void> {
  for (const item of items) {
    if (!item.product_id) continue;
    const { error } = await svc.rpc("increment_product_stock", {
      p_product_id: item.product_id,
      p_qty: item.quantity,
    });
    if (error) console.error("[payment/webhook] stock restore failed:", error, item.product_id);
  }
}

// 결제 확정 공통 처리 — 재고 차감 + paid 전환 + 장바구니 정리
async function finalizePaid(
  svc: SupabaseClient,
  order: { id: string; user_id: string; items: OrderItem[] },
  toss: TossPayment,
  decrementStock: boolean,
): Promise<void> {
  if (decrementStock) {
    const reserved: OrderItem[] = [];
    for (const item of order.items) {
      if (!item.product_id) continue;
      const { data: ok, error } = await svc.rpc("decrement_product_stock", {
        p_product_id: item.product_id,
        p_qty: item.quantity,
      });
      if (error || ok !== true) {
        // 결제는 이미 완료 — 재고 부족이어도 주문은 확정하고 관리자 수동 처리 대상으로 로그
        console.error("[payment/webhook] stock decrement failed after DONE payment (manual check needed):", order.id, item.product_id, error);
      } else {
        reserved.push(item);
      }
    }
  }

  const paymentMethod = toss.easyPay?.provider
    ? `${toss.method ?? "간편결제"}(${toss.easyPay.provider})`
    : (toss.method ?? null);

  const { error } = await svc
    .from("orders")
    .update({
      status: "paid",
      payment_key: toss.paymentKey,
      payment_method: paymentMethod,
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", order.id)
    .eq("status", "pending");
  if (error) console.error("[payment/webhook] mark paid failed:", error, order.id);

  const ids = order.items.map((i) => i.product_id).filter((id): id is string => !!id);
  if (ids.length > 0) {
    await svc.from("cart_items").delete().eq("user_id", order.user_id).in("product_id", ids);
  }
}

export async function POST(req: Request) {
  const secretKey = process.env.TOSS_SECRET_KEY;
  if (!secretKey) return NextResponse.json({ ok: true, skipped: "no secret key" });

  // 1. 웹훅 본문에서 paymentKey만 추출 (v2/legacy 형태 모두 대응)
  let paymentKey: string | undefined;
  try {
    const body = await req.json();
    paymentKey = body?.data?.paymentKey ?? body?.paymentKey;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  if (!paymentKey || typeof paymentKey !== "string") {
    return NextResponse.json({ ok: true, ignored: "no paymentKey" });
  }

  // 2. 토스에 실제 결제 상태 재조회 — 본문 위조 방어
  const basicAuth = Buffer.from(`${secretKey}:`).toString("base64");
  let toss: TossPayment;
  try {
    const res = await fetch(
      `https://api.tosspayments.com/v1/payments/${encodeURIComponent(paymentKey)}`,
      { headers: { Authorization: `Basic ${basicAuth}` } },
    );
    if (!res.ok) {
      // 존재하지 않는 paymentKey(위조 가능성) — 정상 응답으로 무시
      return NextResponse.json({ ok: true, ignored: "payment not found" });
    }
    toss = (await res.json()) as TossPayment;
  } catch (e) {
    console.error("[payment/webhook] toss lookup failed:", e);
    return NextResponse.json({ error: "lookup failed" }, { status: 502 }); // 토스가 재시도
  }

  const svc = serviceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // 3. 주문 조회
  const { data: order } = await svc
    .from("orders")
    .select("*, items:order_items(*)")
    .eq("order_number", toss.orderId)
    .maybeSingle();
  if (!order) return NextResponse.json({ ok: true, ignored: "order not found" });

  const items = (order.items ?? []) as OrderItem[];

  // ── 케이스 A: 결제 완료(DONE)인데 주문이 아직 pending ──
  if (toss.status === "DONE" && order.status === "pending") {
    // 금액 검증 — confirm과 동일하게 실제 상품가로 기대 금액을 재계산해서 대조.
    // (order.payment_amount는 클라이언트가 조작 가능하므로 그것만 믿으면 안 됨 —
    //  이 경로는 confirm의 4.5 검증을 우회할 수 있어 여기서도 반드시 재검증)
    let expectedAmount = order.payment_amount as number;
    const productIds = items.map((i) => i.product_id).filter((id): id is string => !!id);
    if (productIds.length !== items.length || items.length === 0) {
      expectedAmount = -1; // 상품 정보 이상 → 강제 불일치 처리
    } else {
      const { data: prods } = await svc
        .from("products")
        .select("id, price, sale_price, shipping_fee")
        .in("id", productIds);
      const pm = new Map(
        ((prods ?? []) as { id: string; price: number; sale_price: number | null; shipping_fee: number }[])
          .map((p) => [p.id, p]),
      );
      let prodSum = 0;
      let ship = 0;
      let bad = false;
      for (const it of items) {
        const p = it.product_id ? pm.get(it.product_id) : undefined;
        if (!p) { bad = true; break; }
        prodSum += (p.sale_price ?? p.price) * it.quantity;
        ship = Math.max(ship, p.shipping_fee);
      }
      expectedAmount = bad ? -1 : prodSum + ship;
    }

    // 실제 결제액이 기대 금액과 다르면 자동 환불 후 취소 (위변조 주문에 돈만 잡힌 상태 방지)
    if (toss.totalAmount !== expectedAmount) {
      console.error(`[payment/webhook] amount mismatch — auto refund: toss=${toss.totalAmount} expected=${expectedAmount} order=${order.payment_amount} (${toss.orderId})`);
      try {
        await fetch(`https://api.tosspayments.com/v1/payments/${encodeURIComponent(paymentKey)}/cancel`, {
          method: "POST",
          headers: { Authorization: `Basic ${basicAuth}`, "Content-Type": "application/json" },
          body: JSON.stringify({ cancelReason: "주문 금액 검증 실패 자동 환불" }),
        });
      } catch (e) {
        console.error("[payment/webhook] auto refund failed (manual refund needed):", e, paymentKey);
      }
      await svc.from("orders")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", order.id);
      return NextResponse.json({ ok: true, action: "refunded_mismatch" });
    }

    // 선점 시도 — confirm 라우트와 동시 처리 방지
    const { data: claimed } = await svc
      .from("orders")
      .update({ payment_key: paymentKey, updated_at: new Date().toISOString() })
      .eq("id", order.id)
      .eq("status", "pending")
      .is("payment_key", null)
      .select("id");

    if (claimed && claimed.length > 0) {
      // 웹훅이 선점 — 정식 확정 (재고 차감 포함)
      await finalizePaid(svc, order, toss, true);
      return NextResponse.json({ ok: true, action: "finalized" });
    }

    // 선점 실패 — confirm이 처리 중이거나 처리 도중 죽은 경우
    if (order.payment_key === paymentKey) {
      const staleMs = Date.now() - new Date(order.updated_at as string).getTime();
      if (staleMs > 2 * 60 * 1000) {
        // confirm이 선점 후 2분 넘게 미완료 → 죽은 것으로 판단, 확정만 수행
        // (재고는 confirm이 어디까지 진행했는지 알 수 없어 차감 생략 — 수동 점검 로그)
        console.error("[payment/webhook] stale confirm recovered — verify stock manually:", order.id);
        await finalizePaid(svc, order, toss, false);
        return NextResponse.json({ ok: true, action: "recovered_stale" });
      }
    }
    return NextResponse.json({ ok: true, action: "in_progress" });
  }

  // ── 케이스 B: 토스에서 취소/환불됐는데 주문이 아직 paid ──
  if ((toss.status === "CANCELED" || toss.status === "PARTIAL_CANCELED") && order.status === "paid") {
    await svc.from("orders")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", order.id);
    await restoreStock(svc, items);
    return NextResponse.json({ ok: true, action: "cancelled_sync" });
  }

  // ── 케이스 C: 결제 만료/중단됐는데 주문이 pending ──
  if ((toss.status === "EXPIRED" || toss.status === "ABORTED") && order.status === "pending") {
    await svc.from("orders")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", order.id);
    return NextResponse.json({ ok: true, action: "expired_sync" });
  }

  return NextResponse.json({ ok: true, action: "noop" });
}
