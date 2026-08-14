"use client";

// ══════════════════════════════════════════
// 곁에 있어요 — 112/119 빠른 전화 시트 (A-1)
//
// ⚠️ 법적 설계 원칙 (box/학대방지_캣맘보호_구현프롬프트.md):
// - tel: 딥링크로 OS 다이얼러를 "여는 것"뿐 — 자동발신 아님, 반드시 2탭(확인) 후 발신.
// - 현재 좌표·주소는 화면 표시 전용. 서버/DB/로그/애널리틱스로 절대 전송하지 않는다.
//   (이 파일에는 fetch·supabase 호출이 없어야 한다 — 추가 금지)
// - "안전 보장/자동신고/긴급 출동" 류 카피 금지. 정직하게 "전화 앱을 대신 열어줌"으로 표기.
// ══════════════════════════════════════════

import { useEffect, useState } from "react";
import { X, Phone, MapPin, Loader2 } from "lucide-react";
import ShareMyLocation from "@/app/components/ShareMyLocation";

const NOTICE_KEY = "dosi_safety_call_notice_v1";

type GeoState =
  | { status: "loading" }
  | { status: "ok"; lat: number; lng: number; address: string | null }
  | { status: "fail" };

type CallTarget = { number: "112" | "119"; label: string; desc: string } | null;

// Kakao SDK 최소 타입 (지도 페이지에서 services 포함 로드됨)
type KakaoGeocoder = {
  coord2Address: (
    lng: number,
    lat: number,
    cb: (
      result: Array<{ address?: { address_name?: string }; road_address?: { address_name?: string } | null }>,
      status: string,
    ) => void,
  ) => void;
};
type KakaoNS = {
  maps?: { services?: { Geocoder: new () => KakaoGeocoder; Status: { OK: string } } };
};

export default function SafetyCallSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [geo, setGeo] = useState<GeoState>({ status: "loading" });
  const [confirmTarget, setConfirmTarget] = useState<CallTarget>(null);
  const [showNotice, setShowNotice] = useState(false);

  // 최초 1회 한계 고지
  useEffect(() => {
    if (!open) return;
    try {
      if (!localStorage.getItem(NOTICE_KEY)) {
        setShowNotice(true);
        localStorage.setItem(NOTICE_KEY, "1");
      }
    } catch {}
  }, [open]);

  // 열릴 때 1회 위치 확인 — 화면 표시 전용 (서버 미전송)
  useEffect(() => {
    if (!open) return;
    setGeo({ status: "loading" });
    setConfirmTarget(null);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeo({ status: "fail" });
      return;
    }
    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        const { latitude: lat, longitude: lng } = pos.coords;
        setGeo({ status: "ok", lat, lng, address: null });
        // 주소 변환 (카카오 SDK — 지도 페이지에서 이미 로드됨. 없으면 좌표만 표시)
        try {
          const kakao = (window as unknown as { kakao?: KakaoNS }).kakao;
          const svc = kakao?.maps?.services;
          if (svc) {
            new svc.Geocoder().coord2Address(lng, lat, (result, status) => {
              if (cancelled || status !== svc.Status.OK) return;
              const addr =
                result[0]?.road_address?.address_name || result[0]?.address?.address_name || null;
              if (addr) setGeo({ status: "ok", lat, lng, address: addr });
            });
          }
        } catch {}
      },
      () => { if (!cancelled) setGeo({ status: "fail" }); },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 },
    );
    return () => { cancelled = true; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center" role="dialog" aria-label="곁에 있어요 — 빠른 전화">
      <button aria-label="닫기" className="absolute inset-0 bg-black/45" onClick={onClose} />
      <div
        className="relative w-full max-w-lg rounded-t-[26px] bg-white px-5 pt-5 pb-8"
        style={{ boxShadow: "0 -8px 30px rgba(0,0,0,0.18)" }}
      >
        <div className="flex items-start justify-between mb-1">
          <div>
            <h2 className="text-[18px] font-extrabold text-text-main">곁에 있어요 🤍</h2>
            <p className="text-[12px] text-text-sub mt-0.5 leading-relaxed">
              돌봄 중 위급하면 아래 버튼으로 전화 앱을 바로 열 수 있어요.
            </p>
          </div>
          <button onClick={onClose} className="p-2 -mr-2 -mt-1 active:scale-90" aria-label="닫기">
            <X size={20} className="text-text-light" />
          </button>
        </div>

        {/* 최초 1회 한계 고지 */}
        {showNotice && (
          <div className="rounded-xl px-3.5 py-2.5 mt-3 text-[12px] leading-relaxed" style={{ backgroundColor: "#FFF6E8", color: "#6F5A3A" }}>
            이 기능은 휴대폰 전화 앱을 <b>대신 열어주는 바로가기</b>예요. 자동으로 발신되지 않고,
            통신 상태에 따라 실패할 수 있어요.
          </div>
        )}

        {/* 현재 위치 — 통화 중 불러줄 수 있게 크게. 화면 표시 전용(서버 미전송) */}
        <div className="rounded-2xl px-4 py-3.5 mt-3" style={{ backgroundColor: "var(--color-surface-alt)" }}>
          <div className="flex items-center gap-1.5 mb-1">
            <MapPin size={13} className="text-primary" />
            <span className="text-[11px] font-bold text-text-sub">지금 내 위치 (통화할 때 불러주세요)</span>
          </div>
          {geo.status === "loading" && (
            <p className="text-[13px] text-text-sub flex items-center gap-1.5">
              <Loader2 size={14} className="animate-spin" /> 위치 확인 중…
            </p>
          )}
          {geo.status === "fail" && (
            <p className="text-[13px] font-bold" style={{ color: "#B84545" }}>
              위치 확인 실패 — 주변 간판·건물 이름을 확인해서 불러주세요.
            </p>
          )}
          {geo.status === "ok" && (
            <>
              {geo.address && (
                <p className="text-[16px] font-extrabold text-text-main leading-snug">{geo.address}</p>
              )}
              <p className="text-[13px] text-text-sub mt-0.5 tabular-nums">
                위도 {geo.lat.toFixed(5)} · 경도 {geo.lng.toFixed(5)}
              </p>
              <p className="text-[10px] text-text-light mt-1">이 위치는 화면에만 표시되고 어디에도 저장·전송되지 않아요.</p>
            </>
          )}
        </div>

        {/* 전화 버튼 (1탭) → 확인(2탭) 후 OS 다이얼러 */}
        {!confirmTarget ? (
          <div className="grid grid-cols-2 gap-2.5 mt-3">
            <button
              onClick={() => setConfirmTarget({ number: "112", label: "112 전화 걸기", desc: "경찰 — 위협·시비·학대 목격" })}
              className="rounded-2xl py-4 flex flex-col items-center gap-1 active:scale-95 transition-transform"
              style={{ backgroundColor: "var(--color-primary)", color: "#fff" }}
            >
              <Phone size={20} />
              <span className="text-[15px] font-extrabold">112 전화 걸기</span>
              <span className="text-[11px] opacity-85">경찰 · 위협받을 때</span>
            </button>
            <button
              onClick={() => setConfirmTarget({ number: "119", label: "119 전화 걸기", desc: "구조·응급의료" })}
              className="rounded-2xl py-4 flex flex-col items-center gap-1 active:scale-95 transition-transform"
              style={{ backgroundColor: "#4A7BA8", color: "#fff" }}
            >
              <Phone size={20} />
              <span className="text-[15px] font-extrabold">119 전화 걸기</span>
              <span className="text-[11px] opacity-85">구조 · 응급의료</span>
            </button>
          </div>
        ) : (
          <div className="rounded-2xl px-4 py-4 mt-3 text-center" style={{ backgroundColor: "#FFF3EC", border: "1px solid #EAD3C6" }}>
            <p className="text-[15px] font-extrabold text-text-main">{confirmTarget.number}에 전화를 겁니다</p>
            <p className="text-[12px] text-text-sub mt-0.5">{confirmTarget.desc}</p>
            <div className="flex gap-2.5 mt-3">
              <a
                href={`tel:${confirmTarget.number}`}
                className="flex-1 rounded-xl py-3 text-[14px] font-extrabold text-white active:scale-95 transition-transform"
                style={{ backgroundColor: "var(--color-primary)" }}
              >
                전화 걸기
              </a>
              <button
                onClick={() => setConfirmTarget(null)}
                className="flex-1 rounded-xl py-3 text-[14px] font-bold text-text-sub active:scale-95 transition-transform"
                style={{ backgroundColor: "var(--color-surface-alt)" }}
              >
                취소
              </button>
            </div>
          </div>
        )}

        {/* 내 위치 보내기 (A-2) — 서버 무경유 */}
        <ShareMyLocation />

        <p className="text-[10px] text-text-light text-center mt-3 leading-relaxed">
          휴대폰 기본 전화·문자·공유 기능으로 연결해주는 바로가기예요 · 잘못 눌렀다면 통화 전에 끊으면 돼요
        </p>
      </div>
    </div>
  );
}
