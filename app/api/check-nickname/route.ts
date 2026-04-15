import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return Response.json({ available: false });
  }

  const { nickname, currentUserId } = await request.json();
  if (!nickname?.trim() || nickname.trim().length < 2) {
    return Response.json({ available: false });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let query = supabase
    .from("profiles")
    .select("user_id")
    .eq("nickname", nickname.trim());

  // 본인은 제외 (닉네임 변경 시)
  if (currentUserId) {
    query = query.neq("user_id", currentUserId);
  }

  const { data } = await query.maybeSingle();

  return Response.json({ available: !data });
}
