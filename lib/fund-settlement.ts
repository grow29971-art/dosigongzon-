// ══════════════════════════════════════════
// 후원금 정산 집계 (서버 전용 — service_role 클라이언트로만 호출)
// /api/shop/fund-settlement의 라이브 집계를 크론(fund-snapshot)과 공유하려고 추출.
// 모인 금액 = 결제완료 주문의 donation_amount 합계 (취소/환불 차감)
// 쓰인 금액 = fund_disbursements 합계 · 잔액 = 모인 − 쓰인
// ══════════════════════════════════════════

import type { SupabaseClient } from "@supabase/supabase-js";

export const COUNTED_STATUSES = ["paid", "preparing", "shipping", "delivered"];

export interface FundSettlement {
  collected: number;
  spent: number;
  balance: number;
  disbursements: { amount: number; memo: string; spent_at: string }[];
  neuteredCount: number;
}

export async function computeFundSettlement(svc: SupabaseClient): Promise<FundSettlement> {
  // 모인 금액 — donation_totals 뷰(부분환불 차감 반영) 우선, 마이그레이션 전이면 기존 집계 폴백
  let collected: number;
  const { data: viewRow, error: viewError } = await svc
    .from("donation_totals")
    .select("donation_net")
    .maybeSingle();
  if (!viewError && viewRow) {
    collected = Number((viewRow as { donation_net: number | string }).donation_net ?? 0);
  } else {
    const { data: items } = await svc
      .from("order_items")
      .select("donation_amount, order:orders!inner(status)")
      .in("order.status", COUNTED_STATUSES);
    collected = ((items ?? []) as { donation_amount: number }[])
      .reduce((s, r) => s + (r.donation_amount ?? 0), 0);
  }

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

  // 후원금으로 중성화한 마릿수 — 집행 내역(fund_disbursements)에 기록된 값의 합계.
  // 지도에 등록된 중성화 개체 수와는 다르다. 집행이 없으면 0이며, 0을 그대로 보여준다.
  // (neutered_count 컬럼 마이그레이션 전이면 조용히 0)
  let neuteredCount = 0;
  const { data: neuteredRows, error: neuteredErr } = await svc
    .from("fund_disbursements")
    .select("neutered_count");
  if (!neuteredErr && neuteredRows) {
    neuteredCount = (neuteredRows as { neutered_count: number | null }[])
      .reduce((s, r) => s + (r.neutered_count ?? 0), 0);
  }

  return { collected, spent, balance: collected - spent, disbursements, neuteredCount };
}
