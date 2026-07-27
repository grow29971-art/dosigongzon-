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
