import { createClient } from "@supabase/supabase-js";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return Response.json({ available: false });
  }

  // Rate limit: IP당 분당 20회 (신규/수정 체크는 보통 수 초 간격)
  // 열거 공격(대규모 사전 공격)을 방어하는 정도의 임계치
  const ip = getClientIp(request);
  if (!rateLimit(`check-nickname:${ip}`, { max: 20, windowMs: 60_000 })) {
    return Response.json({ available: false, throttled: true }, { status: 429 });
  }

  const { nickname, currentUserId } = await request.json();
  const trimmed = nickname?.trim();

  if (!trimmed || trimmed.length < 2 || trimmed.length > 20) {
    return Response.json({ available: false });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let query = supabase
    .from("profiles")
    .select("user_id")
    .eq("nickname", trimmed);

  // 본인은 제외 (닉네임 변경 시)
  if (currentUserId) {
    query = query.neq("user_id", currentUserId);
  }

  const { data } = await query.maybeSingle();

  return Response.json({ available: !data });
}
