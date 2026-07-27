// P5 core-journey: source-watch regression for the reporter-facing
// "my reports" read helper (lib/support-repo.ts :: listMyReports).
//
// P5 "신고 상태 추적" needs a reporter to see the status of the reports THEY
// filed. listReports() is admin-only (returns all rows). P5-3 adds a pure,
// read-only listMyReports() that filters reports by the current user's
// reporter_id, relying on existing RLS for real visibility (defense in depth).
//
// This test reads the source directly and locks the safety invariants so a
// future edit can't silently:
//   1) drop the reporter_id filter (which would leak all reports),
//   2) turn the read into a mutation (insert/update/delete/upsert),
//   3) remove the fail-safe empty-array behavior (unauth + error).
// It does NOT import app code — pure source-watch.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "../lib/support-repo.ts"), "utf8");

// Extract the listMyReports function body.
function listMyReportsBody() {
  // capture from the listMyReports declaration up to (but not including) the
  // next top-level export declaration.
  const m = src.match(
    /export async function listMyReports\([\s\S]*?(?=\nexport (?:async )?function )/,
  );
  assert.ok(m, "listMyReports function not found in support-repo.ts");
  return m[0];
}

test("listMyReports filters by the current user's reporter_id", () => {
  const body = listMyReportsBody();
  assert.ok(
    /\.eq\(\s*"reporter_id"\s*,\s*user\.id\s*\)/.test(body),
    "listMyReports must filter reports by reporter_id = user.id (never return all)",
  );
  // must read the reports table, not something else
  assert.ok(
    /\.from\(\s*"reports"\s*\)/.test(body),
    "listMyReports must query the reports table",
  );
});

test("listMyReports is read-only (no mutation)", () => {
  const body = listMyReportsBody();
  for (const mut of [".insert(", ".update(", ".delete(", ".upsert("]) {
    assert.ok(
      !body.includes(mut),
      `listMyReports must be read-only — found forbidden mutation ${mut}`,
    );
  }
  assert.ok(
    /\.select\(/.test(body),
    "listMyReports must use select (read-only)",
  );
});

test("listMyReports is fail-safe: empty array when unauth or on error", () => {
  const body = listMyReportsBody();
  // unauthenticated -> empty (no throw)
  assert.ok(
    /if \(!user\) return \[\];/.test(body),
    "listMyReports must return [] when there is no logged-in user",
  );
  // query error -> empty (no throw)
  assert.ok(
    /if \(error\)[\s\S]*?return \[\];/.test(body),
    "listMyReports must return [] on query error (fail-safe, no throw)",
  );
});
