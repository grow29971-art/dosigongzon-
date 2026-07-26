import assert from "node:assert/strict";
import test from "node:test";

import {
  CARE_SHIFT_NOTE_MAX_LENGTH,
  CARE_SHIFT_STATUSES,
  canTransitionCareShift,
  describeCareShiftError,
  getNextCareShiftStatus,
  validateCareShiftRequest,
} from "../lib/care-shift.ts";

test("care shift uses the requested, accepted, completed sequence", () => {
  assert.deepEqual(CARE_SHIFT_STATUSES, [
    "requested",
    "accepted",
    "completed",
  ]);
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
});

test("unknown or missing error codes fall back to the given Korean message", () => {
  assert.equal(describeCareShiftError("create_failed", "기본 안내"), "기본 안내");
  assert.equal(describeCareShiftError(undefined, "기본 안내"), "기본 안내");
  assert.equal(describeCareShiftError(42, "기본 안내"), "기본 안내");
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
