import assert from "node:assert/strict";
import test from "node:test";

import {
  CARE_SHIFT_LIST_LOOKBACK_MS,
  CARE_SHIFT_MAX_FUTURE_MS,
  CARE_SHIFT_NOTE_MAX_LENGTH,
  CARE_SHIFT_STATUSES,
  canTransitionCareShift,
  careShiftListWindowStart,
  describeCareShiftError,
  getNextCareShiftStatus,
  getRequiredCurrentStatus,
  isCareShiftBodyObject,
  isCareShiftSchemaNotReadyCode,
  isCareShiftTimestamp,
  isCareShiftUuid,
  toDatetimeLocalValue,
  validateCareShiftRequest,
} from "../lib/care-shift.ts";

test("care shift uses the requested, accepted, completed sequence", () => {
  assert.deepEqual(CARE_SHIFT_STATUSES, [
    "requested",
    "accepted",
    "completed",
  ]);
});

test("care shift identifiers accept UUIDs and reject malformed database input", () => {
  assert.equal(isCareShiftUuid("4f01f5fd-1b52-4d63-9bbc-7f6055f7b7cc"), true);
  assert.equal(isCareShiftUuid("not-a-uuid"), false);
  assert.equal(isCareShiftUuid("4f01f5fd-1b52-4d63-9bbc"), false);
});

test("missing care shift schema and stale PostgREST cache are both not ready", () => {
  assert.equal(isCareShiftSchemaNotReadyCode("42P01"), true);
  assert.equal(isCareShiftSchemaNotReadyCode("PGRST205"), true);
  assert.equal(isCareShiftSchemaNotReadyCode("42501"), false);
});

test("care shift timestamps require an explicit RFC 3339 timezone", () => {
  assert.equal(isCareShiftTimestamp("2026-07-27T01:30:00Z"), true);
  assert.equal(isCareShiftTimestamp("2026-07-27T10:30:00+09:00"), true);
  assert.equal(isCareShiftTimestamp("2026-07-27T10:30"), false);
  assert.equal(isCareShiftTimestamp("2026-07-27 10:30:00"), false);
  assert.equal(isCareShiftTimestamp("not-a-date"), false);
});

test("care shift timestamps reject normalized calendar and clock overflows", () => {
  assert.equal(isCareShiftTimestamp("2026-02-30T10:00:00Z"), false);
  assert.equal(isCareShiftTimestamp("2026-07-27T24:00:00Z"), false);
  assert.equal(isCareShiftTimestamp("2026-07-27T10:60:00+09:00"), false);
  assert.equal(isCareShiftTimestamp("2026-07-27T10:00:00+09:60"), false);
});

test("care shift timestamps reject RFC 3339 offsets beyond 14 hours", () => {
  assert.equal(isCareShiftTimestamp("2026-07-27T10:00:00+14:00"), true);
  assert.equal(isCareShiftTimestamp("2026-07-27T10:00:00-14:00"), true);
  assert.equal(isCareShiftTimestamp("2026-07-27T10:00:00+14:01"), false);
  assert.equal(isCareShiftTimestamp("2026-07-27T10:00:00-15:00"), false);
});

test("an assignee can accept a request and complete an accepted shift", () => {
  assert.equal(getNextCareShiftStatus("requested", "assignee"), "accepted");
  assert.equal(getNextCareShiftStatus("accepted", "assignee"), "completed");
});

test("requesters, skips, and completed shift rewrites are rejected", () => {
  assert.equal(getNextCareShiftStatus("requested", "requester"), null);
  assert.equal(
    canTransitionCareShift("requested", "completed", "assignee"),
    false,
  );
  assert.equal(
    canTransitionCareShift("completed", "accepted", "assignee"),
    false,
  );
});

test("required current status is derived from the transition contract", () => {
  assert.equal(getRequiredCurrentStatus("accepted", "assignee"), "requested");
  assert.equal(getRequiredCurrentStatus("completed", "assignee"), "accepted");
  assert.equal(getRequiredCurrentStatus("requested", "assignee"), null);
  for (const status of CARE_SHIFT_STATUSES) {
    assert.equal(getRequiredCurrentStatus(status, "requester"), null);
  }
});

test("required current status stays consistent with forward transitions", () => {
  for (const actor of ["requester", "assignee"]) {
    for (const current of CARE_SHIFT_STATUSES) {
      const next = getNextCareShiftStatus(current, actor);
      if (next !== null) {
        assert.equal(getRequiredCurrentStatus(next, actor), current);
      }
    }
  }
});

test("a valid future shift request is accepted", () => {
  assert.deepEqual(
    validateCareShiftRequest(
      {
        requesterId: "owner-1",
        assigneeId: "member-1",
        startsAt: "2026-07-27T02:00:00.000Z",
        note: "저녁 급식 부탁드려요.",
      },
      new Date("2026-07-27T01:00:00.000Z"),
    ),
    [],
  );
});

test("invalid participants, time, and oversized notes are rejected together", () => {
  assert.deepEqual(
    validateCareShiftRequest(
      {
        requesterId: "same-user",
        assigneeId: "same-user",
        startsAt: "2026-07-27T01:00:00.000Z",
        note: "가".repeat(CARE_SHIFT_NOTE_MAX_LENGTH + 1),
      },
      new Date("2026-07-27T01:00:00.000Z"),
    ),
    ["self_assignment", "starts_at_not_future", "note_too_long"],
  );
});

test("self assignment rejects UUIDs that differ only by letter case", () => {
  assert.deepEqual(
    validateCareShiftRequest(
      {
        requesterId: "4f01f5fd-1b52-4d63-9bbc-7f6055f7b7cc",
        assigneeId: "4F01F5FD-1B52-4D63-9BBC-7F6055F7B7CC",
        startsAt: "2026-07-27T02:00:00.000Z",
      },
      new Date("2026-07-27T01:00:00.000Z"),
    ),
    ["self_assignment"],
  );
});

test("shift requests beyond the future horizon are rejected", () => {
  const now = new Date("2026-07-27T01:00:00.000Z");
  assert.equal(CARE_SHIFT_MAX_FUTURE_MS, 60 * 24 * 60 * 60 * 1000);
  assert.deepEqual(
    validateCareShiftRequest(
      {
        requesterId: "owner-1",
        assigneeId: "member-1",
        startsAt: new Date(
          now.getTime() + CARE_SHIFT_MAX_FUTURE_MS + 60_000,
        ).toISOString(),
      },
      now,
    ),
    ["starts_at_too_far"],
  );
});

test("a shift request exactly at the future horizon is accepted", () => {
  const now = new Date("2026-07-27T01:00:00.000Z");
  assert.deepEqual(
    validateCareShiftRequest(
      {
        requesterId: "owner-1",
        assigneeId: "member-1",
        startsAt: new Date(now.getTime() + CARE_SHIFT_MAX_FUTURE_MS).toISOString(),
      },
      now,
    ),
    [],
  );
});

test("known API error codes map to Korean guidance", () => {
  assert.equal(
    describeCareShiftError("rate_limited", "기본 안내"),
    "요청이 너무 잦아요. 잠시 후 다시 시도해 주세요.",
  );
  assert.equal(
    describeCareShiftError("not_ready", "기본 안내"),
    "돌봄 교대 기능을 준비하고 있어요. 잠시 후 다시 시도해 주세요.",
  );
  assert.equal(
    describeCareShiftError("invalid_transition", "기본 안내"),
    "이미 처리된 요청이에요. 목록을 새로고침해 주세요.",
  );
  assert.equal(
    describeCareShiftError("duplicate_request", "기본 안내"),
    "같은 시각에 이미 요청한 돌봄 교대가 있어요.",
  );
});

test("unknown or missing error codes fall back to the given Korean message", () => {
  assert.equal(describeCareShiftError("create_failed", "기본 안내"), "기본 안내");
  assert.equal(describeCareShiftError(undefined, "기본 안내"), "기본 안내");
  assert.equal(describeCareShiftError(42, "기본 안내"), "기본 안내");
});

test("datetime-local min uses local wall-clock time, not UTC", () => {
  assert.equal(
    toDatetimeLocalValue(new Date(2026, 6, 27, 21, 30)),
    "2026-07-27T21:30",
  );
});

test("datetime-local values round-trip through local Date parsing", () => {
  const date = new Date("2026-07-26T12:00:00.000Z");
  const value = toDatetimeLocalValue(date);
  assert.match(value, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  assert.equal(new Date(value).getTime(), date.getTime());
});

test("care shift list window starts exactly one week before now", () => {
  const now = new Date("2026-07-26T15:00:00.000Z");
  assert.equal(CARE_SHIFT_LIST_LOOKBACK_MS, 7 * 24 * 60 * 60 * 1000);
  assert.equal(
    careShiftListWindowStart(now),
    "2026-07-19T15:00:00.000Z",
  );
});

test("care shift list window keeps recent shifts and drops stale ones", () => {
  const now = new Date("2026-07-26T15:00:00.000Z");
  const windowStart = careShiftListWindowStart(now);
  assert.ok("2026-07-20T09:00:00.000Z" >= windowStart);
  assert.ok("2026-07-01T09:00:00.000Z" < windowStart);
});

test("only plain object request bodies are accepted", () => {
  assert.equal(isCareShiftBodyObject({}), true);
  assert.equal(isCareShiftBodyObject({ circle_id: "abc" }), true);
});

test("null, array, and primitive JSON bodies are rejected before field access", () => {
  assert.equal(isCareShiftBodyObject(null), false);
  assert.equal(isCareShiftBodyObject([]), false);
  assert.equal(isCareShiftBodyObject("care"), false);
  assert.equal(isCareShiftBodyObject(42), false);
  assert.equal(isCareShiftBodyObject(undefined), false);
});

test("missing participants and malformed time have stable errors", () => {
  assert.deepEqual(
    validateCareShiftRequest({
      requesterId: " ",
      assigneeId: "",
      startsAt: "not-a-date",
    }),
    ["requester_required", "assignee_required", "invalid_starts_at"],
  );
});
