"use client";

// 공존 디자인 시스템 — 시그니처 스퀘어 토글 (2026-07-15)
// 토스풍 클린 토글을 따르되, 노브를 '원형 대신 라운드 사각'으로 → 트레이드드레스 차별화.
// 트랙도 완전한 pill이 아니라 라운드 사각(radius-square-lg).

interface SquareToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  size?: "sm" | "md";
  /** 켜짐 색 (기본 공존 블루) */
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
      className="relative shrink-0 transition-colors active:scale-95 disabled:opacity-40"
      style={{
        width: dims.w,
        height: dims.h,
        borderRadius: "var(--radius-square-lg)",
        background: checked ? color : "var(--color-border)",
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
          borderRadius: "var(--radius-square-sm)", // 원형이 아니라 라운드 사각 (시그니처)
          background: "#fff",
          boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
          transition: "transform 0.18s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      />
    </button>
  );
}
