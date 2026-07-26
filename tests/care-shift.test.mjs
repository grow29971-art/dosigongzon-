import assert from "node:assert/strict";
import test from "node:test";

import {
  CARE_SHIFT_STATUSES,
  canTransitionCareShift,
  getNextCareShiftStatus,
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
