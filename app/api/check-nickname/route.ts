import { createServiceClient } from "@/lib/supabase/service";
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

  const supabase = createServiceClient();

  // profiles PK는 id — 예전엔 없는 컬럼(user_id)으로 조회해 쿼리가 에러나면 data가
  // 늘 null → 무조건 available:true(중복 닉네임 통과)였음. id로 조회하고 에러도 확인.
  let query = supabase
    .from("profiles")
    .select("id")
    .eq("nickname", trimmed);

  // 본인은 제외 (닉네임 변경 시)
  if (currentUserId) {
    query = query.neq("id", currentUserId);
  }

  const { data, error } = await query.limit(1);
  if (error) {
    console.error("[check-nickname] query failed:", error);
    return Response.json({ available: false });
  }

  return Response.json({ available: !data || data.length === 0 });
}
