// ══════════════════════════════════════════
// 돌봄 연속 일수 (streak) + 주간 목표 집계
// KST(Asia/Seoul) 기준 일자 계산
// ══════════════════════════════════════════

import { createClient } from "@/lib/supabase/client";

export interface StreakInfo {
  streak: number;            // 오늘(또는 어제)부터 거슬러 올라간 연속 일수
  hasToday: boolean;         // 오늘 돌봄 기록 있음
  lastCareDate: string | null; // "YYYY-MM-DD" (KST)
  weekly: {
    count: number;           // 이번 주 월~일 돌봄 횟수
    goal: number;            // 목표 (기본 7)
    byDay: boolean[];        // [월,화,수,목,금,토,일] 돌봄 유무
  };
}

// KST 날짜 문자열 "YYYY-MM-DD"
function toKstDate(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  // en-CA는 "YYYY-MM-DD" 포맷 반환
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}

// 이번 주 월요일 0시(KST)의 UTC ISO 반환
function thisMondayKstISO(): string {
  const now = new Date();
  // KST 기준 현재 시각
  const kstNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const day = kstNow.getDay(); // 0=일 1=월
  const daysSinceMonday = (day + 6) % 7;
  const kstMon = new Date(kstNow);
  kstMon.setHours(0, 0, 0, 0);
  kstMon.setDate(kstMon.getDate() - daysSinceMonday);
  // kstMon은 브라우저 로컬 기준으로 만들어졌지만, 같은 시각(KST 자정)을 ISO로 변환해 사용
  // KST와 브라우저 로컬 타임존 차이 보정
  const offsetMinutes = new Date().getTimezoneOffset() - (-540); // KST는 +9h = -540m
  const utcMs = kstMon.getTime() - offsetMinutes * 60 * 1000;
  return new Date(utcMs).toISOString();
}

export async function getMyStreakInfo(weeklyGoal = 7): Promise<StreakInfo> {
  const empty: StreakInfo = {
    streak: 0,
    hasToday: false,
    lastCareDate: null,
    weekly: { count: 0, goal: weeklyGoal, byDay: [false, false, false, false, false, false, false] },
  };

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return empty;

  // 최근 60일치 돌봄 기록 가져와서 클라이언트에서 집계
  const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("care_logs")
    .select("logged_at")
    .eq("author_id", user.id)
    .gte("logged_at", since)
    .order("logged_at", { ascending: false });

  if (error || !data) return empty;

  // KST 날짜별 set
  const daysSet = new Set<string>();
  for (const row of data as { logged_at: string }[]) {
    daysSet.add(toKstDate(row.logged_at));
  }
  if (daysSet.size === 0) return empty;

  const today = toKstDate(new Date());
  const hasToday = daysSet.has(today);

  // streak: 오늘(있으면) 또는 어제부터 거슬러
  let streak = 0;
  const cursor = new Date();
  if (!hasToday) cursor.setDate(cursor.getDate() - 1);
  for (let i = 0; i < 366; i++) {
    if (daysSet.has(toKstDate(cursor))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }

  // 이번 주(월~일) 집계
  const mondayIso = thisMondayKstISO();
  const mondayMs = new Date(mondayIso).getTime();
  const byDay = [false, false, false, false, false, false, false];
  let count = 0;
  for (const row of data as { logged_at: string }[]) {
    const t = new Date(row.logged_at).getTime();
    if (t < mondayMs) continue;
    count += 1;
    // 월요일 00:00부터 몇 일째인지
    const diffDays = Math.floor((t - mondayMs) / (24 * 60 * 60 * 1000));
    if (diffDays >= 0 && diffDays < 7) byDay[diffDays] = true;
  }

  // 최신 돌봄 날짜
  const sorted = Array.from(daysSet).sort().reverse();

  return {
    streak,
    hasToday,
    lastCareDate: sorted[0] ?? null,
    weekly: { count, goal: weeklyGoal, byDay },
  };
}
