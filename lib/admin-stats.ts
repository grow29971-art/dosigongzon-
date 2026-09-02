// ══════════════════════════════════════════
// 관리자 대시보드 통계 집계
// 2026-09-02: 클라이언트 RLS count → 서버 API(/api/admin/stats) 집계로 전환.
// profiles 잠금(self+admin) 이후 클라이언트에서 세면 가입자 수가 실제보다 작게 나왔다.
// ══════════════════════════════════════════

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
  daysUntilLaunch: number; // 출시일까지 남은 일수, 음수면 출시 후
  newUsersToday: number;
  newUsersYesterday: number;
  newCatsToday: number;
}

// 정식 출시 D-day — LaunchCountdown과 동일
const LAUNCH_DATE = new Date("2026-06-01T00:00:00+09:00");

const EMPTY_COUNTS = {
  totalCats: 0,
  totalPosts: 0,
  totalComments: 0,
  pendingReports: 0,
  pendingInquiries: 0,
  totalUsers: 0,
  suspendedUsers: 0,
  todayErrors: 0,
  errors7d: 0,
  newUsersToday: 0,
  newUsersYesterday: 0,
  newCatsToday: 0,
};

export async function getAdminStats(): Promise<AdminStats> {
  // 서버 집계 — admin 검증은 라우트가 수행(비관리자는 403 → 0으로 표시)
  let counts = EMPTY_COUNTS;
  try {
    const res = await fetch("/api/admin/stats");
    if (res.ok) counts = { ...EMPTY_COUNTS, ...(await res.json()) };
  } catch { /* 네트워크 실패 시 0 유지 */ }

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

  return { ...counts, todayVisits, daysUntilLaunch };
}
