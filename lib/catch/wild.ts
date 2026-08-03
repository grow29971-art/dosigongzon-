// 로밍 냥이 — 지도 위를 "실제로" 돌아다니는 야생 고양이 (2026-07-11 도입).
//
// 구 스폰 시스템(legacy/spawn.ts: 셀×30분 고정 스폰 + 소반경 순찰)의 후속.
// 차이점: 냥이가 하루 단위로 존재하고, 집(home)에서 최대 10km 반경을
// 사람 걷기(≈1.4m/s)보다 빠른 2.0~3.0m/s로 계속 이동한다.
//
// 검증 원칙은 구 시스템 그대로 계승 — 냥이를 DB에 저장하지 않는다.
// "geohash5 셀 × 날짜"를 시드로 한 PRNG가 냥이(집·종·속도)를 결정하고,
// 경로는 "10분 간격 웨이포인트 랜덤워크"의 순수 함수라서
//   - 클라이언트는 즉시 그릴 수 있고(서버 왕복 없음, 모두에게 동일),
//   - 서버는 포획 요청 시 같은 계산으로 위치·종을 재검증한다(위조 불가).
// 중복 포획은 cards(owner_id, spawn_id) unique 제약이 최종 방어선.

import { encodeGeohash, geohashBounds, geohashNeighbors3x3, haversineMeters } from "@/lib/catch/geohash";
import { SPECIES_BY_RARITY, SPECIES_BY_KEY, type SpawnSpecies } from "@/lib/catch/spawn-species";
import type { GradeKey } from "@/lib/cat-grade-rules"; // 냥줍과 동일 계보 — city 기존 모듈 재사용 (2026-08-04 catch 이식)

// ── 튜닝 상수 ──────────────────────────────────────────────────────────────
export const ROAM_CELL_PRECISION = 5;      // geohash5 ≈ 4.9km × 4.9km — 냥이의 "출신 동네"
// GO식 "빽빽한 지도" 방향 (2026-07-16) — 셀당 마릿수 ↑. 포획 자체는 서버 쿨다운·레이트리밋
// (roam/capture: 10분당 15마리 + 셀 쿨다운)이 그대로 막으므로 밀도는 시각/체감만 늘고 파밍은 불변.
const CATS_PER_CELL_MIN = 46;              // 셀당 마릿수 → 체감 밀도 ≈ 2.3마리/km² (구 1.2)
const CATS_PER_CELL_MAX = 62;
export const ROAM_RADIUS_M = 10_000;       // 집에서 최대 10km까지 방랑
const LEG_SECONDS = 600;                   // 10분마다 방향 전환(웨이포인트)
const SPEED_MIN_MPS = 2.8;                 // 사람 걷기(≈1.4m/s)보다 확실히 빠르게 — 조깅 속도
const SPEED_MAX_MPS = 4.2;                 // (2026-07-12 상향: 지도에서 움직임이 더 생생하게)

export const ROAM_CAPTURE_RADIUS_M = 100;
export const ROAM_CAPTURE_SERVER_SLACK = 1.5;
// 미니게임 하는 동안 냥이가 이동하므로, 서버는 최근 90초 구간의 최소 거리로 판정
const CAPTURE_WINDOW_S = 90;
const CAPTURE_SAMPLE_S = 15;
// 자정 직후 날아온 어제 냥이 포획 요청 유예
const DAY_GRACE_MS = 5 * 60_000;

const DAY_MS = 86_400_000;

// geohash base32 문자셋(a/i/l/o 제외 32자) — cell 문자열 검증용.
const GEOHASH32 = /^[0-9bcdefghjkmnpqrstuvwxyz]+$/;

// 희귀도 출현 가중치 — 구 스폰과 동일 (합계 100)
const RARITY_WEIGHTS: Array<{ key: GradeKey; weight: number }> = [
  { key: "common", weight: 62 },
  { key: "uncommon", weight: 25 },
  { key: "rare", weight: 11 },
  { key: "legendary", weight: 2 },
];

// 활동 시간대 — 밤에만 나오는 냥이가 있어 시간대별로 지도가 달라진다.
// 날씨 연동과 달리 시간은 클라·서버가 항상 같은 값을 계산할 수 있어 결정성이 유지된다.
export type RoamActivity = "all" | "day" | "night";
const DAY_START_H = 7, DAY_END_H = 19;       // KST 기준 낮 07~19시
const ACTIVITY_GRACE_MS = 5 * 60_000;        // 경계에서 미니게임 중이던 포획 유예
// 종 고정 활동대 — 컨셉이 뚜렷한 종은 시드와 무관하게 고정
const SPECIES_ACTIVITY: Record<string, RoamActivity> = {
  nightlord: "night",   // 밤하늘냥 — 별빛 방랑자는 밤에만
  goldenking: "day",    // 황금냥 — 햇빛의 제왕은 낮에만
  // 대확장 100종(2026-07-24) 중 컨셉 고정 종
  wisp: "night",        // 도깨비불냥 — 깊은 밤 골목의 푸른 불꽃
  moonhalo: "night",    // 달무리냥 — 달 밝은 밤에만
  galaxy: "night",      // 은하냥 — 은하수는 밤하늘에
  morning: "day",       // 아침냥 — 아침형 냥이
  daybreak: "day",      // 여명냥 — 해와 함께 다닌다
};

/** 경로 계산(waypoints/roamPosAt)에 필요한 최소 필드 — 야생 RoamCat과 "내 냥이" 트랙이 공유. */
export interface RoamTrack {
  id: string;
  day: number;           // UTC 일 인덱스
  homeLat: number;
  homeLng: number;
  speedMps: number;
  legSeconds?: number;   // 웨이포인트 간격. 생략 시 LEG_SECONDS(야생 기본) — 내 냥이 로밍만 짧게 쓴다
  radiusM?: number;      // 방랑 반경. 생략 시 ROAM_RADIUS_M(야생 10km) — 내 냥이는 동네 어슬렁(600m)
}

export interface RoamCat extends RoamTrack {
  // id: "roam:{cell}:{day}:{index}" — 이 문자열만으로 서버 재검증 가능
  cell: string;
  speciesKey: string;
  species: SpawnSpecies;
  activity: RoamActivity;
  expiresAt: number;     // 그날 자정(UTC, epoch ms)
}

// ── 시드 PRNG (xmur3 + mulberry32) — legacy/spawn.ts와 동일 구현 ──────────
function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rollRarity(rng: () => number): GradeKey {
  let roll = rng() * 100;
  for (const { key, weight } of RARITY_WEIGHTS) {
    roll -= weight;
    if (roll < 0) return key;
  }
  return "common";
}

export function currentDay(now: number = Date.now()): number {
  return Math.floor(now / DAY_MS);
}

/** 한 셀 × 하루의 로밍 냥이 목록을 결정적으로 생성. 잘못된 셀이면 빈 배열. */
export function catsForCell(cell: string, day: number): RoamCat[] {
  const bounds = geohashBounds(cell);
  if (!bounds) return [];
  const rng = mulberry32(xmur3(`nyangroam:${cell}:${day}`)());
  const count = CATS_PER_CELL_MIN + Math.floor(rng() * (CATS_PER_CELL_MAX - CATS_PER_CELL_MIN + 1));

  const cats: RoamCat[] = [];
  for (let i = 0; i < count; i++) {
    // 집 위치 → 희귀도 → 종 → 속도 → 활동대 순서 — 순서를 바꾸면 전 지역 배치가 달라지므로 유지할 것.
    const homeLat = bounds.latMin + rng() * (bounds.latMax - bounds.latMin);
    const homeLng = bounds.lngMin + rng() * (bounds.lngMax - bounds.lngMin);
    const rarity = rollRarity(rng);
    const pool = SPECIES_BY_RARITY[rarity];
    const species = pool[Math.floor(rng() * pool.length)];
    const speedMps = SPEED_MIN_MPS + rng() * (SPEED_MAX_MPS - SPEED_MIN_MPS);
    // 활동대: 상시 55% / 낮 25% / 밤 20% (종 고정 오버라이드 우선)
    const roll = rng();
    const activity: RoamActivity =
      SPECIES_ACTIVITY[species.key] ?? (roll < 0.55 ? "all" : roll < 0.8 ? "day" : "night");
    cats.push({
      id: `roam:${cell}:${day}:${i}`,
      cell, day,
      speciesKey: species.key,
      species,
      homeLat, homeLng,
      speedMps,
      activity,
      expiresAt: (day + 1) * DAY_MS,
    });
  }
  return cats;
}

// ── 🎉 주말 페스타 — 토·일(KST) 한정 이벤트 냥이 ───────────────────────────
// "지금 접속해야 하는 이유": 주말에만 셀당 2마리가 추가로 돌아다닌다.
// 레어 70% / 레전드 30% 보장 + 포획 보너스(EXP·샤이니 확률, capture 라우트에서 처리).
// 로밍과 같은 결정적 생성이라 서버가 id만으로 재계산·검증한다.
export const EVENT_CATS_PER_CELL = 2;
export const EVENT_BONUS_EXP = 30;
export const EVENT_SHINY_RATE = 0.03;

/** 지금이 주말 페스타 시간대(KST 토·일)인지 — 클라·서버 공용 순수 계산 */
export function isEventTimeKST(now: number = Date.now(), graceMs = 0): boolean {
  const check = (t: number) => {
    const dow = new Date(t + 9 * 3600_000).getUTCDay();
    return dow === 6 || dow === 0;
  };
  return check(now) || (graceMs > 0 && check(now - graceMs));
}

/** 한 셀 × 하루의 이벤트 냥이 — 주말 여부와 무관하게 후보를 결정적으로 생성.
 *  노출 여부는 호출자(roamCatsNear)와 검증자(resolveRoamById)가 isEventTimeKST로 거른다. */
export function eventCatsForCell(cell: string, day: number): RoamCat[] {
  const bounds = geohashBounds(cell);
  if (!bounds) return [];
  const rng = mulberry32(xmur3(`nyangevent:${cell}:${day}`)());
  const cats: RoamCat[] = [];
  for (let i = 0; i < EVENT_CATS_PER_CELL; i++) {
    const homeLat = bounds.latMin + rng() * (bounds.latMax - bounds.latMin);
    const homeLng = bounds.lngMin + rng() * (bounds.lngMax - bounds.lngMin);
    const rarity: GradeKey = rng() < 0.3 ? "legendary" : "rare";
    const pool = SPECIES_BY_RARITY[rarity];
    const species = pool[Math.floor(rng() * pool.length)];
    cats.push({
      id: `event:${cell}:${day}:${i}`,
      cell, day,
      speciesKey: species.key, species,
      homeLat, homeLng,
      speedMps: SPEED_MIN_MPS + rng() * (SPEED_MAX_MPS - SPEED_MIN_MPS),
      activity: "all", // 이벤트 냥이는 주말 내내 — 시간대 제한 없음
      expiresAt: (day + 1) * DAY_MS,
    });
  }
  return cats;
}

// ── 🌙 수요일 골목의 밤 — 평일 훅 (2026-07-13, 주말 페스타 패턴 확장) ──────
// KST 수요일 18~24시 한정, 셀당 2마리 추가(희귀 60%/레어 40% 보장, 밤 무드).
// 서버 검증도 주말과 동일: id만으로 재계산 + 시간대 재검증(자정 5분 유예).
export const WED_CATS_PER_CELL = 2;
export const WED_BONUS_EXP = 15;
const WED_START_H = 18, WED_END_H = 24;

/** 지금이 수요일 골목의 밤(KST 수 18~24시)인지 — 클라·서버 공용 순수 계산 */
export function isWedNightKST(now: number = Date.now(), graceMs = 0): boolean {
  const check = (t: number) => {
    const kst = new Date(t + 9 * 3600_000);
    return kst.getUTCDay() === 3 && kst.getUTCHours() >= WED_START_H && kst.getUTCHours() < WED_END_H;
  };
  return check(now) || (graceMs > 0 && check(now - graceMs));
}

/** 한 셀 × 하루의 수요일 밤 냥이 — 활성 여부는 호출자/검증자가 isWedNightKST로 거른다. */
export function wedCatsForCell(cell: string, day: number): RoamCat[] {
  const bounds = geohashBounds(cell);
  if (!bounds) return [];
  const rng = mulberry32(xmur3(`nyangwed:${cell}:${day}`)());
  const cats: RoamCat[] = [];
  for (let i = 0; i < WED_CATS_PER_CELL; i++) {
    const homeLat = bounds.latMin + rng() * (bounds.latMax - bounds.latMin);
    const homeLng = bounds.lngMin + rng() * (bounds.lngMax - bounds.lngMin);
    const rarity: GradeKey = rng() < 0.4 ? "rare" : "uncommon";
    const pool = SPECIES_BY_RARITY[rarity];
    const species = pool[Math.floor(rng() * pool.length)];
    cats.push({
      id: `wed:${cell}:${day}:${i}`,
      cell, day,
      speciesKey: species.key, species,
      homeLat, homeLng,
      speedMps: SPEED_MIN_MPS + rng() * (SPEED_MAX_MPS - SPEED_MIN_MPS),
      activity: "all", // 시간 게이트는 isWedNightKST가 담당
      expiresAt: (day + 1) * DAY_MS,
    });
  }
  return cats;
}

/** 게스트 웰컴 카드 종 — 가입 즉시 지급되는 일반 등급 1장 (uid 결정적).
 *  지도의 튜토리얼 냥이와 종이 겹치지 않게 피해서 뽑는다. */
export function starterSpeciesFor(uid: string): SpawnSpecies {
  const pool = SPECIES_BY_RARITY.common;
  const tutKey = tutorialCatFor(uid, 0, 0).speciesKey;
  const rng = mulberry32(xmur3(`nyangstarter:${uid}`)());
  const others = pool.filter(s => s.key !== tutKey);
  return others[Math.floor(rng() * others.length)] ?? pool[0];
}

/**
 * 튜토리얼 냥이 — 로밍 카드가 한 장도 없는 신규 유저의 첫 GPS 위치 바로 옆(18~30m)에
 * 항상 한 마리를 보장한다. "주변에 냥이가 없어서 첫 행동을 못 하는" 신규 이탈 방지.
 * 종·성별 rng 순서가 lat/lng보다 앞이라 서버는 tutorialCatFor(uid, 0, 0)만으로
 * 같은 종을 재계산할 수 있다(위치는 클라이언트 사정 — 서버는 검증하지 않는 1회 무료 개체).
 * speedMps 0 → waypoint가 전부 (0,0)이라 제자리에 머문다.
 */
export function tutorialCatFor(uid: string, lat: number, lng: number): RoamCat {
  const rng = mulberry32(xmur3(`nyangtut:${uid}`)());
  const pool = SPECIES_BY_RARITY.common;
  const species = pool[Math.floor(rng() * pool.length)];
  const angle = rng() * Math.PI * 2;
  const dist = 18 + rng() * 12;
  return {
    id: `tut:${uid}`,
    cell: "", day: currentDay(),
    speciesKey: species.key, species,
    homeLat: lat + (Math.sin(angle) * dist) / 111320,
    homeLng: lng + (Math.cos(angle) * dist) / (111320 * Math.cos((lat * Math.PI) / 180)),
    speedMps: 0,
    activity: "all",
    expiresAt: Number.MAX_SAFE_INTEGER,
  };
}

/** KST(UTC+9) 기준 시각으로 활동 중인지 — 클라·서버가 같은 값을 계산한다(결정적). */
export function isRoamActiveAt(cat: RoamCat, now: number = Date.now(), graceMs = 0): boolean {
  if (cat.activity === "all") return true;
  const check = (t: number) => {
    const kstH = new Date(t + 9 * 3600_000).getUTCHours();
    const isDay = kstH >= DAY_START_H && kstH < DAY_END_H;
    return cat.activity === "day" ? isDay : !isDay;
  };
  // 유예: 경계 직후라면 grace 전 시각 기준으로도 인정 (미니게임 도중 시간대가 바뀐 경우)
  return check(now) || (graceMs > 0 && check(now - graceMs));
}

// ── 경로: 10분 간격 웨이포인트 랜덤워크 ────────────────────────────────────
// 집 기준 미터 오프셋 (x=동쪽, y=북쪽). 방향은 관성을 갖고 천천히 꺾이고,
// 10km 경계에 닿으면 집 쪽으로 방향을 튼다 → 넓게 어슬렁거리는 자연스러운 궤적.
// k번째 웨이포인트는 0..k를 순차 계산해야 하지만 하루 최대 144스텝이라 충분히 싸고,
// 셀 단위 캐시로 틱(1초)마다의 재계산은 보간만 남긴다.
interface Waypoint { x: number; y: number }

const wpCache = new Map<string, { upto: number; points: Waypoint[]; angles: number[] }>();

function waypoints(cat: RoamTrack, upto: number): Waypoint[] {
  let c = wpCache.get(cat.id);
  if (!c) {
    c = { upto: 0, points: [{ x: 0, y: 0 }], angles: [] };
    // 시작 방향
    const rng0 = mulberry32(xmur3(`roamdir:${cat.id}`)());
    c.angles.push(rng0() * Math.PI * 2);
    wpCache.set(cat.id, c);
    if (wpCache.size > 4000) wpCache.clear(); // 자정 넘김/장기 세션 메모리 방어
  }
  const leg = cat.speedMps * (cat.legSeconds ?? LEG_SECONDS);
  while (c.upto < upto) {
    const k = c.upto;
    const rng = mulberry32(xmur3(`roamstep:${cat.id}:${k}`)());
    const prev = c.points[k];
    let angle = c.angles[k];
    const distFromHome = Math.hypot(prev.x, prev.y);
    if (distFromHome + leg > (cat.radiusM ?? ROAM_RADIUS_M)) {
      // 경계 근처 — 집 방향으로 선회 (±0.6rad 흔들림)
      angle = Math.atan2(-prev.y, -prev.x) + (rng() - 0.5) * 1.2;
    } else {
      // 관성 있는 방향 전환 (±0.7rad)
      angle = angle + (rng() - 0.5) * 1.4;
    }
    c.points.push({ x: prev.x + Math.cos(angle) * leg, y: prev.y + Math.sin(angle) * leg });
    c.angles.push(angle);
    c.upto = k + 1;
  }
  return c.points;
}

/** 시각 now의 로밍 냥이 실제 위치 — 클라(마커)와 서버(거리 검증)가 공유하는 순수 계산. */
export function roamPosAt(cat: RoamTrack, now: number = Date.now()): { lat: number; lng: number } {
  const legS = cat.legSeconds ?? LEG_SECONDS;
  const sinceDayS = Math.max(0, (now - cat.day * DAY_MS) / 1000);
  const k = Math.floor(sinceDayS / legS);
  const f = (sinceDayS % legS) / legS;
  const pts = waypoints(cat, k + 1);
  const a = pts[k], b = pts[k + 1];
  const x = a.x + (b.x - a.x) * f;
  const y = a.y + (b.y - a.y) * f;
  const lat = cat.homeLat + y / 111320;
  const lng = cat.homeLng + x / (111320 * Math.cos((cat.homeLat * Math.PI) / 180));
  return { lat, lng };
}

/** 중심 셀 + 주변 (2n+1)² 셀 — 로밍 반경이 넓어 3×3보다 넓게 본다. */
function neighborCells(cell: string, n: number): string[] {
  const b = geohashBounds(cell);
  if (!b) return [cell];
  const latStep = b.latMax - b.latMin;
  const lngStep = b.lngMax - b.lngMin;
  const centerLat = (b.latMin + b.latMax) / 2;
  const centerLng = (b.lngMin + b.lngMax) / 2;
  const cells = new Set<string>();
  for (let dy = -n; dy <= n; dy++) {
    for (let dx = -n; dx <= n; dx++) {
      const lat = Math.max(-90, Math.min(90, centerLat + dy * latStep));
      const lng = centerLng + dx * lngStep;
      cells.add(encodeGeohash(lat, ((lng + 540) % 360) - 180, cell.length));
    }
  }
  return [...cells];
}

/** 사용자 주변 5×5 셀(≈±12km)의 "지금 활동 중인" 로밍 냥이. 위치는 호출자가 roamPosAt으로 틱마다 계산.
 *  주말(KST)에는 셀당 이벤트 냥이가 추가로 섞인다. */
export function roamCatsNear(lat: number, lng: number, now: number = Date.now()): RoamCat[] {
  const cell = encodeGeohash(lat, lng, ROAM_CELL_PRECISION);
  const day = currentDay(now);
  const cells = neighborCells(cell, 2);
  const cats = cells.flatMap(c => catsForCell(c, day));
  if (isEventTimeKST(now)) cats.push(...cells.flatMap(c => eventCatsForCell(c, day)));
  if (isWedNightKST(now)) cats.push(...cells.flatMap(c => wedCatsForCell(c, day)));
  return cats.filter(c => isRoamActiveAt(c, now));
}

/**
 * 냥이 id로 재계산해 찾는다 — 서버 포획 검증용.
 * 오늘 냥이가 아니면(자정 직후 유예 제외) null.
 */
export function resolveRoamById(roamId: string, now: number = Date.now()): RoamCat | null {
  const parts = roamId.split(":");
  if (parts.length !== 4 || (parts[0] !== "roam" && parts[0] !== "event" && parts[0] !== "wed")) return null;
  const [kind, cell, dayStr, indexStr] = parts;
  // [C4 보안패치 2026-07-31] cell 정밀도·문자셋 검증. 이게 없으면 공격자가 자기 실제
  // gh7을 cell로 넣어 catsForCell이 유저 실위치 박스 안에 냥이를 생성 → 근접검증을
  // 통과시켜 index 열거로 레전드 선별 포획이 가능했다(순간이동 감지도 미발동).
  if (cell.length !== ROAM_CELL_PRECISION || !GEOHASH32.test(cell)) return null;
  const day = Number(dayStr);
  const index = Number(indexStr);
  if (!Number.isInteger(day) || !Number.isInteger(index) || index < 0) return null;

  const today = currentDay(now);
  const isToday = day === today;
  const isGrace = day === today - 1 && now - today * DAY_MS <= DAY_GRACE_MS;
  if (!isToday && !isGrace) return null;

  // 이벤트 냥이는 주말(KST)에만 실존 — 자정 경계 5분 유예
  if (kind === "event" && !isEventTimeKST(now, ACTIVITY_GRACE_MS)) return null;
  // 수요일 밤 냥이는 KST 수 18~24시에만 실존 — 동일 유예
  if (kind === "wed" && !isWedNightKST(now, ACTIVITY_GRACE_MS)) return null;

  const cat = (kind === "event" ? eventCatsForCell(cell, day) : kind === "wed" ? wedCatsForCell(cell, day) : catsForCell(cell, day))[index];
  if (!cat || !SPECIES_BY_KEY[cat.speciesKey]) return null;
  // 활동 시간대 밖이면 실존하지 않는 냥이 — 경계는 5분 유예(미니게임 도중 시간대 전환)
  if (!isRoamActiveAt(cat, now, ACTIVITY_GRACE_MS)) return null;
  return cat;
}

/**
 * [프라이버시 우선 서버 검증] 유저의 geohash7 셀만 받아, 최근 90초 내 냥이의 위치가
 * 그 셀의 3×3 이웃 안에 들어온 적이 있는지 확인한다. 원시 GPS 좌표는 서버로 오지 않으므로
 * (위치정보 마스킹 전송) 정밀 거리 검증 대신 ≈150~450m 셀 근접성으로 판정 —
 * 정밀 100m 게이트는 클라이언트(하버사인)가 담당한다.
 */
export function roamCatNearCell(cat: RoamCat, userGh7: string, now: number = Date.now()): boolean {
  const allowed = new Set(geohashNeighbors3x3(userGh7));
  for (let t = now; t >= now - CAPTURE_WINDOW_S * 1000; t -= CAPTURE_SAMPLE_S * 1000) {
    const pos = roamPosAt(cat, t);
    if (allowed.has(encodeGeohash(pos.lat, pos.lng, 7))) return true;
  }
  return false;
}

// ── 내 냥이 로밍 (실사 카드) — 소유자 지도 전용 눈요기 ────────────────────
// 내가 촬영한 카드가 지도 위를 야생 로밍보다 빠르고 불규칙하게 돌아다닌다.
// 정적 "만난 자리" 마커는 스크린샷 한 장으로 실제 길고양이 서식지가 특정될 수 있어
// (학대 위험) 이동 마커로 대체 — 위치 보안이 이 기능의 절반이다:
//   - 홈 앵커 = 촬영 셀 중심이 아니라 "카드×날짜" 시드의 1~3km 오프셋 지점.
//     매일 오프셋이 바뀌므로 궤적을 아무리 오래 관찰해도 촬영 위치가 역산되지 않는다.
//   - 서버·DB 무관 순수 클라 계산: 새 위치 데이터를 만들지 않는다(프라이버시 아키텍처 유지).
const MY_SPEED_MIN_MPS = 4.8;      // 야생(2.8~4.2)보다 확실히 빠르게
const MY_SPEED_MAX_MPS = 7.0;
// 사용자 확정(2026-07-13 2차): 이동범위 = **등록(포획) 지점 기준 반경 3km**.
// 위치 보안 오프셋(매일 바뀌는 홈 앵커)과 합산해도 3km를 넘지 않도록
// radiusM = 3km - 오프셋 거리로 잡는다 (오프셋 0.5~1.5km → 실이동 반경 1.5~2.5km).
// 방향 전환은 1~2.5분 유지 — 넓어진 범위 안을 오락가락 왔다갔다.
const MY_TOTAL_RANGE_M = 3_000;
const MY_LEG_MIN_S = 60;
const MY_LEG_MAX_S = 150;
const MY_HOME_OFFSET_MIN_M = 500;
const MY_HOME_OFFSET_MAX_M = 1_500;

/** 실사 카드 1장의 오늘 로밍 트랙. 위치는 roamPosAt(track)으로 틱마다 계산. gh7이 없거나 깨졌으면 null. */
export function myCatRoamFor(cardId: string, gh7: string, day: number = currentDay()): RoamTrack | null {
  // geohashBounds("")는 null이 아니라 전 세계 범위를 반환한다 — 빈 값이면 (0,0) 근처에
  // 유령 마커가 생기므로 여기서 걸러낸다
  if (!gh7) return null;
  const b = geohashBounds(gh7);
  if (!b) return null;
  const rng = mulberry32(xmur3(`nyangmine:${cardId}:${day}`)());
  const centerLat = (b.latMin + b.latMax) / 2;
  const centerLng = (b.lngMin + b.lngMax) / 2;
  const angle = rng() * Math.PI * 2;
  const dist = MY_HOME_OFFSET_MIN_M + rng() * (MY_HOME_OFFSET_MAX_M - MY_HOME_OFFSET_MIN_M);
  return {
    id: `mine:${cardId}:${day}`,
    day,
    homeLat: centerLat + (Math.sin(angle) * dist) / 111320,
    homeLng: centerLng + (Math.cos(angle) * dist) / (111320 * Math.cos((centerLat * Math.PI) / 180)),
    speedMps: MY_SPEED_MIN_MPS + rng() * (MY_SPEED_MAX_MPS - MY_SPEED_MIN_MPS),
    legSeconds: MY_LEG_MIN_S + rng() * (MY_LEG_MAX_S - MY_LEG_MIN_S),
    radiusM: MY_TOTAL_RANGE_M - dist, // 오프셋+반경 = 등록 지점에서 정확히 3km 상한
  };
}

/**
 * 포획 거리 판정. 클라는 현재 위치 기준(slack=1),
 * 서버는 미니게임 소요시간을 감안해 최근 90초 구간의 최소 거리 + 1.5배 slack.
 */
export function withinRoamCaptureRange(
  userLat: number, userLng: number, cat: RoamCat, slack = 1, now: number = Date.now(),
): boolean {
  const limit = ROAM_CAPTURE_RADIUS_M * slack;
  const windowMs = slack > 1 ? CAPTURE_WINDOW_S * 1000 : 0;
  for (let t = now; t >= now - windowMs; t -= CAPTURE_SAMPLE_S * 1000) {
    const pos = roamPosAt(cat, t);
    if (haversineMeters(userLat, userLng, pos.lat, pos.lng) <= limit) return true;
  }
  return false;
}
