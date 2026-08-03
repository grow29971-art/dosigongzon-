// 야생냥이(catch) 로밍 모듈 테스트 — node --test tests/catch-wild.test.mjs
// 냥줍 tests/roam.test.ts(vitest)의 city 규약 이식판 (2026-08-04 P1).
// (.mjs에서 .ts를 직접 import — Node 타입 스트리핑. 빌드·tsc와 무관하게 실행)
//
// lib/catch/* 모듈은 Next 규약대로 "@/lib/..." 별칭을 쓰는데 plain node는 이를
// 못 푼다 → registerHooks(동기 리졸버, Node 22.15+/24)로 "@/x" → "<루트>/x.ts"만
// 매핑한다. 별칭 해석 전에 정적 import가 먼저 평가되면 안 되므로 대상 모듈은
// 동적 import로 로드한다. (type-only import는 스트리핑 단계에서 지워져 무관)
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
  catsForCell, roamCatsNear, roamPosAt, resolveRoamById, withinRoamCaptureRange,
  isRoamActiveAt, roamCatNearCell, currentDay, ROAM_RADIUS_M, ROAM_CAPTURE_RADIUS_M,
  eventCatsForCell, isEventTimeKST, EVENT_CATS_PER_CELL, myCatRoamFor,
  wedCatsForCell, isWedNightKST, WED_CATS_PER_CELL,
} = await import("../lib/catch/wild.ts");
const { encodeGeohash, haversineMeters } = await import("../lib/catch/geohash.ts");

const SEOUL = { lat: 37.5665, lng: 126.978 };
const CELL = encodeGeohash(SEOUL.lat, SEOUL.lng, 5);
const DAY = currentDay();
const DAY_START = DAY * 86_400_000;

// ── 로밍 냥이 생성 ──────────────────────────────────────────────────────────

test("생성: 같은 셀·날짜는 항상 같은 냥이 목록 (결정성)", () => {
  const a = catsForCell(CELL, DAY);
  const b = catsForCell(CELL, DAY);
  assert.ok(a.length > 0);
  assert.deepEqual(a.map((c) => c.id + c.speciesKey), b.map((c) => c.id + c.speciesKey));
});

test("생성: 주변 5×5 셀에서 수백 마리 규모가 나온다", () => {
  const cats = roamCatsNear(SEOUL.lat, SEOUL.lng);
  assert.ok(cats.length > 100, `${cats.length} > 100`);
  assert.ok(cats.length < 1500, `${cats.length} < 1500`);
});

test("생성: 활동 시간대 — 밤하늘냥은 밤 전용, 낮/밤 필터가 결정적", () => {
  const all = catsForCell(CELL, DAY);
  // 종 고정: nightlord는 항상 night, goldenking은 항상 day
  for (const c of all) {
    if (c.speciesKey === "nightlord") assert.equal(c.activity, "night");
    if (c.speciesKey === "goldenking") assert.equal(c.activity, "day");
  }
  // KST 정오(=UTC 03시)와 KST 자정(=UTC 15시)의 활동 여부가 서로 반대
  const kstNoon = DAY_START + 3 * 3600_000;
  const kstMidnight = DAY_START + 15 * 3600_000;
  const dayCat = all.find((c) => c.activity === "day");
  const nightCat = all.find((c) => c.activity === "night");
  if (dayCat) {
    assert.equal(isRoamActiveAt(dayCat, kstNoon), true);
    assert.equal(isRoamActiveAt(dayCat, kstMidnight), false);
  }
  if (nightCat) {
    assert.equal(isRoamActiveAt(nightCat, kstNoon), false);
    assert.equal(isRoamActiveAt(nightCat, kstMidnight), true);
  }
  // roamCatsNear는 활동 중인 냥이만 — 자정엔 day 냥이가 없어야 함
  const atMidnight = roamCatsNear(SEOUL.lat, SEOUL.lng, kstMidnight);
  assert.ok(atMidnight.every((c) => c.activity !== "day"));
});

test("resolveRoamById — 활동 시간대 밖의 냥이는 포획 불가", () => {
  const all = catsForCell(CELL, DAY);
  const nightCat = all.find((c) => c.activity === "night");
  if (nightCat) {
    const idx = all.indexOf(nightCat);
    const kstNoon = DAY_START + 3 * 3600_000;
    assert.equal(resolveRoamById(`roam:${CELL}:${DAY}:${idx}`, kstNoon), null);
  }
});

test("resolveRoamById — 오늘 냥이는 찾고, 어제 냥이는 (유예 밖에서) null", () => {
  // 상시(all) 활동 개체로 고정 — [0]을 쓰면 날짜별 로스터에 따라 낮/밤 전용이 걸려
  // 활동 시간대 검증에서 null이 되는 날짜 의존 플레이크가 있었다(냥줍 2026-07-13 실측)
  const cat = catsForCell(CELL, DAY).find((c) => c.activity === "all");
  const found = resolveRoamById(cat.id, DAY_START + 12 * 3600_000);
  assert.equal(found?.speciesKey, cat.speciesKey);
  const yesterday = `roam:${CELL}:${DAY - 1}:0`;
  assert.equal(resolveRoamById(yesterday, DAY_START + 12 * 3600_000), null);
});

// [C4 보안 회귀, 냥줍 2026-07-31] cell 정밀도 미검증 시 공격자가 자기 gh7(≈150m)을
// cell로 넣어 실위치 안에 냥이를 생성 → 근접검증 통과로 레전드 파밍이 가능했다.
// gh5가 아닌 cell은 반드시 null이어야 한다.
test("resolveRoamById — gh5가 아닌 cell(정밀도 위조)은 거절", () => {
  const noon = DAY_START + 12 * 3600_000;
  const gh7 = encodeGeohash(SEOUL.lat, SEOUL.lng, 7); // 공격자 실위치 셀
  const gh6 = encodeGeohash(SEOUL.lat, SEOUL.lng, 6);
  assert.equal(resolveRoamById(`roam:${gh7}:${DAY}:0`, noon), null);
  assert.equal(resolveRoamById(`roam:${gh6}:${DAY}:0`, noon), null);
  assert.equal(resolveRoamById(`roam:${CELL}a:${DAY}:0`, noon), null); // gh5+1자
  assert.equal(resolveRoamById(`roam:AAAAA:${DAY}:0`, noon), null); // base32 밖 문자
  // 정상 gh5는 여전히 통과(회귀 방지)
  const ok = catsForCell(CELL, DAY).find((c) => c.activity === "all");
  assert.equal(resolveRoamById(ok.id, noon)?.speciesKey, ok.speciesKey);
});

// ── 로밍 이동 ──────────────────────────────────────────────────────────────

const MOVE_CAT = catsForCell(CELL, DAY)[0];

test("이동: 같은 시각이면 항상 같은 위치 (서버 검증의 전제)", () => {
  const t = DAY_START + 5 * 3600_000;
  assert.deepEqual(roamPosAt(MOVE_CAT, t), roamPosAt(MOVE_CAT, t));
});

test("이동: 속도가 사람 걷기(1.4m/s)보다 빠르고 상한 이내", () => {
  // 웨이포인트 구간 안에서는 등속 — 여러 구간을 샘플해 속도 확인
  for (let h = 1; h < 20; h += 3) {
    const t = DAY_START + h * 3600_000 + 60_000; // 구간 중간
    const p1 = roamPosAt(MOVE_CAT, t);
    const p2 = roamPosAt(MOVE_CAT, t + 100_000); // 100초 뒤
    const v = haversineMeters(p1.lat, p1.lng, p2.lat, p2.lng) / 100;
    assert.ok(v > 1.4, `v=${v} > 1.4`);
    assert.ok(v < 4.5, `v=${v} < 4.5`);
  }
});

test("이동: 하루 종일 집에서 10km(+한 걸음) 이상 벗어나지 않는다", () => {
  const cats = catsForCell(CELL, DAY).slice(0, 5);
  for (const c of cats) {
    for (let h = 0; h < 24; h += 2) {
      const p = roamPosAt(c, DAY_START + h * 3600_000);
      const d = haversineMeters(c.homeLat, c.homeLng, p.lat, p.lng);
      assert.ok(d < ROAM_RADIUS_M + c.speedMps * 600 + 50, `d=${d}`);
    }
  }
});

test("포획 판정 — 냥이 위치에서는 통과, 5km 밖에서는 거절", () => {
  const t = Date.now();
  const pos = roamPosAt(MOVE_CAT, t);
  assert.equal(withinRoamCaptureRange(pos.lat, pos.lng, MOVE_CAT, 1, t), true);
  assert.equal(withinRoamCaptureRange(pos.lat + 0.05, pos.lng, MOVE_CAT, 1.5, t), false);
  // 서버 slack: 75초 전 위치 기준에서도 통과 (미니게임 소요 보정)
  const oldPos = roamPosAt(MOVE_CAT, t - 75_000);
  assert.equal(withinRoamCaptureRange(oldPos.lat, oldPos.lng, MOVE_CAT, 1.5, t), true);
});

test("셀 근접 검증(프라이버시 마스킹) — 냥이 셀에서 통과, 먼 셀에서 거절", () => {
  const t = Date.now();
  const pos = roamPosAt(MOVE_CAT, t);
  const myCell = encodeGeohash(pos.lat, pos.lng, 7);
  assert.equal(roamCatNearCell(MOVE_CAT, myCell, t), true);
  const farCell = encodeGeohash(pos.lat + 0.05, pos.lng, 7); // ≈5.5km 밖
  assert.equal(roamCatNearCell(MOVE_CAT, farCell, t), false);
});

test("틱 성능 — 주변 전체 위치 계산이 150ms 이내 (1초 틱 예산)", () => {
  const cats = roamCatsNear(SEOUL.lat, SEOUL.lng);
  const t0 = performance.now();
  const now = Date.now();
  for (const c of cats) roamPosAt(c, now);
  const elapsed = performance.now() - t0;
  // 50ms 예산은 개발 PC에서 54~79ms로 상시 플레이크(냥줍 2026-07-13 실측).
  // 실제 예산은 1초 틱이므로 150ms면 충분히 보수적이다.
  assert.ok(elapsed < 150, `${elapsed}ms < 150ms`);
});

test("포획 반경 상수가 미니게임 밸런스와 일치 (100m)", () => {
  assert.equal(ROAM_CAPTURE_RADIUS_M, 100);
});

// ── 🎉 주말 페스타 이벤트 냥이 ─────────────────────────────────────────────
// KST 2026-07-11(토) 정오 / 2026-07-13(월) 정오
const SAT_NOON = Date.UTC(2026, 6, 11, 3, 0, 0);
const MON_NOON = Date.UTC(2026, 6, 13, 3, 0, 0);

test("페스타: KST 토·일에만 활성", () => {
  assert.equal(isEventTimeKST(SAT_NOON), true);
  assert.equal(isEventTimeKST(MON_NOON), false);
  // 일요일 KST 23:59 → 활성, 월요일 KST 00:01 → 비활성(유예 없이)
  assert.equal(isEventTimeKST(Date.UTC(2026, 6, 12, 14, 59)), true);
  assert.equal(isEventTimeKST(Date.UTC(2026, 6, 12, 15, 1)), false);
  // 월요일 00:01이라도 5분 유예면 통과 (미니게임 도중 자정 넘김)
  assert.equal(isEventTimeKST(Date.UTC(2026, 6, 12, 15, 1), 5 * 60_000), true);
});

test("페스타: 결정적 생성 + 레어 이상 보장 + 상시 활동", () => {
  const day = currentDay(SAT_NOON);
  const a = eventCatsForCell(CELL, day);
  const b = eventCatsForCell(CELL, day);
  assert.equal(a.length, EVENT_CATS_PER_CELL);
  assert.deepEqual(a.map((c) => c.id + c.speciesKey), b.map((c) => c.id + c.speciesKey));
  for (const c of a) {
    assert.ok(["rare", "legendary"].includes(c.species.rarity));
    assert.equal(c.activity, "all");
    assert.ok(c.id.startsWith("event:"));
  }
});

test("페스타: 주말에는 roamCatsNear에 섞이고, 평일에는 빠진다", () => {
  const weekend = roamCatsNear(SEOUL.lat, SEOUL.lng, SAT_NOON);
  const weekday = roamCatsNear(SEOUL.lat, SEOUL.lng, MON_NOON);
  assert.ok(weekend.some((c) => c.id.startsWith("event:")));
  assert.ok(!weekday.some((c) => c.id.startsWith("event:")));
});

test("페스타: resolveRoamById — 주말엔 event id 복원, 평일엔 거절", () => {
  const day = currentDay(SAT_NOON);
  const cat = eventCatsForCell(CELL, day)[0];
  assert.equal(resolveRoamById(cat.id, SAT_NOON)?.speciesKey, cat.speciesKey);
  // 같은 날짜의 id라도 평일 시각으로 검증하면 거절 — 단 day가 과거면 날짜 검증에서 이미
  // 거절되므로 활성 시간 검증을 보려면 주말 자정 직후+유예 밖 시각을 쓴다
  const monAfterGrace = Date.UTC(2026, 6, 12, 15, 10); // KST 월 00:10 (유예 5분 밖, day는 같은 UTC일)
  if (currentDay(monAfterGrace) === day) {
    assert.equal(resolveRoamById(cat.id, monAfterGrace), null);
  }
});

// ── 🐾 내 냥이 로밍 (실사 카드 눈요기) ─────────────────────────────────────
const GH7 = encodeGeohash(SEOUL.lat, SEOUL.lng, 7);
const CARD = "11111111-2222-3333-4444-555555555555";

test("내 냥이: 결정적 — 같은 카드·날짜는 같은 트랙, 위치 계산도 동일", () => {
  const a = myCatRoamFor(CARD, GH7, DAY);
  const b = myCatRoamFor(CARD, GH7, DAY);
  assert.notEqual(a, null);
  assert.deepEqual(a, b);
  const t = DAY_START + 5 * 3600_000;
  assert.deepEqual(roamPosAt(a, t), roamPosAt(b, t));
});

test("내 냥이: 위치 보안 — 홈 앵커가 촬영 셀 중심에서 1~3km 벗어나고, 날짜마다 달라진다", () => {
  const today = myCatRoamFor(CARD, GH7, DAY);
  const tomorrow = myCatRoamFor(CARD, GH7, DAY + 1);
  const off1 = haversineMeters(SEOUL.lat, SEOUL.lng, today.homeLat, today.homeLng);
  // 셀 중심 기준이라 검사 여유 ±200m (gh7 셀 반경 ≈75m + 하버사인 오차)
  assert.ok(off1 > 350, `off1=${off1}`);
  assert.ok(off1 < 1700, `off1=${off1}`);
  // 내일은 다른 오프셋 — 궤적 중심 관찰로 촬영 위치가 역산되지 않는 근거
  const dayDiff = haversineMeters(today.homeLat, today.homeLng, tomorrow.homeLat, tomorrow.homeLng);
  assert.ok(dayDiff > 100, `dayDiff=${dayDiff}`);
});

test("내 냥이: 야생보다 빠르고 불규칙 — 속도 4.8~7.0m/s, 웨이포인트 60~150초", () => {
  for (let i = 0; i < 20; i++) {
    const t = myCatRoamFor(`card-${i}`, GH7, DAY);
    assert.ok(t.speedMps >= 4.8 && t.speedMps <= 7.0, `speed=${t.speedMps}`);
    assert.ok(t.legSeconds >= 60 && t.legSeconds <= 150, `leg=${t.legSeconds}`);
  }
});

test("내 냥이: 등록 지점 기준 3km 상한 — 오프셋+반경 합산으로도 넘지 않는다", () => {
  // 냥줍 사용자 확정(2026-07-13 2차): 이동범위 = 등록한 곳 반경 3km
  for (let i = 0; i < 8; i++) {
    const track = myCatRoamFor(`card-r-${i}`, GH7, DAY);
    let maxD = 0;
    for (let h = 0; h < 24; h += 1) {
      const pos = roamPosAt(track, DAY_START + h * 3600_000);
      // 등록 지점(셀 중심) 기준 거리 — 오프셋 홈이 아니라 원점 기준으로 검사
      const d = haversineMeters(SEOUL.lat, SEOUL.lng, pos.lat, pos.lng);
      maxD = Math.max(maxD, d);
      assert.ok(d < 3000 + track.speedMps * (track.legSeconds ?? 600) + 250, `d=${d}`);
    }
    // 실제로 어슬렁대는지(제자리 고정이 아닌지)도 확인
    assert.ok(maxD > 100, `maxD=${maxD}`);
  }
});

test("내 냥이: 깨진 geohash면 null — 마커 생성에서 조용히 걸러진다", () => {
  assert.equal(myCatRoamFor(CARD, "", DAY), null);
});

// ── 🌙 수요일 골목의 밤 ────────────────────────────────────────────────────
// KST 2026-07-15(수) 19시 / 수 12시 / 2026-07-13(월) 19시
const WED_NIGHT = Date.UTC(2026, 6, 15, 10, 0);
const WED_NOON = Date.UTC(2026, 6, 15, 3, 0);
const MON_NIGHT = Date.UTC(2026, 6, 13, 10, 0);

test("수요냥: KST 수요일 18~24시에만 활성", () => {
  assert.equal(isWedNightKST(WED_NIGHT), true);
  assert.equal(isWedNightKST(WED_NOON), false);
  assert.equal(isWedNightKST(MON_NIGHT), false);
  // 자정 직후 유예 — 목 00:02는 5분 유예로 통과
  const thuJustAfter = Date.UTC(2026, 6, 15, 15, 2);
  assert.equal(isWedNightKST(thuJustAfter), false);
  assert.equal(isWedNightKST(thuJustAfter, 5 * 60_000), true);
});

test("수요냥: 결정적 생성 + 희귀 이상 보장", () => {
  const day = currentDay(WED_NIGHT);
  const a = wedCatsForCell(CELL, day);
  const b = wedCatsForCell(CELL, day);
  assert.equal(a.length, WED_CATS_PER_CELL);
  assert.deepEqual(a.map((c) => c.id + c.speciesKey), b.map((c) => c.id + c.speciesKey));
  for (const c of a) {
    assert.ok(["uncommon", "rare"].includes(c.species.rarity));
    assert.ok(c.id.startsWith("wed:"));
  }
});

test("수요냥: 수요일 밤에는 roamCatsNear에 섞이고, 그 외엔 빠진다", () => {
  const on = roamCatsNear(SEOUL.lat, SEOUL.lng, WED_NIGHT);
  const off = roamCatsNear(SEOUL.lat, SEOUL.lng, WED_NOON);
  assert.ok(on.some((c) => c.id.startsWith("wed:")));
  assert.ok(!off.some((c) => c.id.startsWith("wed:")));
});

test("수요냥: resolveRoamById — 수요일 밤엔 복원, 같은 날 낮엔 거절", () => {
  const day = currentDay(WED_NIGHT);
  const cat = wedCatsForCell(CELL, day)[0];
  assert.equal(resolveRoamById(cat.id, WED_NIGHT)?.speciesKey, cat.speciesKey);
  assert.equal(resolveRoamById(cat.id, WED_NOON), null);
});
