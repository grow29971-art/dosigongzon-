// 케어 순수 모듈 테스트 — node --test tests/care.test.mjs
// (.mjs에서 .ts를 직접 import — Node 23.6+ 타입 스트리핑. 빌드·tsc와 무관하게 실행)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fullnessAt,
  moodAt,
  gaugeTs,
  careState,
  growthStage,
  currentCareDay,
  CARE_DEFAULT_GAUGE,
  FULLNESS_DECAY_HOURS,
  MOOD_DECAY_HOURS,
} from "../lib/care.ts";

const H = 3_600_000;
const NOW = Date.parse("2026-07-16T12:00:00.000Z");
const iso = (msAgo) => new Date(NOW - msAgo).toISOString();

test("포만감 감쇠: 0h=100, 12h=50, 24h=0, 만료 후에도 0 클램프", () => {
  assert.equal(fullnessAt(iso(0), NOW), 100);
  assert.equal(fullnessAt(iso(12 * H), NOW), 50);
  assert.equal(fullnessAt(iso(24 * H), NOW), 0);
  assert.equal(fullnessAt(iso(30 * H), NOW), 0);
});

test("기분 감쇠: 48h 곡선 (24h=50)", () => {
  assert.equal(moodAt(iso(0), NOW), 100);
  assert.equal(moodAt(iso(24 * H), NOW), 50);
  assert.equal(moodAt(iso(48 * H), NOW), 0);
});

test("null 타임스탬프 → 기본값 55", () => {
  assert.equal(fullnessAt(null, NOW), CARE_DEFAULT_GAUGE);
  assert.equal(moodAt(null, NOW), CARE_DEFAULT_GAUGE);
});

test("잘못된 타임스탬프 → 기본값 55", () => {
  assert.equal(fullnessAt("이상한값", NOW), CARE_DEFAULT_GAUGE);
});

test("gaugeTs 왕복: fullnessAt(gaugeTs(v)) === v", () => {
  for (const v of [0, 1, 35, 55, 70, 93, 100]) {
    assert.ok(Math.abs(fullnessAt(gaugeTs(v, FULLNESS_DECAY_HOURS, NOW), NOW) - v) < 1e-6, `v=${v}`);
    assert.ok(Math.abs(moodAt(gaugeTs(v, MOOD_DECAY_HOURS, NOW), NOW) - v) < 1e-6, `mood v=${v}`);
  }
});

test("gaugeTs 클램프: 100 초과·0 미만 입력", () => {
  assert.equal(fullnessAt(gaugeTs(140, FULLNESS_DECAY_HOURS, NOW), NOW), 100);
  assert.equal(fullnessAt(gaugeTs(-20, FULLNESS_DECAY_HOURS, NOW), NOW), 0);
});

test("부분 회복 시나리오: 현재 55 + 38 = 93 (100 아님)", () => {
  const current = fullnessAt(null, NOW); // 55
  const next = Math.min(100, current + 38);
  const savedTs = gaugeTs(next, FULLNESS_DECAY_HOURS, NOW);
  assert.ok(Math.abs(fullnessAt(savedTs, NOW) - 93) < 1e-6);
});

test("careState 경계값", () => {
  assert.equal(careState(34, 34).key, "lonely");   // 둘 다 <35 → 외로움 최우선
  assert.equal(careState(34, 80).key, "hungry");
  assert.equal(careState(80, 34).key, "sulky");
  assert.equal(careState(35, 35).key, "calm");     // 딱 35는 부족 아님
  assert.equal(careState(70, 70).key, "excited");  // 딱 70부터 신남
  assert.equal(careState(69, 100).key, "calm");
});

test("careState 문구에 죄책감 단어 없음", () => {
  for (const [f, m] of [[10, 10], [10, 80], [80, 10], [50, 50], [90, 90]]) {
    const s = careState(f, m);
    assert.ok(!/굶|죽|아파|병/.test(s.line + s.label), s.key);
  }
});

test("growthStage: Lv10 커브 안 경계값", () => {
  assert.equal(growthStage(1).name, "아기냥");
  assert.equal(growthStage(2).name, "아기냥");
  assert.equal(growthStage(3).name, "개구쟁이");
  assert.equal(growthStage(5).name, "어른냥");
  assert.equal(growthStage(7).name, "의젓냥");
  assert.equal(growthStage(9).name, "전설냥");
  assert.equal(growthStage(10).name, "전설냥"); // 커브 최대치에서도 유효
});

test("currentCareDay: KST 자정 경계 (UTC 14:59 vs 15:00)", () => {
  const before = Date.parse("2026-07-16T14:59:00.000Z"); // KST 23:59
  const after = Date.parse("2026-07-16T15:00:00.000Z");  // KST 다음날 00:00
  assert.equal(currentCareDay(after) - currentCareDay(before), 1);
});

test("currentCareDay: 같은 KST 하루 안에서는 동일", () => {
  const morning = Date.parse("2026-07-16T00:00:00.000Z"); // KST 09:00
  const evening = Date.parse("2026-07-16T14:00:00.000Z"); // KST 23:00
  assert.equal(currentCareDay(morning), currentCareDay(evening));
});
