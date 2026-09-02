// 관리자 대시보드 통계 — 서버 집계 (2026-09-02).
// 기존에는 클라이언트에서 RLS 세션으로 count했는데, profiles 잠금(self+admin) 이후
// 가입자·오늘 가입 수가 실제보다 작게(사실상 0~1로) 나오는 문제가 있었다.
// 여기서 admin 검증 후 service 키로 정확한 전수를 센다.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const maxDuration = 30;

type CountQuery = ReturnType<
  ReturnType<ReturnType<typeof createServiceClient>["from"]>["select"]
>;

async function safeCount(
  admin: ReturnType<typeof createServiceClient>,
  table: string,
  filter?: (q: CountQuery) => CountQuery,
): Promise<number> {
  try {
    let q: CountQuery = admin.from(table).select("*", { count: "exact", head: true });
    if (filter) q = filter(q);
    const { count } = await q;
    return count ?? 0;
  } catch {
    return 0;
  }
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  }
  // admin 확인 — admins 테이블 (requireAdmin과 동일 기준, 서버판)
  const { data: adminRow } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!adminRow) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  const admin = createServiceClient();

  // KST 자정 기준 (서버는 UTC — 로컬 자정으로 세면 오늘 집계가 9시간 어긋난다)
  const now = new Date();
  const kstNow = new Date(now.getTime() + 9 * 3600 * 1000);
  const todayStart = new Date(Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate()) - 9 * 3600 * 1000);
  const yesterdayStart = new Date(todayStart.getTime() - 24 * 3600 * 1000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);

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
    safeCount(admin, "cats"),
    safeCount(admin, "posts"),
    safeCount(admin, "cat_comments"),
    safeCount(admin, "reports", (q) => q.eq("status", "pending")),
    safeCount(admin, "inquiries", (q) => q.eq("status", "pending")),
    safeCount(admin, "profiles"),
    safeCount(admin, "profiles", (q) => q.not("suspended_until", "is", null)),
    safeCount(admin, "auth_error_logs", (q) => q.gte("created_at", todayStart.toISOString())),
    safeCount(admin, "auth_error_logs", (q) => q.gte("created_at", weekAgo.toISOString())),
    safeCount(admin, "profiles", (q) => q.gte("created_at", todayStart.toISOString())),
    safeCount(admin, "profiles", (q) =>
      q.gte("created_at", yesterdayStart.toISOString()).lt("created_at", todayStart.toISOString()),
    ),
    safeCount(admin, "cats", (q) => q.gte("created_at", todayStart.toISOString())),
  ]);

  return NextResponse.json({
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
  });
}
