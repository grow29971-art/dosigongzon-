// ══════════════════════════════════════════
// 후원 적립 현황 (공개) — 쇼핑 홈 진행바용
// 결제완료 이후 상태(paid/preparing/shipping/delivered) 주문의
// donation_amount 스냅샷 합계. 취소/환불은 제외.
// ══════════════════════════════════════════

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

// 1차 목표 (사용처는 커뮤니티 투표로 결정 예정 — 2026-07-14)
const GOAL_AMOUNT = 100_000;
const GOAL_LABEL = "1차 목표";

const COUNTED_STATUSES = ["paid", "preparing", "shipping", "delivered"];

export async function GET() {
  const svc = createServiceClient();

  const { data, error } = await svc
    .from("order_items")
    .select("donation_amount, order:orders!inner(status)")
    .in("order.status", COUNTED_STATUSES);

  if (error) {
    console.error("[donation-progress] aggregate failed:", error);
    return NextResponse.json({ error: "집계에 실패했어요." }, { status: 500 });
  }

  const total = ((data ?? []) as { donation_amount: number }[])
    .reduce((sum, r) => sum + (r.donation_amount ?? 0), 0);

  return NextResponse.json(
    { total, goal: GOAL_AMOUNT, goalLabel: GOAL_LABEL },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } },
  );
}
