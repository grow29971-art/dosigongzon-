// 버려진 결제대기 주문 자동 정리 — 24시간 지난 pending 주문을 취소 처리.
// + 구매확정 적립: 배송완료 7일 지난 주문에 구매 적립 지급(2026-10-02, 결제 시점에서 이동).
// (결제창만 열고 이탈한 주문. pending 상태는 재고를 점유하지 않으므로 상태만 변경.)
// Vercel Cron 매일 04:00 KST 실행 (vercel.json).
// 수동 호출: POST /api/cron/cleanup-stale-orders (CRON_SECRET 필요)

import { createServiceClient } from "@/lib/supabase/service";
import { reportError } from "@/lib/error-report";
import { grantPurchaseReward } from "@/lib/purchase-reward";

export const maxDuration = 60;

const STALE_HOURS = 24;
// 구매확정 — 배송완료 후 이 일수가 지나면 구매 적립 지급(lib/purchase-reward.ts 상단)
const REWARD_CONFIRM_DAYS = 7;
// 크론이 며칠 빠져도 놓치지 않게 넉넉히 훑는다(grant_points가 reason 유니크로 멱등)
const REWARD_LOOKBACK_DAYS = 30;

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    return Response.json({ error: "서버 설정 미완료" }, { status: 500 });
  }

  const supabase = createServiceClient();
  const cutoff = new Date(Date.now() - STALE_HOURS * 60 * 60 * 1000).toISOString();

  // payment_key가 잡힌 pending은 confirm이 토스 승인 중(카드 청구 진행)일 수 있어
  // 취소 대상에서 제외한다 — cancel 라우트와 동일한 가드. 청구됐는데 무환불 취소되는
  // 이중장애(confirm 크래시 + 웹훅 미도달)를 막고, 해당 주문은 웹훅/reconcile에 위임.
  const { data: updated, error } = await supabase
    .from("orders")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("status", "pending")
    .is("payment_key", null)
    .lt("created_at", cutoff)
    .select("id");

  if (error) {
    reportError("cron/cleanup-stale-orders", error);
    return Response.json({ error: error.message }, { status: 500 });
  }

  // 구매확정 적립 — 배송완료 후 7일 지난 회원 주문. 환불·취소된 주문은 status로 빠진다.
  const confirmBefore = new Date(Date.now() - REWARD_CONFIRM_DAYS * 86_400_000).toISOString();
  const confirmAfter = new Date(Date.now() - REWARD_LOOKBACK_DAYS * 86_400_000).toISOString();
  const { data: confirmed, error: confirmedError } = await supabase
    .from("orders")
    .select("id, order_number, payment_amount, user_id")
    .eq("status", "delivered")
    .not("user_id", "is", null)
    .lte("delivered_at", confirmBefore)
    .gte("delivered_at", confirmAfter);
  if (confirmedError) reportError("cron/cleanup-stale-orders:reward", confirmedError);
  let rewarded = 0;
  for (const o of (confirmed ?? []) as { id: string; order_number: string; payment_amount: number; user_id: string }[]) {
    if ((await grantPurchaseReward(supabase, o, o.user_id)) > 0) rewarded++;
  }

  return Response.json({
    ok: true,
    cancelled: updated?.length ?? 0,
    rewarded,
    staleHours: STALE_HOURS,
    cutoff,
  });
}

// GET 허용 — Vercel Cron이 GET 호출 (헤더는 자동으로 Bearer CRON_SECRET 추가)
export const GET = POST;
