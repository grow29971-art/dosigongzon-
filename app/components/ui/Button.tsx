"use client";

// 공존 디자인 시스템 — 버튼 (2026-07-15 → 2026-09-16 「익숙한 동네앱」 리디자인)
// 당근·토스 문법: primary(테라코타 채움·흰 글자) / secondary(gray-100 채움·text-main, neutral 별칭) /
// weak·text(테두리·배경 없이 글자만) / danger(의미색). 그림자·그라디언트 없음, 라운드 8px(radius-input).
// 프레스 피드백은 공용 .press 유틸.

import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "weak" | "neutral" | "text" | "danger";
type Size = "lg" | "md" | "sm";

interface UIButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  full?: boolean;
  children: ReactNode;
}

const VARIANT_STYLE: Record<Variant, React.CSSProperties> = {
  primary: { background: "var(--color-primary)", color: "var(--color-surface)" },
  secondary: { background: "var(--color-gray-100)", color: "var(--color-text-main)" },
  neutral: { background: "var(--color-gray-100)", color: "var(--color-text-main)" },
  weak: { background: "transparent", color: "var(--color-primary)" },
  text: { background: "transparent", color: "var(--color-text-sub)" },
  danger: { background: "var(--color-error-soft)", color: "var(--color-error)" },
};

const SIZE_STYLE: Record<Size, React.CSSProperties> = {
  lg: { height: 48, padding: "0 20px", fontSize: 16 },
  md: { height: 40, padding: "0 16px", fontSize: 15 },
  sm: { height: 32, padding: "0 12px", fontSize: 13 },
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
      className={`press inline-flex items-center justify-center gap-1.5 font-semibold disabled:opacity-40 ${full ? "w-full" : ""} ${className}`}
      style={{
        borderRadius: "var(--radius-input)",
        border: "none",
        boxShadow: "none",
        ...VARIANT_STYLE[variant],
        ...SIZE_STYLE[size],
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
