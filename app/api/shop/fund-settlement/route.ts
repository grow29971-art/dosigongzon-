// ══════════════════════════════════════════
// 후원금 투명 정산 요약 (공개) — 일일 스냅샷 모드 (2026-08-25)
// 숫자는 매 요청 집계가 아니라 fund_snapshot(하루 1회, 09:00 KST 크론 갱신)을 읽는다.
// 구매 직후 총액 변화로 개별 주문 금액이 역산되는 것을 막고, "기준 시각"이 명확한
// 정산을 보여주기 위함. 스냅샷이 아직 없으면(마이그레이션/첫 크론 전) 라이브 집계 폴백.
// ══════════════════════════════════════════

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { computeFundSettlement } from "@/lib/fund-settlement";

export async function GET() {
  const svc = createServiceClient();

  const { data: snap, error: snapError } = await svc
    .from("fund_snapshot")
    .select("collected, spent, neutered_count, disbursements, snapped_at")
    .eq("id", 1)
    .maybeSingle();

  if (!snapError && snap) {
    const row = snap as {
      collected: number;
      spent: number;
      neutered_count: number;
      disbursements: { amount: number; memo: string; spent_at: string }[];
      snapped_at: string;
    };
    return NextResponse.json(
      {
        collected: row.collected,
        spent: row.spent,
        balance: row.collected - row.spent,
        disbursements: row.disbursements ?? [],
        neuteredCount: row.neutered_count,
        snappedAt: row.snapped_at,
      },
      // 하루 1회 데이터 — CDN 1시간 캐시로 충분 (다음 스냅샷은 다음날 아침)
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
    );
  }

  // 폴백: 스냅샷 없음(마이그레이션/첫 크론 전) — 기존 라이브 집계로 카드가 계속 동작
  const settlement = await computeFundSettlement(svc);
  return NextResponse.json(
    { ...settlement, snappedAt: null },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } },
  );
}
