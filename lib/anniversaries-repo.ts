// ══════════════════════════════════════════
// 고양이 발견 기념일 — 등록 날짜와 월/일이 같은 아이들
// KST(Asia/Seoul) 기준
// ══════════════════════════════════════════

import { createClient } from "@/lib/supabase/client";

export interface Anniversary {
  catId: string;
  name: string;
  region: string | null;
  photoUrl: string | null;
  years: number;          // 오늘 기준 몇 년째
  originalDate: string;   // 원 등록일 ISO
}

// KST 기준 오늘의 월/일 ("MM-DD")
function todayMonthDayKst(): { month: number; day: number; year: number } {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  return { month: d.getMonth() + 1, day: d.getDate(), year: d.getFullYear() };
}

// KST 기준 created_at 의 월/일·연도
function kstParts(iso: string): { month: number; day: number; year: number } {
  const d = new Date(new Date(iso).toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  return { month: d.getMonth() + 1, day: d.getDate(), year: d.getFullYear() };
}

export async function getTodayAnniversaries(opts: { onlyMine?: boolean } = {}): Promise<Anniversary[]> {
  const supabase = createClient();

  let query = supabase
    .from("cats")
    .select("id, name, region, photo_url, caretaker_id, created_at");

  if (opts.onlyMine) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    query = query.eq("caretaker_id", user.id);
  }

  const { data, error } = await query.limit(500);
  if (error || !data) return [];

  const today = todayMonthDayKst();

  const annivs: Anniversary[] = [];
  for (const c of data as { id: string; name: string; region: string | null; photo_url: string | null; caretaker_id: string | null; created_at: string }[]) {
    const parts = kstParts(c.created_at);
    if (parts.month !== today.month || parts.day !== today.day) continue;
    // 같은 해에 등록된 고양이(오늘 등록된 신생아)는 0주년 — 축하 카드에서 제외 또는 포함?
    // 포함: "오늘 구조됐어요" 식으로 표시
    const years = today.year - parts.year;
    annivs.push({
      catId: c.id,
      name: c.name,
      region: c.region,
      photoUrl: c.photo_url,
      years,
      originalDate: c.created_at,
    });
  }

  // 오래된 아이부터 먼저 (10주년 > 1주년)
  annivs.sort((a, b) => b.years - a.years);
  return annivs;
}
