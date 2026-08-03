// 주간 의뢰(catch) 순수 로직 테스트 — node --test tests/catch-quests.test.mjs
// 냥줍 tests/quests.test.ts(vitest)의 city 규약 이식판 (2026-08-04 P3).
// (.mjs에서 .ts를 직접 import — Node 타입 스트리핑. 빌드·tsc와 무관하게 실행)
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

const {
  QUEST_POOL, currentQuest, currentWeekKey,
  isQuestDoneThisWeek, questProgressCount, encodeQuestProgress,
} = await import("../lib/catch/quests.ts");
const { SPECIES_BY_KEY, SPAWN_SPECIES } = await import("../lib/catch/spawn-species.ts");

// ── 주차 로테이션 ───────────────────────────────────────────────────────────

test("주차 키 — ISO 주차, KST 기준 (2026-07-13 월요일 = W29)", () => {
  assert.equal(currentWeekKey(new Date("2026-07-13T03:00:00Z")), "2026-W29");
  // KST 자정 경계: UTC 07-12 15:00 = KST 07-13 00:00 → 새 주(W29)
  assert.equal(currentWeekKey(new Date("2026-07-12T15:00:00Z")), "2026-W29");
  // 그 1초 전은 KST 일요일 밤 → 아직 W28
  assert.equal(currentWeekKey(new Date("2026-07-12T14:59:59Z")), "2026-W28");
});

test("결정적 선택 — 같은 주엔 언제 호출해도 같은 의뢰", () => {
  const mon = currentQuest(new Date("2026-07-13T00:00:00Z"));
  const sun = currentQuest(new Date("2026-07-19T11:30:00Z"));
  assert.equal(mon.id, sun.id);
  assert.ok(QUEST_POOL.some((q) => q.id === mon.id));
});

test("로테이션 — 26주 돌리면 풀에서 여러 의뢰가 번갈아 나온다", () => {
  const seen = new Set();
  for (let w = 0; w < 26; w++) {
    const d = new Date(Date.UTC(2026, 0, 5) + w * 7 * 86400_000); // 2026-01-05(월)부터 주 단위
    seen.add(currentQuest(d).id);
  }
  assert.ok(seen.size >= 3, `${seen.size} >= 3`);
});

// ── 달성 가능성 (죽은 의뢰 회귀 방지 — 냥줍 2026-07-15 감사 교훈) ───────────

test("판정 가능성 — 풀의 모든 의뢰가 실제 서버 이벤트로 달성 가능하다", () => {
  // city 라우트가 실제로 발행하는 이벤트 모양 전수:
  //   app/api/catch/capture → { type:"capture", speciesKey, rarity(최종), isPerfect }
  //   app/api/catch/pet     → { type:"pet" }
  const emittable = [
    ...SPAWN_SPECIES.flatMap((s) => [
      { type: "capture", speciesKey: s.key, rarity: s.rarity, isPerfect: false },
      { type: "capture", speciesKey: s.key, rarity: s.rarity, isPerfect: true },
    ]),
    { type: "pet" },
  ];
  for (const quest of QUEST_POOL) {
    assert.ok(quest.target >= 1);
    const achievable = emittable.some((e) => quest.matches(e));
    assert.ok(achievable, `의뢰 "${quest.id}"를 달성시킬 수 있는 서버 이벤트가 없다`);
  }
});

test("종 지정 의뢰 — 실제 스폰 카탈로그에 있는 common 종만 가리킨다", () => {
  for (const quest of QUEST_POOL) {
    // matches 함수가 어떤 speciesKey를 요구하는지 역추출: 각 종으로 이벤트를 쏴본다
    const wanted = SPAWN_SPECIES.filter((s) =>
      quest.matches({ type: "capture", speciesKey: s.key, rarity: s.rarity }));
    for (const s of wanted) {
      if (quest.id.startsWith("catch-") && quest.id !== "catch-uncommon" && quest.id !== "catch-3") {
        assert.ok(SPECIES_BY_KEY[s.key], `의뢰 ${quest.id}의 종 ${s.key}가 스폰 카탈로그에 없다`);
        assert.equal(s.rarity, "common", `종 지정 의뢰 ${quest.id}는 common 종이어야 주간 달성이 안정적`);
      }
    }
  }
});

// ── 진행도 인코딩 (catch_profiles.quest_week) ───────────────────────────────

const week = "2026-W29";

test("완료 판정 — 순수 주차 키와 일치할 때만 (진행 중 값은 미완료)", () => {
  assert.equal(isQuestDoneThisWeek(week, week), true);
  assert.equal(isQuestDoneThisWeek("2026-W28", week), false);   // 지난주 완료
  assert.equal(isQuestDoneThisWeek(`${week}:1`, week), false);  // 진행 중은 미완료
  assert.equal(isQuestDoneThisWeek(null, week), false);
  assert.equal(isQuestDoneThisWeek(undefined, week), false);
});

test("진행 횟수 — 이번 주 진행분만 세고, 다른 주·완료·깨진 값은 0", () => {
  assert.equal(questProgressCount(encodeQuestProgress(week, 1), week), 1);
  assert.equal(questProgressCount(encodeQuestProgress(week, 2), week), 2);
  assert.equal(questProgressCount(week, week), 0);            // 완료 상태는 진행 0
  assert.equal(questProgressCount("2026-W28:2", week), 0);    // 지난주 진행은 자동 리셋
  assert.equal(questProgressCount(null, week), 0);
  assert.equal(questProgressCount(`${week}:abc`, week), 0);   // 깨진 값 안전
  assert.equal(questProgressCount(`${week}:-3`, week), 0);
});
