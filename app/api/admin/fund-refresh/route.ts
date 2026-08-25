// ══════════════════════════════════════════
// 후원금 정산 — 관리자 라이브 조회 + 스냅샷 즉시 반영 (admin 전용)
// GET  : 라이브 집계값 + 현재 스냅샷 기준 시각 (공개 카드는 건드리지 않음)
// POST : 라이브 집계를 fund_snapshot에 저장 → 공개 카드에 즉시 반영
//   (평소엔 daily-dispatch 크론이 매일 09:00 KST 갱신 — 이 버튼은 관리자가
//    지출·조정을 등록한 직후 다음날까지 기다리기 싫을 때만 쓰는 수동 트리거)
// 인증: 쿠키 세션 + admins 테이블 확인 (admin/refunds 라우트와 동일 패턴)
// ══════════════════════════════════════════

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { computeFundSettlement } from "@/lib/fund-settlement";

async function requireAdminOrResponse() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });

  const svc = createServiceClient();
  const { data: admin } = await svc
    .from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!admin) return NextResponse.json({ error: "관리자 권한이 필요해요." }, { status: 403 });
  return null;
}

export async function GET() {
  const denied = await requireAdminOrResponse();
  if (denied) return denied;

  const svc = createServiceClient();
  const settlement = await computeFundSettlement(svc);
  const { data: snap } = await svc
    .from("fund_snapshot")
    .select("collected, spent, snapped_at")
    .eq("id", 1)
    .maybeSingle();

  return NextResponse.json({
    live: settlement,
    snapshot: snap ?? null,
  });
}

export async function POST() {
  const denied = await requireAdminOrResponse();
  if (denied) return denied;

  const svc = createServiceClient();
  const settlement = await computeFundSettlement(svc);
  const snappedAt = new Date().toISOString();
  const { error } = await svc.from("fund_snapshot").upsert({
    id: 1,
    collected: settlement.collected,
    spent: settlement.spent,
    neutered_count: settlement.neuteredCount,
    disbursements: settlement.disbursements,
    snapped_at: snappedAt,
  });
  if (error) {
    console.error("[admin/fund-refresh] upsert failed:", error.code);
    return NextResponse.json({ error: "스냅샷 저장에 실패했어요. (fund_snapshot 마이그레이션 확인)" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, live: settlement, snappedAt });
}
