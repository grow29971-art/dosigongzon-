// ══════════════════════════════════════════
// 돌봄 연속 일수 (streak) + 주간 목표 집계
// KST(Asia/Seoul) 기준 일자 계산
// ══════════════════════════════════════════

import { createClient } from "@/lib/supabase/client";

export interface StreakInfo {
  streak: number;            // 오늘(또는 어제)부터 거슬러 올라간 연속 일수
  hasToday: boolean;         // 오늘 돌봄 기록 있음
  lastCareDate: string | null; // "YYYY-MM-DD" (KST)
  longestStreak: number;     // 역대 최장 연속 일수
  longestStreakEndDate: string | null; // 역대 최장 기록이 끝난 날 (YYYY-MM-DD KST)
  isRecord: boolean;         // 현재 streak이 역대 최장과 동률인지 (진행 중 신기록)
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
    longestStreak: 0,
    longestStreakEndDate: null,
    isRecord: false,
    weekly: { count: 0, goal: weeklyGoal, byDay: [false, false, false, false, false, false, false] },
  };

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return empty;

  // 전체 기간 돌봄 기록 (역대 최장 계산용) — 최근 1000건 제한.
  // 하루에 여러 건 있어도 날짜만 쓰므로 충분히 많은 날을 커버함.
  const { data, error } = await supabase
    .from("care_logs")
    .select("logged_at")
    .eq("author_id", user.id)
    .order("logged_at", { ascending: false })
    .limit(1000);

  if (error || !data) return empty;

  // KST 날짜별 set
  const daysSet = new Set<string>();
  for (const row of data as { logged_at: string }[]) {
    daysSet.add(toKstDate(row.logged_at));
  }
  if (daysSet.size === 0) return empty;

  const today = toKstDate(new Date());
  const hasToday = daysSet.has(today);

  // 현재 streak: 오늘(있으면) 또는 어제부터 거슬러
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

  // 역대 최장 streak: 날짜 오름차순으로 스캔하며 연속 구간 길이 중 최대
  const sortedDays = Array.from(daysSet).sort(); // "YYYY-MM-DD" 오름차순
  let longestStreak = 0;
  let longestEnd: string | null = null;
  let runLen = 0;
  let prevDay: string | null = null;
  for (const day of sortedDays) {
    if (prevDay === null) {
      runLen = 1;
    } else {
      const prev = new Date(prevDay + "T00:00:00");
      const curr = new Date(day + "T00:00:00");
      const diffDays = Math.round(
        (curr.getTime() - prev.getTime()) / (24 * 60 * 60 * 1000),
      );
      if (diffDays === 1) {
        runLen += 1;
      } else {
        runLen = 1;
      }
    }
    if (runLen > longestStreak) {
      longestStreak = runLen;
      longestEnd = day;
    }
    prevDay = day;
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

  // 최신 돌봄 날짜 (최장 end와 다를 수 있음)
  const lastCareDate = sortedDays[sortedDays.length - 1] ?? null;

  // 현재 streak이 역대 최장과 같으면 = 신기록 진행 중
  const isRecord = streak > 0 && streak >= longestStreak;

  return {
    streak,
    hasToday,
    lastCareDate,
    longestStreak,
    longestStreakEndDate: longestEnd,
    isRecord,
    weekly: { count, goal: weeklyGoal, byDay },
  };
}
