import { createServiceClient } from "@/lib/supabase/service";

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

  const supabase = createServiceClient();
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

  // 주문·결제·환불 기록은 전자상거래법상 보존 대상(계약·대금결제 5년, 소비자불만 3년)이라
  // 계정과 함께 지우면 안 된다. 탈퇴 시점만 남기고 계정 연결은 FK(on delete set null)가 끊는다.
  // box/supabase_orders_retention_migration.sql 실행 전이면 컬럼이 없어 42703이 나는데,
  // 그때는 기존 동작(CASCADE 삭제)이므로 표식 없이 진행한다.
  const { error: markError } = await supabase
    .from("orders")
    .update({ user_deleted_at: new Date().toISOString() })
    .eq("user_id", user.id);
  if (markError && markError.code !== "42703" && markError.code !== "PGRST204") {
    console.error("[account/delete] 주문 탈퇴 표식 실패:", markError.code);
    return Response.json({ error: "탈퇴 처리에 실패했어요. 잠시 후 다시 시도해주세요." }, { status: 500 });
  }

  // 유저 삭제 (service_role로 auth.users에서 삭제 → 나머지 테이블은 CASCADE로 정리)
  const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);

  if (deleteError) {
    return Response.json({ error: "탈퇴 처리에 실패했어요." }, { status: 500 });
  }

  return Response.json({ success: true });
}
