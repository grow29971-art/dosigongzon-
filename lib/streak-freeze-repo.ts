// ══════════════════════════════════════════
// 스트릭 프리즈(건너뛰기 쿠폰) repository
// ══════════════════════════════════════════

import { createClient } from "@/lib/supabase/client";

export interface FreezeRow {
  id: string;
  user_id: string;
  freeze_date: string; // "YYYY-MM-DD" (KST)
  created_at: string;
}

export interface FreezeStatus {
  dates: Set<string>;          // 지금까지 얼린 날짜 전부
  usedThisWeek: boolean;       // 이번 ISO 주에 사용했는지
  canUseToday: boolean;        // 오늘 사용 가능 조건 성립
}

function toKstDate(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}

function thisMondayKst(): string {
  const now = new Date();
  const kstNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const daysSinceMonday = (kstNow.getDay() + 6) % 7;
  const monday = new Date(kstNow);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - daysSinceMonday);
  return monday.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}

/**
 * 내 프리즈 이력 + 이번 주 사용 여부.
 * 최근 60일치만 로드.
 */
export async function getMyFreezeStatus(): Promise<FreezeStatus> {
  const empty: FreezeStatus = {
    dates: new Set(),
    usedThisWeek: false,
    canUseToday: false,
  };

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return empty;

  const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("streak_freezes")
    .select("freeze_date")
    .eq("user_id", user.id)
    .gte("created_at", since);

  if (error || !data) return empty;

  const dates = new Set((data as { freeze_date: string }[]).map((r) => r.freeze_date));
  const monday = thisMondayKst();
  const usedThisWeek = Array.from(dates).some((d) => d >= monday);
  const today = toKstDate(new Date());
  const canUseToday = !usedThisWeek && !dates.has(today);

  return { dates, usedThisWeek, canUseToday };
}

/**
 * 오늘 KST 날짜를 얼린다. 서버 RPC 호출 (주간 제약·중복 검사 원자적).
 */
export async function useFreezeToday(): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient();
  const today = toKstDate(new Date());
  const { data, error } = await supabase.rpc("use_streak_freeze", { p_date: today });
  if (error) {
    return { ok: false, error: error.message };
  }
  const result = data as { ok: boolean; error?: string } | null;
  if (!result) return { ok: false, error: "알 수 없는 오류" };
  return result;
}
