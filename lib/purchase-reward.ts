// ══════════════════════════════════════════
// 구매 적립 지급 — 결제 성공 시 결제액의 등급% 를 포인트로 적립 (2026-08-30)
// confirm·webhook 양쪽에서 호출될 수 있으나 grant_points의 (user, reason) 유니크로 멱등.
// 게스트(memberId 없음)는 지갑이 없어 미적립.
// ══════════════════════════════════════════

import type { SupabaseClient } from "@supabase/supabase-js";
import { purchaseRewardTier, purchaseRewardPoints } from "@/lib/points-config";

interface RewardOrder {
  id: string;
  order_number: string;
  payment_amount: number | null;
}

/**
 * 결제 완료된 주문에 구매 적립 포인트 지급.
 * 등급 = 이 유저의 과거 결제완료(paid_at not null) 주문 수(이 주문 제외).
 * 반환: 적립된 포인트(멱등 재호출·미적립 시 0).
 */
export async function grantPurchaseReward(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  svc: SupabaseClient<any, any, any>,
  order: RewardOrder,
  memberId: string | null,
): Promise<number> {
  if (!memberId) return 0;
  const payAmount = order.payment_amount ?? 0;
  if (payAmount <= 0) return 0;

  // 과거 결제완료 주문 수 (이 주문 제외) — 등급 판정
  const { count } = await svc
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("user_id", memberId)
    .not("paid_at", "is", null)
    .neq("id", order.id);

  const { rate } = purchaseRewardTier(count ?? 0);
  const pts = purchaseRewardPoints(payAmount, rate);
  if (pts <= 0) return 0;

  const { data: ok, error } = await svc.rpc("grant_points", {
    p_user_id: memberId,
    p_amount: pts,
    p_reason: `purchase-reward:${order.id}`, // (user,reason) 유니크 → confirm+webhook 중복 차단
    p_note: `주문 ${order.order_number} 구매 적립 (${Math.round(rate * 100)}%)`,
  });
  if (error) {
    // 유니크 위반(중복 호출)은 정상 — 이미 적립됨. 그 외만 로그.
    if (!String(error.message || "").toLowerCase().includes("duplicate")) {
      console.error("[purchase-reward] grant failed:", error.code ?? error.message, order.id);
    }
    return 0;
  }
  return ok === true ? pts : 0;
}
