// 업적(catch) 순수 계산 테스트 — node --test tests/catch-achievements.test.mjs
// lib/catch/achievements.ts는 DB 없이 입력 통계 → 업적 목록을 계산한다 (2026-08-04 P3).
import { test } from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      return nextResolve(new URL(`../${specifier.slice(2)}.ts`, import.meta.url).href, context);
    }
    return nextResolve(specifier, context);
  },
});

const { computeAchievements, achievementInput, BATTLE_ACHIEVEMENT_KEYS } =
  await import("../lib/catch/achievements.ts");
const { SPAWN_SPECIES } = await import("../lib/catch/spawn-species.ts");

const EMPTY = {
  totalCatches: 0, rarityCounts: {}, distinctCells: 0, perfectCatches: 0,
  bossDefeats: 0, bestWinStreak: 0, speciesCount: 0, shinyCount: 0,
};

test("빈 입력 — 전부 미달성, current는 0", () => {
  const list = computeAchievements(EMPTY);
  assert.ok(list.length > 0);
  for (const a of list) {
    assert.equal(a.done, false, `${a.key}는 빈 입력에서 미달성이어야`);
    assert.equal(a.current, 0);
    assert.ok(a.target >= 1);
    assert.ok(a.reward > 0);
  }
});

test("key 유일성 — 수령 기록(achievement_claims)의 키가 겹치면 안 된다", () => {
  const keys = computeAchievements(EMPTY).map((a) => a.key);
  assert.equal(new Set(keys).size, keys.length);
});

test("달성 판정 — 첫 포획·레어·샤이니, current는 target에서 클램프", () => {
  const list = computeAchievements({
    ...EMPTY,
    totalCatches: 250, // catch_100 target(100) 초과 → current는 100으로 클램프
    rarityCounts: { common: 200, rare: 50 },
    shinyCount: 3,
  });
  const byKey = Object.fromEntries(list.map((a) => [a.key, a]));
  assert.equal(byKey.first_catch.done, true);
  assert.equal(byKey.catch_100.done, true);
  assert.equal(byKey.catch_100.current, 100);
  assert.equal(byKey.rare_1.done, true);
  assert.equal(byKey.legendary_1.done, false);
  assert.equal(byKey.shiny_1.done, true);
  assert.equal(byKey.rarity_all.current, 2); // common + rare 두 등급만
});

test("완전 도감 목표 — 카탈로그 크기를 동적으로 따라간다", () => {
  const all = computeAchievements(EMPTY).find((a) => a.key === "species_all");
  assert.equal(all.target, SPAWN_SPECIES.length);
});

test("배틀 업적 키 — 플래그 필터 대상 목록과 정의가 일치한다", () => {
  const keys = new Set(computeAchievements(EMPTY).map((a) => a.key));
  for (const k of BATTLE_ACHIEVEMENT_KEYS) {
    assert.ok(keys.has(k), `배틀 업적 ${k}가 정의에 없다`);
  }
});

test("achievementInput — 카드/프로필 행 집계 규칙 (도감·claim 서버 공용)", () => {
  const cards = [
    { card_rarity: "common", caught_geohash7: "wydm123", species_key: "cheese", is_shiny: false },
    { card_rarity: "common", caught_geohash7: "wydm123", species_key: "cheese", is_shiny: true },
    { card_rarity: "rare", caught_geohash7: "wydm999", species_key: "siamese", is_shiny: null },
    { card_rarity: "legendary", caught_geohash7: null, species_key: null, is_shiny: false },
  ];
  const input = achievementInput(cards, { perfect_catch_count: 7 });
  assert.equal(input.totalCatches, 4);
  assert.deepEqual(input.rarityCounts, { common: 2, rare: 1, legendary: 1 });
  assert.equal(input.distinctCells, 2);      // null 셀 제외
  assert.equal(input.speciesCount, 2);       // null 종 제외, 중복 1회
  assert.equal(input.shinyCount, 1);
  assert.equal(input.perfectCatches, 7);
  // 프로필 행 부재(lazy 생성 전) — 전부 0으로 안전
  assert.equal(achievementInput(cards, null).perfectCatches, 0);
});
