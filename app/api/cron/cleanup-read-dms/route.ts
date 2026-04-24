// 읽은 쪽지 자동 정리 — read_at으로부터 7일 경과 행 삭제.
// Vercel Cron 매일 03:00 KST 실행 (vercel.json).
// 수동 호출: POST /api/cron/cleanup-read-dms (CRON_SECRET 필요)
//
// 보관 기간 7일 정한 이유:
// - 분쟁·신고 대응 시 최소한의 컨텍스트 보존
// - 무한 보관은 user privacy/DB 비용 부담
// - privacy 정책에 명시 (TODO: privacy 페이지 업데이트)

import { createClient } from "@supabase/supabase-js";

export const maxDuration = 60;

const RETENTION_DAYS = 7;

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

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // 1. 카운트 (로그용)
  const { count: targetCount } = await supabase
    .from("direct_messages")
    .select("*", { count: "exact", head: true })
    .lt("read_at", cutoff);

  // 2. 삭제
  const { error: deleteError } = await supabase
    .from("direct_messages")
    .delete()
    .lt("read_at", cutoff);

  if (deleteError) {
    console.error("[cleanup-read-dms] delete failed:", deleteError);
    return Response.json({ error: deleteError.message }, { status: 500 });
  }

  return Response.json({
    ok: true,
    deleted: targetCount ?? 0,
    retentionDays: RETENTION_DAYS,
    cutoff,
  });
}

// GET 허용 — Vercel Cron이 GET 호출 (헤더는 자동으로 Bearer CRON_SECRET 추가)
export const GET = POST;
