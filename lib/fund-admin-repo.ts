// ══════════════════════════════════════════
// 후원금 지출 관리 (관리자) — public.fund_disbursements
// RLS: 읽기 공개, 쓰기 관리자만 (DB에서 강제). 여기선 얇게 래핑만.
// ══════════════════════════════════════════

import { createClient } from "@/lib/supabase/client";

export interface Disbursement {
  id: string;
  amount: number;
  memo: string;
  spent_at: string; // YYYY-MM-DD
  created_at: string;
  /** 이 집행으로 중성화한 고양이 수 — 쇼핑 정산 카드에 합산 표시된다 */
  neutered_count: number;
}

export interface DisbursementInput {
  amount: number;
  memo: string;
  spent_at?: string; // 기본 오늘(KST)
  neuteredCount?: number;
}

export async function listDisbursements(): Promise<Disbursement[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("fund_disbursements")
    .select("id, amount, memo, spent_at, created_at, neutered_count")
    .order("spent_at", { ascending: false });
  if (error) {
    console.error("[fund-admin-repo] list failed:", error);
    return [];
  }
  return (data ?? []) as Disbursement[];
}

export async function createDisbursement(input: DisbursementInput): Promise<void> {
  const supabase = createClient();
  const amount = Math.round(input.amount);
  const memo = input.memo.trim();
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("금액을 올바르게 입력해주세요.");
  if (!memo) throw new Error("사용처를 입력해주세요.");
  const row: Record<string, unknown> = { amount, memo };
  if (input.spent_at) row.spent_at = input.spent_at;
  // 중성화 마릿수 — 안 넣으면 DB 기본값 0. 음수·소수는 막는다.
  if (input.neuteredCount != null) {
    const n = Math.round(input.neuteredCount);
    if (!Number.isFinite(n) || n < 0) throw new Error("중성화 마릿수를 올바르게 입력해주세요.");
    row.neutered_count = n;
  }
  const { error } = await supabase.from("fund_disbursements").insert(row);
  if (error) {
    console.error("[fund-admin-repo] create failed:", error);
    throw new Error(`등록 실패: ${error.message}`);
  }
}

export async function deleteDisbursement(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("fund_disbursements").delete().eq("id", id);
  if (error) throw new Error(`삭제 실패: ${error.message}`);
}

// ══════════════════════════════════════════
// 수동 조정 (증액/감액) — public.fund_adjustments
// 오프라인 후원 입금·집계 정정처럼 앱 밖의 돈을 "모인 금액"에 반영하는 장부.
// RLS: 관리자만 읽기/쓰기. 수정은 없음 — 정정은 삭제 후 재등록(사유가 남는 장부 원칙).
// ══════════════════════════════════════════

export interface Adjustment {
  id: string;
  amount: number; // 양수=증액, 음수=감액
  memo: string;
  created_at: string;
}

export async function listAdjustments(): Promise<Adjustment[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("fund_adjustments")
    .select("id, amount, memo, created_at")
    .order("created_at", { ascending: false });
  if (error) {
    // 마이그레이션 전(테이블 없음)이면 빈 목록 — 화면은 계속 동작
    console.error("[fund-admin-repo] listAdjustments failed:", error.code);
    return [];
  }
  return (data ?? []) as Adjustment[];
}

export async function createAdjustment(amount: number, memo: string): Promise<void> {
  const supabase = createClient();
  const value = Math.round(amount);
  const reason = memo.trim();
  if (!Number.isFinite(value) || value === 0) throw new Error("조정 금액을 올바르게 입력해주세요.");
  if (!reason) throw new Error("조정 사유를 입력해주세요.");
  const { error } = await supabase.from("fund_adjustments").insert({ amount: value, memo: reason });
  if (error) {
    console.error("[fund-admin-repo] createAdjustment failed:", error.code);
    throw new Error("조정 등록에 실패했어요. (fund_adjustments 마이그레이션 실행 여부 확인)");
  }
}

export async function deleteAdjustment(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("fund_adjustments").delete().eq("id", id);
  if (error) throw new Error(`조정 삭제 실패: ${error.message}`);
}
