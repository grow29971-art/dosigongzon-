"use client";

import { useEffect, useState } from "react";
import { Download, ChevronRight, Check, Share, PlusSquare, X } from "lucide-react";
import { track } from "@vercel/analytics";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in window.navigator && (window.navigator as { standalone?: boolean }).standalone === true)
  );
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  return isIos() && /safari/i.test(ua) && !/crios|fxios/i.test(ua);
}

/**
 * 마이페이지에 표시할 "앱 설치하기" 메뉴 항목.
 * - 이미 standalone: "설치 완료" 표시 + 클릭 비활성
 * - 크롬/엣지: beforeinstallprompt 받아서 직접 띄움
 * - iOS Safari: "홈 화면에 추가" 방법 안내 모달
 * - iOS 크롬/파파이어폭스: 사파리로 열라는 안내
 */
export default function InstallAppMenuItem() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [iosModalOpen, setIosModalOpen] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall as EventListener);

    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
      try { track("pwa_installed", { source: "mypage" }); } catch {}
    };
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall as EventListener);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const handleClick = async () => {
    if (installed) return;

    try { track("pwa_install_manual_clicked"); } catch {}

    // iOS: 방법 모달 띄움 (beforeinstallprompt 미지원)
    if (isIos()) {
      setIosModalOpen(true);
      return;
    }

    // 크롬·엣지: prompt 있으면 바로 띄움
    if (deferred) {
      try {
        await deferred.prompt();
        const { outcome } = await deferred.userChoice;
        try { track("pwa_install_choice", { outcome, source: "mypage" }); } catch {}
        if (outcome === "accepted") setInstalled(true);
      } catch {}
      finally {
        setDeferred(null);
      }
      return;
    }

    // prompt 없음 = 이미 설치됐거나 브라우저가 지원 안 함.
    // 안내 메시지만 alert
    alert("이 브라우저에서는 자동 설치가 지원되지 않아요.\n브라우저 메뉴에서 '홈 화면에 추가'를 눌러주세요.");
  };

  const subtitle = installed
    ? "홈 화면에 설치됨"
    : isIos()
    ? "사파리에서 홈 화면에 추가"
    : "한 번의 탭으로 홈 화면에 설치";

  return (
    <>
      {/* 마이페이지 '내 설정' 그룹 카드 내부의 행(row) — 토스식 (2026-07-16) */}
      <button
        type="button"
        onClick={handleClick}
        disabled={installed}
        className="w-full flex items-center gap-3 px-1 py-3 press disabled:opacity-80"
        style={{ borderTop: "1px solid var(--color-divider)" }}
      >
        <div
          className="w-10 h-10 flex items-center justify-center shrink-0"
          style={{
            backgroundColor: installed ? "rgba(46,125,50,0.1)" : "var(--color-primary-soft)",
            borderRadius: "var(--radius-square-lg)",
          }}
        >
          {installed ? (
            <Check size={18} color="#2E7D32" strokeWidth={2.2} />
          ) : (
            <Download size={18} color="#3182F6" strokeWidth={2.2} />
          )}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-[14px] font-extrabold text-text-main tracking-tight">
            {installed ? "앱 설치 완료" : "앱으로 설치하기"}
          </p>
          <p className="text-[11px] text-text-sub mt-0.5">{subtitle}</p>
        </div>
        {!installed && (
          <ChevronRight size={16} className="shrink-0" style={{ color: "var(--color-primary)", opacity: 0.7 }} />
        )}
      </button>

      {/* iOS 안내 모달 */}
      {iosModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-6">
          <div
            className="absolute inset-0"
            style={{ background: "rgba(0,0,0,0.4)" }}
            onClick={() => setIosModalOpen(false)}
          />
          <div
            className="relative w-full max-w-sm rounded-[24px] p-5"
            style={{ background: "#FFFFFF", boxShadow: "var(--shadow-modal)" }}
          >
            <button
              type="button"
              onClick={() => setIosModalOpen(false)}
              className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: "rgba(0,0,0,0.05)" }}
              aria-label="닫기"
            >
              <X size={14} className="text-text-sub" />
            </button>
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center"
                style={{
                  background: "linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)",
                  boxShadow: "0 4px 12px rgba(49,130,246,0.35)",
                }}
              >
                <Download size={19} color="#fff" strokeWidth={2.2} />
              </div>
              <div>
                <p className="text-[10px] font-extrabold tracking-[0.12em]" style={{ color: "var(--color-primary)" }}>
                  INSTALL
                </p>
                <p className="text-[15px] font-extrabold text-text-main tracking-tight">
                  홈 화면에 추가하기
                </p>
              </div>
            </div>
            {isIosSafari() ? (
              <>
                <p className="text-[12px] text-text-sub mb-3 leading-relaxed">
                  사파리 하단 공유 버튼을 눌러 <b>홈 화면에 추가</b>를 선택하면 앱처럼 사용할 수 있어요.
                </p>
                <ol className="space-y-2.5 text-[12.5px] text-text-main">
                  <li className="flex items-center gap-2">
                    <span
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-extrabold text-white shrink-0"
                      style={{ background: "var(--color-primary)" }}
                    >1</span>
                    <Share size={14} style={{ color: "var(--color-primary)" }} />
                    <span>사파리 하단 공유 아이콘 탭</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-extrabold text-white shrink-0"
                      style={{ background: "var(--color-primary)" }}
                    >2</span>
                    <PlusSquare size={14} style={{ color: "var(--color-primary)" }} />
                    <span>"홈 화면에 추가" 선택</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-extrabold text-white shrink-0"
                      style={{ background: "var(--color-primary)" }}
                    >3</span>
                    <span>우측 상단 "추가" 버튼</span>
                  </li>
                </ol>
              </>
            ) : (
              <>
                <p className="text-[12.5px] text-text-sub leading-relaxed mb-2">
                  iOS 크롬·파이어폭스에서는 홈 화면 추가가 지원되지 않아요.
                </p>
                <p className="text-[12.5px] text-text-main leading-relaxed">
                  <b>사파리</b>로 이 페이지를 열고 공유 → <b>홈 화면에 추가</b>를 이용해주세요.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
