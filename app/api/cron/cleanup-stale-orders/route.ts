// 버려진 결제대기 주문 자동 정리 — 24시간 지난 pending 주문을 취소 처리.
// (결제창만 열고 이탈한 주문. pending 상태는 재고를 점유하지 않으므로 상태만 변경.)
// Vercel Cron 매일 04:00 KST 실행 (vercel.json).
// 수동 호출: POST /api/cron/cleanup-stale-orders (CRON_SECRET 필요)

import { createServiceClient } from "@/lib/supabase/service";
import { reportError } from "@/lib/error-report";

export const maxDuration = 60;

const STALE_HOURS = 24;

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

  return Response.json({
    ok: true,
    cancelled: updated?.length ?? 0,
    staleHours: STALE_HOURS,
    cutoff,
  });
}

// GET 허용 — Vercel Cron이 GET 호출 (헤더는 자동으로 Bearer CRON_SECRET 추가)
export const GET = POST;
