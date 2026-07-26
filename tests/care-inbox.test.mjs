import assert from "node:assert/strict";
import test from "node:test";

import { prioritizePendingFeed } from "../lib/care-inbox.ts";

test("미완료 돌봄을 먼저 두고 각 그룹의 기존 순서는 유지한다", () => {
  const cats = [
    { id: "done-new", doneTypes: ["feed"] },
    { id: "pending-new", doneTypes: ["water"] },
    { id: "done-old", doneTypes: ["feed", "health"] },
    { id: "pending-old", doneTypes: [] },
  ];

  assert.deepEqual(
    prioritizePendingFeed(cats).map(({ id }) => id),
    ["pending-new", "pending-old", "done-new", "done-old"],
  );
  assert.deepEqual(
    cats.map(({ id }) => id),
    ["done-new", "pending-new", "done-old", "pending-old"],
  );
});

test("빈 인박스도 안전하게 처리한다", () => {
  assert.deepEqual(prioritizePendingFeed([]), []);
});
