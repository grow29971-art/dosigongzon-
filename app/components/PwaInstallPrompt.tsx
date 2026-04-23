"use client";

import { useEffect, useState } from "react";
import { X, Download, Share, PlusSquare } from "lucide-react";
import { track } from "@vercel/analytics";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "dosigongzon_pwa_dismissed";
const VISITS_KEY = "dosigongzon_visits";
const DISMISS_TTL_DAYS = 3;
// 노출 조건: 첫 방문부터 AND 현재 세션에서 5초 이상 체류 (자주 노출 모드)
const MIN_VISITS = 1;
const DWELL_MS = 5_000;

function isDismissedRecently(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const ts = parseInt(raw, 10);
    if (isNaN(ts)) return false;
    return Date.now() - ts < DISMISS_TTL_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in window.navigator && (window.navigator as { standalone?: boolean }).standalone === true)
  );
}

function isIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iOS = /iphone|ipad|ipod/i.test(ua);
  const isSafari = /safari/i.test(ua) && !/crios|fxios/i.test(ua);
  return iOS && isSafari;
}

/**
 * 방문 카운터. 첫 방문자에게 바로 띄우면 거부율 높으므로 2회차 이상에서만 노출.
 * 세션당 1회만 카운트 (sessionStorage로 중복 방지).
 */
function bumpAndGetVisitCount(): number {
  try {
    if (sessionStorage.getItem("dosigongzon_session_counted")) {
      const raw = localStorage.getItem(VISITS_KEY);
      return raw ? parseInt(raw, 10) || 0 : 0;
    }
    const prev = parseInt(localStorage.getItem(VISITS_KEY) ?? "0", 10) || 0;
    const next = prev + 1;
    localStorage.setItem(VISITS_KEY, String(next));
    sessionStorage.setItem("dosigongzon_session_counted", "1");
    return next;
  } catch {
    return MIN_VISITS; // 저장소 막힘 → 통과
  }
}

export default function PwaInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandalone() || isDismissedRecently()) return;

    // 방문 카운터 증가 + 충족 여부 확인
    const visits = bumpAndGetVisitCount();
    if (visits < MIN_VISITS) return;

    let showTimer: ReturnType<typeof setTimeout> | null = null;

    // iOS 사파리: beforeinstallprompt 없음 → 수동 안내
    if (isIosSafari()) {
      showTimer = setTimeout(() => {
        setShowIosHint(true);
        setVisible(true);
        try { track("pwa_install_prompted", { platform: "ios" }); } catch {}
      }, DWELL_MS);
      return () => { if (showTimer) clearTimeout(showTimer); };
    }

    // 크롬·엣지: beforeinstallprompt 이벤트를 잡아뒀다가 체류 조건 충족 후 노출
    let captured: BeforeInstallPromptEvent | null = null;
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      captured = e as BeforeInstallPromptEvent;
      setDeferred(captured);
      if (!showTimer) {
        showTimer = setTimeout(() => {
          if (captured) {
            setVisible(true);
            try { track("pwa_install_prompted", { platform: "chromium" }); } catch {}
          }
        }, DWELL_MS);
      }
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall as EventListener);

    const onInstalled = () => {
      setVisible(false);
      setDeferred(null);
      try { track("pwa_installed"); } catch {}
    };
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      if (showTimer) clearTimeout(showTimer);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall as EventListener);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
    try { track("pwa_install_dismissed"); } catch {}
  };

  const install = async () => {
    if (!deferred) return;
    try {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      try { track("pwa_install_choice", { outcome }); } catch {}
      if (outcome === "accepted") {
        setVisible(false);
      } else {
        dismiss();
      }
    } catch {
      dismiss();
    } finally {
      setDeferred(null);
    }
  };

  if (!visible) return null;

  return (
    <div
      className="fixed left-4 right-4 z-50 pointer-events-none"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0) + 92px)" }}
      role="dialog"
      aria-label="앱 설치 안내"
    >
      <div
        className="pointer-events-auto rounded-2xl p-4 mx-auto"
        style={{
          maxWidth: 420,
          background: "linear-gradient(135deg, #FFFFFF 0%, #FFF9F0 100%)",
          boxShadow: "0 12px 36px rgba(196,126,90,0.25), 0 2px 8px rgba(0,0,0,0.08)",
          border: "1px solid rgba(196,126,90,0.25)",
        }}
      >
        <div className="flex items-start gap-3">
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
            style={{
              background: "linear-gradient(135deg, #C47E5A 0%, #A8684A 100%)",
              boxShadow: "0 4px 12px rgba(196,126,90,0.35)",
            }}
          >
            <Download size={19} color="#fff" strokeWidth={2.3} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-extrabold tracking-[0.12em]" style={{ color: "#C47E5A" }}>
              INSTALL
            </p>
            <p className="text-[14.5px] font-extrabold text-text-main tracking-tight leading-tight mt-0.5">
              도시공존을 앱처럼 쓰세요
            </p>
            <p className="text-[11.5px] text-text-sub mt-1 leading-snug">
              홈 화면에 추가하면 빠르게 열 수 있어요
            </p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="w-7 h-7 rounded-full flex items-center justify-center active:scale-90 shrink-0 -mt-1 -mr-1"
            style={{ background: "rgba(0,0,0,0.05)" }}
            aria-label="닫기"
          >
            <X size={13} className="text-text-sub" />
          </button>
        </div>

        {/* iOS 안내 */}
        {showIosHint && (
          <div className="mt-3 rounded-xl p-3" style={{ background: "rgba(196,126,90,0.08)" }}>
            <p className="text-[11.5px] text-text-main leading-relaxed mb-2 font-semibold">
              사파리 하단 공유 버튼을 눌러주세요:
            </p>
            <ol className="space-y-1 text-[11.5px] text-text-sub leading-relaxed pl-1">
              <li className="flex items-center gap-1.5">
                <Share size={13} style={{ color: "#C47E5A" }} />
                <span>공유 아이콘 탭</span>
              </li>
              <li className="flex items-center gap-1.5">
                <PlusSquare size={13} style={{ color: "#C47E5A" }} />
                <span>"홈 화면에 추가" 선택</span>
              </li>
            </ol>
          </div>
        )}

        {/* 크롬·엣지: 설치 버튼 */}
        {deferred && (
          <button
            type="button"
            onClick={install}
            className="w-full mt-3 py-2.5 rounded-xl text-[13px] font-extrabold text-white active:scale-[0.98] transition-transform"
            style={{
              background: "linear-gradient(135deg, #C47E5A 0%, #A8684A 100%)",
              boxShadow: "0 4px 12px rgba(196,126,90,0.35)",
            }}
          >
            홈 화면에 추가
          </button>
        )}
      </div>
    </div>
  );
}
