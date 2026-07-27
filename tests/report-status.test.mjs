// P5 core-journey: reporter-facing report status view regression tests.
// Verifies the pure contract in lib/report-status.ts:
//  - each known ReportStatus maps to a non-empty reporter-facing view
//  - resolved/dismissed are terminal (closed), pending/reviewed are not
//  - unknown / non-string / prototype-key values fail safe to the
//    non-terminal "접수됨" view (never a misleading closed/resolved view)

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  describeReportStatusForReporter,
  isReportClosedForReporter,
  summarizeReportForReporter,
  buildMyReportsView,
  summarizeMyReportsHeadline,
  formatReporterReportLine,
} from "../lib/report-status.ts";

const KNOWN = ["pending", "reviewed", "resolved", "dismissed"];

test("every known status yields a non-empty reporter view", () => {
  for (const s of KNOWN) {
    const v = describeReportStatusForReporter(s);
    assert.equal(typeof v.title, "string");
    assert.ok(v.title.trim().length > 0, `title for ${s}`);
    assert.equal(typeof v.detail, "string");
    assert.ok(v.detail.trim().length > 0, `detail for ${s}`);
    assert.equal(typeof v.closed, "boolean");
  }
});

test("terminal states are closed, in-progress states are not", () => {
  assert.equal(isReportClosedForReporter("pending"), false);
  assert.equal(isReportClosedForReporter("reviewed"), false);
  assert.equal(isReportClosedForReporter("resolved"), true);
  assert.equal(isReportClosedForReporter("dismissed"), true);
});

test("unknown / malformed values fail safe to non-terminal 접수됨", () => {
  for (const bad of [
    undefined,
    null,
    "",
    "UNKNOWN",
    "toString",
    "constructor",
    "__proto__",
    "hasOwnProperty",
    42,
    {},
    [],
  ]) {
    const v = describeReportStatusForReporter(bad);
    assert.equal(v.title, "접수됨", `title for ${String(bad)}`);
    assert.equal(v.closed, false, `closed for ${String(bad)}`);
    // and the boolean helper agrees
    assert.equal(isReportClosedForReporter(bad), false);
  }
});

test("summarizeReportForReporter projects a row into a reporter summary", () => {
  const s = summarizeReportForReporter({
    id: "r1",
    reason: "abuse",
    status: "reviewed",
    created_at: "2026-07-27T00:00:00.000Z",
  });
  assert.equal(s.id, "r1");
  assert.equal(s.reasonLabel, "학대 조장");
  assert.equal(s.status.title, "확인 중");
  assert.equal(s.closed, false);
  assert.equal(s.createdAt, "2026-07-27T00:00:00.000Z");
});

test("summarizeReportForReporter closed flag mirrors terminal status", () => {
  const resolved = summarizeReportForReporter({
    id: "r2",
    reason: "spam",
    status: "resolved",
    created_at: "2026-07-27T00:00:00.000Z",
  });
  assert.equal(resolved.closed, true);
  assert.equal(resolved.status.closed, true);
});

test("summarizeReportForReporter fails safe on malformed reason/status", () => {
  // Unknown reason -> 기타 label; malformed status -> non-terminal 접수됨.
  for (const badReason of [undefined, null, "nope", "toString", "__proto__"]) {
    const s = summarizeReportForReporter({
      id: "rx",
      reason: badReason,
      status: "weird",
      created_at: "2026-07-27T00:00:00.000Z",
    });
    assert.equal(s.reasonLabel, "기타", `reason label for ${String(badReason)}`);
    assert.equal(s.status.title, "접수됨");
    assert.equal(s.closed, false);
  }
});

test("buildMyReportsView projects rows and derives open/closed counts", () => {
  const rows = [
    { id: "a", reason: "spam", status: "pending", created_at: "2026-07-27T03:00:00.000Z" },
    { id: "b", reason: "abuse", status: "reviewed", created_at: "2026-07-27T02:00:00.000Z" },
    { id: "c", reason: "other", status: "resolved", created_at: "2026-07-27T01:00:00.000Z" },
    { id: "d", reason: "false_info", status: "dismissed", created_at: "2026-07-27T00:00:00.000Z" },
  ];
  const view = buildMyReportsView(rows);
  assert.equal(view.total, 4);
  assert.equal(view.openCount, 2); // pending + reviewed
  assert.equal(view.closedCount, 2); // resolved + dismissed
  assert.equal(view.openCount + view.closedCount, view.total);
  // order preserved (newest-first as given by listMyReports)
  assert.deepEqual(view.reports.map((r) => r.id), ["a", "b", "c", "d"]);
  // each entry is a fail-safe reporter summary
  assert.equal(view.reports[1].status.title, "확인 중");
  assert.equal(view.reports[2].closed, true);
});

test("buildMyReportsView fails safe on non-array / malformed rows", () => {
  for (const bad of [undefined, null, "nope", 42, {}]) {
    const view = buildMyReportsView(bad);
    assert.deepEqual(view, { reports: [], total: 0, openCount: 0, closedCount: 0 });
  }
  // malformed rows inside a real array still project (fail-safe per row)
  const view = buildMyReportsView([
    { id: "x", reason: "weird", status: "???", created_at: "" },
  ]);
  assert.equal(view.total, 1);
  assert.equal(view.openCount, 1); // malformed status -> non-terminal
  assert.equal(view.reports[0].reasonLabel, "기타");
});

test("summarizeMyReportsHeadline derives one line per open/closed mix", () => {
  const empty = buildMyReportsView([]);
  assert.equal(summarizeMyReportsHeadline(empty), "아직 접수한 신고가 없어요.");

  const allOpen = buildMyReportsView([
    { id: "a", reason: "spam", status: "pending", created_at: "2026-07-27T02:00:00.000Z" },
    { id: "b", reason: "abuse", status: "reviewed", created_at: "2026-07-27T01:00:00.000Z" },
  ]);
  assert.equal(summarizeMyReportsHeadline(allOpen), "진행 중 2건");

  const allClosed = buildMyReportsView([
    { id: "c", reason: "other", status: "resolved", created_at: "2026-07-27T01:00:00.000Z" },
  ]);
  assert.equal(summarizeMyReportsHeadline(allClosed), "완료 1건");

  const mixed = buildMyReportsView([
    { id: "a", reason: "spam", status: "pending", created_at: "2026-07-27T03:00:00.000Z" },
    { id: "b", reason: "abuse", status: "reviewed", created_at: "2026-07-27T02:00:00.000Z" },
    { id: "c", reason: "other", status: "resolved", created_at: "2026-07-27T01:00:00.000Z" },
  ]);
  assert.equal(summarizeMyReportsHeadline(mixed), "진행 중 2건 · 완료 1건");
});

test("summarizeMyReportsHeadline fails safe on malformed view", () => {
  for (const bad of [undefined, null, "nope", 42, [], {}]) {
    assert.equal(summarizeMyReportsHeadline(bad), "아직 접수한 신고가 없어요.");
  }
  // negative / non-finite counts are rejected, not rendered
  assert.equal(
    summarizeMyReportsHeadline({ reports: [], total: 0, openCount: -3, closedCount: NaN }),
    "아직 접수한 신고가 없어요.",
  );
  assert.equal(
    summarizeMyReportsHeadline({ reports: [], total: 0, openCount: 1.5, closedCount: 2 }),
    "완료 2건", // fractional open rejected, closed kept
  );
});

test("formatReporterReportLine renders status · reason · KST date", () => {
  const summary = summarizeReportForReporter({
    id: "r1",
    reason: "abuse",
    status: "reviewed",
    // 2026-07-27T00:00:00Z is 2026-07-27 09:00 KST -> same calendar day
    created_at: "2026-07-27T00:00:00.000Z",
  });
  assert.equal(formatReporterReportLine(summary), "확인 중 · 학대 조장 · 2026.07.27");
});

test("formatReporterReportLine uses KST calendar day across UTC midnight", () => {
  // 2026-07-26T20:00:00Z is 2026-07-27 05:00 KST -> KST date is the 27th
  const summary = summarizeReportForReporter({
    id: "r2",
    reason: "spam",
    status: "resolved",
    created_at: "2026-07-26T20:00:00.000Z",
  });
  assert.equal(formatReporterReportLine(summary), "처리 완료 · 스팸/도배 · 2026.07.27");
});

test("formatReporterReportLine omits an unparseable date, keeps status · reason", () => {
  for (const badDate of ["", "not-a-date", "Invalid Date"]) {
    const summary = summarizeReportForReporter({
      id: "rx",
      reason: "other",
      status: "pending",
      created_at: badDate,
    });
    assert.equal(formatReporterReportLine(summary), "접수됨 · 기타");
  }
});

test("formatReporterReportLine fails safe on null / malformed summary", () => {
  for (const bad of [undefined, null, "nope", 42, []]) {
    assert.equal(formatReporterReportLine(bad), "");
  }
  // a summary with a missing status object still renders reason · date
  assert.equal(
    formatReporterReportLine({
      id: "r",
      reasonLabel: "기타",
      closed: false,
      createdAt: "2026-07-27T00:00:00.000Z",
    }),
    "기타 · 2026.07.27",
  );
});
