// ══════════════════════════════════════════
// 신고 증거 첨부 Repository (B-2)
//
// ⚠️ 법적 설계 원칙 (box/학대방지_캣맘보호_구현프롬프트.md):
// - 사진은 convertImageToWebp(canvas 재인코딩)를 반드시 거친다 → EXIF(GPS·기기ID)가
//   제거된 사본만 업로드된다. 원본 바이너리 업로드 경로를 만들지 말 것 (2026-08-02 결정).
// - 비공개 버킷(report-evidence) + 단수명 서명 URL만. public URL 금지.
// - 무결성은 SHA-256 해시 "표기"까지만 — 법적 효력·수사자료 주장 금지.
// - 모든 행은 DB 기본값 purge_at(+90일)로 파기 예약됨 (cron purge-safety-data).
// ══════════════════════════════════════════

import { createClient } from "@/lib/supabase/client";
import { convertImageToWebp } from "@/lib/cats-repo";
import type { Report } from "@/lib/support-repo";
import { REPORT_REASON_LABELS, type ReportReason } from "@/lib/support-repo";
import { SAFETY_REPORT_EVIDENCE_ENABLED } from "@/lib/safety-flags";

export interface ReportEvidence {
  id: string;
  report_id: string;
  storage_path: string;
  sha256: string;
  purge_at: string;
  created_at: string;
}

export const EVIDENCE_MAX_FILES = 3;
const EVIDENCE_BUCKET = "report-evidence";

async function sha256Hex(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** 신고에 사진 첨부 (최대 3장). EXIF 제거된 webp 사본만 업로드. */
export async function uploadReportEvidence(reportId: string, files: File[]): Promise<number> {
  // 킬스위치: 사고·이슈 시 증거 첨부만 차단 (신고 본문은 계속 가능)
  if (!SAFETY_REPORT_EVIDENCE_ENABLED) {
    throw new Error("사진 첨부를 잠시 점검 중이에요. 신고 내용만 먼저 접수해주세요.");
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요해요.");

  let uploaded = 0;
  for (const file of files.slice(0, EVIDENCE_MAX_FILES)) {
    if (!file.type.startsWith("image/")) throw new Error("이미지 파일만 첨부할 수 있어요.");
    if (file.size > 20 * 1024 * 1024) throw new Error("사진은 20MB 이하만 가능해요.");

    // canvas 재인코딩 — EXIF(GPS 등) 제거된 사본 생성
    const webp = await convertImageToWebp(file, 1600, 0.85);
    const hash = await sha256Hex(webp);
    const path = `${user.id}/ev_${crypto.randomUUID()}.webp`;

    const { error: upErr } = await supabase.storage
      .from(EVIDENCE_BUCKET)
      .upload(path, webp, { contentType: "image/webp", upsert: false });
    if (upErr) throw new Error(`사진 업로드 실패: ${upErr.message}`);

    const { error: rowErr } = await supabase.from("report_evidence").insert({
      report_id: reportId,
      uploader_id: user.id,
      storage_path: path,
      sha256: hash,
      // purge_at은 DB 기본값 (+90일)
    });
    if (rowErr) throw new Error(`증거 기록 실패: ${rowErr.message}`);
    uploaded += 1;
  }
  return uploaded;
}

/** 신고에 첨부된 증거 목록 (RLS: 본인 업로드분 또는 admin) */
export async function listEvidenceForReport(reportId: string): Promise<ReportEvidence[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("report_evidence")
    .select("id, report_id, storage_path, sha256, purge_at, created_at")
    .eq("report_id", reportId)
    .order("created_at", { ascending: true });
  if (error) return [];
  return (data ?? []) as ReportEvidence[];
}

/** 단수명(10분) 서명 URL — private 버킷 열람용 */
export async function getEvidenceSignedUrl(path: string): Promise<string | null> {
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from(EVIDENCE_BUCKET)
    .createSignedUrl(path, 600);
  if (error) return null;
  return data?.signedUrl ?? null;
}

/**
 * 기관 이관용 서식 텍스트 생성 — 도시공존은 판정하지 않는 통로.
 * "법적 효력" 주장 없이 신고 내용 정리 + 파일 무결성 해시만 표기.
 */
export function buildForwardingText(report: Report, evidence: ReportEvidence[]): string {
  const lines = [
    "[신고 내용 정리 — 도시공존(dosigongzon.com)]",
    "",
    `접수 일시: ${new Date(report.created_at).toLocaleString("ko-KR")}`,
    `신고 유형: ${REPORT_REASON_LABELS[report.reason as ReportReason] ?? report.reason}`,
    `대상 종류: ${report.target_type}`,
    report.target_snapshot ? `대상 내용 스냅샷: ${report.target_snapshot}` : null,
    report.description ? `신고자 설명: ${report.description}` : null,
    "",
    evidence.length > 0 ? `첨부 사진 ${evidence.length}장 (업로드 시점 SHA-256 해시):` : "첨부 사진: 없음",
    ...evidence.map((e, i) => `  ${i + 1}. ${e.sha256}`),
    "",
    "※ 본 문서는 이용자 신고 내용을 정리한 것으로, 사실 여부에 대한 플랫폼의 판단을 포함하지 않습니다.",
    "※ 첨부 사진은 개인정보 보호를 위해 위치정보(EXIF)가 제거된 사본이며, 해시는 업로드 시점 파일 무결성 확인용입니다.",
  ].filter((l): l is string => l !== null);
  return lines.join("\n");
}
