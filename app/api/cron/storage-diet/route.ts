// 누적 로그·dedupe 테이블 자동 정리 (스토리지 다이어트)
// Vercel Cron 매일 17:00 UTC (= 02:00 KST 다음날) 실행 — 한가한 시간대.
// 수동 호출: POST /api/cron/storage-diet (CRON_SECRET 필요)
//
// 정리 대상 (안전 — 기능 영향 없음):
//   - push_alert_log:    30일 (발송 로그, 분석 종료 후 무의미)
//   - auth_error_logs:   90일 (로그인 에러 패턴 분석용, 분기당 1회면 충분)
//   - anon_visit_dedupe: 30일 (DAU 중복 제거용, 더 이상 의미 없음)
//
// box/supabase_storage_diet_cleanup.sql PART 2와 동일한 정책.
// 고아 storage 파일 정리(PART 4)는 race condition 리스크로 자동화하지 않음.

import { createClient } from "@supabase/supabase-js";
import { reportError } from "@/lib/error-report";

export const maxDuration = 60;

// (table, cutoff column) — 보존 기간(일)
const CLEANUP_RULES: Array<{ table: string; column: string; days: number }> = [
  { table: "push_alert_log",   column: "sent_at",    days: 30 },
  { table: "auth_error_logs",  column: "created_at", days: 90 },
  { table: "anon_visit_dedupe",column: "visit_date", days: 30 },
];

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

  const results: Record<string, { deleted: number; error: string | null }> = {};
  let totalDeleted = 0;
  let hasError = false;

  for (const { table, column, days } of CLEANUP_RULES) {
    const cutoffIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    try {
      // visit_date는 date 타입이라 YYYY-MM-DD, 나머지는 timestamptz라 ISO.
      // .lt가 date 컬럼에도 ISO 문자열 받아서 자동 캐스팅하므로 ISO 통일.
      const { count, error } = await supabase
        .from(table)
        .delete({ count: "exact" })
        .lt(column, cutoffIso);

      if (error) {
        // 테이블이 마이그레이션 안 된 환경에서는 PGRST205 (schema cache miss) 발생.
        // SQL의 to_regclass 가드와 동일하게 조용히 skip.
        if (error.code === "PGRST205" || error.message?.includes("schema cache")) {
          results[table] = { deleted: 0, error: "table not found (skipped)" };
          continue;
        }
        hasError = true;
        reportError(`cron/storage-diet/${table}`, new Error(error.message));
        results[table] = { deleted: 0, error: error.message };
        continue;
      }
      const deleted = count ?? 0;
      totalDeleted += deleted;
      results[table] = { deleted, error: null };
    } catch (err) {
      hasError = true;
      reportError(`cron/storage-diet/${table}`, err);
      results[table] = {
        deleted: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  return Response.json({
    ok: !hasError,
    totalDeleted,
    results,
    at: new Date().toISOString(),
  });
}

// Vercel Cron이 GET으로 호출 (Authorization 헤더 자동 첨부)
export const GET = POST;
