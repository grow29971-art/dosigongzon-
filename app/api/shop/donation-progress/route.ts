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

  // 1순위: donation_totals 뷰 — 부분환불 차감(donation_refunded)까지 반영된 순액.
  // 마이그레이션 전(뷰 없음)이면 기존 앱 집계로 폴백(전액환불만 반영됨).
  const { data: viewRow, error: viewError } = await svc
    .from("donation_totals")
    .select("donation_net")
    .maybeSingle();

  let total: number;
  if (!viewError && viewRow) {
    total = Number((viewRow as { donation_net: number | string }).donation_net ?? 0);
  } else {
    const { data, error } = await svc
      .from("order_items")
      .select("donation_amount, order:orders!inner(status)")
      .in("order.status", COUNTED_STATUSES);

    if (error) {
      console.error("[donation-progress] aggregate failed:", error);
      return NextResponse.json({ error: "집계에 실패했어요." }, { status: 500 });
    }

    total = ((data ?? []) as { donation_amount: number }[])
      .reduce((sum, r) => sum + (r.donation_amount ?? 0), 0);
  }

  return NextResponse.json(
    { total, goal: GOAL_AMOUNT, goalLabel: GOAL_LABEL },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } },
  );
}
