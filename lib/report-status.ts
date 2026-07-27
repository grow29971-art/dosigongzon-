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

/**
 * Reporter-facing view model for the whole "my reports" list.
 * A pure, fail-safe projection over the rows returned by listMyReports():
 * it maps each row through summarizeReportForReporter and derives small
 * aggregate counts the UI can show without any additional logic.
 * Introduces no new statuses, columns, routes, or mutations.
 */
export interface MyReportsView {
  /** Per-report reporter summaries, in the order given (listMyReports is newest-first). */
  reports: ReporterReportSummary[];
  /** Total number of reports. */
  total: number;
  /** Reports still in progress (not terminal) from the reporter's view. */
  openCount: number;
  /** Reports that reached a terminal state (resolved / dismissed). */
  closedCount: number;
}

/**
 * Order reporter summaries so in-progress (open) reports come before
 * terminal (closed) ones, while preserving the incoming order within each
 * group. Pure and stable: listMyReports returns rows newest-first, so this
 * keeps that ordering inside the open group and inside the closed group,
 * only lifting the reports that still need attention to the top.
 *
 * Fail-safe: a non-array input yields an empty array rather than throwing.
 * The input array is not mutated (a shallow copy is returned).
 */
export function orderMyReportsForReporter(
  summaries:
    | ReadonlyArray<ReporterReportSummary>
    | null
    | undefined,
): ReporterReportSummary[] {
  if (!Array.isArray(summaries)) return [];
  const open: ReporterReportSummary[] = [];
  const closed: ReporterReportSummary[] = [];
  for (const summary of summaries) {
    // Treat only an explicit terminal flag as closed; a missing/malformed
    // flag stays in the open group so active reports are never hidden.
    if (summary && summary.closed === true) closed.push(summary);
    else open.push(summary as ReporterReportSummary);
  }
  return [...open, ...closed];
}

/**
 * Build the reporter-facing "my reports" view model from raw report rows.
 * Pure and fail-safe: a non-array input (null/undefined/malformed) yields an
 * empty view rather than throwing, and each row is projected through the
 * fail-safe summarizeReportForReporter so a bad row can never crash the list
 * or mislead the reporter. openCount + closedCount always equals total.
 *
 * Reports are ordered open-first (via orderMyReportsForReporter) so the
 * reports still needing attention stay at the top, while newest-first order
 * is preserved within each group.
 */
export function buildMyReportsView(
  reports:
    | ReadonlyArray<Pick<Report, "id" | "reason" | "status" | "created_at">>
    | null
    | undefined,
): MyReportsView {
  if (!Array.isArray(reports)) {
    return { reports: [], total: 0, openCount: 0, closedCount: 0 };
  }
  const summaries = orderMyReportsForReporter(
    reports.map(summarizeReportForReporter),
  );
  const closedCount = summaries.reduce(
    (acc, summary) => acc + (summary.closed ? 1 : 0),
    0,
  );
  return {
    reports: summaries,
    total: summaries.length,
    openCount: summaries.length - closedCount,
    closedCount,
  };
}

/**
 * Build a single reporter-facing headline line for the "my reports" view.
 * Pure and fail-safe: it derives one short Korean summary sentence from the
 * view-model counts so a future UI can render it directly without any count
 * formatting logic of its own. Introduces no new statuses, columns, routes,
 * or mutations and reads no operator-only fields.
 *
 * Behaviour:
 *  - empty list (total 0)      -> a neutral "no reports yet" line.
 *  - all reports still open    -> "진행 중 N건".
 *  - all reports terminal      -> "완료 N건".
 *  - mixed                     -> "진행 중 N건 · 완료 M건".
 *
 * Fail-safe: a non-object / malformed input (or negative / non-finite
 * counts) yields the same neutral empty-state line rather than throwing,
 * so a broken view can never crash the header or show a misleading count.
 */
export function summarizeMyReportsHeadline(
  view: MyReportsView | null | undefined,
): string {
  const EMPTY = "아직 접수한 신고가 없어요.";
  if (!view || typeof view !== "object") return EMPTY;

  const open = Number((view as MyReportsView).openCount);
  const closed = Number((view as MyReportsView).closedCount);
  // Reject anything that is not a safe, non-negative integer count.
  const safeOpen =
    Number.isSafeInteger(open) && open > 0 ? open : 0;
  const safeClosed =
    Number.isSafeInteger(closed) && closed > 0 ? closed : 0;

  if (safeOpen === 0 && safeClosed === 0) return EMPTY;
  if (safeClosed === 0) return `진행 중 ${safeOpen}건`;
  if (safeOpen === 0) return `완료 ${safeClosed}건`;
  return `진행 중 ${safeOpen}건 · 완료 ${safeClosed}건`;
}

/**
 * Format a single reporter report summary into one display line the UI can
 * render directly, e.g. "확인 중 · 학대 조장 · 2026.07.27".
 *
 * Pure and fail-safe: it reads only the reporter-facing summary produced by
 * summarizeReportForReporter (no operator-only fields) and never throws.
 * A missing / malformed createdAt is simply omitted rather than rendered as
 * "Invalid Date", so a broken row still yields a clean "<status> · <reason>"
 * line. Introduces no new statuses, columns, routes, or mutations.
 *
 * The date is formatted as a KST (Asia/Seoul) calendar date so the line is
 * stable regardless of the viewer's runtime timezone.
 */
export function formatReporterReportLine(
  summary: ReporterReportSummary | null | undefined,
): string {
  if (!summary || typeof summary !== "object") return "";

  const parts: string[] = [];

  const title = (summary as ReporterReportSummary).status?.title;
  if (typeof title === "string" && title.trim().length > 0) {
    parts.push(title.trim());
  }

  const reasonLabel = (summary as ReporterReportSummary).reasonLabel;
  if (typeof reasonLabel === "string" && reasonLabel.trim().length > 0) {
    parts.push(reasonLabel.trim());
  }

  const dateLabel = formatReporterDate((summary as ReporterReportSummary).createdAt);
  if (dateLabel) parts.push(dateLabel);

  return parts.join(" · ");
}

// Format an ISO timestamp as a KST calendar date "YYYY.MM.DD". Fail-safe:
// a missing / unparseable value returns "" (omitted from the line) rather
// than "Invalid Date".
function formatReporterDate(value: string | null | undefined): string {
  if (typeof value !== "string" || value.trim().length === 0) return "";
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return "";
  try {
    // en-CA yields ISO-like YYYY-MM-DD; convert to dot form for display.
    const ymd = new Date(ms).toLocaleDateString("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return ymd.replace(/-/g, ".");
  } catch {
    return "";
  }
}
