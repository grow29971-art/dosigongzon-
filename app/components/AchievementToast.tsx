"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

export interface ToastData {
  id: string;
  kind: "level_up" | "title_unlock";
  emoji: string;
  title: string;
  subtitle: string;
  color: string;
}

/**
 * 레벨업 / 새 업적 잠금 해제 토스트.
 * 여러 개 연속으로 나오면 순차 표시.
 */
export default function AchievementToast({
  toasts,
  onDismiss,
}: {
  toasts: ToastData[];
  onDismiss: (id: string) => void;
}) {
  const current = toasts[0];

  // 자동 닫힘
  useEffect(() => {
    if (!current) return;
    const t = setTimeout(() => onDismiss(current.id), 5000);
    return () => clearTimeout(t);
  }, [current, onDismiss]);

  // 마운트 애니메이션용
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (current) {
      const t = setTimeout(() => setVisible(true), 50);
      return () => clearTimeout(t);
    } else {
      setVisible(false);
    }
  }, [current]);

  if (!current) return null;

  return (
    <div
      className="fixed top-4 left-1/2 z-[180] pointer-events-none"
      style={{
        transform: `translate(-50%, ${visible ? "0" : "-120%"})`,
        transition: "transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)",
        width: "calc(100% - 2rem)",
        maxWidth: 380,
      }}
    >
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-auto rounded-2xl overflow-hidden flex items-center gap-3 px-4 py-3"
        style={{
          background: "#FFFFFF",
          boxShadow: `0 10px 30px ${current.color}35, 0 2px 8px rgba(0,0,0,0.1)`,
          border: `2px solid ${current.color}`,
        }}
      >
        <div
          className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 text-[22px]"
          style={{
            background: `linear-gradient(135deg, ${current.color} 0%, ${current.color}DD 100%)`,
            boxShadow: `0 4px 14px ${current.color}55`,
          }}
        >
          {current.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <p
            className="text-[10px] font-extrabold tracking-[0.12em]"
            style={{ color: current.color }}
          >
            {current.kind === "level_up" ? "LEVEL UP" : "UNLOCKED"}
          </p>
          <p className="text-[13.5px] font-extrabold text-text-main leading-tight tracking-tight mt-0.5">
            {current.title}
          </p>
          <p className="text-[11px] font-semibold text-text-sub mt-0.5 leading-tight truncate">
            {current.subtitle}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onDismiss(current.id)}
          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 active:scale-90"
          style={{ background: "#F5F0EB" }}
          aria-label="닫기"
        >
          <X size={13} style={{ color: "#A38E7A" }} />
        </button>
      </div>
    </div>
  );
}
