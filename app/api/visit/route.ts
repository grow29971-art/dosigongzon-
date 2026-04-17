import { createClient } from "@supabase/supabase-js";

// 비회원 IP 중복 방지 (인메모리, 날짜별)
const anonVisitLog = new Set<string>();

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return Response.json({ count: 0 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const authHeader = request.headers.get("authorization");

  // 비로그인 → IP 기반 하루 1회 카운트
  if (!authHeader) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const today = new Date().toISOString().split("T")[0];
    const key = `${ip}_${today}`;

    if (!anonVisitLog.has(key)) {
      anonVisitLog.add(key);
      // daily_stats에 오늘 행이 없으면 생성, 있으면 +1
      const { data: existing } = await supabase
        .from("daily_stats")
        .select("visit_count")
        .eq("date", today)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("daily_stats")
          .update({ visit_count: existing.visit_count + 1 })
          .eq("date", today);
      } else {
        await supabase
          .from("daily_stats")
          .insert({ date: today, visit_count: 1 });
      }
    }

    const { data } = await supabase
      .from("daily_stats")
      .select("visit_count")
      .eq("date", today)
      .maybeSingle();
    return Response.json({ count: data?.visit_count ?? 0 });
  }

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return Response.json({ count: 0 });
  }

  // 순 방문자 카운트 (유저당 하루 1회)
  const { data, error } = await supabase.rpc("increment_daily_visit", {
    p_user_id: user.id,
  });

  if (error) {
    return Response.json({ count: 0 });
  }

  return Response.json({ count: data ?? 0 });
}

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return Response.json({ today: 0, total: 0 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // 총 누적 방문자 수 (모든 날짜의 visit_count 합산)
  const { data: allStats } = await supabase
    .from("daily_stats")
    .select("visit_count");

  const totalVisits = (allStats ?? []).reduce((sum, row) => sum + (row.visit_count ?? 0), 0);

  // 전체 가입자 수 (auth.users → profiles 테이블)
  const { count: totalUsers } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true });

  return Response.json({
    today: totalVisits,
    total: totalUsers ?? 0,
  });
}
