// 사회적 증명용 집계 — 오늘 돌봄 유저·이번 주 신규 고양이·전체 돌봄 연결 수
// 비로그인 접근 가능. 개인정보 없이 숫자만 반환.

import { createClient } from "@supabase/supabase-js";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export const revalidate = 60; // 1분 캐시

export async function GET(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const ip = getClientIp(request);
  if (!rateLimit(`social-proof:${ip}`, { max: 60, windowMs: 60_000 })) {
    return Response.json({ error: "too many requests" }, { status: 429 });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return Response.json({
      activeCaretakersToday: 0,
      newCatsThisWeek: 0,
      totalCats: 0,
    });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 오늘 00:00 KST → UTC 변환
  const kstNowStr = new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" });
  const kstNow = new Date(kstNowStr);
  const todayStartKst = new Date(kstNow);
  todayStartKst.setHours(0, 0, 0, 0);
  // KST는 UTC+9 — 9시간 빼면 UTC
  const todayStartUtcMs = todayStartKst.getTime() - 9 * 60 * 60 * 1000;
  const todayStartUtc = new Date(todayStartUtcMs).toISOString();

  // 이번 주 = 월요일 00:00 KST
  const kstDay = kstNow.getDay(); // 0=일, 1=월
  const daysSinceMonday = (kstDay + 6) % 7;
  const mondayKst = new Date(todayStartKst);
  mondayKst.setDate(mondayKst.getDate() - daysSinceMonday);
  const mondayUtcMs = mondayKst.getTime() - 9 * 60 * 60 * 1000;
  const mondayUtc = new Date(mondayUtcMs).toISOString();

  const [caretakersRes, newCatsRes, totalCatsRes] = await Promise.all([
    // 오늘 KST 돌봄 기록 있는 유저 — author_id 전부 가져와서 set 크기로 unique 카운트
    supabase
      .from("care_logs")
      .select("author_id")
      .gte("logged_at", todayStartUtc)
      .limit(2000),
    // 이번 주 신규 등록된 고양이
    supabase
      .from("cats")
      .select("*", { count: "exact", head: true })
      .gte("created_at", mondayUtc),
    // 전체 고양이 수
    supabase
      .from("cats")
      .select("*", { count: "exact", head: true }),
  ]);

  const uniqueCaretakers = new Set(
    ((caretakersRes.data ?? []) as { author_id: string | null }[])
      .map((r) => r.author_id)
      .filter((v): v is string => !!v),
  ).size;

  return Response.json({
    activeCaretakersToday: uniqueCaretakers,
    newCatsThisWeek: newCatsRes.count ?? 0,
    totalCats: totalCatsRes.count ?? 0,
  });
}
