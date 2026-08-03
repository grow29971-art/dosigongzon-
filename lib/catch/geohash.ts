// geohash 인코딩/디코딩 + 이웃 셀 계산 — 위치 기반 스폰의 좌표계.
//
// 스폰은 "geohash 셀 + 시간 버킷"을 시드로 결정적으로 생성되기 때문에(lib/spawn.ts),
// 클라이언트와 서버가 같은 셀 문자열을 얻는 것이 정합성의 전부다.
// 외부 라이브러리 대신 표준 base32 geohash를 직접 구현 — 의존성 없이 서버/클라 공용.

const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";

/** 위경도를 geohash 문자열로 인코딩. precision 6 ≈ 1.2km×0.6km 셀. */
export function encodeGeohash(lat: number, lng: number, precision: number): string {
  let idx = 0;
  let bit = 0;
  let evenBit = true;
  let hash = "";
  let latMin = -90, latMax = 90;
  let lngMin = -180, lngMax = 180;

  while (hash.length < precision) {
    if (evenBit) {
      const mid = (lngMin + lngMax) / 2;
      if (lng >= mid) { idx = idx * 2 + 1; lngMin = mid; }
      else { idx = idx * 2; lngMax = mid; }
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat >= mid) { idx = idx * 2 + 1; latMin = mid; }
      else { idx = idx * 2; latMax = mid; }
    }
    evenBit = !evenBit;
    if (++bit === 5) {
      hash += BASE32.charAt(idx);
      bit = 0;
      idx = 0;
    }
  }
  return hash;
}

export interface GeohashBounds {
  latMin: number; latMax: number;
  lngMin: number; lngMax: number;
}

/** geohash 셀의 경계 사각형. 잘못된 문자가 섞이면 null. */
export function geohashBounds(hash: string): GeohashBounds | null {
  let evenBit = true;
  let latMin = -90, latMax = 90;
  let lngMin = -180, lngMax = 180;

  for (const c of hash.toLowerCase()) {
    const idx = BASE32.indexOf(c);
    if (idx === -1) return null;
    for (let n = 4; n >= 0; n--) {
      const bitN = (idx >> n) & 1;
      if (evenBit) {
        const mid = (lngMin + lngMax) / 2;
        if (bitN === 1) lngMin = mid; else lngMax = mid;
      } else {
        const mid = (latMin + latMax) / 2;
        if (bitN === 1) latMin = mid; else latMax = mid;
      }
      evenBit = !evenBit;
    }
  }
  return { latMin, latMax, lngMin, lngMax };
}

/** 셀 중심 좌표. */
export function geohashCenter(hash: string): { lat: number; lng: number } | null {
  const b = geohashBounds(hash);
  if (!b) return null;
  return { lat: (b.latMin + b.latMax) / 2, lng: (b.lngMin + b.lngMax) / 2 };
}

/**
 * 자기 자신 + 8방향 이웃 셀 (3×3).
 * 경계 재인코딩 방식 — 셀 크기만큼 위경도를 이동시켜 다시 인코딩하면
 * 극지방·날짜변경선 특수 케이스를 따로 다루지 않아도 된다(서비스 지역상 무관).
 */
export function geohashNeighbors3x3(hash: string): string[] {
  const b = geohashBounds(hash);
  if (!b) return [hash];
  const latStep = b.latMax - b.latMin;
  const lngStep = b.lngMax - b.lngMin;
  const centerLat = (b.latMin + b.latMax) / 2;
  const centerLng = (b.lngMin + b.lngMax) / 2;
  const cells = new Set<string>();
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const lat = Math.max(-90, Math.min(90, centerLat + dy * latStep));
      const lng = centerLng + dx * lngStep;
      cells.add(encodeGeohash(lat, ((lng + 540) % 360) - 180, hash.length));
    }
  }
  return [...cells];
}

/** 두 좌표 사이 거리(m) — 하버사인. 포획 반경 판정에 사용. */
export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// ── gh7 파라미터 공용 검증 (2026-07-15 감사: 라우트 3곳 복붙 → 통합) ──
// 검증 로직이 라우트마다 미묘하게 갈라지며 생기는 우회 구멍(reunion null-gh 사례) 방지.
export const GEOHASH_PRECISION = 7;

/** API body의 gh7 입력을 검증 — 유효하면 그대로, 아니면 null */
export function parseGh7(input: unknown): string | null {
  return typeof input === "string" && input.length === GEOHASH_PRECISION && geohashBounds(input)
    ? input
    : null;
}
