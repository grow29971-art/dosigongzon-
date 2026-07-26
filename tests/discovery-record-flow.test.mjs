import assert from "node:assert/strict";
import test from "node:test";

import {
  DISCOVERY_RECORD_STEPS,
  findNearbyDiscoveryCandidates,
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

test("nearby duplicate candidates are sorted, limited, and do not mutate input", () => {
  const candidates = [
    { id: "far", lat: 37.01, lng: 127 },
    { id: "near-2", lat: 37.0008, lng: 127 },
    { id: "near-1", lat: 37.0002, lng: 127 },
    { id: "near-3", lat: 37.0012, lng: 127 },
  ];
  const originalOrder = candidates.map(({ id }) => id);

  assert.deepEqual(
    findNearbyDiscoveryCandidates(
      { lat: 37, lng: 127 },
      candidates,
      300,
      2,
    ).map(({ id }) => id),
    ["near-1", "near-2"],
  );
  assert.deepEqual(candidates.map(({ id }) => id), originalOrder);
});

test("첫 단계와 마지막 단계 밖으로 이동하지 않는다", () => {
  assert.equal(getAdjacentDiscoveryRecordStep("location", "previous"), "location");
  assert.equal(getAdjacentDiscoveryRecordStep("location", "next"), "identity");
  assert.equal(getAdjacentDiscoveryRecordStep("identity", "next"), "visibility");
  assert.equal(getAdjacentDiscoveryRecordStep("visibility", "next"), "visibility");
});
