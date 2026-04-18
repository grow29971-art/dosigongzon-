"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  MapPin,
  Search,
  LocateFixed,
  Trash2,
  Save,
  Loader2,
  Star,
  Check,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  listMyActivityRegions,
  upsertActivityRegion,
  deleteActivityRegion,
  setPrimaryRegion,
  RADIUS_PRESETS,
  type ActivityRegion,
  type RegionSlot,
} from "@/lib/activity-regions-repo";
import { MAP_CENTER } from "@/lib/cats-repo";

declare global {
  interface Window {
    kakao: any;
  }
}

const SLOT_COLORS: Record<RegionSlot, string> = {
  1: "#C47E5A",
  2: "#4A7BA8",
};

export default function ActivityRegionsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [regions, setRegions] = useState<ActivityRegion[]>([]);
  const [activeSlot, setActiveSlot] = useState<RegionSlot>(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  // 현재 편집 중인 값
  const [name, setName] = useState("");
  const [lat, setLat] = useState<number>(MAP_CENTER.lat);
  const [lng, setLng] = useState<number>(MAP_CENTER.lng);
  const [radius, setRadius] = useState<number>(1000);
  const [isPrimary, setIsPrimary] = useState(true);

  // Kakao 지도
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const centerMarkerRef = useRef<any>(null);
  const circleRef = useRef<any>(null);
  const otherCircleRef = useRef<any>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  // 주소 검색
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const apiKey = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;

  // ── 비로그인 가드 ──
  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);

  // ── 초기 데이터 로드 ──
  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const list = await listMyActivityRegions();
      setRegions(list);
      const first = list.find((r) => r.slot === 1);
      if (first) {
        loadSlot(first);
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // ── Kakao SDK 로드 ──
  useEffect(() => {
    if (!apiKey) return;
    if (window.kakao?.maps) {
      setScriptLoaded(true);
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-kakao-sdk="true"]',
    );
    const waitForSdk = () => {
      const check = setInterval(() => {
        if (window.kakao?.maps) {
          clearInterval(check);
          setScriptLoaded(true);
        }
      }, 100);
    };
    if (existing) {
      waitForSdk();
      return;
    }
    const s = document.createElement("script");
    s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${apiKey}&autoload=false&libraries=services`;
    s.async = true;
    s.dataset.kakaoSdk = "true";
    s.onload = waitForSdk;
    document.head.appendChild(s);
  }, [apiKey]);

  // ── 지도 초기화 ──
  useEffect(() => {
    if (!scriptLoaded || !mapContainerRef.current) return;
    window.kakao.maps.load(() => {
      const map = new window.kakao.maps.Map(mapContainerRef.current, {
        center: new window.kakao.maps.LatLng(lat, lng),
        level: 5,
      });
      mapInstanceRef.current = map;
      setMapReady(true);

      // 지도 클릭 → 중심 이동
      window.kakao.maps.event.addListener(map, "click", (e: any) => {
        const ll = e.latLng;
        setLat(ll.getLat());
        setLng(ll.getLng());
        reverseGeocode(ll.getLat(), ll.getLng());
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptLoaded]);

  // ── 중심/반경/다른 슬롯 변경 시 오버레이 갱신 ──
  useEffect(() => {
    if (!mapReady || !window.kakao) return;
    const map = mapInstanceRef.current;
    const pos = new window.kakao.maps.LatLng(lat, lng);

    // 기존 오버레이 정리
    if (centerMarkerRef.current) centerMarkerRef.current.setMap(null);
    if (circleRef.current) circleRef.current.setMap(null);
    if (otherCircleRef.current) otherCircleRef.current.setMap(null);

    const color = SLOT_COLORS[activeSlot];

    // 중심 마커 (이모지 HTML)
    const el = document.createElement("div");
    el.innerHTML = `
      <div style="transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center;">
        <div style="padding:6px 10px;border-radius:14px;background:${color};color:#fff;font-size:11px;font-weight:800;box-shadow:0 4px 12px ${color}88;white-space:nowrap;">
          📍 활동 지역 ${activeSlot}
        </div>
        <div style="width:10px;height:10px;background:${color};transform:rotate(45deg);margin-top:-5px;"></div>
      </div>
    `;
    centerMarkerRef.current = new window.kakao.maps.CustomOverlay({
      map,
      position: pos,
      content: el,
      yAnchor: 1,
      zIndex: 20,
    });

    // 반경 Circle
    circleRef.current = new window.kakao.maps.Circle({
      map,
      center: pos,
      radius,
      strokeWeight: 2,
      strokeColor: color,
      strokeOpacity: 0.9,
      strokeStyle: "solid",
      fillColor: color,
      fillOpacity: 0.15,
    });

    // 다른 슬롯(저장된 것)도 옅게 표시
    const other = regions.find((r) => r.slot !== activeSlot);
    if (other) {
      const otherColor = SLOT_COLORS[other.slot as RegionSlot];
      otherCircleRef.current = new window.kakao.maps.Circle({
        map,
        center: new window.kakao.maps.LatLng(other.lat, other.lng),
        radius: other.radius_m,
        strokeWeight: 1,
        strokeColor: otherColor,
        strokeOpacity: 0.5,
        strokeStyle: "dashed",
        fillColor: otherColor,
        fillOpacity: 0.06,
      });
    }
  }, [mapReady, lat, lng, radius, activeSlot, regions]);

  // ── 중심 좌표 변경 시 지도 이동 (검색/GPS 결과 반영) ──
  useEffect(() => {
    if (!mapReady || !window.kakao) return;
    mapInstanceRef.current.setCenter(new window.kakao.maps.LatLng(lat, lng));
  }, [mapReady, lat, lng]);

  // ── 슬롯 전환 ──
  function loadSlot(r: ActivityRegion) {
    setActiveSlot(r.slot as RegionSlot);
    setName(r.name);
    setLat(r.lat);
    setLng(r.lng);
    setRadius(r.radius_m);
    setIsPrimary(r.is_primary);
  }

  function switchSlot(slot: RegionSlot) {
    const existing = regions.find((r) => r.slot === slot);
    if (existing) {
      loadSlot(existing);
    } else {
      setActiveSlot(slot);
      setName("");
      setRadius(1000);
      setIsPrimary(regions.length === 0 || slot === 1);
      // 첫 활동 지역이 있다면 그 근처에서 시작, 없으면 현재 위치
      const first = regions.find((r) => r.slot !== slot);
      if (first) {
        setLat(first.lat);
        setLng(first.lng);
      }
    }
    setErr("");
    setOk("");
  }

  // ── 역지오코딩: 좌표 → 동 이름 ──
  function reverseGeocode(la: number, ln: number) {
    if (!window.kakao?.maps?.services) return;
    const geocoder = new window.kakao.maps.services.Geocoder();
    geocoder.coord2RegionCode(ln, la, (result: any, status: any) => {
      if (status === window.kakao.maps.services.Status.OK && result[0]) {
        const dong = result[0].region_3depth_name || result[0].region_2depth_name;
        if (dong && !name.trim()) setName(dong);
      }
    });
  }

  // ── 내 위치 ──
  function handleLocateMe() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        reverseGeocode(pos.coords.latitude, pos.coords.longitude);
      },
      () => alert("위치 권한을 허용해주세요."),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  // ── 주소 검색 ──
  function handleSearch() {
    if (!searchQ.trim() || !window.kakao?.maps?.services) return;
    setSearching(true);
    const places = new window.kakao.maps.services.Places();
    places.keywordSearch(searchQ.trim(), (data: any, status: any) => {
      setSearching(false);
      if (status === window.kakao.maps.services.Status.OK) {
        setSearchResults(data.slice(0, 5));
      } else {
        setSearchResults([]);
      }
    });
  }

  function pickSearchResult(r: any) {
    const la = parseFloat(r.y);
    const ln = parseFloat(r.x);
    setLat(la);
    setLng(ln);
    if (!name.trim()) setName(r.place_name?.split(" ")[0] ?? r.place_name);
    setSearchResults([]);
    setSearchQ("");
  }

  // ── 저장 ──
  async function handleSave() {
    setErr("");
    setOk("");
    if (!name.trim()) {
      setErr("지역 이름을 입력해주세요.");
      return;
    }
    setSaving(true);
    try {
      await upsertActivityRegion({
        slot: activeSlot,
        name,
        lat,
        lng,
        radius_m: radius,
        is_primary: isPrimary,
      });
      const list = await listMyActivityRegions();
      setRegions(list);
      setOk("저장했어요 ✓");
      setTimeout(() => setOk(""), 2000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  // ── 삭제 ──
  async function handleDelete() {
    const exists = regions.find((r) => r.slot === activeSlot);
    if (!exists) {
      alert("아직 저장된 활동 지역이 아니에요.");
      return;
    }
    if (!confirm(`활동 지역 ${activeSlot} "${exists.name}" 을(를) 삭제할까요?`)) return;
    try {
      await deleteActivityRegion(activeSlot);
      const list = await listMyActivityRegions();
      setRegions(list);
      switchSlot(activeSlot);
      setOk("삭제했어요");
      setTimeout(() => setOk(""), 2000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "삭제 실패");
    }
  }

  // ── 주 활동 지역 지정 ──
  async function handleSetPrimary() {
    try {
      await setPrimaryRegion(activeSlot);
      const list = await listMyActivityRegions();
      setRegions(list);
      setIsPrimary(true);
      setOk("주 활동 지역으로 지정했어요");
      setTimeout(() => setOk(""), 2000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "변경 실패");
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin text-primary" size={28} />
      </div>
    );
  }

  const savedOnSlot = regions.find((r) => r.slot === activeSlot);

  return (
    <div className="pb-24" style={{ background: "#F7F4EE", minHeight: "100vh" }}>
      {/* 헤더 */}
      <div className="px-5 pt-14 pb-3 flex items-center gap-3 bg-white/80 backdrop-blur-md sticky top-0 z-40">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 rounded-full bg-white flex items-center justify-center active:scale-90"
          style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}
          aria-label="뒤로"
        >
          <ArrowLeft size={18} className="text-text-main" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-[16px] font-extrabold text-text-main tracking-tight">
            활동 지역 설정
          </h1>
          <p className="text-[11px] text-text-sub">
            최대 2곳까지 지정할 수 있어요
          </p>
        </div>
      </div>

      <div className="px-4 mt-3 space-y-4">
        {/* 슬롯 탭 */}
        <div className="flex gap-2">
          {([1, 2] as RegionSlot[]).map((slot) => {
            const r = regions.find((x) => x.slot === slot);
            const active = activeSlot === slot;
            const color = SLOT_COLORS[slot];
            return (
              <button
                key={slot}
                type="button"
                onClick={() => switchSlot(slot)}
                className="flex-1 px-3 py-3 rounded-2xl text-left active:scale-[0.98] transition-transform"
                style={{
                  background: active ? color : "#fff",
                  color: active ? "#fff" : "#333",
                  boxShadow: active
                    ? `0 4px 14px ${color}55`
                    : "0 2px 8px rgba(0,0,0,0.05)",
                  border: active ? "none" : "1px solid rgba(0,0,0,0.05)",
                }}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <MapPin size={12} />
                  <span className="text-[10px] font-bold opacity-80">
                    활동 지역 {slot}
                  </span>
                  {r?.is_primary && (
                    <Star
                      size={11}
                      fill={active ? "#fff" : "#E8B84A"}
                      strokeWidth={0}
                    />
                  )}
                </div>
                <p className="text-[13px] font-extrabold truncate">
                  {r ? r.name : "미설정"}
                </p>
                {r && (
                  <p className="text-[10px] opacity-70 mt-0.5">
                    반경 {r.radius_m >= 1000 ? `${r.radius_m / 1000}km` : `${r.radius_m}m`}
                  </p>
                )}
              </button>
            );
          })}
        </div>

        {/* 지도 */}
        <div
          className="relative rounded-2xl overflow-hidden"
          style={{
            height: 320,
            boxShadow: "0 4px 14px rgba(0,0,0,0.08)",
          }}
        >
          <div ref={mapContainerRef} className="w-full h-full" style={{ background: "#EEEAE2" }} />

          {/* 검색바 */}
          <div className="absolute top-3 left-3 right-3 z-10">
            <div
              className="flex items-center gap-2 rounded-2xl px-3 py-2 bg-white"
              style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}
            >
              <Search size={14} className="text-text-sub" />
              <input
                type="text"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="주소·장소 검색 (예: 남동구청)"
                className="flex-1 bg-transparent text-[12px] font-semibold outline-none"
              />
              {searching && <Loader2 size={14} className="animate-spin text-primary" />}
            </div>
            {searchResults.length > 0 && (
              <div
                className="mt-1 bg-white rounded-2xl overflow-hidden"
                style={{ boxShadow: "0 4px 14px rgba(0,0,0,0.12)" }}
              >
                {searchResults.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => pickSearchResult(r)}
                    className="w-full text-left px-3 py-2 active:bg-gray-50 border-b border-gray-100 last:border-0"
                  >
                    <p className="text-[12px] font-bold text-text-main truncate">
                      {r.place_name}
                    </p>
                    <p className="text-[10px] text-text-sub truncate">
                      {r.road_address_name || r.address_name}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 내 위치 FAB */}
          <button
            type="button"
            onClick={handleLocateMe}
            className="absolute bottom-3 right-3 z-10 w-10 h-10 rounded-2xl bg-white flex items-center justify-center active:scale-90"
            style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.15)" }}
            aria-label="내 위치"
          >
            <LocateFixed size={18} style={{ color: SLOT_COLORS[activeSlot] }} />
          </button>

          {/* 안내 */}
          <div
            className="absolute bottom-3 left-3 z-10 px-3 py-1.5 rounded-xl"
            style={{ background: "rgba(255,255,255,0.92)", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}
          >
            <p className="text-[10px] font-bold text-text-main">
              지도를 터치해서 중심점을 바꿔보세요
            </p>
          </div>
        </div>

        {/* 이름 입력 */}
        <div
          className="bg-white rounded-2xl p-4"
          style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}
        >
          <label className="text-[11px] font-bold text-text-sub">
            지역 이름
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 20))}
            placeholder="예: 구월동, 우리집 근처"
            className="w-full mt-1.5 px-3 py-2.5 rounded-xl text-[13px] font-bold outline-none"
            style={{
              background: "#F7F4EE",
              border: "1px solid rgba(0,0,0,0.05)",
            }}
          />
        </div>

        {/* 반경 선택 */}
        <div
          className="bg-white rounded-2xl p-4"
          style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}
        >
          <div className="flex items-center justify-between mb-2.5">
            <label className="text-[11px] font-bold text-text-sub">
              활동 반경
            </label>
            <span
              className="text-[13px] font-extrabold"
              style={{ color: SLOT_COLORS[activeSlot] }}
            >
              {radius >= 1000 ? `${radius / 1000}km` : `${radius}m`}
            </span>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {RADIUS_PRESETS.map((p) => {
              const active = radius === p.value;
              return (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setRadius(p.value)}
                  className="px-3 py-1.5 rounded-xl text-[11px] font-bold active:scale-95 transition-transform"
                  style={{
                    background: active ? SLOT_COLORS[activeSlot] : "#F7F4EE",
                    color: active ? "#fff" : "#666",
                  }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 주 활동 지역 */}
        <div
          className="bg-white rounded-2xl p-4 flex items-center gap-3"
          style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}
        >
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
            style={{ background: "rgba(232,184,74,0.15)" }}
          >
            <Star size={16} fill="#E8B84A" strokeWidth={0} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-extrabold text-text-main">
              주 활동 지역
            </p>
            <p className="text-[11px] text-text-sub">
              홈/지도의 기본 필터 기준이 돼요
            </p>
          </div>
          {savedOnSlot?.is_primary ? (
            <span
              className="px-3 py-1.5 rounded-xl text-[11px] font-extrabold"
              style={{ background: "#E8B84A", color: "#fff" }}
            >
              <Check size={11} className="inline mr-0.5" />
              지정됨
            </span>
          ) : (
            <button
              type="button"
              onClick={handleSetPrimary}
              disabled={!savedOnSlot}
              className="px-3 py-1.5 rounded-xl text-[11px] font-extrabold active:scale-95 disabled:opacity-40"
              style={{ background: "#F7F4EE", color: "#333" }}
            >
              지정하기
            </button>
          )}
        </div>

        {/* 피드백 */}
        {err && (
          <div
            className="rounded-2xl px-4 py-2.5 text-[12px] font-bold"
            style={{ background: "#FDECEC", color: "#B84545" }}
          >
            {err}
          </div>
        )}
        {ok && (
          <div
            className="rounded-2xl px-4 py-2.5 text-[12px] font-bold"
            style={{ background: "#E8F4E8", color: "#3F5B42" }}
          >
            {ok}
          </div>
        )}

        {/* 액션 버튼 */}
        <div className="flex gap-2">
          {savedOnSlot && (
            <button
              type="button"
              onClick={handleDelete}
              className="px-4 py-3 rounded-2xl flex items-center gap-1.5 active:scale-95"
              style={{ background: "#fff", color: "#B84545", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}
            >
              <Trash2 size={15} />
              <span className="text-[12px] font-extrabold">삭제</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-3 rounded-2xl flex items-center justify-center gap-1.5 active:scale-[0.98] disabled:opacity-50"
            style={{
              background: SLOT_COLORS[activeSlot],
              color: "#fff",
              boxShadow: `0 4px 14px ${SLOT_COLORS[activeSlot]}55`,
            }}
          >
            {saving ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Save size={15} />
            )}
            <span className="text-[13px] font-extrabold">
              {savedOnSlot ? "변경사항 저장" : "활동 지역 저장"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
