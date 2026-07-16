// 카드 레벨 커브 테스트 — node --test tests/card-level.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { cardLevelFromExp, CARD_LEVEL_THRESHOLDS } from "../lib/card-level.ts";

test("경계값: 각 임계 EXP에서 정확히 레벨업", () => {
  assert.equal(cardLevelFromExp(0), 1);
  assert.equal(cardLevelFromExp(89), 1);
  assert.equal(cardLevelFromExp(90), 2);
  assert.equal(cardLevelFromExp(209), 2);
  assert.equal(cardLevelFromExp(210), 3);
  assert.equal(cardLevelFromExp(2799), 9);
  assert.equal(cardLevelFromExp(2800), 10);
  assert.equal(cardLevelFromExp(999999), 10); // 만렙 클램프
});

test("음수·비정상 입력 → 최소 레벨 1", () => {
  assert.equal(cardLevelFromExp(-100), 1);
});

test("DB compute_cat_card_level과 동일 임계값 (10단계)", () => {
  assert.deepEqual(CARD_LEVEL_THRESHOLDS, [0, 90, 210, 380, 610, 900, 1260, 1690, 2200, 2800]);
  // 각 임계값에서 레벨이 i+1이어야 커브 일치
  CARD_LEVEL_THRESHOLDS.forEach((t, i) => assert.equal(cardLevelFromExp(t), i + 1, `threshold[${i}]=${t}`));
});
