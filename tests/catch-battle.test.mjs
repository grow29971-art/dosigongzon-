// 야생냥이(catch) 배틀 모듈 테스트 — node --test tests/catch-battle.test.mjs
// 냥줍 tests/ranking.test.ts(vitest) 이식 + 배틀 엔진 불변식 검증 (2026-08-04 P4).
// (.mjs에서 .ts를 직접 import — Node 타입 스트리핑. 별칭 해석은 registerHooks.)
// battle-token.ts는 "server-only" 가드라 plain node에서 import 불가 — 라우트 통합에서 검증.
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
  thisMondayKstISO, weekStartUtc, lastWeekRange, weekKeyOf, rankBattleScores,
  WEEKLY_RANK_REWARDS, COINS_BATTLE_WIN, COINS_BOSS_WIN,
} = await import("../lib/catch/ranking.ts");
const {
  simulateBattle, calcStats, estimateWinRate, pickByTargetWinRate, underdogBoost,
  makeBossOpponent, makeCreatureOpponent, makePveOpponent,
  PVE_ROSTER, PVE_PHOTO_KEYS, BOSS_CAT_ID, AUTO_SKILL_FX, RARITY_HP_BONUS,
} = await import("../lib/catch/battle-engine.ts");
const { PVE_BESTIARY, PVE_BOSS, bestiaryPhotoUrl } = await import("../lib/catch/pve-bestiary.ts");
const { SKILL_POOL, SPECIAL_SKILLS } = await import("../lib/battle-config.ts");

// ── 테스트용 카드 팩토리 ──
function makeCat(overrides = {}) {
  return {
    id: "test-cat", photo_url: null, owner_id: "u1",
    card_level: 3, card_exp: 0, card_rarity: "common",
    card_name: "테스트냥", card_traits: ["a", "b"],
    card_stats: { cuteness: 50, wildness: 50, sociability: 50, mysteriousness: 50 },
    battle_atk: 40, battle_def: 25, battle_eva: 8, battle_crit: 8,
    battle_special: "sharp_claws", battle_special2: "grooming",
    battle_special3: "tail_whip", battle_special4: "body_slam",
    win_streak: 0,
    ...overrides,
  };
}

// ══ 주간 랭킹 주 경계 (냥줍 tests/ranking.test.ts 이식) ══
// 기준: 2026-07-13(월) 00:00 KST = 2026-07-12T15:00:00.000Z

test("주중(수요일 낮 KST) — 이번 주 시작은 직전 월요일 00:00 KST", () => {
  const wedNoonKst = new Date("2026-07-15T03:00:00Z"); // 수 12:00 KST
  assert.equal(thisMondayKstISO(wedNoonKst), "2026-07-12T15:00:00.000Z");

  const { startISO, endISO, weekKey } = lastWeekRange(wedNoonKst);
  assert.equal(startISO, "2026-07-05T15:00:00.000Z"); // 지난주 월 00:00 KST (7/6)
  assert.equal(endISO, "2026-07-12T15:00:00.000Z");   // 이번 주 시작 = 반개구간 끝
  assert.equal(weekKey, "2026-07-06");                 // 지난주 월요일의 KST 날짜
});

test("경계 정밀 — 월 00:00:00 KST 정각은 새 주, 1ms 전은 이전 주", () => {
  const mondayMidnightKst = new Date("2026-07-12T15:00:00.000Z");
  assert.equal(weekStartUtc(mondayMidnightKst).toISOString(), "2026-07-12T15:00:00.000Z");

  const oneMsBefore = new Date(mondayMidnightKst.getTime() - 1);
  assert.equal(weekStartUtc(oneMsBefore).toISOString(), "2026-07-05T15:00:00.000Z");
});

test("크론 발화 시각(월 00:05 KST = 일 15:05 UTC) — 지난주 범위·멱등 키가 정확", () => {
  const cronFire = new Date("2026-07-12T15:05:00Z"); // vercel.json "5 15 * * 0"
  const { startISO, endISO, weekKey } = lastWeekRange(cronFire);
  assert.equal(startISO, "2026-07-05T15:00:00.000Z");
  assert.equal(endISO, "2026-07-12T15:00:00.000Z");
  assert.equal(weekKey, "2026-07-06");
  // 다음 주 월요일에 다시 돌면 키가 달라진다 (멱등 키의 주 단위 유일성)
  assert.equal(lastWeekRange(new Date("2026-07-19T15:05:00Z")).weekKey, "2026-07-13");
  // 주 시작 인스턴트의 키 = 그 월요일의 KST 날짜
  assert.equal(weekKeyOf(new Date("2026-07-12T15:00:00.000Z")), "2026-07-13");
});

test("점수 집계 — 승 3점/패 1점, 내림차순, null 참가자 무시", () => {
  const rows = [
    { challenger_id: "a", opponent_id: "b", winner_id: "a" }, // a 승, b 패
    { challenger_id: "a", opponent_id: "c", winner_id: "c" }, // c 승, a 패
    { challenger_id: "b", opponent_id: null, winner_id: "b" }, // b 승 (상대 null은 무시)
    { challenger_id: null, opponent_id: null, winner_id: null }, // 전부 null — 집계 없음
  ];
  const ranked = rankBattleScores(rows);
  // a: 1승1패 = 4점, b: 1승1패 = 4점, c: 1승 = 3점 / 동점(a,b)은 첫 등장 순
  assert.deepEqual(ranked, [
    { userId: "a", score: 4, wins: 1, losses: 1 },
    { userId: "b", score: 4, wins: 1, losses: 1 },
    { userId: "c", score: 3, wins: 1, losses: 0 },
  ]);
  assert.deepEqual(rankBattleScores([]), []);
});

test("보상 상수 — 랭킹 TOP 10 지급표·배틀 코인이 냥줍 원본값 그대로", () => {
  assert.deepEqual(WEEKLY_RANK_REWARDS, [200, 150, 120, 100, 80, 60, 50, 40, 30, 20]);
  assert.equal(COINS_BATTLE_WIN, 3);
  assert.equal(COINS_BOSS_WIN, 8);
});

// ══ 배틀 엔진 불변식 ══

test("calcStats — 양수 스탯, 등급 HP 보너스 반영, PVE HP 배율 적용", () => {
  const s = calcStats(makeCat());
  for (const k of ["hp", "atk", "def", "eva", "crit", "spd"]) {
    assert.ok(s[k] > 0, `${k} > 0`);
  }
  // 레전드는 common보다 HP 보너스만큼 두껍다
  const legend = calcStats(makeCat({ card_rarity: "legendary" }));
  assert.equal(legend.hp - s.hp, RARITY_HP_BONUS.legendary - RARITY_HP_BONUS.common);
  // PVE HP 배율
  const fat = calcStats(makeCat({ pve_hp_mult: 2 }));
  assert.equal(fat.hp, s.hp * 2);
});

test("simulateBattle — 결과 일관성: winner/draw와 HP 잔량이 맞고 로그가 쌓인다", () => {
  for (let i = 0; i < 50; i++) {
    const r = simulateBattle(makeCat(), makeCat({ id: "opp", owner_id: "u2" }));
    assert.ok(r.rounds >= 1 && r.rounds <= 40);
    assert.ok(r.log.length >= 1);
    assert.ok(r.aHp >= 0 && r.dHp >= 0);
    assert.equal(r.isDraw, r.aHp === r.dHp);
    assert.equal(r.attackerWins, r.aHp > r.dHp);
    // 종료 조건: 한쪽이 0이거나 최대 턴 도달
    assert.ok(r.aHp === 0 || r.dHp === 0 || r.rounds === 40);
  }
});

test("simulateBattle — 압도적 스탯 차이는 승률로 드러난다 (레전드 vs 최약 common)", () => {
  const strong = makeCat({ card_rarity: "legendary", card_level: 8, battle_atk: 85, battle_def: 70, battle_eva: 25, battle_crit: 25,
    battle_special: "meteor", battle_special2: "vampirism", battle_special3: "dominate", battle_special4: "regen" });
  // underdogBoost(도전자 보정)를 배제하기 위해 같은 등급·레벨의 저스탯 카드로 비교
  const weak = makeCat({ id: "w", card_rarity: "legendary", card_level: 8, battle_atk: 12, battle_def: 5, battle_eva: 2, battle_crit: 2 });
  const winRate = estimateWinRate(strong, weak, 60);
  assert.ok(winRate > 0.8, `강한 쪽 승률 ${winRate} > 0.8`);
});

test("underdogBoost — 동급은 1배, 열세측은 보너스, PVE 상대전은 항상 1배", () => {
  const a = makeCat(), b = makeCat({ id: "b" });
  assert.deepEqual(underdogBoost(a, b), { dmg: 1, hp: 1 });
  const under = underdogBoost(makeCat(), makeCat({ id: "l", card_rarity: "legendary", card_level: 8 }));
  assert.ok(under.dmg > 1 && under.hp > 1);
  assert.ok(under.dmg <= 1.6 && under.hp <= 1.45); // 상한 클램프
  // 우세측은 보정 없음
  assert.deepEqual(underdogBoost(makeCat({ card_rarity: "legendary" }), makeCat({ id: "c" })), { dmg: 1, hp: 1 });
  // PVE(HP 배율 보유) 상대전은 자체 튜닝이라 제외
  assert.deepEqual(underdogBoost(makeCat({ pve_hp_mult: 1.7 }), b), { dmg: 1, hp: 1 });
});

test("PVE 합성 상대 — 보스/야생동물 형태와 로스터 정합", () => {
  const me = makeCat();
  const boss = makeBossOpponent(me);
  assert.equal(boss.id, BOSS_CAT_ID);
  assert.equal(boss.photo_url, "/boss/villain-card.jpg");
  assert.ok(boss.pve_hp_mult > 1);

  for (const c of PVE_ROSTER) {
    const opp = makeCreatureOpponent(me, c);
    assert.equal(opp.id, `pve-${c.key}`);
    assert.ok(opp.battle_atk >= 8 && opp.battle_def >= 3);
    // 사진 키는 로스터 키의 부분집합이어야 함 (죽은 에셋 참조 방지)
    if (PVE_PHOTO_KEYS.has(c.key)) assert.equal(opp.photo_url, `/pve/${c.key}.jpg`);
    else assert.equal(opp.photo_url, null);
    // 스킬 4개는 전부 실제 스킬 사전에 존재
    for (const s of c.skills) assert.ok(SPECIAL_SKILLS[s], `${c.key}의 스킬 ${s}`);
  }
  // makePveOpponent는 보스 또는 로스터 중 하나
  for (let i = 0; i < 30; i++) {
    const opp = makePveOpponent(me);
    assert.ok(opp.id === BOSS_CAT_ID || opp.id.startsWith("pve-"));
  }
});

test("PVE 도감(bestiary) — 로스터와 키·순서 동기화, 보스 포함", () => {
  assert.deepEqual(PVE_BESTIARY.map(e => e.key), PVE_ROSTER.map(c => c.key));
  // dexNo는 1부터 연번
  PVE_BESTIARY.forEach((e, i) => assert.equal(e.dexNo, i + 1));
  assert.equal(PVE_BOSS.dexNo, PVE_BESTIARY.length + 1);
  assert.equal(bestiaryPhotoUrl(PVE_BOSS), "/boss/villain-card.jpg");
  // photo=true인 엔트리는 전부 실제 에셋 키 목록에 존재
  for (const e of PVE_BESTIARY) {
    if (e.photo) assert.ok(PVE_PHOTO_KEYS.has(e.key), `photo 에셋 ${e.key}`);
  }
});

test("AUTO_SKILL_FX — 스킬 풀의 40종 전부 효과표에 정의돼 있다 (조용한 기본값 함정 방지)", () => {
  const all = Object.values(SKILL_POOL).flat();
  assert.equal(new Set(all).size, 40);
  for (const id of all) {
    assert.ok(AUTO_SKILL_FX[id], `AUTO_SKILL_FX[${id}]`);
    assert.equal(typeof AUTO_SKILL_FX[id].dmgMult, "number");
  }
});

test("pickByTargetWinRate — 후보 중 하나를 반환한다", () => {
  const me = makeCat();
  const candidates = [
    makeCat({ id: "c1", owner_id: "u2" }),
    makeCat({ id: "c2", owner_id: "u3", battle_atk: 60 }),
    makeCat({ id: "c3", owner_id: "u4", battle_atk: 20 }),
  ];
  const picked = pickByTargetWinRate(me, candidates, 0.5);
  assert.ok(candidates.some(c => c.id === picked.id));
});
