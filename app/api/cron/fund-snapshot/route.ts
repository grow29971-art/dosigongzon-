// 후원금 정산 일일 스냅샷 — daily-dispatch 팬아웃 (매일 00:00 UTC = 09:00 KST)
// 라이브 집계를 fund_snapshot 단일행에 저장한다. 공개 API(/api/shop/fund-settlement)는
// 이 스냅샷만 읽으므로, 구매가 일어나도 카드 숫자는 하루 1회만 갱신된다.
// (구매 직후 총액 변화로 개별 주문 금액이 역산되는 것 방지 + 기준 시각이 명확한 정산)

import { createServiceClient } from "@/lib/supabase/service";
import { computeFundSettlement } from "@/lib/fund-settlement";

async function handle(request: Request): Promise<Response> {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const svc = createServiceClient();
  const settlement = await computeFundSettlement(svc);

  const { error } = await svc.from("fund_snapshot").upsert({
    id: 1,
    collected: settlement.collected,
    spent: settlement.spent,
    neutered_count: settlement.neuteredCount,
    disbursements: settlement.disbursements,
    snapped_at: new Date().toISOString(),
  });
  if (error) {
    // 마이그레이션 전(테이블 없음) 포함 — 실패를 삼키지 않고 5xx로 노출해야
    // cron_runs/디스패처 로그에서 결행이 보인다 (7/24 "실패 200 삼킴" 교훈)
    console.error("[cron/fund-snapshot] upsert failed:", error.code, error.message);
    return Response.json({ error: "스냅샷 저장 실패", code: error.code }, { status: 500 });
  }

  return Response.json({
    ok: true,
    collected: settlement.collected,
    spent: settlement.spent,
    snappedAt: new Date().toISOString(),
  });
}

export async function POST(request: Request) {
  return handle(request);
}

// Vercel Cron/수동 테스트는 GET으로도 호출 가능
export const GET = POST;
