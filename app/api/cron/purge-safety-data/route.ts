// 안전 데이터 파기 cron (B-1·B-2) — purge_at 경과 행 hard delete
// - zone_reports: QR 지킴판 익명 제보 (기본 90일)
// - report_evidence: 신고 증거 메타 행 + report-evidence 버킷 실제 객체 (기본 90일)
// ⚠️ 파기는 절대 금지선 아님 — 오히려 의무 (증거·제보 무한 보관 금지, 이관 후 파기 원칙).
// Vercel Cron 매일 03:40 KST 실행 (vercel.json). 수동 호출: POST + Bearer CRON_SECRET.

import { createServiceClient } from "@/lib/supabase/service";
import { reportError } from "@/lib/error-report";

export const maxDuration = 60;

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const nowIso = new Date().toISOString();
  const result = { zoneReportsPurged: 0, evidencePurged: 0, storageRemoved: 0, errors: [] as string[] };

  // 1) QR 지킴판 제보 파기
  try {
    const { data: expired } = await supabase
      .from("zone_reports")
      .select("id")
      .lte("purge_at", nowIso)
      .limit(500);
    const ids = (expired ?? []).map((r: { id: string }) => r.id);
    if (ids.length > 0) {
      const { error } = await supabase.from("zone_reports").delete().in("id", ids);
      if (error) result.errors.push(`zone_reports: ${error.message}`);
      else result.zoneReportsPurged = ids.length;
    }
  } catch (err) {
    reportError("purge-safety-data:zone_reports", err);
    result.errors.push("zone_reports 파기 실패");
  }

  // 2) 신고 증거 파기 — 스토리지 객체 먼저, 성공한 것만 행 삭제 (고아 객체 방지)
  try {
    const { data: expired } = await supabase
      .from("report_evidence")
      .select("id, storage_path")
      .lte("purge_at", nowIso)
      .limit(500);
    const rows = (expired ?? []) as { id: string; storage_path: string }[];
    if (rows.length > 0) {
      const paths = rows.map((r) => r.storage_path);
      const { error: rmErr } = await supabase.storage.from("report-evidence").remove(paths);
      if (rmErr) {
        // 객체 삭제 실패 시 행을 남겨 다음 실행에서 재시도
        result.errors.push(`storage: ${rmErr.message}`);
      } else {
        result.storageRemoved = paths.length;
        const { error: delErr } = await supabase
          .from("report_evidence")
          .delete()
          .in("id", rows.map((r) => r.id));
        if (delErr) result.errors.push(`report_evidence: ${delErr.message}`);
        else result.evidencePurged = rows.length;
      }
    }
  } catch (err) {
    reportError("purge-safety-data:evidence", err);
    result.errors.push("report_evidence 파기 실패");
  }

  const status = result.errors.length > 0 ? 500 : 200;
  return Response.json(result, { status });
}

// GET 허용 — Vercel Cron이 GET 호출 (헤더는 자동으로 Bearer CRON_SECRET 추가)
export const GET = POST;
