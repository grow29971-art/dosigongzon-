"use client";

// 지도 데코 — 시간대 팔레트 + 공원 발바닥 패턴 + 유저 발자국 트레일 (2026-07-16).
// public/catch/map-style.json(OMT 스키마, 커스텀 카툰 그린)의 레이어 id를 직접 알고 있는
// 전제의 런타임 리컬러 — 스타일 파일을 갈아끼우지 않고 setPaintProperty로 칠만 바꾼다
// (MapLibre가 페인트 변경을 300ms 트랜지션해줘서 시간대 전환이 은은하게 넘어감).
// ⚠️ map-style.json 레이어 id를 바꾸면 이 파일의 팔레트 키도 같이 바꿀 것.

import type maplibregl from "maplibre-gl";

export type DayPeriod = "morning" | "day" | "sunset" | "night";

/** 시간대 판정 — 아침 5~10 / 낮 10~17 / 노을 17~20 / 밤 20~5 (기기 로컬 시간) */
export function periodFor(hour: number): DayPeriod {
  if (hour >= 5 && hour < 10) return "morning";
  if (hour >= 10 && hour < 17) return "day";
  if (hour >= 17 && hour < 20) return "sunset";
  return "night";
}

// 레이어별 페인트 속성 — id → 어떤 속성을 칠하는 레이어인지
const PAINT_PROP: Record<string, string> = {
  background: "background-color",
  "landuse-residential": "fill-color", "landcover-wood": "fill-color", "landcover-grass": "fill-color",
  "landcover-sand": "fill-color", park: "fill-color", "landuse-school-hospital": "fill-color", water: "fill-color",
  waterway: "line-color", aeroway: "line-color", tunnel: "line-color", path: "line-color",
  "road-minor-casing": "line-color", "road-minor": "line-color", "road-mid-casing": "line-color",
  "road-mid": "line-color", "road-major-casing": "line-color", "road-major": "line-color",
  "road-motorway-casing": "line-color", "road-motorway": "line-color", rail: "line-color", boundary: "line-color",
  building: "fill-extrusion-color",
  "road-label": "text-color", "place-neighbourhood": "text-color", "place-city-town": "text-color",
};
const LABEL_LAYERS = ["road-label", "place-neighbourhood", "place-city-town"];

// 시간대 팔레트 — day는 map-style.json 원본값 그대로(적용해도 변화 없음 = 멱등)
const PALETTES: Record<DayPeriod, Record<string, string>> = {
  day: {
    background: "#A6DA8E", "landuse-residential": "#B4E29C", "landcover-wood": "#74C45C",
    "landcover-grass": "#8CD072", "landcover-sand": "#F2E5B1", park: "#7BCC61",
    "landuse-school-hospital": "#C6E8AE", water: "#59BEEF", waterway: "#59BEEF",
    aeroway: "#DCEBCB", tunnel: "#CBE3B6", path: "#F4FAEA",
    "road-minor-casing": "#89BE72", "road-minor": "#FDFEF9", "road-mid-casing": "#82B96C",
    "road-mid": "#FFFCEE", "road-major-casing": "#7CB566", "road-major": "#FFF3C4",
    "road-motorway-casing": "#D9A94E", "road-motorway": "#FFDD7E", rail: "#9DBC9D",
    building: "#EDF6E1", boundary: "#679467",
    "road-label": "#49683F", "place-neighbourhood": "#3E5C36", "place-city-town": "#2F4A28",
  },
  // 아침 — 낮보다 한 톤 밝고 파릇한 새벽 공기
  morning: {
    background: "#B2E0A8", "landuse-residential": "#BEE5AC", "landcover-wood": "#7FCA69",
    "landcover-grass": "#97D680", "landcover-sand": "#F4EBC0", park: "#86D26E",
    "landuse-school-hospital": "#CDEBB8", water: "#6EC8F2", waterway: "#6EC8F2",
    aeroway: "#E0EDD2", tunnel: "#D2E7C0", path: "#F7FBEF",
    "road-minor-casing": "#93C57E", "road-minor": "#FDFEFB", "road-mid-casing": "#8CC077",
    "road-mid": "#FFFDF3", "road-major-casing": "#86BC72", "road-major": "#FFF6D2",
    "road-motorway-casing": "#DDB25E", "road-motorway": "#FFE494", rail: "#A7C3A7",
    building: "#F2F8E9", boundary: "#74A074",
    "road-label": "#52704A", "place-neighbourhood": "#47653F", "place-city-town": "#375232",
  },
  // 노을 — 골든아워 주황 워시 (초록이 올리브로, 도로가 살구빛으로)
  sunset: {
    background: "#C2CF7F", "landuse-residential": "#CBD584", "landcover-wood": "#7FAE55",
    "landcover-grass": "#9CC26A", "landcover-sand": "#F2DCA0", park: "#8CBB5E",
    "landuse-school-hospital": "#D5DB96", water: "#4FA9DE", waterway: "#4FA9DE",
    aeroway: "#E2DFAE", tunnel: "#D5CF9E", path: "#FBF3DC",
    "road-minor-casing": "#A3A862", "road-minor": "#FFF9E4", "road-mid-casing": "#9CA35E",
    "road-mid": "#FFF3D2", "road-major-casing": "#999C58", "road-major": "#FFE1A6",
    "road-motorway-casing": "#D08C3A", "road-motorway": "#FFC46A", rail: "#A8AE84",
    building: "#F4EBD2", boundary: "#7C8A5A",
    "road-label": "#5C5A33", "place-neighbourhood": "#514F2C", "place-city-town": "#3E3D20",
  },
  // 밤 — 다크 지도 (수요냥 밤 이벤트·야간 산책 무드)
  night: {
    background: "#253345", "landuse-residential": "#2A3A4C", "landcover-wood": "#22402F",
    "landcover-grass": "#2A4A3A", "landcover-sand": "#4B4634", park: "#2A5244",
    "landuse-school-hospital": "#2E4054", water: "#1C4C74", waterway: "#1C4C74",
    aeroway: "#34485E", tunnel: "#2E3E50", path: "#3E5064",
    "road-minor-casing": "#1D2938", "road-minor": "#43586E", "road-mid-casing": "#1D2938",
    "road-mid": "#4B627A", "road-major-casing": "#202E40", "road-major": "#587090",
    "road-motorway-casing": "#6E5524", "road-motorway": "#C9A24E", rail: "#3C5052",
    building: "#303F52", boundary: "#3E5A50",
    "road-label": "#A9C4DD", "place-neighbourhood": "#C3D9EB", "place-city-town": "#E1EEF9",
  },
};
const LABEL_HALO: Record<DayPeriod, string> = {
  morning: "#FFFFFF", day: "#FFFFFF", sunset: "#FFF6E0", night: "#16202B",
};

/** 팔레트 적용 — 존재하지 않는 레이어는 조용히 스킵 (스타일 교체에도 안 죽게) */
export function applyMapPalette(map: maplibregl.Map, period: DayPeriod): void {
  const colors = PALETTES[period];
  for (const [id, color] of Object.entries(colors)) {
    const prop = PAINT_PROP[id];
    if (!prop || !map.getLayer(id)) continue;
    try { map.setPaintProperty(id, prop as never, color as never); } catch { /* 레이어 스펙 변경 등 — 무시 */ }
  }
  for (const id of LABEL_LAYERS) {
    if (!map.getLayer(id)) continue;
    try { map.setPaintProperty(id, "text-halo-color" as never, LABEL_HALO[period] as never); } catch { /* 무시 */ }
  }
  // 공원 발바닥 패턴 — 밤엔 밝은 발바닥으로 교체
  if (map.getLayer("park-paws")) {
    try { map.setPaintProperty("park-paws", "fill-pattern" as never, (period === "night" ? "paw-dots-light" : "paw-dots-dark") as never); } catch { /* 무시 */ }
  }
}

// ── 발바닥 그리기 (캔버스) — 자체 모티프. 패드 타원 1 + 발가락 4 ──
function drawPaw(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, rotateRad: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotateRad);
  ctx.fillStyle = color;
  const s = size;
  ctx.beginPath(); ctx.ellipse(0, s * 0.18, s * 0.34, s * 0.28, 0, 0, Math.PI * 2); ctx.fill(); // 패드
  const toes: Array<[number, number]> = [[-s * 0.30, -s * 0.16], [-s * 0.11, -s * 0.30], [s * 0.11, -s * 0.30], [s * 0.30, -s * 0.16]];
  for (const [tx, ty] of toes) { ctx.beginPath(); ctx.ellipse(tx, ty, s * 0.10, s * 0.13, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}

/** 공원 위 발바닥 패턴 레이어 — park 레이어 바로 위에 타일 패턴으로 얹는다 */
export function addParkPawPattern(map: maplibregl.Map): void {
  const make = (color: string) => {
    const c = document.createElement("canvas");
    c.width = 96; c.height = 96;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    // 어긋난 두 개 — 타일링해도 격자 느낌이 덜 나게
    drawPaw(ctx, 26, 30, 22, color, -0.35);
    drawPaw(ctx, 70, 74, 22, color, 0.5);
    return ctx.getImageData(0, 0, 96, 96);
  };
  const dark = make("rgba(22,60,36,0.14)");
  const light = make("rgba(226,240,255,0.10)");
  if (!dark || !light) return;
  try {
    if (!map.hasImage("paw-dots-dark")) map.addImage("paw-dots-dark", dark, { pixelRatio: 2 });
    if (!map.hasImage("paw-dots-light")) map.addImage("paw-dots-light", light, { pixelRatio: 2 });
    if (!map.getLayer("park-paws") && map.getLayer("park")) {
      map.addLayer({
        id: "park-paws", type: "fill", source: "omt", "source-layer": "park",
        paint: { "fill-pattern": "paw-dots-dark", "fill-opacity": 0.9 },
      }, "water"); // park 계열 위·물 아래
    }
  } catch { /* addImage 중복 등 — 무시 */ }
}

// ── 유저 발자국 트레일 — 20m 이동마다 뒤에 발자국이 남고 서서히 사라진다 ──
// 좌표 이력은 화면 장식으로만 쓰고 어디에도 저장·전송하지 않는다 (위치 방침 유지).
const TRAIL_MIN_DIST_M = 20;
const TRAIL_MAX = 14;
const TRAIL_FADE_MS = 45_000;

interface TrailState { last: { lat: number; lng: number } | null; step: number; markers: maplibregl.Marker[] }
const trail: TrailState = { last: null, step: 0, markers: [] };

function bearingRad(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dy = b.lat - a.lat;
  const dx = (b.lng - a.lng) * Math.cos((a.lat * Math.PI) / 180);
  return Math.atan2(dx, dy); // 북쪽 기준 시계방향
}

/** 위치 갱신 때 호출 — 충분히 이동했으면 발자국 하나를 떨군다 */
export function maybeDropPaw(
  map: maplibregl.Map,
  maplibre: { Marker: typeof maplibregl.Marker },
  pos: { lat: number; lng: number },
  period: DayPeriod,
  haversineMeters: (aLat: number, aLng: number, bLat: number, bLng: number) => number,
): void {
  if (!trail.last) { trail.last = pos; return; }
  const d = haversineMeters(trail.last.lat, trail.last.lng, pos.lat, pos.lng);
  if (d < TRAIL_MIN_DIST_M) return;
  const rot = (bearingRad(trail.last, pos) * 180) / Math.PI;
  trail.step += 1;
  const sideOffset = trail.step % 2 === 0 ? 5 : -5; // 좌우 번갈아 — 걷는 느낌
  const color = period === "night" ? "rgba(214,232,252,0.55)" : "rgba(24,58,36,0.5)";
  const el = document.createElement("div");
  el.style.pointerEvents = "none";
  el.innerHTML = `
    <div style="transform:rotate(${rot.toFixed(0)}deg) translateX(${sideOffset}px);opacity:0.9;transition:opacity ${TRAIL_FADE_MS}ms linear">
      <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden>
        <ellipse cx="12" cy="15.5" rx="6" ry="5" fill="${color}"/>
        <ellipse cx="5" cy="9" rx="2.1" ry="2.7" fill="${color}"/>
        <ellipse cx="9.7" cy="6.4" rx="2.1" ry="2.7" fill="${color}"/>
        <ellipse cx="14.3" cy="6.4" rx="2.1" ry="2.7" fill="${color}"/>
        <ellipse cx="19" cy="9" rx="2.1" ry="2.7" fill="${color}"/>
      </svg>
    </div>`;
  // 발자국은 "지나온 자리"(직전 위치)에 찍는다 — 현재 위치는 유저 마커가 차지
  const m = new maplibre.Marker({ element: el, anchor: "center" })
    .setLngLat([trail.last.lng, trail.last.lat]).addTo(map);
  trail.last = pos;
  trail.markers.push(m);
  requestAnimationFrame(() => { const inner = el.firstElementChild as HTMLElement | null; if (inner) inner.style.opacity = "0"; });
  setTimeout(() => { m.remove(); trail.markers = trail.markers.filter(x => x !== m); }, TRAIL_FADE_MS + 500);
  while (trail.markers.length > TRAIL_MAX) trail.markers.shift()?.remove();
}
