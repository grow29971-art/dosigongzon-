import { createClient } from "@supabase/supabase-js";
import { ADMIN_TITLES } from "@/lib/titles";

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    return Response.json({ error: "서버 오류" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // 관리자 인증
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return Response.json({ error: "인증 필요" }, { status: 401 });

  const token = authHeader.replace("Bearer ", "");
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return Response.json({ error: "인증 실패" }, { status: 401 });

  const { data: adminRow } = await supabase
    .from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!adminRow) return Response.json({ error: "관리자 권한 필요" }, { status: 403 });

  // 입력 검증
  const { userId, titleId } = await request.json();
  if (!userId) return Response.json({ error: "유저 ID 필요" }, { status: 400 });

  // titleId가 null이면 타이틀 제거, 아니면 유효한 타이틀인지 확인
  if (titleId && !ADMIN_TITLES.find((t) => t.id === titleId)) {
    return Response.json({ error: "유효하지 않은 타이틀" }, { status: 400 });
  }

  // profiles에 저장
  const { error } = await supabase
    .from("profiles")
    .update({ admin_title: titleId || null })
    .eq("id", userId);

  if (error) {
    return Response.json({ error: `저장 실패: ${error.message}` }, { status: 500 });
  }

  return Response.json({ ok: true });
}
