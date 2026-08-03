// 📦 골판지 상자 — 지도 곳곳에 놓인 보물상자 (2026-07-21, PGO "포켓스톱"의 냥줍 번역).
//
// 고양이가 사랑하는 골판지 상자가 매일 다른 자리에 나타난다. 100m 안에서 탭하면
// 열리고, 안에서 코인·깃털 장난감이 나오거나 — 꽝(20%)이면 아무것도 없다.
//
// 검증 원칙은 로밍 냥이(lib/roam.ts)와 동일 — 상자를 DB에 저장하지 않는다.
// "geohash6 셀 × 날짜" 시드 PRNG가 상자(개수·위치)를 결정하는 순수 함수라서
//   - 클라이언트는 즉시 그릴 수 있고(서버 왕복 없음, 모두에게 동일),
//   - 서버는 열기 요청 시 같은 계산으로 실존·위치를 재검증한다(위조 불가).
// 열기 기록만 profiles.daily_claims jsonb에 "chest:{id}"로 남긴다(마이그레이션 0,
// 날짜 리셋·중복 방지 공짜 — 2026-07-21 시스템 회의 Next.js 실측안 그대로).
//
// 보상은 서버 전용 시드(서비스 롤 키 salt + uid + chestId)로 결정적 롤 —
// 재시도에 멱등이면서, PRNG가 클라 번들에 있어도 salt를 몰라 미리 계산할 수 없다.

import { encodeGeohash, geohashBounds, geohashNeighbors3x3 } from "@/lib/catch/geohash";

// ── 튜닝 상수 ──────────────────────────────────────────────────────────────
export const CHEST_CELL_PRECISION = 6;   // geohash6 ≈ 1.2km × 0.6km — 산책 한 바퀴 단위
const CHESTS_PER_CELL_MIN = 2;
const CHESTS_PER_CELL_MAX = 4;
export const CHEST_OPEN_RADIUS_M = 100;  // 로밍 포획과 동일 반경 — UX 문법 통일
export const CHEST_DAILY_CAP = 5;        // 하루 열기 상한 — EV ≈ 67냥/일(데일리 3종 70냥과 등가)
const DAY_GRACE_MS = 5 * 60_000;         // 자정 직후 어제 상자 열기 유예 (roam과 동일)
const DAY_MS = 86_400_000;

// geohash base32 문자셋(a/i/l/o 제외 32자) — cell 문자열 검증용.
const GEOHASH32 = /^[0-9bcdefghjkmnpqrstuvwxyz]+$/;

export interface Chest {
  // id: "chest:{cell}:{day}:{index}" — 이 문자열만으로 서버 재검증 가능
  id: string;
  cell: string;
  day: number;       // UTC 일 인덱스 (lib/roam currentDay와 동일 축)
  lat: number;
  lng: number;
}

// ── 시드 PRNG (xmur3 + mulberry32) — lib/roam.ts와 동일 구현 ───────────────
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

/** 한 셀 × 하루의 상자 목록을 결정적으로 생성. 잘못된 셀이면 빈 배열. */
export function chestsForCell(cell: string, day: number): Chest[] {
  const bounds = geohashBounds(cell);
  if (!bounds) return [];
  const rng = mulberry32(xmur3(`nyangchest:${cell}:${day}`)());
  const count = CHESTS_PER_CELL_MIN + Math.floor(rng() * (CHESTS_PER_CELL_MAX - CHESTS_PER_CELL_MIN + 1));
  const chests: Chest[] = [];
  for (let i = 0; i < count; i++) {
    const lat = bounds.latMin + rng() * (bounds.latMax - bounds.latMin);
    const lng = bounds.lngMin + rng() * (bounds.lngMax - bounds.lngMin);
    chests.push({ id: `chest:${cell}:${day}:${i}`, cell, day, lat, lng });
  }
  return chests;
}

/** 사용자 주변 3×3 gh6 셀(≈±1.2km)의 오늘 상자 — 정적이라 틱마다 위치 재계산이 없다. */
export function chestsNear(lat: number, lng: number, day: number): Chest[] {
  const cell = encodeGeohash(lat, lng, CHEST_CELL_PRECISION);
  return geohashNeighbors3x3(cell).flatMap(c => chestsForCell(c, day));
}

/** 상자 id로 재계산 — 서버 열기 검증용. 오늘 상자가 아니면(자정 유예 제외) null. */
export function resolveChestById(chestId: string, now: number = Date.now()): Chest | null {
  const parts = chestId.split(":");
  if (parts.length !== 4 || parts[0] !== "chest") return null;
  const [, cell, dayStr, indexStr] = parts;
  // [C4 보안패치 2026-07-31] cell 정밀도·문자셋 검증(roam과 동일 계열 결함).
  // 미검증 시 임의 길이 cell로 위치 요건을 우회 + chestId 네임스페이스가 무한해진다.
  if (cell.length !== CHEST_CELL_PRECISION || !GEOHASH32.test(cell)) return null;
  const day = Number(dayStr);
  const index = Number(indexStr);
  if (!Number.isInteger(day) || !Number.isInteger(index) || index < 0) return null;
  const today = Math.floor(now / DAY_MS);
  const isGrace = day === today - 1 && now - today * DAY_MS <= DAY_GRACE_MS;
  if (day !== today && !isGrace) return null;
  return chestsForCell(cell, day)[index] ?? null;
}

/** [프라이버시 우선 서버 검증] 상자는 정적이므로 상자 셀이 유저 gh7의 3×3 이웃 안인지만 본다.
 *  (≈150~450m 근사 — 정밀 100m 게이트는 클라이언트 하버사인 담당, roam과 동일 분담) */
export function chestNearCell(chest: Chest, userGh7: string): boolean {
  return new Set(geohashNeighbors3x3(userGh7)).has(encodeGeohash(chest.lat, chest.lng, 7));
}

// ── 보상 테이블 — 진짜 꽝 20% (2026-07-21 사용자 확정) ─────────────────────
// 가변 보상이되 돈과 절대 연결하지 않는다(건강한 중독 7원칙). 코인 기대값 ≈ 13.4냥/상자.
export type ChestReward =
  | { kind: "miss" }
  | { kind: "coins"; coins: number }
  | { kind: "feather"; exp: number }    // 깃털 장난감 — 파트너 냥이 EXP
  | { kind: "jackpot"; coins: number }; // 금빛 츄르 상자

/** 시드 문자열로 보상을 결정적으로 롤. 서버는 seed에 서비스 롤 키를 salt로 섞어 호출한다. */
export function rollChestReward(seed: string): ChestReward {
  const r = mulberry32(xmur3(seed)())();
  if (r < 0.20) return { kind: "miss" };
  if (r < 0.65) return { kind: "coins", coins: 10 };
  if (r < 0.85) return { kind: "coins", coins: 25 };
  if (r < 0.95) return { kind: "feather", exp: 15 };
  return { kind: "jackpot", coins: 77 };
}

/** 지도 마커용 중세 보물상자 SVG — 모노 팔레트, 범위 안일 때만 블루 포인트(조작 가능 신호). */
export function chestSvg(inRange: boolean): string {
  const line = inRange ? "#3182F6" : "#4E5968";
  const band = inRange ? "#3182F6" : "#8B95A1";
  return `
    <svg width="34" height="30" viewBox="0 0 34 30" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 13 L4 10 Q4 3 17 3 Q30 3 30 10 L30 13 Z" fill="#E5E8EB" stroke="${line}" stroke-width="2" stroke-linejoin="round"/>
      <rect x="4" y="13" width="26" height="13" rx="1.5" fill="#F2F4F6" stroke="${line}" stroke-width="2"/>
      <path d="M9.5 4.6 L9.5 25 M24.5 4.6 L24.5 25" stroke="${band}" stroke-width="3" opacity="0.85"/>
      <rect x="13.5" y="10" width="7" height="7.5" rx="1.4" fill="#F2F4F6" stroke="${line}" stroke-width="1.6"/>
      <circle cx="17" cy="12.8" r="1.1" fill="${line}"/>
      <path d="M17 13.6 L17 15.4" stroke="${line}" stroke-width="1.4" stroke-linecap="round"/>
    </svg>`;
}
