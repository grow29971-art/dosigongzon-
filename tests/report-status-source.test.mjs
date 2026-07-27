// P5 core-journey: source-watch regression for the reporter-facing report
// status view (lib/report-status.ts).
//
// The admin ReportStatus union in lib/support-repo.ts is the single source of
// truth for report statuses. P5-1 re-describes those same values from the
// reporter's point of view in lib/report-status.ts. TypeScript already forces
// REPORTER_STATUS_VIEWS to be a Record<ReportStatus, ...> (a missing key is a
// compile error), but the *runtime* regression test (report-status.test.mjs)
// checks coverage against a hardcoded KNOWN array that could silently drift
// from the real union.
//
// This test reads both source files directly and verifies:
//  1) the ReportStatus union literals parsed from support-repo.ts exactly
//     match the own keys of REPORTER_STATUS_VIEWS in report-status.ts, so a
//     future status added to the union can never be missing a reporter view
//     (and a stale reporter key can never linger).
//  2) the reporter view module still maps only own, known keys and keeps a
//     non-terminal fallback (fail-safe: a bad value never surfaces a closed /
//     "resolved" view to a reporter).
// It does NOT import the modules or run app code — pure source-watch.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repoSrc = readFileSync(join(here, "../lib/support-repo.ts"), "utf8");
const viewSrc = readFileSync(join(here, "../lib/report-status.ts"), "utf8");

// Parse the ReportStatus union literals from support-repo.ts.
function parseReportStatusUnion(src) {
  const m = src.match(/export type ReportStatus\s*=([\s\S]*?);/);
  assert.ok(m, "ReportStatus union declaration not found in support-repo.ts");
  const literals = [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
  assert.ok(literals.length > 0, "ReportStatus union has no string literals");
  return literals;
}

// Parse the own keys of the REPORTER_STATUS_VIEWS map object.
function parseReporterViewKeys(src) {
  const m = src.match(
    /REPORTER_STATUS_VIEWS[^=]*=\s*\{([\s\S]*?)\n\};/,
  );
  assert.ok(m, "REPORTER_STATUS_VIEWS object not found in report-status.ts");
  // top-level status keys only: `  pending: {` — value is an object literal.
  // Nested view fields (title/detail/closed) are followed by a value, not `{`.
  const keys = [...m[1].matchAll(/^  ([a-zA-Z_][a-zA-Z0-9_]*):\s*\{/gm)].map(
    (x) => x[1],
  );
  assert.ok(keys.length > 0, "REPORTER_STATUS_VIEWS has no keys");
  return keys;
}

test("reporter view keys exactly match the ReportStatus union source of truth", () => {
  const union = parseReportStatusUnion(repoSrc).sort();
  const keys = parseReporterViewKeys(viewSrc).sort();
  assert.deepEqual(
    keys,
    union,
    "REPORTER_STATUS_VIEWS keys must equal the ReportStatus union exactly (no missing / stale statuses)",
  );
});

// Parse a `Record<...> = { key: "value", ... }` label map object body by name.
function parseLabelMap(src, name) {
  const m = src.match(new RegExp(`${name}[^=]*=\\s*\\{([\\s\\S]*?)\\n\\};`));
  assert.ok(m, `${name} object not found`);
  const pairs = [...m[1].matchAll(/^\s*([a-zA-Z_][a-zA-Z0-9_]*):\s*"([^"]*)"/gm)];
  assert.ok(pairs.length > 0, `${name} has no key/value pairs`);
  return Object.fromEntries(pairs.map((x) => [x[1], x[2]]));
}

test("reporter reason labels exactly mirror the admin REPORT_REASON_LABELS", () => {
  // REPORTER_REASON_LABELS is inlined in report-status.ts (no runtime import
  // of the repo layer). This keeps it from drifting from the admin source.
  const admin = parseLabelMap(repoSrc, "REPORT_REASON_LABELS");
  const reporter = parseLabelMap(viewSrc, "REPORTER_REASON_LABELS");
  assert.deepEqual(
    reporter,
    admin,
    "REPORTER_REASON_LABELS must equal REPORT_REASON_LABELS exactly (keys and values)",
  );
});

test("reporter view maps only own known keys and keeps a non-terminal fallback", () => {
  // own-property guard so inherited prototype keys can't be treated as statuses
  assert.ok(
    /Object\.prototype\.hasOwnProperty\.call\(\s*REPORTER_STATUS_VIEWS\s*,\s*status\s*\)/.test(
      viewSrc,
    ),
    "describeReportStatusForReporter must guard with hasOwnProperty on own keys",
  );
  // a string-type guard so non-string values fall back
  assert.ok(
    /typeof status !== "string"/.test(viewSrc),
    "describeReportStatusForReporter must reject non-string values",
  );
  // the fallback view must be non-terminal (closed: false) so a bad value
  // never tells a reporter their report was closed / resolved
  const fb = viewSrc.match(/FALLBACK_VIEW[^=]*=\s*\{([\s\S]*?)\};/);
  assert.ok(fb, "FALLBACK_VIEW declaration not found");
  assert.ok(
    /closed:\s*false/.test(fb[1]),
    "FALLBACK_VIEW must be non-terminal (closed: false)",
  );
});
