"use client";

// 🐾 야생냥이 지도 (/catch) — 냥줍 app/page.tsx 이식 (2026-08-04 P2).
// MapLibre GL + OpenFreeMap 게임 지도: 로밍 야생냥이(결정적 스폰)·골판지 상자·골목 프롭·
// 발자국 트레일·시간대 팔레트 + 캔 던지기 포획(WildCapture)·내 냥이 쓰다듬기.
//
// 냥줍 대비 뺀 것: 자체 BottomNav(city (main) 레이아웃이 담당)·실사 촬영 플로우·게스트
// 스타터/웰컴·온보딩 모달·튜토리얼 냥이·데일리 퀘스트 칩·업적 칩·Open-Meteo 하늘
// (CSP connect-src 미허용 — 시간대 팔레트만 유지)·track 계측.
//
// [위치정보 불변식 — lib/geo.ts 무신고 구성] 원시 GPS 좌표는 React state/ref에만 머문다.
// 네트워크로 나가는 것은 encodeGeohash(...,7) 결과(≈150m 셀)뿐이다 — 포획·상자·쓰다듬기
// 요청 본문 전부. 카드에도 정밀 좌표가 없고 geohash7만 있다(catch_cards 스키마에 lat/lng
// 컬럼 자체가 없음). 내 냥이 마커는 매일 다른 오프셋 홈 기준 로밍 궤적이라 서식지 역산 불가.
// tests/security-invariants.test.mjs R6가 이 파일의 JSON.stringify 본문을 소스 레벨로 감시한다.
// 지도는 MapLibre GL + OpenFreeMap (카카오맵은 약관상 게임 사용 금지라 배제).

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import maplibregl from "maplibre-gl";
import { LocateFixed, Radar, X, Star, FlaskConical } from "lucide-react";
import "maplibre-gl/dist/maplibre-gl.css";
import type { CSSProperties } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { GEOLOCATION_ENABLED } from "@/lib/geo";
import { encodeGeohash, haversineMeters } from "@/lib/catch/geohash";
import { RARITY_COLOR, speciesPhotoUrl } from "@/lib/catch/spawn-species";
import { speciesArtWalkSvg, butlerWalkSvg } from "@/lib/catch/species-art";
import { periodFor, applyMapPalette, addParkPawPattern, maybeDropPaw, type DayPeriod } from "@/lib/catch/map-decor";
import { propsNear, propSvg } from "@/lib/catch/map-props";
import { celebratePet, celebrateVictory } from "@/lib/catch/celebrate";
import {
  roamCatsNear, roamPosAt, currentDay, isEventTimeKST, myCatRoamFor,
  ROAM_CELL_PRECISION, ROAM_CAPTURE_RADIUS_M, type RoamCat, type RoamTrack,
} from "@/lib/catch/wild";
import { chestsNear, chestSvg, CHEST_CELL_PRECISION, CHEST_OPEN_RADIUS_M, type Chest } from "@/lib/catch/chest";
import WildCapture from "@/app/components/catch/WildCapture";

const MAP_STYLE = "/catch/map-style.json";

// GPS를 못 받았을 때의 기본 중심 (서울시청)
const DEFAULT_CENTER = { lat: 37.5665, lng: 126.978 };

interface CaughtCat {
  id: string;
  card_name: string | null;
  card_rarity: string;
  photo_url: string | null;
  species_key: string | null;
  caught_geohash7: string | null;
  spawn_id: string | null;
}

// 로밍 마커 렌더 한계 — 가까운 냥이만 그린다 (전체 후보는 ±12km에 수백 마리)
const ROAM_RENDER_DIST_M = 4000;
const ROAM_RENDER_MAX = 85;

// 골목 데코 프롭 — 냥이보다 짧은 반경·적은 수(분위기용, 비상호작용)
const PROP_RENDER_DIST_M = 1200;
const PROP_RENDER_MAX = 60;

const RARITY_RING = RARITY_COLOR as Record<string, string>;

// 반경 원 GeoJSON (MapLibre circle 레이어는 px 단위라 미터 원은 직접 그린다)
function circlePolygon(lat: number, lng: number, radiusM: number): GeoJSON.Feature<GeoJSON.Polygon> {
  const points = 64;
  const coords: [number, number][] = [];
  const latR = radiusM / 111320;
  const lngR = radiusM / (111320 * Math.cos((lat * Math.PI) / 180));
  for (let i = 0; i <= points; i++) {
    const a = (i / points) * Math.PI * 2;
    coords.push([lng + Math.cos(a) * lngR, lat + Math.sin(a) * latR]);
  }
  return { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [coords] } };
}

// 지도 위 HUD 칩 — 흰 바탕 + 굵은 컬러 아웃라인 + 아래 두꺼운 엣지(냥줍 아케이드 문법 축약)
function hudChipStyle(color: string, radius: number | string = 13): CSSProperties {
  return {
    background: "rgba(255,255,255,0.96)",
    borderRadius: radius,
    boxShadow: `inset 0 0 0 2px ${color}, 0 3px 0 ${color}55, 0 4px 12px rgba(31,58,86,0.16)`,
  };
}

// 카드 id → [0,1) 결정적 난수 2개 — 마커 지터가 새로고침마다 튀지 않게 한다
function jitterFromId(id: string): [number, number] {
  let h1 = 0, h2 = 0;
  for (let i = 0; i < id.length; i++) {
    h1 = (h1 * 31 + id.charCodeAt(i)) >>> 0;
    h2 = (h2 * 37 + id.charCodeAt(i)) >>> 0;
  }
  return [(h1 % 1000) / 1000, (h2 % 1000) / 1000];
}

// GO식 바닥 앵커 — 냥이 발밑 스폰 링 + 그림자
function groundAnchorHTML(color: string, w = 44): string {
  const shadowW = Math.round(w * 0.52), shadowH = Math.round(w * 0.17), ringH = Math.round(w * 0.4);
  return `
    <div style="position:absolute;left:50%;bottom:0;transform:translateX(-50%);pointer-events:none;z-index:-1">
      <div style="position:absolute;left:50%;top:52%;transform:translateX(-50%);
        width:${shadowW}px;height:${shadowH}px;border-radius:50%;background:rgba(8,14,22,0.30);filter:blur(2.5px)"></div>
      <div style="width:${w}px;height:${ringH}px;border-radius:50%;
        background:radial-gradient(ellipse at center, ${color}52 0%, ${color}26 46%, transparent 72%);
        box-shadow:inset 0 0 0 1.5px ${color}99;animation:nyangGroundPulse 2.4s ease-in-out infinite"></div>
    </div>`;
}

// 📦 연 상자 로컬 캐시 키 — {day, ids}. 날이 바뀌면 상자 자리도 바뀌므로 통째로 버린다.
const CHEST_STORAGE_KEY = "city_catch_chests_opened";

// 📦 보물상자 마커 HTML — 범위 안이면 블루 포인트 링 + 통통으로 "열 수 있다" 신호.
function chestElHTML(chest: Chest, inRange: boolean): string {
  const [r1, r2] = jitterFromId(chest.id);
  const bob = inRange
    ? `animation:nyangBob ${(2.2 + r1).toFixed(2)}s ease-in-out ${(-r2 * 2).toFixed(2)}s infinite`
    : "";
  return `
    <div style="position:relative;display:flex;flex-direction:column;align-items:center;padding-bottom:4px">
      <div style="display:flex;flex-direction:column;align-items:center;${bob}">
        ${inRange ? `<div style="padding:1px 7px;border-radius:99px;background:#3182F6;color:#fff;
          font-size:8.5px;font-weight:900;margin-bottom:2px;box-shadow:0 0 10px rgba(49,130,246,0.8)">열어보기</div>` : ""}
        <div style="filter:drop-shadow(0 1px 2px rgba(20,30,45,0.3))">${chestSvg(inRange)}</div>
      </div>
      ${inRange ? groundAnchorHTML("#3182F6", 36) : `
        <div style="position:absolute;left:50%;bottom:0;transform:translateX(-50%);pointer-events:none;z-index:-1;
          width:20px;height:6px;border-radius:50%;background:rgba(20,30,45,0.22);filter:blur(1.5px)"></div>`}
    </div>`;
}

// 마커 애니메이션 — 냥줍 globals.css에서 이식. 마커가 innerHTML로 주입돼 전역 keyframes가
// 필요하다. city 전역 CSS를 건드리지 않고 이 페이지가 마운트된 동안만 존재하도록 여기 둔다.
const MARKER_CSS = `
@keyframes nyangPulse {
  0% { transform: scale(0.5); opacity: 0.9; }
  70% { transform: scale(1.4); opacity: 0; }
  100% { transform: scale(1.4); opacity: 0; }
}
@keyframes nyangBob {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-3.5px); }
}
@keyframes nyangGroundPulse {
  0%, 100% { transform: scale(1); opacity: 0.85; }
  50% { transform: scale(1.12); opacity: 1; }
}
@keyframes nyangLegSwing {
  0%, 100% { transform: rotate(13deg); }
  50% { transform: rotate(-13deg); }
}
@keyframes nyangTailSway {
  0%, 100% { transform: rotate(-7deg); }
  50% { transform: rotate(6deg); }
}
@keyframes nyangAuraGold {
  0%, 100% { filter: drop-shadow(0 1.5px 2px rgba(20,30,45,0.35)) drop-shadow(0 0 4px rgba(245,166,35,0.75)); }
  50% { filter: drop-shadow(0 1.5px 2px rgba(20,30,45,0.35)) drop-shadow(0 0 11px rgba(245,166,35,1)); }
}
.me-marker .me-legA, .me-marker .me-legB,
.me-marker .me-armA, .me-marker .me-armB {
  transform-box: fill-box; transform-origin: 50% 8%;
}
.me-marker.me-walking .me-legA { animation: nyangLegSwing 0.5s ease-in-out infinite; }
.me-marker.me-walking .me-legB { animation: nyangLegSwing 0.5s ease-in-out -0.25s infinite; }
.me-marker.me-walking .me-armA { animation: nyangLegSwing 0.5s ease-in-out -0.25s infinite; }
.me-marker.me-walking .me-armB { animation: nyangLegSwing 0.5s ease-in-out infinite; }
.me-marker .me-body {
  transform-box: fill-box; transform-origin: 50% 100%;
  animation: nyangBreathe 2.6s ease-in-out infinite;
}
@keyframes nyangBreathe {
  0%, 100% { transform: scaleY(1); }
  50% { transform: scaleY(0.965); }
}
`;

export default function CatchMapPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const userRef = useRef<typeof user>(null);
  useEffect(() => { userRef.current = user; }, [user]);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const userPosRef = useRef<{ lat: number; lng: number } | null>(null);

  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [geoDenied, setGeoDenied] = useState(false);
  const [myCats, setMyCats] = useState<CaughtCat[]>([]);
  // 로밍 냥이 — 잡은 개체(spawn_id)는 내 지도에서 사라진다
  const [capturedIds, setCapturedIds] = useState<Set<string>>(new Set());
  const [activeRoam, setActiveRoam] = useState<RoamCat | null>(null);
  const roamMarkersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const propMarkersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  // 📦 보물상자 — 마커와 "범위 안" 상태(블루 포인트 토글)를 함께 기억
  const chestMarkersRef = useRef<Map<string, { m: maplibregl.Marker; inRange: boolean }>>(new Map());
  const openedChestsRef = useRef<Set<string>>(new Set());
  const chestBusyRef = useRef(false);
  const activeRoamRef = useRef(false);
  useEffect(() => { activeRoamRef.current = activeRoam !== null; }, [activeRoam]);

  // 주변 냥이 트레이 + 접근 알림
  interface TrayCat { cat: RoamCat; d: number }
  const [tray, setTray] = useState<TrayCat[]>([]);
  const [trayOpen, setTrayOpen] = useState(false);
  const traySigRef = useRef("");
  const inRingRef = useRef<Set<string>>(new Set());       // 100m 링 안에 있다고 이미 알린 개체
  const legendNotifiedRef = useRef<Set<string>>(new Set()); // 레전드 1km 알림을 이미 보낸 개체
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 🧪 시뮬레이션 모드 — GPS 없는 PC/실내 테스트용. ?sim=1 로 진입했을 때만 토글 노출.
  // 켜면 실제 GPS를 무시하고 조이스틱/키보드(WASD·화살표)로 유저 마커를 움직인다.
  // 위치는 언제나 클라이언트 state뿐 — 서버로는 여전히 gh7만 나간다.
  const [simMode, setSimMode] = useState(false);
  const [simAllowed, setSimAllowed] = useState(false);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("sim")) setSimAllowed(true);
  }, []);
  const simModeRef = useRef(false);
  useEffect(() => { simModeRef.current = simMode; }, [simMode]);

  const showToast = useCallback((msg: string, ms = 2200) => {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), ms);
  }, []);

  // 🐾 "지도 냥이 = 가상·랜덤" 안내 — 실제 길고양이 위치로 오해 방지, 기기당 1회
  const virtualNoticeSkipRef = useRef(false);
  useEffect(() => {
    try {
      if (localStorage.getItem("city_catch_virtual_notice")) virtualNoticeSkipRef.current = true;
    } catch { virtualNoticeSkipRef.current = true; }
  }, []);
  useEffect(() => {
    if (!mapReady || virtualNoticeSkipRef.current) return;
    const t = setTimeout(() => {
      virtualNoticeSkipRef.current = true;
      try { localStorage.setItem("city_catch_virtual_notice", "1"); } catch { /* 무시 */ }
      showToast("🐾 지도 위 야생 냥이는 랜덤으로 나타나는 가상 냥이예요 — 실제 고양이 위치와 무관해요!", 4500);
    }, 2000);
    return () => clearTimeout(t);
  }, [mapReady, showToast]);

  // 🎉 주말 페스타 안내 — 이벤트 활성 시 세션당 1회
  useEffect(() => {
    if (!mapReady || !isEventTimeKST()) return;
    try {
      if (sessionStorage.getItem("city_catch_event_shown")) return;
    } catch { /* 시크릿 모드 — 매번 보여도 무해 */ }
    const t = setTimeout(() => {
      try { sessionStorage.setItem("city_catch_event_shown", "1"); } catch { /* 무시 */ }
      showToast("🎉 주말 페스타! 이벤트 냥이를 잡으면 EXP +30 · ✨확률 3배");
    }, 5000);
    return () => clearTimeout(t);
  }, [mapReady, showToast]);

  // ── GPS 추적 — 좌표는 state/ref까지만. 서버 전송은 항상 encodeGeohash(...,7) 결과만 ──
  useEffect(() => {
    if (!GEOLOCATION_ENABLED) { setGeoDenied(true); return; }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      queueMicrotask(() => setGeoDenied(true));
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (simModeRef.current) return;
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        userPosRef.current = p;
        setUserPos(prev => {
          if (prev && haversineMeters(prev.lat, prev.lng, p.lat, p.lng) < 1) return prev;
          return p;
        });
      },
      () => setGeoDenied(true),
      // maximumAge 0 — 캐시 좌표를 버리고 항상 신선한 픽스(실시간 이동)
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // ── 내가 잡은 냥이 불러오기 — 비로그인은 빈 지도(포획 시도에서 로그인 유도) ──
  useEffect(() => {
    if (authLoading || !user) return;
    const supabase = createClient();
    (async () => {
      const { data, error } = await supabase
        .from("catch_cards")
        .select("id, card_name, card_rarity, photo_url, species_key, caught_geohash7, spawn_id")
        .eq("owner_id", user.id)
        .order("caught_at", { ascending: false })
        .limit(300);
      if (error) { setMyCats([]); return; } // 마이그레이션 전 — 지도만 동작
      const cats = (data ?? []) as CaughtCat[];
      setMyCats(cats);
      setCapturedIds(new Set(cats.filter(c => c.spawn_id).map(c => c.spawn_id as string)));
    })();
  }, [authLoading, user]);

  // 지도 시간대 팔레트 현재값 — 발자국 트레일 색도 이걸 따른다
  const mapPeriodRef = useRef<DayPeriod>("day");

  // ── 지도 초기화 ──
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const center = userPosRef.current ?? DEFAULT_CENTER;
    // WebGL 미지원/컨텍스트 실패(구형 기기, 일부 인앱 웹뷰)면 Map 생성자가 던진다
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: MAP_STYLE,
        center: [center.lng, center.lat],
        zoom: 16,
        pitch: 48,
        attributionControl: { compact: true },
      });
    } catch (e) {
      console.error("map init failed", e);
      const inApp = /KAKAOTALK|Instagram|Line\/|FBAV|FBAN|NAVER|everytimeApp|DaumApps/i.test(navigator.userAgent);
      setMapError(inApp
        ? "인앱 브라우저에서는 지도가 열리지 않을 수 있어요. 우측 상단 ⋯ 메뉴에서 \"다른 브라우저로 열기\"를 눌러주세요."
        : "이 기기에서 지도를 그릴 수 없어요(WebGL 미지원). 최신 Chrome/Safari로 접속해주세요.");
      return;
    }
    map.touchZoomRotate.disableRotation();
    map.dragRotate.disable();
    const loadTimeout = setTimeout(() => {
      setMapError("지도를 불러오지 못했어요. 네트워크를 확인하고 새로고침해주세요.");
    }, 20_000);
    map.on("load", () => {
      clearTimeout(loadTimeout);
      setMapError(null);
      // 🎨 지도 데코 — 공원 발바닥 패턴 + 시간대 팔레트(아침/낮/노을/밤, 5분마다 재판정)
      addParkPawPattern(map);
      mapPeriodRef.current = periodFor(new Date().getHours());
      applyMapPalette(map, mapPeriodRef.current);
      // 포획 반경(100m) 링 — 로밍 냥이가 이 안에 들어오면 잡을 수 있다
      map.addSource("capture-radius", { type: "geojson", data: circlePolygon(center.lat, center.lng, ROAM_CAPTURE_RADIUS_M) });
      map.addLayer({
        id: "capture-radius-fill", type: "fill", source: "capture-radius",
        paint: { "fill-color": "#3182F6", "fill-opacity": 0.06 },
      });
      map.addLayer({
        id: "capture-radius-line", type: "line", source: "capture-radius",
        paint: { "line-color": "#3182F6", "line-opacity": 0.55, "line-width": 2, "line-dasharray": [2, 2] },
      });
      setMapReady(true);
    });
    map.on("error", (e) => console.error("map error", e.error?.message ?? e));
    mapRef.current = map;
    // 시간대 변화 감시 — 노을이 지거나 밤이 되면 지도가 은은하게 물든다
    const periodTimer = setInterval(() => {
      const p = periodFor(new Date().getHours());
      if (p !== mapPeriodRef.current && mapRef.current?.isStyleLoaded()) {
        mapPeriodRef.current = p;
        applyMapPalette(mapRef.current, p);
      }
    }, 5 * 60_000);
    return () => { clearTimeout(loadTimeout); clearInterval(periodTimer); map.remove(); mapRef.current = null; };
  }, []);

  // ── 내 위치 마커 갱신 — 픽스 간 rAF 글라이드 + 따라가는 카메라 ──
  const centeredOnceRef = useRef(false);
  const mePrevPosRef = useRef<{ lat: number; lng: number } | null>(null);
  const meWalkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const meAnimRef = useRef<number | null>(null);
  const meLastFixAtRef = useRef(0);
  const followMeRef = useRef(true);
  useEffect(() => () => { if (meAnimRef.current) cancelAnimationFrame(meAnimRef.current); }, []);
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    const release = (e: { originalEvent?: unknown }) => { if (e.originalEvent) followMeRef.current = false; };
    map.on("dragstart", release);
    map.on("zoomstart", release);
    return () => { map.off("dragstart", release); map.off("zoomstart", release); };
  }, [mapReady]);
  useEffect(() => {
    if (!mapReady || !userPos || !mapRef.current) return;
    const map = mapRef.current;
    const pos: [number, number] = [userPos.lng, userPos.lat];
    if (!centeredOnceRef.current) { centeredOnceRef.current = true; map.jumpTo({ center: pos }); }
    if (!userMarkerRef.current) {
      // 트레이너 아바타 — 고양이귀 후드 집사(butlerWalkSvg) + 발밑 GPS 소나 펄스 + 바닥 링
      const el = document.createElement("div");
      el.className = "me-marker";
      el.style.zIndex = "9000000"; // 냥이 위도 z-정렬(수만대)보다 항상 위
      el.dataset.dir = "1";
      el.innerHTML = `
        <div style="position:relative;display:flex;flex-direction:column;align-items:center;padding-bottom:4px">
          <div style="position:absolute;left:50%;bottom:-10px;transform:translateX(-50%);
            width:36px;height:36px;pointer-events:none;z-index:-2">
            <div style="position:absolute;inset:0;border-radius:50%;background:rgba(49,130,246,0.3);animation:nyangPulse 2.2s ease-out infinite"></div>
          </div>
          <div class="nyang-flip" style="display:flex;transform:scaleX(1);transition:transform 0.25s ease;
            filter:drop-shadow(0 1.5px 2px rgba(20,30,45,0.35))">
            ${butlerWalkSvg(44)}
          </div>
          ${groundAnchorHTML("#3182F6", 40)}
        </div>`;
      userMarkerRef.current = new maplibregl.Marker({ element: el, anchor: "bottom" }).setLngLat(pos).addTo(map);
      meLastFixAtRef.current = performance.now();
    } else {
      // 순간이동 대신 글라이드 — 80m 초과 점프(첫 픽스·GPS 튐)는 스냅
      const marker = userMarkerRef.current;
      const from = marker.getLngLat();
      const distM = haversineMeters(from.lat, from.lng, userPos.lat, userPos.lng);
      if (meAnimRef.current) { cancelAnimationFrame(meAnimRef.current); meAnimRef.current = null; }
      const now = performance.now();
      const duration = distM > 80 ? 0 : Math.min(1200, Math.max(250, now - meLastFixAtRef.current));
      meLastFixAtRef.current = now;
      const ringSrc = map.getSource("capture-radius") as maplibregl.GeoJSONSource | undefined;
      if (duration === 0) {
        marker.setLngLat(pos);
      } else {
        const step = (t: number) => {
          const k = Math.min(1, (t - now) / duration);
          const e = k * (2 - k); // easeOutQuad
          const lng = from.lng + (userPos.lng - from.lng) * e;
          const lat = from.lat + (userPos.lat - from.lat) * e;
          marker.setLngLat([lng, lat]);
          ringSrc?.setData(circlePolygon(lat, lng, ROAM_CAPTURE_RADIUS_M));
          meAnimRef.current = k < 1 ? requestAnimationFrame(step) : null;
        };
        meAnimRef.current = requestAnimationFrame(step);
      }
      if (followMeRef.current) map.easeTo({ center: pos, duration: Math.max(duration, 400), easing: (x) => x });
    }
    // 걷기 상태 — GPS 갱신 간 1m 이상 움직였으면 총총 + 진행 방향 보기
    const meEl = userMarkerRef.current.getElement();
    const prev = mePrevPosRef.current;
    if (prev && haversineMeters(prev.lat, prev.lng, userPos.lat, userPos.lng) > 1) {
      meEl.classList.add("me-walking");
      const dLng = userPos.lng - prev.lng;
      if (Math.abs(dLng) > 1e-7) {
        const dir = dLng > 0 ? "1" : "-1";
        if (meEl.dataset.dir !== dir) {
          meEl.dataset.dir = dir;
          const flip = meEl.querySelector<HTMLElement>(".nyang-flip");
          if (flip) flip.style.transform = `scaleX(${dir})`;
        }
      }
      if (meWalkTimerRef.current) clearTimeout(meWalkTimerRef.current);
      meWalkTimerRef.current = setTimeout(() => meEl.classList.remove("me-walking"), 1600);
    }
    mePrevPosRef.current = userPos;
    // 글라이드 중이면 링은 rAF가 프레임마다 옮긴다
    if (meAnimRef.current === null) {
      const src = map.getSource("capture-radius") as maplibregl.GeoJSONSource | undefined;
      src?.setData(circlePolygon(userPos.lat, userPos.lng, ROAM_CAPTURE_RADIUS_M));
    }
    // 🐾 발자국 트레일 — 20m 이동마다 지나온 자리에 발자국이 남는다
    maybeDropPaw(map, maplibregl, userPos, mapPeriodRef.current, haversineMeters);
  }, [mapReady, userPos]);

  // ── 포획 진입 — 비로그인은 로그인 유도, 100m 밖은 거리 안내 ──
  const tryRoamCaptureRef = useRef<(cat: RoamCat) => void>(() => {});
  useEffect(() => {
    tryRoamCaptureRef.current = (cat: RoamCat) => {
      if (!userRef.current) {
        showToast("포획하려면 로그인이 필요해요 — 로그인 화면으로 이동할게요");
        setTimeout(() => router.push("/login"), 900);
        return;
      }
      const p = userPosRef.current;
      if (!p) { showToast("내 위치를 아직 못 찾았어요. 위치 권한을 확인해주세요!"); return; }
      const pos = roamPosAt(cat);
      const d = haversineMeters(p.lat, p.lng, pos.lat, pos.lng);
      if (d > ROAM_CAPTURE_RADIUS_M) {
        const label = d >= 1000 ? `${(d / 1000).toFixed(1)}km` : `${Math.round(d)}m`;
        showToast(`${cat.species.name}까지 ${label} — ${ROAM_CAPTURE_RADIUS_M}m 안으로 다가가주세요! 🚶`);
        return;
      }
      setActiveRoam(cat);
    };
  }, [showToast, router]);

  // ── 로밍 냥이 — 1초 틱마다 위치 갱신, 가까운 개체만 마커 유지 ──
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    const markers = roamMarkersRef.current;
    let cats: RoamCat[] = [];
    let catsKey = "";

    const makeEl = (cat: RoamCat) => {
      const color = RARITY_RING[cat.species.rarity] ?? "#9CA3AF";
      const el = document.createElement("div");
      el.style.cursor = "pointer";
      // idle 통통 — 개체별 주기·시작점을 다르게(id 결정적) 해서 군무처럼 안 보이게
      const [r1, r2] = jitterFromId(cat.id);
      const bob = `animation:nyangBob ${(2 + r1 * 1.4).toFixed(2)}s ease-in-out ${(-r2 * 2).toFixed(2)}s infinite`;
      const aura = cat.species.rarity === "legendary"
        ? "animation:nyangAuraGold 1.8s ease-in-out infinite"
        : "filter:drop-shadow(0 1.5px 2px rgba(20,30,45,0.35))";
      const isEvent = cat.id.startsWith("event:");
      const isWed = cat.id.startsWith("wed:");
      const ringColor = isEvent ? "#3182F6" : color;
      el.innerHTML = `
        <div style="position:relative;display:flex;flex-direction:column;align-items:center;padding-bottom:5px">
          <div style="display:flex;flex-direction:column;align-items:center;${bob}">
            ${isEvent ? `<div style="padding:1px 7px;border-radius:99px;background:#3182F6;color:#fff;
              font-size:8.5px;font-weight:900;margin-bottom:2px;box-shadow:0 0 12px rgba(49,130,246,0.9)">이벤트</div>` : ""}
            ${isWed ? `<div style="padding:1px 7px;border-radius:99px;background:#1B64DA;color:#fff;
              font-size:8.5px;font-weight:900;margin-bottom:2px;box-shadow:0 0 12px rgba(27,100,218,0.9)">골목의 밤</div>` : ""}
            <div style="margin-bottom:1px;padding:1px 7px;border-radius:99px;background:rgba(15,21,32,0.92);
              color:#E8F0FE;font-size:9.5px;font-weight:800;border:1px solid ${color}88;box-shadow:0 0 8px ${color}44">
              ${cat.species.name}</div>
            <div class="nyang-flip" style="display:flex;transform:scaleX(1);transition:transform 0.25s ease;${aura}">
              ${speciesArtWalkSvg(cat.speciesKey, 62, { jitter: r2 })}
            </div>
          </div>
          ${groundAnchorHTML(ringColor)}
        </div>`;
      el.addEventListener("click", (e) => { e.stopPropagation(); tryRoamCaptureRef.current(cat); });
      return el;
    };

    const tick = () => {
      // 포획 미니게임 중엔 갱신 정지 — 마커 이동이 배경에서 계속되면 산만함
      if (activeRoamRef.current) return;
      const now = Date.now();
      const ref = userPosRef.current ?? DEFAULT_CENTER;
      // 동네(geohash5)나 날짜가 바뀌면 냥이 목록 재생성
      const key = `${encodeGeohash(ref.lat, ref.lng, ROAM_CELL_PRECISION)}:${currentDay(now)}`;
      if (key !== catsKey) {
        catsKey = key;
        cats = roamCatsNear(ref.lat, ref.lng, now);
      }
      const nearby = cats
        .filter(c => !capturedIds.has(c.id))
        .map(c => ({ c, pos: roamPosAt(c, now) }))
        .map(x => ({ ...x, d: haversineMeters(ref.lat, ref.lng, x.pos.lat, x.pos.lng) }))
        .filter(x => x.d <= ROAM_RENDER_DIST_M)
        .sort((a, b) => a.d - b.d)
        .slice(0, ROAM_RENDER_MAX);
      const keep = new Set(nearby.map(x => x.c.id));
      for (const [id, m] of markers) {
        if (!keep.has(id)) { m.remove(); markers.delete(id); }
      }
      for (const { c, pos } of nearby) {
        // 위도 기반 z-정렬 — 남쪽(낮은 위도)일수록 틸트 시점에서 앞이라 위로 겹치게
        const z = String(Math.round((90 - pos.lat) * 1000));
        const existing = markers.get(c.id);
        if (existing) {
          existing.setLngLat([pos.lng, pos.lat]);
          const mEl = existing.getElement();
          mEl.style.zIndex = z;
          // 이동 방향으로 캐릭터 좌우 반전 — 방향이 실제로 바뀐 틱에만 DOM을 만진다
          const prevLng = Number(mEl.dataset.lng);
          if (!Number.isFinite(prevLng)) {
            mEl.dataset.lng = String(pos.lng);
          } else if (Math.abs(pos.lng - prevLng) > 5e-7) {
            const dir = pos.lng > prevLng ? "1" : "-1";
            if (mEl.dataset.dir !== dir) {
              mEl.dataset.dir = dir;
              const flip = mEl.querySelector<HTMLElement>(".nyang-flip");
              if (flip) flip.style.transform = `scaleX(${dir})`;
            }
            mEl.dataset.lng = String(pos.lng);
          }
        } else {
          const el = makeEl(c);
          el.style.zIndex = z;
          // 등장 즉시 진행 방향을 보도록 1초 앞 위치로 초기 방향 판정
          const ahead = roamPosAt(c, now + 1000);
          if (ahead.lng < pos.lng) {
            el.dataset.dir = "-1";
            const flip = el.querySelector<HTMLElement>(".nyang-flip");
            if (flip) flip.style.transform = "scaleX(-1)";
          } else {
            el.dataset.dir = "1";
          }
          el.dataset.lng = String(pos.lng);
          const m = new maplibregl.Marker({ element: el, anchor: "bottom" })
            .setLngLat([pos.lng, pos.lat]).addTo(map);
          markers.set(c.id, m);
        }
      }

      // ── 주변 냥이 트레이 (가까운 8마리) — 거리 20m 단위로 바뀔 때만 리렌더 ──
      const trayList = nearby.slice(0, 8).map(x => ({ cat: x.c, d: x.d }));
      const sig = trayList.map(t => `${t.cat.id}:${Math.round(t.d / 20)}`).join("|");
      if (sig !== traySigRef.current) {
        traySigRef.current = sig;
        setTray(trayList);
      }

      // ── 접근 알림 — GPS가 실제로 잡혀 있을 때만 (기본 위치 기준 오알림 방지) ──
      if (userPosRef.current) {
        const inRing = inRingRef.current;
        for (const { c, d } of nearby) {
          if (d <= ROAM_CAPTURE_RADIUS_M && !inRing.has(c.id)) {
            inRing.add(c.id);
            navigator.vibrate?.(c.species.rarity === "legendary" ? [120, 60, 120, 60, 240] : 180);
            showToast(
              c.species.rarity === "legendary"
                ? `⭐ 레전드 ${c.species.name}이(가) 가까이 왔어요!!`
                : `🐾 ${c.species.name}이(가) 가까이 왔어요! 탭해서 포획해 보세요`,
            );
          } else if (d > ROAM_CAPTURE_RADIUS_M + 30 && inRing.has(c.id)) {
            inRing.delete(c.id); // 히스테리시스 — 경계에서 알림이 반복되지 않게
          }
          // 레전드 원거리 레이더 — 1km 안에 들어오면 개체당 1회
          if (c.species.rarity === "legendary" && d <= 1000 && !legendNotifiedRef.current.has(c.id)) {
            legendNotifiedRef.current.add(c.id);
            if (d > ROAM_CAPTURE_RADIUS_M) {
              navigator.vibrate?.([80, 40, 80]);
              showToast(`⭐ 레전드 ${c.species.name}이(가) ${(d / 1000).toFixed(1)}km 근처에 있어요!`);
            }
          }
        }
      }
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => {
      clearInterval(timer);
      markers.forEach(m => m.remove());
      markers.clear();
    };
  }, [mapReady, capturedIds, showToast]);

  // ── 골목 데코 프롭 — 밥그릇·화분·스크래처·표지판 (정적·비상호작용) ──
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    const markers = propMarkersRef.current;
    let props: ReturnType<typeof propsNear> = [];
    let propsCellKey = "";

    const tick = () => {
      const ref = userPosRef.current ?? DEFAULT_CENTER;
      const key = encodeGeohash(ref.lat, ref.lng, ROAM_CELL_PRECISION);
      if (key !== propsCellKey) { propsCellKey = key; props = propsNear(ref.lat, ref.lng); }
      const nearby = props
        .map(p => ({ p, d: haversineMeters(ref.lat, ref.lng, p.lat, p.lng) }))
        .filter(x => x.d <= PROP_RENDER_DIST_M)
        .sort((a, b) => a.d - b.d)
        .slice(0, PROP_RENDER_MAX);
      const keep = new Set(nearby.map(x => x.p.id));
      for (const [id, m] of markers) {
        if (!keep.has(id)) { m.remove(); markers.delete(id); }
      }
      for (const { p } of nearby) {
        if (markers.has(p.id)) continue; // 정적이라 위치 갱신 불필요
        const el = document.createElement("div");
        el.style.pointerEvents = "none";
        el.style.zIndex = String(Math.round((90 - p.lat) * 10)); // 냥이(×1000)보다 항상 뒤
        el.innerHTML = `
          <div style="position:relative;display:flex;flex-direction:column;align-items:center;
            filter:drop-shadow(0 1px 1px rgba(20,40,24,0.28));opacity:0.9">
            ${propSvg(p.kind)}
            <div style="position:absolute;left:50%;bottom:-2px;transform:translateX(-50%);
              width:18px;height:6px;border-radius:50%;background:rgba(20,40,24,0.22);filter:blur(1.5px)"></div>
          </div>`;
        const m = new maplibregl.Marker({ element: el, anchor: "bottom" })
          .setLngLat([p.lng, p.lat]).addTo(map);
        markers.set(p.id, m);
      }
    };

    tick();
    const timer = setInterval(tick, 2000); // 정적이라 냥이(1초)보다 느슨하게
    return () => {
      clearInterval(timer);
      markers.forEach(m => m.remove());
      markers.clear();
    };
  }, [mapReady]);

  // ── 📦 골판지 상자 — 매일 자리가 바뀐다, 100m 안에서 탭하면 열린다 ──
  // 연 상자는 지도에서 사라지고 localStorage에 날짜별로 기억(서버 catch_chest_opens가 최종 방어선)
  const markChestOpened = useCallback((id: string) => {
    openedChestsRef.current.add(id);
    const entry = chestMarkersRef.current.get(id);
    if (entry) { entry.m.remove(); chestMarkersRef.current.delete(id); }
    try {
      localStorage.setItem(CHEST_STORAGE_KEY, JSON.stringify({
        day: currentDay(), ids: [...openedChestsRef.current],
      }));
    } catch { /* 저장 실패 무시 — 서버가 어차피 중복을 막는다 */ }
  }, []);

  const tryOpenChestRef = useRef<(chest: Chest) => void>(() => {});
  useEffect(() => {
    tryOpenChestRef.current = async (chest: Chest) => {
      if (chestBusyRef.current) return;
      if (!userRef.current) {
        showToast("상자를 열려면 로그인이 필요해요 — 로그인 화면으로 이동할게요");
        setTimeout(() => router.push("/login"), 900);
        return;
      }
      const p = userPosRef.current;
      if (!p) { showToast("내 위치를 아직 못 찾았어요. 위치 권한을 확인해주세요!"); return; }
      const d = haversineMeters(p.lat, p.lng, chest.lat, chest.lng);
      if (d > CHEST_OPEN_RADIUS_M) {
        const label = d >= 1000 ? `${(d / 1000).toFixed(1)}km` : `${Math.round(d)}m`;
        showToast(`상자까지 ${label} — ${CHEST_OPEN_RADIUS_M}m 안에서 열 수 있어요! 🚶`);
        return;
      }
      chestBusyRef.current = true;
      try {
        const res = await fetch("/api/catch/chest/open", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chestId: chest.id, gh7: encodeGeohash(p.lat, p.lng, 7) }),
        });
        const data = await res.json().catch(() => ({})) as
          { ok?: boolean; kind?: string; message?: string; error?: string };
        if (!res.ok) {
          // 이미 열었거나(409) 어제 상자(410)면 지도에서도 치운다
          if (res.status === 409 || res.status === 410) markChestOpened(chest.id);
          showToast(data.error ?? "상자를 열지 못했어요.");
          return;
        }
        markChestOpened(chest.id);
        navigator.vibrate?.(data.kind === "miss" ? 60 : [80, 40, 120]);
        if (data.kind === "jackpot") celebrateVictory();
        showToast(`📦 ${data.message}`);
      } catch {
        showToast("네트워크가 불안정해요. 다시 시도해주세요!");
      } finally {
        chestBusyRef.current = false;
      }
    };
  }, [showToast, markChestOpened, router]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    const markers = chestMarkersRef.current;
    // 오늘 연 상자 복원 — 날이 바뀌면(상자 자리도 바뀌므로) 버린다
    try {
      const saved = JSON.parse(localStorage.getItem(CHEST_STORAGE_KEY) ?? "null") as
        { day?: number; ids?: string[] } | null;
      if (saved?.day === currentDay() && Array.isArray(saved.ids)) {
        openedChestsRef.current = new Set(saved.ids);
      }
    } catch { /* 깨진 저장값 무시 */ }

    let chests: Chest[] = [];
    let cellKey = "";
    const tick = () => {
      const now = Date.now();
      const ref = userPosRef.current ?? DEFAULT_CENTER;
      const key = `${encodeGeohash(ref.lat, ref.lng, CHEST_CELL_PRECISION)}:${currentDay(now)}`;
      if (key !== cellKey) { cellKey = key; chests = chestsNear(ref.lat, ref.lng, currentDay(now)); }
      const nearby = chests
        .filter(c => !openedChestsRef.current.has(c.id))
        .map(c => ({ c, d: haversineMeters(ref.lat, ref.lng, c.lat, c.lng) }))
        .filter(x => x.d <= 1500)
        .sort((a, b) => a.d - b.d)
        .slice(0, 15);
      const keep = new Set(nearby.map(x => x.c.id));
      for (const [id, e] of markers) {
        if (!keep.has(id)) { e.m.remove(); markers.delete(id); }
      }
      for (const { c, d } of nearby) {
        const inRange = d <= CHEST_OPEN_RADIUS_M;
        const existing = markers.get(c.id);
        if (existing) {
          if (existing.inRange !== inRange) { // 범위 경계에서만 다시 그린다
            existing.m.getElement().innerHTML = chestElHTML(c, inRange);
            existing.inRange = inRange;
          }
          continue;
        }
        const el = document.createElement("div");
        el.style.cursor = "pointer";
        el.style.zIndex = String(Math.round((90 - c.lat) * 100)); // 프롭(×10)보다 앞, 냥이(×1000)보다 뒤
        el.innerHTML = chestElHTML(c, inRange);
        el.addEventListener("click", (e) => { e.stopPropagation(); tryOpenChestRef.current(c); });
        const m = new maplibregl.Marker({ element: el, anchor: "bottom" })
          .setLngLat([c.lng, c.lat]).addTo(map);
        markers.set(c.id, { m, inRange });
      }
    };

    tick();
    const timer = setInterval(tick, 2000); // 정적이라 프롭과 같은 주기
    return () => {
      clearInterval(timer);
      markers.forEach(e => e.m.remove());
      markers.clear();
    };
  }, [mapReady]);

  // ── 🤚 쓰다듬기 — 돌아다니는 내 냥이를 100m 안에서 탭하면 EXP+5 (하루 1회) ──
  const petBusyRef = useRef(false);
  const tryPetRef = useRef<(cat: CaughtCat) => void>(() => {});
  useEffect(() => {
    tryPetRef.current = async (cat) => {
      const p = userPosRef.current;
      if (!p || !cat.caught_geohash7) { router.push("/mypage/cards"); return; }
      const track = myCatRoamFor(cat.id, cat.caught_geohash7);
      if (!track) { router.push("/mypage/cards"); return; }
      const pos = roamPosAt(track);
      const d = haversineMeters(p.lat, p.lng, pos.lat, pos.lng);
      const name = cat.card_name ?? "냥이";
      if (d > ROAM_CAPTURE_RADIUS_M) {
        const label = d >= 1000 ? `${(d / 1000).toFixed(1)}km` : `${Math.round(d)}m`;
        showToast(`${name}까지 ${label} — 가까이 가면 쓰다듬을 수 있어요 🤚`);
        return;
      }
      if (petBusyRef.current) return;
      petBusyRef.current = true;
      try {
        const res = await fetch("/api/catch/pet", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ card_id: cat.id, gh7: encodeGeohash(p.lat, p.lng, 7) }),
        });
        const data = await res.json().catch(() => ({} as Record<string, unknown>));
        if (data.already) { showToast(`${name}은(는) 오늘 충분히 쓰다듬었어요 💗 내일 또 만나요`); return; }
        if (!res.ok) { showToast((data.error as string) ?? "쓰다듬기에 실패했어요."); return; }
        celebratePet();
        navigator.vibrate?.([20, 30, 20]);
        showToast(`💗 ${name}이(가) 골골거려요! EXP +${data.exp_gained}${data.leveled_up ? ` · ✨ Lv.${data.new_level}!` : ""}`);
      } catch {
        showToast("네트워크 오류가 발생했어요.");
      } finally {
        petBusyRef.current = false;
      }
    };
  }, [showToast, router]);

  // ── 내 냥이 로밍 마커 — 잡은 카드가 지도 위를 돌아다닌다 ──
  // 위치 보안: 홈 앵커가 포획 셀에서 매일 다른 1~3km 오프셋이라 궤적으로 위치 역산 불가.
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    const markers = new Map<string, maplibregl.Marker>(); // key = card id
    let tracks: { cat: CaughtCat; track: RoamTrack }[] = [];
    let trackDay = -1;

    const makeEl = (cat: CaughtCat) => {
      const ring = RARITY_RING[cat.card_rarity] ?? "#9AA5B1";
      const el = document.createElement("div");
      el.style.cursor = "pointer";
      const [r1, r2] = jitterFromId(cat.id);
      // 사진이 없으면(포획 카드 기본) 종 아트 폴백 — speciesPhotoUrl이 데이터 URL까지 처리
      const imgSrc = cat.photo_url ?? speciesPhotoUrl(cat.species_key ?? "");
      el.innerHTML = `
        <div style="position:relative;display:flex;flex-direction:column;align-items:center;padding-bottom:5px">
          <div style="display:flex;flex-direction:column;align-items:center;
            animation:nyangBob ${(2 + r1 * 1.4).toFixed(2)}s ease-in-out ${(-r2 * 2).toFixed(2)}s infinite">
            <div style="margin-bottom:3px;padding:1.5px 8px;border-radius:99px;background:rgba(15,21,32,0.92);
              color:#E8F0FE;font-size:9.5px;font-weight:800;border:1px solid ${ring}88;max-width:90px;
              box-shadow:0 0 8px ${ring}44;
              overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${cat.card_name ?? "냥이"}</div>
            <div style="width:48px;height:48px;border-radius:50%;overflow:hidden;background:#0F1520;
              border:3px solid ${ring};box-shadow:0 0 0 2.5px #0F1520, 0 0 12px ${ring}88">
              <img src="${imgSrc}" style="width:100%;height:100%;object-fit:cover" alt=""/>
            </div>
          </div>
          ${groundAnchorHTML(ring)}
        </div>`;
      el.addEventListener("click", (e) => { e.stopPropagation(); tryPetRef.current(cat); });
      return el;
    };

    const tick = () => {
      const now = Date.now();
      const day = currentDay(now);
      if (day !== trackDay) {
        // 날짜가 바뀌면 트랙 재생성 — 홈 오프셋·경로가 새로워진다
        trackDay = day;
        tracks = myCats
          .filter(c => c.caught_geohash7)
          .map(c => ({ cat: c, track: myCatRoamFor(c.id, c.caught_geohash7!, day) }))
          .filter((x): x is { cat: CaughtCat; track: RoamTrack } => x.track !== null);
        for (const m of markers.values()) m.remove();
        markers.clear();
      }
      // 렌더 상한 — 유저 기준 가까운 순 40마리
      const ref = userPosRef.current ?? DEFAULT_CENTER;
      const nearby = tracks
        .map(x => ({ ...x, pos: roamPosAt(x.track, now) }))
        .map(x => ({ ...x, d: haversineMeters(ref.lat, ref.lng, x.pos.lat, x.pos.lng) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 40);
      const keep = new Set(nearby.map(x => x.cat.id));
      for (const [id, m] of markers) {
        if (!keep.has(id)) { m.remove(); markers.delete(id); }
      }
      for (const { cat, pos } of nearby) {
        const existing = markers.get(cat.id);
        if (existing) existing.setLngLat([pos.lng, pos.lat]);
        else {
          const m = new maplibregl.Marker({ element: makeEl(cat), anchor: "bottom" })
            .setLngLat([pos.lng, pos.lat]).addTo(map);
          markers.set(cat.id, m);
        }
      }
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => {
      clearInterval(timer);
      markers.forEach(m => m.remove());
      markers.clear();
    };
  }, [mapReady, myCats]);

  // 시뮬레이션 이동 — 한 스텝 15m, 홀드/키 반복으로 연속 이동
  const simStep = useCallback((dx: number, dy: number) => {
    const cur = userPosRef.current ?? DEFAULT_CENTER;
    const STEP_M = 15;
    const lat = cur.lat + (dy * STEP_M) / 111320;
    const lng = cur.lng + (dx * STEP_M) / (111320 * Math.cos((cur.lat * Math.PI) / 180));
    const p = { lat, lng };
    userPosRef.current = p;
    setUserPos(p);
    mapRef.current?.easeTo({ center: [lng, lat], duration: 180 });
  }, []);

  useEffect(() => {
    if (!simMode) return;
    // 시작 위치가 없으면 기본 위치에서 출발
    if (!userPosRef.current) { userPosRef.current = { ...DEFAULT_CENTER }; setUserPos({ ...DEFAULT_CENTER }); }
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const map: Record<string, [number, number]> = {
        w: [0, 1], arrowup: [0, 1], s: [0, -1], arrowdown: [0, -1],
        a: [-1, 0], arrowleft: [-1, 0], d: [1, 0], arrowright: [1, 0],
      };
      const dir = map[k];
      if (!dir) return;
      e.preventDefault();
      simStep(dir[0], dir[1]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [simMode, simStep]);

  // 조이스틱 홀드 — 누르는 동안 10Hz 연속 이동
  const holdTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startHold = useCallback((dx: number, dy: number) => {
    simStep(dx, dy);
    if (holdTimerRef.current) clearInterval(holdTimerRef.current);
    holdTimerRef.current = setInterval(() => simStep(dx, dy), 100);
  }, [simStep]);
  const endHold = useCallback(() => {
    if (holdTimerRef.current) { clearInterval(holdTimerRef.current); holdTimerRef.current = null; }
  }, []);
  useEffect(() => () => { if (holdTimerRef.current) clearInterval(holdTimerRef.current); }, []);

  const recenter = useCallback(() => {
    const p = userPosRef.current;
    if (!p) { showToast("내 위치를 아직 못 찾았어요. 위치 권한을 확인해주세요!"); return; }
    followMeRef.current = true; // 드래그로 풀렸던 카메라 팔로우 복귀
    mapRef.current?.flyTo({ center: [p.lng, p.lat], zoom: 16 });
  }, [showToast]);

  return (
    <div className="relative overflow-hidden" style={{ height: "calc(100dvh - 5rem)", background: "#F2F4F6", color: "#1F3A56" }}>
      <style>{MARKER_CSS}</style>
      <div className="absolute inset-0">
        <div ref={mapContainerRef} style={{ position: "absolute", inset: 0 }} />
        {!mapReady && !mapError && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-[14px] font-bold" style={{ color: "#8B95A1" }}>지도를 불러오는 중...</p>
          </div>
        )}
        {mapError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center" style={{ background: "#F2F4F6" }}>
            <p className="text-[14px] font-bold mb-6" style={{ color: "#E5484D" }}>{mapError}</p>
            <button onClick={() => window.location.reload()}
              className="px-6 py-3 rounded-2xl font-black text-[13.5px] text-white"
              style={{ background: "#3182F6" }}>
              새로고침
            </button>
          </div>
        )}
      </div>

      {/* ── 플로팅 헤더 — 타이틀 칩만 (도감·퀘스트 칩은 P3에서) ── */}
      <header className="absolute top-0 left-0 right-0 z-30 flex items-start justify-between px-3.5 py-3 pointer-events-none">
        <div className="flex items-center gap-1.5 pointer-events-auto"
          style={{ padding: "7px 14px 7px 11px", ...hudChipStyle("#3182F6") }}>
          <svg width="19" height="19" viewBox="0 0 24 24" aria-hidden>
            <defs>
              <linearGradient id="catchPaw" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#4593FC" />
                <stop offset="55%" stopColor="#3182F6" />
                <stop offset="100%" stopColor="#1B64DA" />
              </linearGradient>
            </defs>
            <g fill="url(#catchPaw)">
              <ellipse cx="12" cy="15.6" rx="5.6" ry="4.7" />
              <ellipse cx="5.2" cy="10.4" rx="2.3" ry="3" transform="rotate(-18 5.2 10.4)" />
              <ellipse cx="12" cy="7.3" rx="2.4" ry="3.1" />
              <ellipse cx="18.8" cy="10.4" rx="2.3" ry="3" transform="rotate(18 18.8 10.4)" />
            </g>
            <circle cx="19.4" cy="5" r="1.3" fill="#4593FC" opacity="0.9" />
          </svg>
          <span className="text-[14.5px] font-black leading-none" style={{
            letterSpacing: 1.5,
            background: "linear-gradient(135deg, #1B64DA 0%, #4593FC 45%, #1B64DA 100%)",
            WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
          }}>
            야생냥이
          </span>
        </div>
      </header>

      {geoDenied && !userPos && (
        <div className="absolute left-4 right-4 top-16 z-30 px-4 py-3 text-[12.5px] font-bold"
          style={{ ...hudChipStyle("#3182F6", 14), color: "#1B64DA" }}>
          📍 위치 권한이 없어 기본 위치(서울시청) 기준으로 보여드려요. 위치를 허용하면 근처 냥이를 잡을 수 있어요.
        </div>
      )}

      {/* ── 🧪 시뮬레이션 모드 — ?sim=1 로 진입한 테스트 세션에서만 노출 ── */}
      {mapReady && simAllowed && (
        <button onClick={() => setSimMode(v => !v)}
          className="absolute right-3.5 bottom-[168px] z-30 flex items-center gap-2 px-3 py-2 text-[10.5px] font-black"
          style={{ ...hudChipStyle(simMode ? "#3182F6" : "#7C93AB", 12), color: simMode ? "#3182F6" : "#7C93AB" }}>
          <FlaskConical size={13} strokeWidth={2.6} /> 시뮬
          <span className="relative inline-block transition-colors" style={{ width: 30, height: 17, borderRadius: 6, background: simMode ? "#3182F6" : "rgba(31,58,86,0.2)" }}>
            <span className="absolute top-[2px] transition-all" style={{ width: 13, height: 13, borderRadius: "38%", left: simMode ? 15 : 2, background: "#fff", boxShadow: "0 1px 3px rgba(31,58,86,0.4)" }} />
          </span>
        </button>
      )}
      {mapReady && simMode && (
        <div className="absolute left-4 bottom-[96px] z-30 grid grid-cols-3 gap-1"
          style={{ width: 132 }}>
          {([["", null], ["▲", [0, 1]], ["", null], ["◀", [-1, 0]], ["·", null], ["▶", [1, 0]], ["", null], ["▼", [0, -1]], ["", null]] as Array<[string, [number, number] | null]>).map(([label, dir], i) => (
            dir ? (
              <button key={i}
                onPointerDown={() => startHold(dir[0], dir[1])}
                onPointerUp={endHold} onPointerLeave={endHold} onPointerCancel={endHold}
                className="h-10 rounded-xl text-[15px] font-black select-none"
                style={{ background: "rgba(15,21,32,0.92)", color: "#4593FC", boxShadow: "inset 0 0 0 1px rgba(49,130,246,0.4)", touchAction: "none" }}>
                {label}
              </button>
            ) : <span key={i} className="h-10 flex items-center justify-center text-[10px]" style={{ color: "rgba(141,180,220,0.3)" }}>{label}</span>
          ))}
          <p className="col-span-3 text-center text-[9px] font-bold mt-0.5" style={{ color: "#5D7A9A", textShadow: "0 1px 3px rgba(255,255,255,0.8)" }}>
            WASD/방향키로도 이동
          </p>
        </div>
      )}

      {/* ── 내 위치 버튼 ── */}
      {mapReady && (
        <button onClick={recenter} aria-label="내 위치로"
          className="absolute right-3.5 bottom-28 z-30 w-12 h-12 flex items-center justify-center"
          style={hudChipStyle("#3182F6", "26%")}>
          <LocateFixed size={22} color="#3182F6" strokeWidth={2.4} />
        </button>
      )}

      {/* ── 주변 냥이 트레이 — 접힘: 좌하단 카운트 필 / 펼침: 가로 스크롤 스트립 ── */}
      {mapReady && tray.length > 0 && !trayOpen && (
        <button onClick={() => setTrayOpen(true)}
          className="absolute left-3.5 bottom-6 z-30 px-3.5 py-2.5 text-[12px] font-black flex items-center gap-1.5"
          style={{ ...hudChipStyle("#3182F6", 12), color: "#3182F6" }}>
          <Radar size={15} color="#3182F6" strokeWidth={2.6} /> 주변{" "}
          <span className="text-[13px]">{tray.length}</span>마리
          {tray.some(t => t.cat.species.rarity === "legendary") && <Star size={13} color="#191F28" fill="#191F28" />}
        </button>
      )}
      {mapReady && trayOpen && (
        <div className="absolute left-0 right-0 bottom-6 z-30 px-3">
          <div className="px-2 py-2 flex items-center gap-1"
            style={hudChipStyle("#3182F6", 16)}>
            <div className="flex-1 flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
              {tray.map(({ cat, d }) => {
                const color = RARITY_RING[cat.species.rarity] ?? "#9CA3AF";
                const inRange = d <= ROAM_CAPTURE_RADIUS_M;
                return (
                  <button key={cat.id}
                    onClick={() => {
                      const pos = roamPosAt(cat);
                      mapRef.current?.flyTo({ center: [pos.lng, pos.lat], zoom: 16.5 });
                    }}
                    className="flex flex-col items-center px-1.5 py-1 rounded-xl shrink-0"
                    style={{ background: inRange ? "rgba(49,130,246,0.14)" : "rgba(31,58,86,0.05)" }}>
                    <span className="w-[38px] h-[38px] overflow-hidden"
                      style={{ borderRadius: "26%", border: `2px solid ${color}`, boxShadow: `0 0 8px ${color}66` }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={speciesPhotoUrl(cat.speciesKey)} alt={cat.species.name} className="w-full h-full object-cover" />
                    </span>
                    <span className="text-[8.5px] font-black mt-0.5 max-w-[52px] truncate" style={{ color: "#1F3A56" }}>
                      {cat.species.name}
                    </span>
                    <span className="text-[8.5px] font-black" style={{ color: inRange ? "#3182F6" : "#7C93AB" }}>
                      {inRange ? "포획 가능!" : d >= 1000 ? `${(d / 1000).toFixed(1)}km` : `${Math.round(d)}m`}
                    </span>
                  </button>
                );
              })}
            </div>
            <button onClick={() => setTrayOpen(false)} aria-label="주변 냥이 닫기"
              className="w-7 h-7 flex items-center justify-center shrink-0"
              style={{ borderRadius: "26%", background: "rgba(31,58,86,0.08)" }}>
              <X size={14} color="#7C93AB" strokeWidth={2.6} />
            </button>
          </div>
        </div>
      )}

      {/* 토스트 — BottomNav(하단 ~80px) 위로 */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[200] px-5 py-3 text-[13px] font-bold max-w-[85vw] text-center"
          style={{ background: "rgba(255,255,255,0.97)", color: "#1F3A56", borderRadius: 14,
            boxShadow: "inset 0 0 0 2px #3182F6, 0 3px 0 rgba(49,130,246,0.33), 0 6px 24px rgba(31,58,86,0.28)" }}>
          {toast}
        </div>
      )}

      {/* 로밍 냥이 포획 미니게임 */}
      {activeRoam && userPos && (
        <WildCapture
          spawn={activeRoam}
          userPos={userPos}
          onClose={() => setActiveRoam(null)}
          onCaptured={(card) => {
            if (activeRoam) {
              setCapturedIds(prev => new Set(prev).add(activeRoam.id));
              // 방금 잡은 냥이를 내 냥이 마커 소스에도 반영 (내 냥이 로밍은 다음 날부터)
              setMyCats(prev => [{
                id: card.id,
                card_name: card.card_name,
                card_rarity: (card.card_rarity as string) ?? "common",
                photo_url: null,
                species_key: activeRoam.speciesKey,
                caught_geohash7: null, // 서버가 기록 — 목록 재조회 전까지 로밍 마커 제외
                spawn_id: activeRoam.id,
              }, ...prev]);
            }
          }}
        />
      )}
    </div>
  );
}
