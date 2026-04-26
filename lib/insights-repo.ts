// ══════════════════════════════════════════
// 관리자 분석(insights) 집계
// /admin/insights에서 사용. service_role 없이 일반 클라이언트로도 접근 가능한
// 지표만 선별 (RLS가 허용하거나 admin 정책으로 읽을 수 있는 테이블).
// ══════════════════════════════════════════

import { createClient } from "@/lib/supabase/server";

export interface InsightsSnapshot {
  // 누적 수
  totalUsers: number;
  totalCats: number;
  totalPosts: number;
  totalCareLogs: number;
  // 오늘 (KST)
  newUsersToday: number;
  newCatsToday: number;
  newPostsToday: number;
  newCareLogsToday: number;
  // 이번 주 (월요일 00:00 KST 기준)
  newUsersWeek: number;
  newCatsWeek: number;
  newPostsWeek: number;
  newCareLogsWeek: number;
  // 방문자
  visitsToday: number;
  visitsWeek: number;
  // 에러
  authErrorsWeek: number;
  authErrorTopCodes: Array<{ code: string; count: number }>;
  // 인기 고양이 TOP 5
  topCats: Array<{ id: string; name: string; like_count: number; region: string | null }>;
  // 활성 유저 TOP 5 (최근 7일 care_logs 많이 쓴 사람)
  topCaretakers: Array<{ user_id: string; name: string; count: number }>;
  // 위급 알림 (health-alert-push cron 가시성)
  urgentCatsTotal: number;       // 현재 caution/danger 상태 고양이 총수
  urgentCatsStale: number;       // 그중 3일 이상 돌봄 부재
  alertPushesWeek: number;       // 최근 7일 push_alert_log 발송 건수
  alertPushedUsersWeek: number;  // 최근 7일 unique 수신 유저 수
}

function startOfKstToday(): string {
  // KST 자정 ISO. 요청 시점의 KST 날짜의 00:00 KST → UTC.
  const nowKst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  nowKst.setHours(0, 0, 0, 0);
  return new Date(nowKst.getTime() - 9 * 60 * 60 * 1000).toISOString();
}

function startOfKstWeek(): string {
  // 이번 주 월요일 00:00 KST
  const nowKst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const day = nowKst.getDay(); // 0=일요일, 1=월요일
  const daysFromMonday = (day + 6) % 7;
  nowKst.setDate(nowKst.getDate() - daysFromMonday);
  nowKst.setHours(0, 0, 0, 0);
  return new Date(nowKst.getTime() - 9 * 60 * 60 * 1000).toISOString();
}

async function count(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: string,
  filter?: { column: string; gte: string },
): Promise<number> {
  let q = supabase.from(table).select("*", { count: "exact", head: true });
  if (filter) q = q.gte(filter.column, filter.gte);
  const { count: c } = await q;
  return c ?? 0;
}

export async function getInsightsSnapshot(): Promise<InsightsSnapshot> {
  const supabase = await createClient();
  const todayStart = startOfKstToday();
  const weekStart = startOfKstWeek();

  // 누적 + 오늘 + 이번 주 count을 병렬로
  const [
    totalUsers, totalCats, totalPosts, totalCareLogs,
    newUsersToday, newCatsToday, newPostsToday, newCareLogsToday,
    newUsersWeek, newCatsWeek, newPostsWeek, newCareLogsWeek,
  ] = await Promise.all([
    count(supabase, "profiles"),
    count(supabase, "cats"),
    count(supabase, "posts"),
    count(supabase, "care_logs"),
    count(supabase, "profiles", { column: "created_at", gte: todayStart }),
    count(supabase, "cats", { column: "created_at", gte: todayStart }),
    count(supabase, "posts", { column: "created_at", gte: todayStart }),
    count(supabase, "care_logs", { column: "logged_at", gte: todayStart }),
    count(supabase, "profiles", { column: "created_at", gte: weekStart }),
    count(supabase, "cats", { column: "created_at", gte: weekStart }),
    count(supabase, "posts", { column: "created_at", gte: weekStart }),
    count(supabase, "care_logs", { column: "logged_at", gte: weekStart }),
  ]);

  // 방문자 (daily_stats)
  const { data: todayStats } = await supabase
    .from("daily_stats")
    .select("visit_count")
    .gte("date", todayStart.slice(0, 10))
    .limit(1)
    .maybeSingle();
  const visitsToday = (todayStats?.visit_count as number | undefined) ?? 0;

  const { data: weekStats } = await supabase
    .from("daily_stats")
    .select("visit_count")
    .gte("date", weekStart.slice(0, 10));
  const visitsWeek = ((weekStats ?? []) as Array<{ visit_count: number | null }>)
    .reduce((sum, r) => sum + (r.visit_count ?? 0), 0);

  // 에러 로그 (최근 7일)
  const { data: errorRows } = await supabase
    .from("auth_error_logs")
    .select("error_code")
    .gte("created_at", weekStart)
    .limit(1000);
  const authErrorsWeek = errorRows?.length ?? 0;
  const codeMap = new Map<string, number>();
  for (const r of (errorRows ?? []) as Array<{ error_code: string | null }>) {
    const c = r.error_code ?? "unknown";
    codeMap.set(c, (codeMap.get(c) ?? 0) + 1);
  }
  const authErrorTopCodes = Array.from(codeMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([code, count]) => ({ code, count }));

  // 인기 고양이 TOP 5
  const { data: topCatsRaw } = await supabase
    .from("cats")
    .select("id, name, like_count, region")
    .eq("hidden", false)
    .order("like_count", { ascending: false, nullsFirst: false })
    .limit(5);
  const topCats = ((topCatsRaw ?? []) as Array<{ id: string; name: string; like_count: number | null; region: string | null }>)
    .map((c) => ({ id: c.id, name: c.name, like_count: c.like_count ?? 0, region: c.region }));

  // 활성 caretakers (이번 주 care_logs 작성 많은 순)
  const { data: weekLogs } = await supabase
    .from("care_logs")
    .select("author_id, author_name")
    .gte("logged_at", weekStart)
    .limit(2000);
  const userMap = new Map<string, { name: string; count: number }>();
  for (const l of (weekLogs ?? []) as Array<{ author_id: string; author_name: string | null }>) {
    const prev = userMap.get(l.author_id);
    if (prev) {
      prev.count += 1;
    } else {
      userMap.set(l.author_id, { name: l.author_name ?? "익명", count: 1 });
    }
  }
  const topCaretakers = Array.from(userMap.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)
    .map(([user_id, { name, count }]) => ({ user_id, name, count }));

  // ── 위급 알림 통계 (health-alert-push cron 가시성) ──
  const STALE_DAYS = 3;
  const staleAt = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const week7Ago = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [{ count: urgentCatsTotal }, urgentCatsRes, alertLogsRes] = await Promise.all([
    supabase
      .from("cats")
      .select("*", { count: "exact", head: true })
      .in("health_status", ["caution", "danger"]),
    supabase
      .from("cats")
      .select("id")
      .in("health_status", ["caution", "danger"])
      .not("region", "is", null),
    // push_alert_log 테이블이 없으면 빈 응답으로 폴백
    supabase
      .from("push_alert_log")
      .select("user_id, cat_id, sent_at")
      .gte("sent_at", week7Ago)
      .limit(5000),
  ]);

  // urgentCatsStale 계산
  const urgentIds = ((urgentCatsRes.data ?? []) as { id: string }[]).map((c) => c.id);
  let urgentCatsStale = 0;
  if (urgentIds.length > 0) {
    const { data: recent } = await supabase
      .from("care_logs")
      .select("cat_id")
      .in("cat_id", urgentIds)
      .gte("logged_at", staleAt);
    const recentSet = new Set(((recent ?? []) as { cat_id: string }[]).map((r) => r.cat_id));
    urgentCatsStale = urgentIds.filter((id) => !recentSet.has(id)).length;
  }

  // 알림 통계 (테이블 없으면 0)
  const alertRows = (alertLogsRes.data ?? []) as { user_id: string; cat_id: string; sent_at: string }[];
  const alertPushesWeek = alertRows.length;
  const alertPushedUsersWeek = new Set(alertRows.map((r) => r.user_id)).size;

  return {
    totalUsers, totalCats, totalPosts, totalCareLogs,
    newUsersToday, newCatsToday, newPostsToday, newCareLogsToday,
    newUsersWeek, newCatsWeek, newPostsWeek, newCareLogsWeek,
    visitsToday, visitsWeek,
    authErrorsWeek, authErrorTopCodes,
    topCats, topCaretakers,
    urgentCatsTotal: urgentCatsTotal ?? 0,
    urgentCatsStale,
    alertPushesWeek,
    alertPushedUsersWeek,
  };
}
