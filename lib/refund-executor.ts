// ══════════════════════════════════════════
// 환불 실행기 (서버 전용) — 토스 취소 호출 + 후처리(원장·재고·포인트·후원 차감)
// /api/payment/refund(유저 셀프·즉시환불)와 /api/admin/refunds(관리자 승인)가 공유한다.
//
// 멱등성 3중 구조:
//   1. order_refunds.idempotency_key(unique) = 토스 Idempotency-Key와 같은 값
//      → "DB에 행이 있다 = 토스에도 갔다". 토스는 같은 키면 첫 응답을 그대로 반환.
//   2. 부분 유니크 인덱스(주문당 열린 요청 1건) → 요청 중복 접수 차단.
//   3. 후처리는 refund 행의 approved→completed 조건부 전환을 "이긴" 요청만 수행
//      (기존 cancel 라우트의 .eq(status).select 패턴 재사용) → 재고·포인트 이중 환원 차단.
// ══════════════════════════════════════════

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  donationDelta,
  pointRefundReason,
  type RefundOrderInput,
  type OrderStatus,
} from "@/lib/refund-policy";
import { safeTossError, safeErrorMessage } from "@/lib/log-sanitize";

// orders 행 중 환불 판정·실행에 필요한 부분.
// refund_* 컬럼은 마이그레이션 전 배포 호환을 위해 optional로 읽는다(없으면 none/0 취급).
export interface RefundOrderRow {
  id: string;
  user_id: string | null;
  order_number: string;
  status: OrderStatus;
  payment_amount: number;
  payment_key: string | null;
  points_used?: number | null;
  refund_status?: string | null;
  refund_amount?: number | null;
  paid_at: string | null;
  shipped_at?: string | null;
  delivered_at?: string | null;
  tracking_number?: string | null; // 송장 발급 여부 — 배송 전 자동환불 차단 근거(H-2)
}

export interface RefundOrderItemRow {
  id: string;
  product_id: string | null;
  quantity: number;
  donation_amount: number | null;
  refunded_quantity?: number | null;
  donation_refunded?: number | null;
}

export interface ProductRefundFlags {
  is_virtual: boolean;
  is_donation: boolean;
}

// ── 품목·상품 플래그 → 정책 판정 입력 ──
// 상품이 삭제돼 플래그를 모르면 실물로 간주한다(회수·재고가 필요한 쪽으로 보수적 판정).
export function buildRefundOrderInput(
  order: RefundOrderRow,
  items: RefundOrderItemRow[],
  flags: Map<string, ProductRefundFlags>,
): RefundOrderInput {
  const itemFlags = items.map((it) => (it.product_id ? flags.get(it.product_id) : undefined));
  return {
    status: order.status,
    refundStatus: (order.refund_status ?? "none") as RefundOrderInput["refundStatus"],
    paymentAmount: order.payment_amount,
    refundAmount: order.refund_amount ?? 0,
    paidAt: order.paid_at,
    shippedAt: order.shipped_at ?? null,
    deliveredAt: order.delivered_at ?? null,
    hasTracking: !!order.tracking_number?.trim(),
    hasPhysicalItem: itemFlags.some((f) => f?.is_virtual !== true),
    hasDonationItem: items.some((it, i) => (it.donation_amount ?? 0) > 0 || itemFlags[i]?.is_donation === true),
    allVirtual: items.length > 0 && itemFlags.every((f) => f?.is_virtual === true),
  };
}

// ── 주문 품목의 상품 플래그 일괄 조회 ──
export async function loadProductFlags(
  svc: SupabaseClient,
  items: RefundOrderItemRow[],
): Promise<Map<string, ProductRefundFlags>> {
  const ids = items.map((i) => i.product_id).filter((id): id is string => !!id);
  if (ids.length === 0) return new Map();
  const { data } = await svc
    .from("products")
    .select("id, is_virtual, is_donation")
    .in("id", ids);
  return new Map(
    ((data ?? []) as { id: string; is_virtual: boolean; is_donation: boolean }[])
      .map((p) => [p.id, { is_virtual: p.is_virtual, is_donation: p.is_donation }]),
  );
}

export interface RefundLedgerRow {
  id: string;
  amount: number;
  idempotency_key: string;
}

export type ExecuteRefundResult =
  | { ok: true; balanceAfter: number | null }
  | { ok: false; status: number; error: string };

/**
 * 승인된(approved) 전액환불을 실행한다: 토스 취소 → 원장 완료 → 주문 확정 → 재고·포인트·후원 후처리.
 *
 * 호출 전 전제: order_refunds 행이 status='approved'로 존재해야 한다.
 * 토스 실패 시 행을 'failed'로 남기고 에러를 돌려준다(관리자 재시도 대상).
 */
export async function executeFullRefund(
  svc: SupabaseClient,
  order: RefundOrderRow,
  items: RefundOrderItemRow[],
  refund: RefundLedgerRow,
  cancelReason: string,
): Promise<ExecuteRefundResult> {
  const secretKey = process.env.TOSS_SECRET_KEY;
  if (!secretKey) {
    return { ok: false, status: 503, error: "결제 설정이 아직 완료되지 않았어요." };
  }
  if (!order.payment_key) {
    return { ok: false, status: 409, error: "결제 정보를 찾을 수 없어요." };
  }

  const alreadyRefunded = order.refund_amount ?? 0;
  // 반품 배송비 차감 등으로 환불액이 결제액보다 작으면 토스에는 부분취소로 나간다.
  // ⚠ 과세제외액이 있는 일부 카드 결제는 토스가 부분취소를 거부한다 — 그 에러는
  //   메시지 그대로 표면화해 관리자 수동 처리(토스 상점관리자)로 넘긴다.
  const isWholePayment = alreadyRefunded === 0 && refund.amount >= order.payment_amount;

  const basicAuth = Buffer.from(`${secretKey}:`).toString("base64");
  let tossBalanceAfter: number | null = null;
  let tossTransactionKey: string | null = null;
  try {
    const res = await fetch(
      `https://api.tosspayments.com/v1/payments/${encodeURIComponent(order.payment_key)}/cancel`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${basicAuth}`,
          "Content-Type": "application/json",
          // 토스는 같은 키의 재요청에 첫 응답을 그대로 반환(300자·15일) —
          // DB unique 제약과 같은 값이라 이중 청구가 구조적으로 불가능.
          "Idempotency-Key": refund.idempotency_key,
        },
        body: JSON.stringify({
          cancelReason,
          ...(isWholePayment ? {} : { cancelAmount: refund.amount }),
        }),
      },
    );
    const toss = (await res.json().catch(() => ({}))) as {
      message?: string;
      balanceAmount?: number;
      cancels?: { transactionKey?: string }[];
    };
    if (!res.ok) {
      console.error("[refund-executor] toss cancel failed:", safeTossError(toss), order.id);
      await svc
        .from("order_refunds")
        .update({
          status: "failed",
          admin_note: `토스 취소 실패: ${toss.message ?? "unknown"}`.slice(0, 500),
          processed_at: new Date().toISOString(),
        })
        .eq("id", refund.id)
        .eq("status", "approved");
      return {
        ok: false,
        status: 400,
        error: toss.message ?? "결제 취소에 실패했어요. 고객센터로 문의해주세요.",
      };
    }
    tossBalanceAfter = typeof toss.balanceAmount === "number" ? toss.balanceAmount : null;
    const cancels = toss.cancels ?? [];
    tossTransactionKey = cancels[cancels.length - 1]?.transactionKey ?? null;
  } catch (e) {
    console.error("[refund-executor] toss request error:", safeErrorMessage(e, [order.payment_key]));
    // 네트워크 단절 — 토스에 갔는지 알 수 없다. 행을 failed로 남기되 같은 idempotency_key로
    // 재시도하면 토스가 멱등 처리하므로 이중 청구는 없다.
    await svc
      .from("order_refunds")
      .update({
        status: "failed",
        admin_note: "토스 호출 네트워크 오류 — 같은 요청 재시도 가능(멱등 키 보존)",
        processed_at: new Date().toISOString(),
      })
      .eq("id", refund.id)
      .eq("status", "approved");
    return { ok: false, status: 502, error: "결제 취소 중 오류가 발생했어요. 잠시 후 다시 시도해주세요." };
  }

  const pointsUsed = order.points_used ?? 0;

  // 후처리 승자 결정 — approved→completed를 실제로 전환한 요청만 재고·포인트를 만진다.
  const { data: won, error: wonError } = await svc
    .from("order_refunds")
    .update({
      status: "completed",
      toss_cancel_amount: refund.amount,
      toss_transaction_key: tossTransactionKey,
      toss_balance_after: tossBalanceAfter,
      points_restored: pointsUsed,
      processed_at: new Date().toISOString(),
    })
    .eq("id", refund.id)
    .eq("status", "approved")
    .select("id");
  if (wonError) {
    console.error("[refund-executor] ledger completion failed (manual check):", wonError, refund.id);
  }
  if (!won || won.length === 0) {
    // 다른 요청이 이미 완료 처리 — 토스는 멱등 키로 이중 청구가 없었으므로 성공으로 간주.
    return { ok: true, balanceAfter: tossBalanceAfter };
  }

  // 주문 확정 — 전액환불 완료 시에만 status를 refunded로. (트리거가 이미 허용하는 전이)
  // ⚠ M-1: .select("id")가 없으면 status 가드에 0행 매칭이어도 error가 없어 "성공"으로 읽힌다.
  //   그 상태로 아래 후처리를 진행하면 이미 환불 처리된 주문에 재고·포인트·후원을 이중 복원한다.
  //   위 원장 완료 전환(:194-213)이 쓰는 것과 같은 "이긴 요청만 후처리" 패턴으로 통일한다.
  const { data: finalized, error: orderError } = await svc
    .from("orders")
    .update({
      status: "refunded",
      refund_status: "refunded",
      refund_amount: alreadyRefunded + refund.amount,
      refunded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", order.id)
    .in("status", ["paid", "preparing", "shipping", "delivered"])
    .select("id");
  if (orderError) {
    // DB 오류 — 전이가 일어나지 않았다. 주문은 아직 환불 전 상태로 보이므로 여기서 재고·포인트를
    // 복원하면, 나중에 재시도·관리자 처리가 또 복원해 이중이 된다. 토스 환불은 이미 나갔으니
    // 관리자 수동 확인 대상으로 남기고 후처리는 하지 않는다.
    console.error("[refund-executor] order finalize failed — 후처리 생략(수동 확인 필요):", orderError, order.id);
    return { ok: true, balanceAfter: tossBalanceAfter };
  }
  if (!finalized || finalized.length === 0) {
    // 0행 매칭 = 주문이 이미 종료 상태(다른 경로가 먼저 확정). 그 경로에서 재고·포인트·후원이
    // 이미 복원됐으므로 여기서 또 하면 이중 복원이다. 토스는 멱등 키로 이중 청구가 없었다.
    console.warn("[refund-executor] order finalize matched 0 rows — 후처리 생략(이중 복원 방지):", order.id);
    return { ok: true, balanceAfter: tossBalanceAfter };
  }

  // 재고 복원 — 아직 환불 안 된 수량만. (기존 cancel 라우트와 같은 RPC)
  for (const item of items) {
    if (!item.product_id) continue;
    const qty = item.quantity - (item.refunded_quantity ?? 0);
    if (qty <= 0) continue;
    const { error: stockError } = await svc.rpc("increment_product_stock", {
      p_product_id: item.product_id,
      p_qty: qty,
    });
    if (stockError) console.error("[refund-executor] stock restore failed:", stockError, item.product_id);
  }

  // 품목별 환불 수량·후원 차감 기록 — 공개 후원 집계(donation_totals)가 이 값으로 순액을 계산한다.
  for (const item of items) {
    const remainingQty = item.quantity - (item.refunded_quantity ?? 0);
    if (remainingQty <= 0) continue;
    const delta = donationDelta(
      item.donation_amount ?? 0,
      remainingQty,
      item.quantity,
      item.donation_refunded ?? 0,
    );
    const { error: itemError } = await svc
      .from("order_items")
      .update({
        refunded_quantity: item.quantity,
        donation_refunded: (item.donation_refunded ?? 0) + delta,
      })
      .eq("id", item.id);
    if (itemError) console.error("[refund-executor] item refund mark failed:", itemError, item.id);
  }

  // 사용 포인트 반환 — 전액환불은 기존 취소 경로와 같은 reason(order-cancel:{id})을 써서
  // point_ledger unique(user_id, reason)로 이중 반환을 충돌시킨다.
  if (pointsUsed > 0 && order.user_id) {
    const { error: pointError } = await svc.rpc("grant_points", {
      p_user_id: order.user_id,
      p_amount: pointsUsed,
      p_reason: pointRefundReason(order.id, refund.id, true),
      p_note: `주문 ${order.order_number} 환불 포인트 반환`,
    });
    if (pointError) {
      console.error("[refund-executor] point refund failed (manual check):", pointError, order.id);
    }
  }

  return { ok: true, balanceAfter: tossBalanceAfter };
}
