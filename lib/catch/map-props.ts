// 골목 데코 오브젝트 — 지도를 "살아있는 동네"로 채우는 정적 프롭 (2026-07-16, GO식 밀도 방향).
//
// 냥이(lib/roam.ts)와 같은 결정적 생성이되 3가지가 다르다:
//   1) 정적 — 날짜가 아니라 "셀"만 시드라 매일 같은 자리에 고정(동네 붙박이 소품 느낌).
//   2) 비상호작용·비경제 — 탭 이벤트/서버/보상 없음. 순수 분위기라 어뷰징 표면이 0.
//   3) 위치 저장 안 함 — 로밍과 동일하게 순수 클라 계산, DB에 어떤 좌표도 남기지 않는다.
//
// 종류: 밥그릇 / 화분 / 스크래처 / 골목 표지판. 지도 카툰 팔레트(크림·초록)에 맞춘 납작 SVG.

import { encodeGeohash, geohashBounds, geohashNeighbors3x3 } from "@/lib/catch/geohash";

export type PropKind = "bowl" | "plant" | "scratcher" | "sign";

export interface MapProp {
  id: string;      // "prop:{cell}:{index}"
  kind: PropKind;
  lat: number;
  lng: number;
}

const PROP_CELL_PRECISION = 5;             // geohash5 ≈ 4.9km — 냥이 셀과 동일
const PROPS_PER_CELL_MIN = 58;
const PROPS_PER_CELL_MAX = 86;

// 출현 비중 — 밥그릇이 가장 흔하고 표지판이 드물게 (합계 100)
const KIND_WEIGHTS: Array<{ kind: PropKind; weight: number }> = [
  { kind: "bowl", weight: 38 },
  { kind: "plant", weight: 31 },
  { kind: "scratcher", weight: 21 },
  { kind: "sign", weight: 10 },
];

// ── 시드 PRNG (xmur3 + mulberry32) — lib/roam.ts와 동일 구현 ──
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

function rollKind(rng: () => number): PropKind {
  let roll = rng() * 100;
  for (const { kind, weight } of KIND_WEIGHTS) {
    roll -= weight;
    if (roll < 0) return kind;
  }
  return "bowl";
}

/** 한 셀의 정적 프롭 목록을 결정적으로 생성. 잘못된 셀이면 빈 배열. */
export function propsForCell(cell: string): MapProp[] {
  const bounds = geohashBounds(cell);
  if (!bounds) return [];
  const rng = mulberry32(xmur3(`nyangprop:${cell}`)());
  const count = PROPS_PER_CELL_MIN + Math.floor(rng() * (PROPS_PER_CELL_MAX - PROPS_PER_CELL_MIN + 1));
  const props: MapProp[] = [];
  for (let i = 0; i < count; i++) {
    // 위치 → 종류 순서 유지 (바꾸면 전 지역 배치가 달라짐)
    const lat = bounds.latMin + rng() * (bounds.latMax - bounds.latMin);
    const lng = bounds.lngMin + rng() * (bounds.lngMax - bounds.lngMin);
    props.push({ id: `prop:${cell}:${i}`, kind: rollKind(rng), lat, lng });
  }
  return props;
}

/** 사용자 주변 3×3 셀(≈±7km)의 정적 프롭 — 위치는 고정이라 렌더러가 거리로 컬링한다. */
export function propsNear(lat: number, lng: number): MapProp[] {
  const cell = encodeGeohash(lat, lng, PROP_CELL_PRECISION);
  return geohashNeighbors3x3(cell).flatMap(propsForCell);
}

/** 프롭 종류별 SVG 마크업 — 지도 카툰 팔레트. 그림자는 렌더러가 따로 얹는다. */
export function propSvg(kind: PropKind): string {
  switch (kind) {
    case "bowl":
      return `<svg width="26" height="26" viewBox="0 0 24 24" aria-hidden>
        <ellipse cx="12" cy="15" rx="8.5" ry="4.6" fill="#F3E6C4"/>
        <path d="M4 14.4c0 2.3 3.6 4.2 8 4.2s8-1.9 8-4.2" fill="none" stroke="#C9A96A" stroke-width="1.6"/>
        <ellipse cx="12" cy="13.2" rx="6.4" ry="3.1" fill="#E9915C"/>
        <circle cx="12" cy="12.9" r="1.5" fill="#C46B3C"/>
        <circle cx="9.4" cy="13.4" r="1" fill="#C46B3C"/><circle cx="14.6" cy="13.4" r="1" fill="#C46B3C"/>
      </svg>`;
    case "plant":
      return `<svg width="26" height="28" viewBox="0 0 24 26" aria-hidden>
        <path d="M12 15c-3-1-5-4-4.5-7.5C10 8.5 12 11 12 15z" fill="#6FBE52"/>
        <path d="M12 15c3-1 4.8-3.8 4.3-7.2C13.8 8.8 12 11.2 12 15z" fill="#83CE66"/>
        <path d="M12 16V9" stroke="#4E9C3C" stroke-width="1.4" stroke-linecap="round"/>
        <path d="M8 16h8l-1.2 6H9.2z" fill="#D98A4E"/><path d="M7.4 15h9.2v2H7.4z" fill="#E7A163"/>
      </svg>`;
    case "scratcher":
      return `<svg width="22" height="30" viewBox="0 0 20 28" aria-hidden>
        <rect x="8" y="6" width="4" height="18" rx="2" fill="#CBB086"/>
        <rect x="8" y="6" width="4" height="18" rx="2" fill="url(#sc)" opacity="0.25"/>
        <ellipse cx="10" cy="24.5" rx="7" ry="2.4" fill="#B9925E"/>
        <circle cx="10" cy="6" r="4.2" fill="#F2C14E"/><circle cx="10" cy="6" r="1.6" fill="#D89A2C"/>
        <defs><linearGradient id="sc" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#8A6E44"/></linearGradient></defs>
      </svg>`;
    case "sign":
      return `<svg width="22" height="30" viewBox="0 0 20 28" aria-hidden>
        <rect x="9" y="8" width="2.4" height="17" rx="1.2" fill="#8A7B5C"/>
        <rect x="2.5" y="4" width="15" height="8" rx="2.2" fill="#6EA8E0"/>
        <rect x="2.5" y="4" width="15" height="8" rx="2.2" fill="none" stroke="#3E6FA6" stroke-width="1.2"/>
        <circle cx="7" cy="8" r="1.5" fill="#FFF3D0"/>
        <path d="M10.5 6.6h5M10.5 8.4h4" stroke="#FFF3D0" stroke-width="1.1" stroke-linecap="round"/>
      </svg>`;
  }
}
