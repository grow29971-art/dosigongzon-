// 동네 채팅 매일 정리 — 매일 04:00 KST (19:00 UTC).
// area_chats 테이블 전체 비움. 사용자 요청: 하루마다 채팅 전부 새로고침.
// 채팅 UI에서도 "매일 새벽 4시 정리" 안내 노출.

import { createClient } from "@supabase/supabase-js";
import { reportError } from "@/lib/error-report";

export const maxDuration = 60;

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    return Response.json({ error: "서버 설정 미완료" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // 삭제 전 카운트 (로그용)
  const { count: before } = await supabase
    .from("area_chats")
    .select("*", { count: "exact", head: true });

  // 전체 삭제 — id가 NULL이 아닌 모든 행
  const { error } = await supabase
    .from("area_chats")
    .delete()
    .not("id", "is", null);

  if (error) {
    reportError("cron/cleanup-area-chats", error);
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({
    ok: true,
    deleted: before ?? 0,
    at: new Date().toISOString(),
  });
}

export const GET = POST;
