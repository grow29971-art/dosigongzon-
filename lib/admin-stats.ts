// ══════════════════════════════════════════
// 관리자 대시보드 통계 집계
// 모든 쿼리 RLS 보호 (admin만 접근)
// ══════════════════════════════════════════

import { createClient } from "@/lib/supabase/client";

export interface AdminStats {
  totalCats: number;
  totalPosts: number;
  totalComments: number;
  pendingReports: number;
  pendingInquiries: number;
  todayVisits: number;
  todayErrors: number;
  totalUsers: number; // profiles 기준
  suspendedUsers: number;
  errors7d: number;
  // 출시 D-day & 일별 가입 추이
  daysUntilLaunch: number; // 5/25까지 남은 일수, 음수면 출시 후
  newUsersToday: number;
  newUsersYesterday: number;
  newCatsToday: number;
}

// 정식 출시 D-day — LaunchCountdown과 동일
const LAUNCH_DATE = new Date("2026-06-01T00:00:00+09:00");

async function safeCount(
  supabase: ReturnType<typeof createClient>,
  table: string,
  filter?: (q: ReturnType<ReturnType<typeof createClient>["from"]>) => ReturnType<ReturnType<typeof createClient>["from"]>,
): Promise<number> {
  try {
    let q = supabase.from(table).select("*", { count: "exact", head: true });
    if (filter) q = filter(q) as typeof q;
    const { count } = await q;
    return count ?? 0;
  } catch {
    return 0;
  }
}

export async function getAdminStats(): Promise<AdminStats> {
  const supabase = createClient();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalCats,
    totalPosts,
    totalComments,
    pendingReports,
    pendingInquiries,
    totalUsers,
    suspendedUsers,
    todayErrors,
    errors7d,
    newUsersToday,
    newUsersYesterday,
    newCatsToday,
  ] = await Promise.all([
    safeCount(supabase, "cats"),
    safeCount(supabase, "posts"),
    safeCount(supabase, "cat_comments"),
    safeCount(supabase, "reports", (q) => q.eq("status", "pending")),
    safeCount(supabase, "inquiries", (q) => q.eq("status", "pending")),
    safeCount(supabase, "profiles"),
    safeCount(supabase, "profiles", (q) => q.not("suspended_until", "is", null)),
    safeCount(supabase, "auth_error_logs", (q) => q.gte("created_at", todayStart.toISOString())),
    safeCount(supabase, "auth_error_logs", (q) => q.gte("created_at", weekAgo.toISOString())),
    safeCount(supabase, "profiles", (q) => q.gte("created_at", todayStart.toISOString())),
    safeCount(supabase, "profiles", (q) =>
      q.gte("created_at", yesterdayStart.toISOString()).lt("created_at", todayStart.toISOString()),
    ),
    safeCount(supabase, "cats", (q) => q.gte("created_at", todayStart.toISOString())),
  ]);

  // 출시까지 남은 일수 (음수면 출시 후 경과일)
  const diffMs = LAUNCH_DATE.getTime() - Date.now();
  const daysUntilLaunch = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  // 오늘 방문자는 별도 API 사용
  let todayVisits = 0;
  try {
    const res = await fetch("/api/visit");
    if (res.ok) {
      const data = await res.json();
      todayVisits = typeof data.today === "number" ? data.today : 0;
    }
  } catch { /* skip */ }

  return {
    totalCats,
    totalPosts,
    totalComments,
    pendingReports,
    pendingInquiries,
    todayVisits,
    todayErrors,
    totalUsers,
    suspendedUsers,
    errors7d,
    daysUntilLaunch,
    newUsersToday,
    newUsersYesterday,
    newCatsToday,
  };
}
