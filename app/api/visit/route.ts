import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return Response.json({ count: 0 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // 유저 인증 확인
  const authHeader = request.headers.get("authorization");
  if (!authHeader) {
    // 비로그인 → 카운트만 조회
    const today = new Date().toISOString().split("T")[0];
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

  // 오늘 방문자 수
  const today = new Date().toISOString().split("T")[0];
  const { data: todayData } = await supabase
    .from("daily_stats")
    .select("visit_count")
    .eq("date", today)
    .maybeSingle();

  // 전체 가입자 수 (auth.users → profiles 테이블)
  const { count: totalUsers } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true });

  return Response.json({
    today: todayData?.visit_count ?? 0,
    total: totalUsers ?? 0,
  });
}
