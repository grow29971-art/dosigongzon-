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

test("care shift migration applies atomically before reloading PostgREST", () => {
  assert.match(sql, /^\s*begin\s*;/im);
  assert.match(sql, /notify pgrst,\s*'reload schema'\s*;\s*commit\s*;/i);
});

test("care shift migration blocks duplicate open requests for the same slot", () => {
  assert.match(
    sql,
    /create unique index if not exists care_shifts_unique_open_request_idx\s+on public\.care_shifts \(circle_id, requester_id, assignee_id, starts_at\)\s+where status <> 'completed'/i,
  );
});

test("care shift migration enforces the same 60-day future horizon as the API", () => {
  assert.match(
    sql,
    /constraint\s+care_shifts_future_horizon\s+check\s*\(\s*starts_at\s*<=\s*created_at\s*\+\s*interval\s+'60 days'\s*\)/i,
  );
  assert.match(
    sql,
    /starts_at\s*<=\s*now\(\)\s*\+\s*interval\s+'60 days'/i,
  );
});

test("care shift migration rejects note control characters outside allowed formatting", () => {
  assert.match(
    sql,
    /constraint\s+care_shifts_note_controls\s+check\s*\(\s*note is null or translate\(note,\s*E'\\t\\n\\r',\s*''\)\s*!~\s*'\[\[:cntrl:\]\]'\s*\)/i,
  );
});

test("care shift migration keeps participant-only access and no delete grant", () => {
  assert.match(
    sql,
    /using\s*\(\s*auth\.uid\(\)\s+in\s+\(requester_id,\s*assignee_id\)\s*\)/i,
  );
  assert.match(sql, /revoke all on public\.care_shifts from anon/i);
  // Supabase default privileges already grant DELETE to authenticated on new
  // tables; the narrow grant only holds if the defaults are revoked first.
  assert.match(
    sql,
    /revoke all on public\.care_shifts from authenticated;[\s\S]*?grant select,\s*insert,\s*update on public\.care_shifts to authenticated/i,
  );
  assert.doesNotMatch(
    sql,
    /^\s*grant[^;]*\bdelete\b[^;]*on public\.care_shifts/im,
  );
});

test("care shift requests may assign either an accepted member or the circle owner", () => {
  assert.match(
    sql,
    /from public\.circle_members cm[\s\S]*cm\.status = 'accepted'[\s\S]*or exists\s*\(\s*select 1\s+from public\.caretaker_circles cc\s+where cc\.id = p_circle_id\s+and cc\.owner_id = p_user_id/i,
  );
});

test("care shift transition timestamps are always assigned by the database", () => {
  assert.match(
    sql,
    /if tg_op = 'INSERT' then[\s\S]*new\.created_at := now\(\);[\s\S]*new\.updated_at := now\(\);/i,
  );
  assert.match(
    sql,
    /old\.status = 'requested' and new\.status = 'accepted' then\s+new\.accepted_at := now\(\);\s+new\.completed_at := null;/i,
  );
  assert.match(
    sql,
    /old\.status = 'accepted' and new\.status = 'completed' then\s+new\.accepted_at := old\.accepted_at;\s+new\.completed_at := now\(\);/i,
  );
  assert.doesNotMatch(sql, /new\.(?:accepted_at|completed_at) := coalesce/i);
});

test("care shift migration keeps status/timestamp consistency as a DB check", () => {
  // Defense in depth beyond the trigger: even a direct UPDATE that skipped the
  // trigger path must not persist an accepted/completed row without matching
  // timestamps, or a requested row that already carries them.
  assert.match(
    sql,
    /constraint\s+care_shifts_status_timestamps\s+check\s*\(\s*\(status = 'requested' and accepted_at is null and completed_at is null\)\s*or \(status = 'accepted' and accepted_at is not null and completed_at is null\)\s*or \(status = 'completed' and accepted_at is not null and completed_at is not null\)\s*\)/i,
  );
});

test("care shift migration keeps request identity fields immutable on update", () => {
  // The status transition path must never let a client rewrite who/where/when
  // by tunneling extra columns through an UPDATE; the guard rejects any change
  // to the identity/creation fields.
  assert.match(
    sql,
    /new\.circle_id <> old\.circle_id[\s\S]*new\.requester_id <> old\.requester_id[\s\S]*new\.assignee_id <> old\.assignee_id[\s\S]*new\.starts_at <> old\.starts_at[\s\S]*new\.created_at <> old\.created_at then\s+raise exception 'care shift request fields are immutable'/i,
  );
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
