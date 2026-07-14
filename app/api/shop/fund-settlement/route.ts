// ══════════════════════════════════════════
// 후원금 투명 정산 요약 (공개)
// 모인 금액 = 결제완료 주문의 donation_amount 합계 (취소/환불 제외)
// 쓰인 금액 = fund_disbursements 합계 · 잔액 = 모인 − 쓰인
// ══════════════════════════════════════════

import { NextResponse } from "next/server";
import { createClient as serviceClient } from "@supabase/supabase-js";

const COUNTED_STATUSES = ["paid", "preparing", "shipping", "delivered"];

export async function GET() {
  const svc = serviceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // 모인 금액
  const { data: items } = await svc
    .from("order_items")
    .select("donation_amount, order:orders!inner(status)")
    .in("order.status", COUNTED_STATUSES);
  const collected = ((items ?? []) as { donation_amount: number }[])
    .reduce((s, r) => s + (r.donation_amount ?? 0), 0);

  // 쓰인 금액(전체 합계) + 최근 지출 내역 (테이블 없으면 조용히 0)
  let spent = 0;
  let disbursements: { amount: number; memo: string; spent_at: string }[] = [];
  const { data: allDis, error: disErr } = await svc
    .from("fund_disbursements")
    .select("amount, memo, spent_at")
    .order("spent_at", { ascending: false });
  if (!disErr && allDis) {
    const rows = allDis as typeof disbursements;
    spent = rows.reduce((s, d) => s + (d.amount ?? 0), 0);
    disbursements = rows.slice(0, 10); // 표시는 최근 10건
  }

  return NextResponse.json(
    { collected, spent, balance: collected - spent, disbursements },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } },
  );
}
