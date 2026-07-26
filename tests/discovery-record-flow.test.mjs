import assert from "node:assert/strict";
import test from "node:test";

import {
  DISCOVERY_RECORD_STEPS,
  getAdjacentDiscoveryRecordStep,
  getDiscoveryRecordStepIndex,
} from "../lib/discovery-record-flow.ts";

test("발견 기록 단계를 위치, 기본 정보, 공개 범위의 3단계로 고정한다", () => {
  assert.deepEqual(
    DISCOVERY_RECORD_STEPS.map(({ id }) => id),
    ["location", "identity", "visibility"],
  );
  assert.equal(getDiscoveryRecordStepIndex("identity"), 1);
});

test("첫 단계와 마지막 단계 밖으로 이동하지 않는다", () => {
  assert.equal(getAdjacentDiscoveryRecordStep("location", "previous"), "location");
  assert.equal(getAdjacentDiscoveryRecordStep("location", "next"), "identity");
  assert.equal(getAdjacentDiscoveryRecordStep("identity", "next"), "visibility");
  assert.equal(getAdjacentDiscoveryRecordStep("visibility", "next"), "visibility");
});
