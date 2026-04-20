import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return Response.json({ count: 0 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const authHeader = request.headers.get("authorization");
  const ip = getClientIp(request);

  // Rate limit: IP당 분당 30회 초과 요청 차단 (봇 폭격 방어)
  if (!rateLimit(`visit:${ip}`, { max: 30, windowMs: 60_000 })) {
    return Response.json({ count: 0 }, { status: 429 });
  }

  // 비로그인 → IP 해시 기반 하루 1회 카운트 (DB 레벨 dedup)
  if (!authHeader) {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
    const ipHash = hashIp(ip);

    // 원자적 INSERT — 중복이면 아무 동작 안 함
    const { error: insertErr } = await supabase
      .from("anon_visit_dedupe")
      .insert({ ip_hash: ipHash, visit_date: today });

    // insertErr가 null이면 신규 방문 → daily_stats 증가
    // duplicate key 에러면 이미 카운트된 유저 → 증가 스킵
    if (!insertErr) {
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

  // 순 방문자 카운트 (유저당 하루 1회 — Supabase RPC가 이미 원자적)
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

  const { data: allStats } = await supabase
    .from("daily_stats")
    .select("visit_count");

  const totalVisits = (allStats ?? []).reduce((sum, row) => sum + (row.visit_count ?? 0), 0);

  const { count: totalUsers } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true });

  return Response.json({
    today: totalVisits,
    total: totalUsers ?? 0,
  });
}
