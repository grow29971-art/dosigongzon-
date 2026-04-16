import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return Response.json({ error: "서버 설정 미완료" }, { status: 500 });
  }

  // 인증 확인
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return Response.json({ error: "인증 필요" }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const token = authHeader.slice(7);
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return Response.json({ error: "인증 실패" }, { status: 401 });
  }

  // Storage 파일 삭제 (cat-photos 버킷의 사용자 폴더)
  const buckets = ["cat-photos"];
  for (const bucket of buckets) {
    const { data: files } = await supabase.storage
      .from(bucket)
      .list(user.id, { limit: 1000 });
    if (files && files.length > 0) {
      const paths = files.map((f) => `${user.id}/${f.name}`);
      await supabase.storage.from(bucket).remove(paths);
    }
  }

  // 유저 삭제 (service_role로 auth.users에서 삭제 → CASCADE로 관련 데이터 정리)
  const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);

  if (deleteError) {
    return Response.json({ error: "탈퇴 처리에 실패했어요." }, { status: 500 });
  }

  return Response.json({ success: true });
}
