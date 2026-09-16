"use client";

import { useEffect, useState } from "react";
import { X, Share2, Check, Trophy, TrendingUp } from "lucide-react";

export interface ToastData {
  id: string;
  kind: "level_up" | "title_unlock";
  /** 호출처(HomeAuthed) 호환용 — 리디자인(2026-09-16)으로 화면에는 그리지 않는다 */
  emoji: string;
  title: string;
  subtitle: string;
  /** 호출처 호환용 — 리디자인으로 색 테두리·틴트 폐지, 화면에는 쓰지 않는다 */
  color: string;
}

// 컨페티 조각 색 — 의미색 토큰만 (이모지 조각 폐지)
const CONFETTI_COLORS = [
  "var(--color-primary)",
  "var(--color-care)",
  "var(--color-sage)",
  "var(--color-like)",
  "var(--color-warning)",
];

/**
 * 레벨업 / 새 업적 잠금 해제 토스트 — 달성 "모먼트".
 * 컨페티 + 햅틱 + 자랑하기(공유). 여러 개면 순차 표시.
 * ssr:false로 동적 import되므로 Math.random/navigator 사용 안전.
 */
export default function AchievementToast({
  toasts,
  onDismiss,
}: {
  toasts: ToastData[];
  onDismiss: (id: string) => void;
}) {
  const current = toasts[0];

  const [visible, setVisible] = useState(false);
  const [confetti, setConfetti] = useState(false);
  const [copied, setCopied] = useState(false);

  // 자동 닫힘 (자랑 여유 위해 6초)
  useEffect(() => {
    if (!current) return;
    const t = setTimeout(() => onDismiss(current.id), 6000);
    return () => clearTimeout(t);
  }, [current, onDismiss]);

  // 등장 애니메이션 + 컨페티 + 햅틱
  useEffect(() => {
    if (!current) {
      setVisible(false);
      return;
    }
    setCopied(false);
    const t1 = setTimeout(() => setVisible(true), 50);
    setConfetti(true);
    const t2 = setTimeout(() => setConfetti(false), 1300);
    try { navigator.vibrate?.([12, 40, 18]); } catch { /* 햅틱 미지원 */ }
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [current]);

  if (!current) return null;

  const share = async () => {
    const text =
      current.kind === "level_up"
        ? `🎉 도시공존에서 ${current.title} 달성! 우리 동네 길고양이 돌보는 중 🐾`
        : `🏆 도시공존 '${current.title}' 업적을 해제했어요! 🐾`;
    const url = "https://dosigongzon.com";
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: "도시공존", text, url });
      } else {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch {
      /* 사용자 취소 등 — 무시 */
    }
  };

  const Icon = current.kind === "level_up" ? TrendingUp : Trophy;

  return (
    <div
      className="fixed top-4 left-1/2 z-[180] pointer-events-none"
      style={{
        transform: `translate(-50%, ${visible ? "0" : "-120%"})`,
        transition: "transform var(--motion-spring)",
        width: "calc(100% - 2rem)",
        maxWidth: 380,
      }}
    >
      {/* 컨페티 레이어 — 의미색 사각 조각 */}
      {confetti && (
        <div className="absolute inset-x-0 top-0 h-0 overflow-visible pointer-events-none" aria-hidden>
          {Array.from({ length: 18 }).map((_, i) => (
            <span
              key={`${current.id}-${i}`}
              className="confetti-piece absolute"
              style={{
                left: `${6 + Math.random() * 88}%`,
                top: 0,
                width: 6,
                height: 10,
                borderRadius: 2,
                background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                animationDelay: `${Math.random() * 0.25}s`,
              }}
            />
          ))}
        </div>
      )}

      <div
        role="status"
        aria-live="polite"
        className="pointer-events-auto overflow-hidden flex items-center gap-3 px-4 py-3"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-card)",
          boxShadow: "var(--shadow-raised)",
        }}
      >
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
          style={{ background: "var(--color-gray-100)", color: "var(--color-primary)" }}
        >
          <Icon size={22} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold tracking-[0.12em]" style={{ color: "var(--color-primary)" }}>
            {current.kind === "level_up" ? "LEVEL UP" : "UNLOCKED"}
          </p>
          <p className="text-[15px] font-bold text-text-main leading-tight tracking-tight mt-0.5">
            {current.title}
          </p>
          <p className="text-[11px] font-medium text-text-sub mt-0.5 leading-tight truncate">
            {current.subtitle}
          </p>
        </div>
        {/* 자랑하기 */}
        <button
          type="button"
          onClick={share}
          className="h-8 px-2.5 flex items-center gap-1 shrink-0 press-strong"
          style={{
            background: "var(--color-primary)",
            color: "var(--color-surface)",
            borderRadius: "var(--radius-input)",
          }}
          aria-label="자랑하기"
        >
          {copied ? <Check size={13} /> : <Share2 size={13} />}
          <span className="text-[11px] font-semibold">{copied ? "복사됨" : "자랑"}</span>
        </button>
        <button
          type="button"
          onClick={() => onDismiss(current.id)}
          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 press-strong text-text-sub"
          style={{ background: "var(--color-gray-100)" }}
          aria-label="닫기"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
}
