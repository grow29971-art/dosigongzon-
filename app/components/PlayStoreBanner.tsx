"use client";

// Play 스토어 앱 설치 배너 — 안드로이드 브라우저 사용자에게만 노출.
// 이미 TWA(앱)·standalone PWA로 보고 있으면 안 보임.
// 한 번 닫으면 14일간 다시 안 보임.

import { useEffect, useState } from "react";
import { Smartphone, X, ChevronRight } from "lucide-react";

const STORAGE_KEY = "dosigongzon_play_store_banner_dismissed_at";
const DISMISS_DAYS = 14;
const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=kr.dosigongzon.app";

export default function PlayStoreBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // SSR 회피
    if (typeof window === "undefined") return;

    // 안드로이드 외 OS·iOS·데스크탑 모두 제외
    const ua = navigator.userAgent ?? "";
    const isAndroid = /android/i.test(ua);
    if (!isAndroid) return;

    // 이미 TWA·PWA standalone으로 진입한 경우 — 앱·홈 화면에서 본 거라 의미 없음
    const isStandalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      window.matchMedia?.("(display-mode: fullscreen)").matches ||
      // iOS Safari standalone (참고용)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window.navigator as any).standalone === true;
    if (isStandalone) return;

    // TWA 진입(referrer가 android-app:// 패턴) — 의미 없음
    if (document.referrer.startsWith("android-app://")) return;

    // localStorage dismiss 체크
    try {
      const dismissed = localStorage.getItem(STORAGE_KEY);
      if (dismissed) {
        const at = parseInt(dismissed, 10);
        if (Number.isFinite(at) && Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000) {
          return;
        }
      }
    } catch {
      // localStorage 차단 — 그대로 노출
    }

    setShow(true);
  }, []);

  const handleDismiss = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {
      // ignore
    }
    setShow(false);
  };

  if (!show) return null;

  return (
    <a
      href={PLAY_STORE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="block mb-3 relative overflow-hidden active:scale-[0.99] transition-transform"
      style={{
        background: "linear-gradient(135deg, #DCEAF6 0%, #B5D2EC 60%, #95BFE3 100%)",
        borderRadius: 18,
        border: "1.5px solid rgba(74,123,168,0.30)",
        boxShadow: "0 6px 18px rgba(74,123,168,0.18)",
      }}
    >
      <button
        type="button"
        onClick={handleDismiss}
        className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center active:scale-90"
        style={{ background: "rgba(255,255,255,0.55)" }}
        aria-label="닫기"
      >
        <X size={13} style={{ color: "#2C5A85" }} />
      </button>
      <div className="flex items-center gap-3 px-4 py-3.5 pr-9">
        <div
          className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
          style={{
            background: "linear-gradient(135deg, #4A7BA8 0%, #2C5A85 100%)",
            boxShadow: "0 4px 12px rgba(74,123,168,0.40)",
          }}
        >
          <Smartphone size={20} color="#fff" strokeWidth={2.3} />
        </div>
        <div className="flex-1 min-w-0">
          <p
            className="text-[10px] font-extrabold tracking-[0.15em] mb-0.5"
            style={{ color: "#2C5A85" }}
          >
            ANDROID · NEW
          </p>
          <p className="text-[13.5px] font-extrabold leading-tight tracking-tight" style={{ color: "#1E3F5C" }}>
            📱 Play 스토어에 도시공존 앱 출시됐어요
          </p>
          <p className="text-[11.5px] mt-0.5 leading-snug" style={{ color: "rgba(30,63,92,0.75)" }}>
            한 번 설치하면 알림이 더 안정적으로 도착
          </p>
        </div>
        <ChevronRight size={14} style={{ color: "#2C5A85" }} className="shrink-0" />
      </div>
    </a>
  );
}
