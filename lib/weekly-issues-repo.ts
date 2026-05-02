// ══════════════════════════════════════════
// 도시공존 — 이번 주 동네 이슈 Repository
// Supabase public.weekly_issues
// ══════════════════════════════════════════

import { createClient } from "@/lib/supabase/client";
import { requireAdmin } from "@/lib/admin-guard";
import { isSafeHttpUrl } from "@/lib/url-validate";

export interface WeeklyIssue {
  id: string;
  emoji: string | null;
  title: string;
  body: string | null;
  week_start: string;          // "YYYY-MM-DD"
  external_url: string | null;
  external_label: string | null;
  created_at: string;
  updated_at: string;
}

export type WeeklyIssueInput = Omit<WeeklyIssue, "id" | "created_at" | "updated_at">;

function validate(input: Partial<WeeklyIssueInput>): void {
  if (input.external_url && !isSafeHttpUrl(input.external_url)) {
    throw new Error("외부 링크는 http(s) URL만 허용돼요.");
  }
}

// ── 읽기: 최근 7일 내 시작한 이슈 (홈에서 사용) ──
export async function listCurrentWeekIssues(): Promise<WeeklyIssue[]> {
  const supabase = createClient();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const { data, error } = await supabase
    .from("weekly_issues")
    .select("*")
    .gte("week_start", sevenDaysAgo)
    .order("week_start", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[weekly-issues-repo] listCurrentWeekIssues failed:", error);
    return [];
  }
  return (data ?? []) as WeeklyIssue[];
}

// ── 읽기: 전체 (admin 페이지용) ──
export async function listAllWeeklyIssues(): Promise<WeeklyIssue[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("weekly_issues")
    .select("*")
    .order("week_start", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[weekly-issues-repo] listAllWeeklyIssues failed:", error);
    return [];
  }
  return (data ?? []) as WeeklyIssue[];
}

// ── 쓰기 ──
export async function createWeeklyIssue(
  input: WeeklyIssueInput,
): Promise<WeeklyIssue> {
  await requireAdmin();
  validate(input);
  const supabase = createClient();
  const { data, error } = await supabase
    .from("weekly_issues")
    .insert(input)
    .select()
    .single();

  if (error) {
    console.error("[weekly-issues-repo] createWeeklyIssue failed:", error);
    throw new Error(`이슈 작성 실패: ${error.message}`);
  }
  return data as WeeklyIssue;
}

export async function updateWeeklyIssue(
  id: string,
  input: Partial<WeeklyIssueInput>,
): Promise<WeeklyIssue> {
  await requireAdmin();
  validate(input);
  const supabase = createClient();
  const { data, error } = await supabase
    .from("weekly_issues")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[weekly-issues-repo] updateWeeklyIssue failed:", error);
    throw new Error(`이슈 수정 실패: ${error.message}`);
  }
  return data as WeeklyIssue;
}

export async function deleteWeeklyIssue(id: string): Promise<void> {
  await requireAdmin();
  const supabase = createClient();
  const { error } = await supabase.from("weekly_issues").delete().eq("id", id);
  if (error) {
    console.error("[weekly-issues-repo] deleteWeeklyIssue failed:", error);
    throw new Error(`이슈 삭제 실패: ${error.message}`);
  }
}

// 이번 주 월요일 (KST) "YYYY-MM-DD" — admin 폼 기본값으로 사용
export function getCurrentMondayKST(): string {
  const todayKstStr = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Seoul",
  });
  const today = new Date(todayKstStr); // 로컬 자정으로 해석
  const dayOfWeek = today.getDay(); // 0(일)~6(토)
  const daysFromMonday = (dayOfWeek + 6) % 7; // 월=0, 화=1, ..., 일=6
  today.setDate(today.getDate() - daysFromMonday);
  return today.toISOString().slice(0, 10);
}
