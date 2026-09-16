"use client";

// 공존 디자인 시스템 — 스퀘어 토글 (2026-07-15 → 2026-09-16 「익숙한 동네앱」 리디자인)
// 트랙 gray-300 / 켜짐 primary, 노브 흰색 6px 라운드 사각(radius-square-sm). 그림자 없음.

interface SquareToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  size?: "sm" | "md";
  /** 켜짐 색 (기본 primary) */
  color?: string;
  "aria-label"?: string;
}

export default function SquareToggle({
  checked,
  onChange,
  disabled = false,
  size = "md",
  color = "var(--color-primary)",
  ...rest
}: SquareToggleProps) {
  const dims =
    size === "sm"
      ? { w: 40, h: 24, knob: 18, pad: 3 }
      : { w: 48, h: 28, knob: 22, pad: 3 };
  const travel = dims.w - dims.knob - dims.pad * 2;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className="relative shrink-0 transition-colors press-strong disabled:opacity-40"
      style={{
        width: dims.w,
        height: dims.h,
        borderRadius: "var(--radius-square-lg)",
        background: checked ? color : "var(--color-gray-300)",
        transition: "background 0.18s ease",
      }}
      {...rest}
    >
      <span
        className="absolute top-1/2"
        style={{
          width: dims.knob,
          height: dims.knob,
          left: dims.pad,
          transform: `translate(${checked ? travel : 0}px, -50%)`,
          borderRadius: "var(--radius-square-sm)",
          background: "var(--color-surface)",
          transition: "transform 0.18s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      />
    </button>
  );
}
