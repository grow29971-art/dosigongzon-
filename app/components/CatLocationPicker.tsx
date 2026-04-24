"use client";

import { useEffect, useRef, useState } from "react";
import { X, LocateFixed, Loader2, MapPin, Check } from "lucide-react";

declare global {
  interface Window {
    kakao: any;
  }
}

type Props = {
  open: boolean;
  initialLat: number;
  initialLng: number;
  initialRegion: string | null;
  catName: string;
  onCancel: () => void;
  onConfirm: (result: { lat: number; lng: number; region: string }) => void;
};

export default function CatLocationPicker({
  open,
  initialLat,
  initialLng,
  initialRegion,
  catName,
  onCancel,
  onConfirm,
}: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const centerOverlayRef = useRef<any>(null);

  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState("");
  const [lat, setLat] = useState(initialLat);
  const [lng, setLng] = useState(initialLng);
  const [region, setRegion] = useState(initialRegion ?? "");
  const [fullAddress, setFullAddress] = useState("");
  const [locating, setLocating] = useState(false);

  // 모달 열릴 때마다 초기값으로 리셋
  useEffect(() => {
    if (open) {
      setLat(initialLat);
      setLng(initialLng);
      setRegion(initialRegion ?? "");
      setFullAddress("");
      setMapError("");
    }
  }, [open, initialLat, initialLng, initialRegion]);

  // ── 지도 초기화 (모달 오픈 시) ──
  useEffect(() => {
    if (!open) return;
    if (!mapContainerRef.current) return;
    if (!window.kakao?.maps) {
      setMapError("지도 SDK가 로드되지 않았어요. 새로고침 해주세요.");
      return;
    }

    let unmounted = false;
    const timeoutIds: ReturnType<typeof setTimeout>[] = [];
    let ro: ResizeObserver | null = null;
    let onResize: (() => void) | null = null;

    window.kakao.maps.load(() => {
      if (unmounted) return;
      const container = mapContainerRef.current;
      if (!container) return;
      const map = new window.kakao.maps.Map(container, {
        center: new window.kakao.maps.LatLng(initialLat, initialLng),
        level: 4,
      });
      mapInstanceRef.current = map;
      setMapReady(true);

      // 드래그/줌 끝나면 중심 좌표 갱신 + 역지오코딩
      const onIdle = () => {
        const c = map.getCenter();
        const la = c.getLat();
        const ln = c.getLng();
        setLat(la);
        setLng(ln);
        reverseGeocode(la, ln);
      };
      window.kakao.maps.event.addListener(map, "idle", onIdle);

      // 리레이아웃 (탭 애니메이션 등으로 크기 늦게 잡히는 경우 대비)
      const triggerRelayout = () => {
        try {
          map.relayout();
          map.setCenter(new window.kakao.maps.LatLng(initialLat, initialLng));
        } catch {}
      };
      timeoutIds.push(setTimeout(triggerRelayout, 150));
      timeoutIds.push(setTimeout(triggerRelayout, 500));

      if (typeof ResizeObserver !== "undefined") {
        ro = new ResizeObserver(() => {
          try { map.relayout(); } catch {}
        });
        ro.observe(container);
      }

      onResize = () => { try { map.relayout(); } catch {} };
      window.addEventListener("resize", onResize);
      window.addEventListener("orientationchange", onResize);
    });

    return () => {
      unmounted = true;
      for (const id of timeoutIds) clearTimeout(id);
      if (ro) ro.disconnect();
      if (onResize) {
        window.removeEventListener("resize", onResize);
        window.removeEventListener("orientationchange", onResize);
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current = null;
      }
      setMapReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ── 역지오코딩: 좌표 → 동 ──
  // Kakao API는 같은 좌표에 대해 [0]법정동(B) + [1]행정동(H) 두 가지를 반환.
  // 사용자는 보통 행정동 이름으로 동네를 인식 (예: 수원시 장안구 장안동 28-7 →
  // 법정동은 "송죽동", 행정동은 "장안동"). 행정동 우선, 없으면 법정동 폴백.
  function reverseGeocode(la: number, ln: number) {
    if (!window.kakao?.maps?.services) return;
    const geocoder = new window.kakao.maps.services.Geocoder();
    geocoder.coord2RegionCode(ln, la, (result: any, status: any) => {
      if (status !== window.kakao.maps.services.Status.OK || !Array.isArray(result)) return;
      const admin = result.find((r: any) => r?.region_type === "H");
      const legal = result.find((r: any) => r?.region_type === "B");
      const target = admin ?? legal ?? result[0];
      const dong = target?.region_3depth_name || target?.region_2depth_name || "";
      const gu = target?.region_2depth_name || "";
      const sido = (target?.region_1depth_name || "")
        .replace(/(특별시|광역시|특별자치시|특별자치도|도)$/, "");
      if (dong) {
        setRegion(dong);
        setFullAddress([sido, gu, dong].filter(Boolean).join(" "));
      }
    });
  }

  // ── 내 위치로 이동 ──
  function handleLocateMe() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const la = pos.coords.latitude;
        const ln = pos.coords.longitude;
        if (mapInstanceRef.current && window.kakao) {
          mapInstanceRef.current.setCenter(new window.kakao.maps.LatLng(la, ln));
        }
      },
      () => {
        setLocating(false);
        alert("위치 권한을 허용해주세요.");
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  if (!open) return null;

  const regionChanged = (initialRegion ?? "") !== region;

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col"
      style={{ background: "#F7F4EE" }}
    >
      {/* 헤더 */}
      <div
        className="px-4 pt-14 pb-3 flex items-center gap-3 bg-white/90 backdrop-blur-md"
        style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.06)" }}
      >
        <button
          type="button"
          onClick={onCancel}
          className="w-9 h-9 rounded-full bg-surface-alt flex items-center justify-center active:scale-90"
          aria-label="닫기"
        >
          <X size={18} className="text-text-sub" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-[15px] font-extrabold text-text-main tracking-tight truncate">
            {catName} 위치 변경
          </h1>
          <p className="text-[11px] text-text-sub">
            지도를 움직여 중심을 맞춰주세요
          </p>
        </div>
      </div>

      {/* 지도 영역 */}
      <div className="relative flex-1">
        <div
          ref={mapContainerRef}
          className="w-full h-full"
          style={{ background: "#EEEAE2" }}
        />

        {/* 로딩/에러 오버레이 */}
        {(!mapReady || mapError) && (
          <div
            className="absolute inset-0 flex items-center justify-center z-[5] pointer-events-none"
            style={{ background: "rgba(238,234,226,0.85)" }}
          >
            {mapError ? (
              <div
                className="pointer-events-auto mx-4 rounded-2xl px-4 py-3 text-center"
                style={{ background: "#fff", boxShadow: "0 2px 10px rgba(0,0,0,0.1)" }}
              >
                <p className="text-[12px] font-bold text-text-main mb-1">⚠️ 지도 로드 실패</p>
                <p className="text-[11px] text-text-sub">{mapError}</p>
              </div>
            ) : (
              <Loader2 size={24} className="animate-spin text-primary" />
            )}
          </div>
        )}

        {/* 중앙 고정 핀 */}
        <div
          className="absolute left-1/2 top-1/2 pointer-events-none z-10"
          style={{ transform: "translate(-50%, -100%)" }}
        >
          <div
            className="flex flex-col items-center"
            style={{ filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.25))" }}
          >
            <div
              className="px-3 py-1.5 rounded-2xl text-[11px] font-extrabold text-white whitespace-nowrap mb-1"
              style={{ background: "#C47E5A" }}
            >
              📍 여기로 이동
            </div>
            <MapPin size={36} fill="#C47E5A" strokeWidth={1.5} color="#fff" />
          </div>
        </div>

        {/* 내 위치 FAB */}
        <button
          type="button"
          onClick={handleLocateMe}
          disabled={locating}
          className="absolute bottom-4 right-4 z-10 w-11 h-11 rounded-2xl bg-white flex items-center justify-center active:scale-90 disabled:opacity-60"
          style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.18)" }}
          aria-label="내 위치"
        >
          {locating ? (
            <Loader2 size={18} className="animate-spin text-primary" />
          ) : (
            <LocateFixed size={18} className="text-primary" />
          )}
        </button>
      </div>

      {/* 하단 확정 바 */}
      <div
        className="px-4 pt-3 pb-6 bg-white"
        style={{ boxShadow: "0 -4px 14px rgba(0,0,0,0.08)" }}
      >
        <div
          className="rounded-2xl px-4 py-3.5 mb-2.5"
          style={{
            background: "linear-gradient(135deg, #FFF8F2 0%, #F7F4EE 100%)",
            border: "1.5px solid rgba(196,126,90,0.25)",
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
              style={{ background: "rgba(196,126,90,0.15)" }}
            >
              <MapPin size={18} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-primary tracking-[0.05em]">자동 감지된 위치</p>
              <p className="text-[18px] font-extrabold text-text-main truncate leading-tight mt-0.5">
                {region || "감지 중…"}
              </p>
              {fullAddress && (
                <p className="text-[11px] text-text-sub truncate mt-0.5">{fullAddress}</p>
              )}
              {regionChanged && initialRegion && (
                <p className="text-[10px] text-text-light mt-0.5">
                  이전: {initialRegion}
                </p>
              )}
            </div>
          </div>
        </div>
        <p className="text-[10.5px] text-text-light leading-relaxed mb-3 px-1">
          💡 동 이름이 익숙한 이름과 다르면 다음 화면 &ldquo;동네&rdquo; 칸에서 직접 고칠 수 있어요. (행정동·법정동 차이로 다르게 보일 수 있음)
        </p>

        <button
          type="button"
          onClick={() => {
            if (!region.trim()) {
              alert("동 정보가 아직 감지되지 않았어요. 잠시 후 다시 시도해주세요.");
              return;
            }
            onConfirm({ lat, lng, region: region.trim() });
          }}
          disabled={!mapReady || !region.trim()}
          className="w-full py-3.5 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50"
          style={{
            background: "#C47E5A",
            color: "#fff",
            boxShadow: "0 4px 14px rgba(196,126,90,0.4)",
          }}
        >
          <Check size={16} />
          <span className="text-[14px] font-extrabold">이 위치로 변경</span>
        </button>
      </div>
    </div>
  );
}
