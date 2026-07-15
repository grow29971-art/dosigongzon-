"use client";

// 공존 디자인 시스템 — 버튼 (2026-07-15)
// 토스식 절제된 버튼 문법: 채움(primary) / 옅은 채움(weak) / 회색(neutral) / 텍스트(text).
// 프레스 피드백은 공용 .press 유틸. 라운드는 radius-input(14px) — pill 금지(시그니처).

import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "weak" | "neutral" | "text" | "danger";
type Size = "lg" | "md" | "sm";

interface UIButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  full?: boolean;
  children: ReactNode;
}

const VARIANT_STYLE: Record<Variant, React.CSSProperties> = {
  primary: { background: "var(--color-primary)", color: "#fff" },
  weak: { background: "var(--color-primary-soft)", color: "var(--color-primary-dark)" },
  neutral: { background: "var(--color-surface-alt)", color: "var(--color-text-sub)" },
  text: { background: "transparent", color: "var(--color-primary-dark)" },
  danger: { background: "rgba(240,68,82,0.08)", color: "var(--color-error)" },
};

const SIZE_STYLE: Record<Size, React.CSSProperties> = {
  lg: { height: 52, padding: "0 20px", fontSize: 16, borderRadius: "var(--radius-input)" },
  md: { height: 44, padding: "0 16px", fontSize: 14, borderRadius: "var(--radius-input)" },
  sm: { height: 34, padding: "0 12px", fontSize: 13, borderRadius: "var(--radius-square-lg)" },
};

export default function UIButton({
  variant = "primary",
  size = "md",
  full = false,
  children,
  style,
  className = "",
  ...rest
}: UIButtonProps) {
  return (
    <button
      type="button"
      className={`press inline-flex items-center justify-center gap-1.5 font-bold disabled:opacity-40 ${full ? "w-full" : ""} ${className}`}
      style={{ ...VARIANT_STYLE[variant], ...SIZE_STYLE[size], ...style }}
      {...rest}
    >
      {children}
    </button>
  );
}
