import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../box/supabase_care_shifts_migration.sql",
  import.meta.url,
);
const sql = await readFile(migrationUrl, "utf8");

test("care shift migration remains rerunnable without destructive table changes", () => {
  assert.match(sql, /create table if not exists public\.care_shifts/i);
  assert.match(sql, /create index if not exists care_shifts_circle_start_idx/i);
  assert.doesNotMatch(sql, /^\s*(drop table|delete from|truncate)\b/im);
});

test("care shift migration keeps participant-only access and no delete grant", () => {
  assert.match(
    sql,
    /using\s*\(\s*auth\.uid\(\)\s+in\s+\(requester_id,\s*assignee_id\)\s*\)/i,
  );
  assert.match(sql, /revoke all on public\.care_shifts from anon/i);
  assert.match(
    sql,
    /grant select,\s*insert,\s*update on public\.care_shifts to authenticated/i,
  );
  assert.doesNotMatch(sql, /grant[^;]*\bdelete\b[^;]*on public\.care_shifts/i);
});

test("care shift migration guards ordered assignee-only transitions", () => {
  assert.match(
    sql,
    /auth\.uid\(\)\s+is distinct from old\.assignee_id/i,
  );
  assert.match(
    sql,
    /old\.status\s*=\s*'requested'\s+and new\.status\s*=\s*'accepted'/i,
  );
  assert.match(
    sql,
    /old\.status\s*=\s*'accepted'\s+and new\.status\s*=\s*'completed'/i,
  );
  assert.match(
    sql,
    /revoke all on function public\.guard_care_shift_write\(\) from public/i,
  );
});
