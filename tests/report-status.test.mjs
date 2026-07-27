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
