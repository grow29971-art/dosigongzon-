// 관리자 전용 인사이트 API — 클라이언트가 /admin/insights에서 호출.
// RLS에 더해 코드 레벨 이중 확인.

import { createClient } from "@/lib/supabase/server";
import { getInsightsSnapshot } from "@/lib/insights-repo";

export async function GET() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  // admin 확인
  const { data: adminRow } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!adminRow) {
    return Response.json({ error: "관리자 권한이 필요해요." }, { status: 403 });
  }

  try {
    const snapshot = await getInsightsSnapshot();
    return Response.json(snapshot);
  } catch (err) {
    console.error("[admin/insights] snapshot failed:", err);
    return Response.json({ error: "집계 실패" }, { status: 500 });
  }
}
