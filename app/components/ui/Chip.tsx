"use client";

// 공존 디자인 시스템 — 칩 (2026-08-15, B8)
// 사각 시그니처 필터/토글 칩. 화면별 인라인 재구현 금지 — 칩은 전부 이걸로.
// 비활성: 화이트 + 헤어라인 / 활성: 채움(기본 테라코타, 의미색 필터는 activeColor).
// floating: 지도 위처럼 떠 있는 칩 — 반투명 화이트 + raised 그림자.

import type { ButtonHTMLAttributes, ReactNode } from "react";

interface UIChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  activeColor?: string;
  floating?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}

export default function UIChip({
  active = false,
  activeColor,
  floating = false,
  icon,
  children,
  style,
  className = "",
  ...rest
}: UIChipProps) {
  const fill = activeColor || "var(--color-primary)";
  return (
    <button
      type="button"
      className={`press inline-flex items-center gap-1 shrink-0 font-semibold chip-square transition-colors ${className}`}
      style={{
        height: 32,
        padding: "0 12px",
        fontSize: 13,
        background: active ? fill : floating ? "rgba(255,255,255,0.95)" : "var(--color-surface)",
        color: active ? "#fff" : "var(--color-gray-600)",
        border: `1px solid ${active ? fill : "var(--color-border)"}`,
        boxShadow: floating ? "var(--shadow-raised)" : "none",
        ...(floating ? { backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" } : {}),
        ...style,
      }}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
