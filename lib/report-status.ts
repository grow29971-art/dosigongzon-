// P5 core-journey: reporter-facing report status tracking (pure contract).
//
// The admin side already defines ReportStatus (pending -> reviewed ->
// resolved | dismissed) with admin labels/colors in lib/support-repo.ts.
// That admin vocabulary ("대기", "검토중", "처리완료", "반려") is written for
// operators, not for the person who filed the report. P5 "신고 상태 추적"
// needs the *reporter* to be able to follow what happened to their report.
//
// This module is a pure, fail-safe view layer. It does NOT introduce new
// statuses, DB columns, routes, or mutations — it only re-describes the
// existing four ReportStatus values from the reporter's point of view.
// It never throws: an unknown / prototype-key / non-string status falls back
// to the safe "접수됨" (received) view so a broken value can never surface a
// misleading "resolved" message to a reporter.

import type { Report, ReportReason, ReportStatus } from "./support-repo";

/**
 * Reporter-facing description of a report status.
 * - title: short status word shown to the reporter.
 * - detail: one-line explanation in the reporter's voice.
 * - closed: whether the report has reached a terminal state (no further
 *   action expected). Used to decide whether to show "진행 중" hints.
 */
export interface ReporterStatusView {
  title: string;
  detail: string;
  closed: boolean;
}

// Only own, known keys are mapped. Any other value (including inherited
// prototype keys like "toString") must fall through to the safe default.
const REPORTER_STATUS_VIEWS: Record<ReportStatus, ReporterStatusView> = {
  pending: {
    title: "접수됨",
    detail: "신고가 접수됐어요. 곧 운영진이 확인할게요.",
    closed: false,
  },
  reviewed: {
    title: "확인 중",
    detail: "운영진이 신고 내용을 확인하고 있어요.",
    closed: false,
  },
  resolved: {
    title: "처리 완료",
    detail: "신고하신 내용이 처리됐어요. 살펴봐 주셔서 고마워요.",
    closed: true,
  },
  dismissed: {
    title: "종료",
    detail: "확인 결과 별도 조치 없이 종료됐어요.",
    closed: true,
  },
};

// Safe fallback for any unknown / malformed status value.
const FALLBACK_VIEW: ReporterStatusView = {
  title: "접수됨",
  detail: "신고가 접수됐어요. 곧 운영진이 확인할게요.",
  closed: false,
};

/**
 * Map any status value to a reporter-facing view. Fail-safe: unknown,
 * non-string, or prototype-inherited keys return the safe "접수됨" view
 * (never a terminal / "resolved" view), so a bad value cannot mislead the
 * reporter into thinking their report was closed.
 */
export function describeReportStatusForReporter(
  status: string | null | undefined,
): ReporterStatusView {
  if (typeof status !== "string") return FALLBACK_VIEW;
  if (!Object.prototype.hasOwnProperty.call(REPORTER_STATUS_VIEWS, status)) {
    return FALLBACK_VIEW;
  }
  return REPORTER_STATUS_VIEWS[status as ReportStatus];
}

/**
 * Whether a status is terminal from the reporter's perspective.
 * Fail-safe: unknown/malformed values are treated as NOT closed (in
 * progress), so the UI keeps showing "진행 중" rather than prematurely
 * telling a reporter their report is done.
 */
export function isReportClosedForReporter(
  status: string | null | undefined,
): boolean {
  return describeReportStatusForReporter(status).closed;
}

/**
 * Reporter-facing summary of a single report row.
 * A pure projection of the existing Report shape for the reporter's own
 * "my reports" view — no new fields, routes, or mutations. It deliberately
 * omits operator-only fields (admin_note, reporter contact info) so the
 * reporter view never leaks internal notes.
 */
export interface ReporterReportSummary {
  id: string;
  reasonLabel: string;
  status: ReporterStatusView;
  closed: boolean;
  createdAt: string;
}

// Reporter-facing reason labels. These deliberately mirror the admin
// REPORT_REASON_LABELS values in lib/support-repo.ts (kept in sync by
// tests/report-status-source.test.mjs) but are inlined here so this pure
// view module has no runtime dependency on the repo layer (which pulls in
// the Supabase client). Keys are the existing ReportReason union.
const REPORTER_REASON_LABELS: Record<ReportReason, string> = {
  spam: "스팸/도배",
  abuse: "학대 조장",
  inappropriate: "부적절한 내용",
  false_info: "허위 정보",
  other: "기타",
};

// Fail-safe reason label: unknown / prototype-key reasons fall back to the
// existing "기타" (other) label rather than surfacing a raw enum value.
function reasonLabelForReporter(reason: string | null | undefined): string {
  if (
    typeof reason === "string" &&
    Object.prototype.hasOwnProperty.call(REPORTER_REASON_LABELS, reason)
  ) {
    return REPORTER_REASON_LABELS[reason as ReportReason];
  }
  return REPORTER_REASON_LABELS.other;
}

/**
 * Project a raw report row into a reporter-facing summary. Pure and
 * fail-safe: a missing/malformed status uses the safe non-terminal view and
 * a missing/malformed reason uses the "기타" label, so a bad row can never
 * mislead the reporter or throw. Does not read admin_note or reporter
 * contact fields.
 */
export function summarizeReportForReporter(
  report: Pick<Report, "id" | "reason" | "status" | "created_at">,
): ReporterReportSummary {
  const view = describeReportStatusForReporter(report.status);
  return {
    id: report.id,
    reasonLabel: reasonLabelForReporter(report.reason),
    status: view,
    closed: view.closed,
    createdAt: report.created_at,
  };
}
