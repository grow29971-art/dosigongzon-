// ══════════════════════════════════════════
// 후원 적립 현황 (공개) — 쇼핑 홈 진행바용
// 결제완료 이후 상태(paid/preparing/shipping/delivered) 주문의
// donation_amount 스냅샷 합계. 취소/환불은 제외.
// ══════════════════════════════════════════

import { NextResponse } from "next/server";
import { createClient as serviceClient } from "@supabase/supabase-js";

// 1차 목표: 첫 번째 길고양이 쉼터 설치
const GOAL_AMOUNT = 100_000;
const GOAL_LABEL = "첫 번째 길고양이 쉼터";

const COUNTED_STATUSES = ["paid", "preparing", "shipping", "delivered"];

export async function GET() {
  const svc = serviceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

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
