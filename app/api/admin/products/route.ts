import { createServiceClient } from "@/lib/supabase/service";

/**
 * 관리자 상품 목록 — supplier(도매처 메모) 포함 전체 컬럼.
 * supplier는 anon/authenticated 컬럼 권한에서 REVOKE되므로, 관리자 조회는
 * service_role 서버 경유로만 supplier를 읽는다.
 */
export async function GET(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    return Response.json({ error: "서버 오류" }, { status: 500 });
  }

  const supabase = createServiceClient();

  // 관리자 인증
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return Response.json({ error: "인증 필요" }, { status: 401 });
  const token = authHeader.replace("Bearer ", "");
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return Response.json({ error: "인증 실패" }, { status: 401 });

  const { data: adminRow } = await supabase
    .from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!adminRow) return Response.json({ error: "관리자 권한 필요" }, { status: 403 });

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[api/admin/products] list failed:", error);
    return Response.json({ error: "상품 목록을 불러올 수 없어요." }, { status: 500 });
  }

  return Response.json({ products: data ?? [] });
}
