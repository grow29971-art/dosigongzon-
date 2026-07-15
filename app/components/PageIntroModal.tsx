"use client";

// 페이지 진입 안내 모달 (범용, 2026-07-15)
// 각 페이지 첫 방문 시 간략 설명 + 사용법. storageKey로 페이지별 1회 dismiss.
// 지도(MapIntroModal)와 동일한 톤. 아이콘은 이모지로 받아 가볍게.

import { useEffect, useState } from "react";
import { X } from "lucide-react";

export interface PageIntroItem {
  emoji: string;
  text: React.ReactNode;
}

export default function PageIntroModal({
  storageKey,
  badge,
  title,
  headerEmoji,
  items,
  buttonLabel = "시작하기 🐾",
  accent = "var(--color-primary)",
  accentDark = "var(--color-primary-dark)",
  headerBg = "linear-gradient(160deg, #EEF5FF 0%, #E3EEFC 100%)",
}: {
  storageKey: string;
  badge: string;
  title: string;
  headerEmoji: string;
  items: PageIntroItem[];
  buttonLabel?: string;
  accent?: string;
  accentDark?: string;
  headerBg?: string;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(storageKey)) {
        const t = setTimeout(() => setShow(true), 450);
        return () => clearTimeout(t);
      }
    } catch {
      setShow(true);
    }
  }, [storageKey]);

  const close = () => {
    try { localStorage.setItem(storageKey, "1"); } catch { /* ignore */ }
    setShow(false);
  };

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-5"
      style={{ background: "rgba(15,20,30,0.55)", backdropFilter: "blur(2px)" }}
      onClick={close}
    >
      <div
        className="relative w-full max-w-sm rounded-[26px] overflow-hidden"
        style={{ background: "#fff", boxShadow: "0 20px 50px rgba(0,0,0,0.3)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-4 text-center" style={{ background: headerBg }}>
          <div
            className="w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-3 text-[28px]"
            style={{ background: "rgba(255,255,255,0.7)" }}
          >
            {headerEmoji}
          </div>
          <p className="text-[10px] font-extrabold tracking-[0.15em] mb-1" style={{ color: accentDark }}>
            {badge}
          </p>
          <h2 className="text-[17px] font-extrabold text-text-main tracking-tight text-balance">
            {title}
          </h2>
        </div>

        <div className="px-6 py-5">
          <div className="flex flex-col gap-3">
            {items.map((it, i) => (
              <div key={i} className="flex gap-3">
                <span className="text-[18px] shrink-0 leading-tight">{it.emoji}</span>
                <p className="text-[12.5px] leading-[1.65] text-text-sub">{it.text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="px-6 pb-6">
          <button
            onClick={close}
            className="w-full py-3 rounded-2xl text-[14px] font-extrabold text-white active:scale-[0.98] transition-transform"
            style={{ background: `linear-gradient(135deg, ${accent} 0%, ${accentDark} 100%)` }}
          >
            {buttonLabel}
          </button>
        </div>

        <button
          onClick={close}
          className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center active:scale-90"
          style={{ background: "rgba(255,255,255,0.6)" }}
          aria-label="닫기"
        >
          <X size={16} className="text-text-sub" />
        </button>
      </div>
    </div>
  );
}
