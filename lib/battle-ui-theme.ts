// 배틀/카드/가방/도감/상점/랭킹 페이지 공용 디자인 토큰.
// 컨셉: "귀여운 사이버펑크 + 포켓몬고" — 거의 검정에 가까운 배경 위에
// 은은한 그리드/스캔라인, 네온 핑크·시안 포인트가 강하게 발광. 다만
// 사이버펑크 특유의 각진 느낌 대신 둥근 모서리·부드러운 카드 모양은
// 그대로 유지해서 "귀엽고 밝은" 느낌을 살림(포켓몬고의 친근한 카드 UI).

import type { CSSProperties } from "react";

export const UI = {
  // 배경 — 거의 검정
  bg: "#0A0A14",
  bgGradient: "radial-gradient(ellipse at 50% 0%, #170F24 0%, #0A0A14 55%)",
  // 그리드/스캔라인 오버레이 — 배경 위에 겹쳐서 쓰는 CSS backgroundImage.
  // gridOverlayStyle()로 style 객체째 가져다 쓰면 됨.

  // 카드/패널 — 어두운 유리질 배경 + 네온 테두리 옵션
  panel: "#12101E",
  panelAlt: "#171426",
  panelBorder: "rgba(255,255,255,0.08)",
  panelBorderStrong: "rgba(255,255,255,0.14)",
  radius: 18,
  radiusSm: 14,

  // 텍스트
  textMain: "#F5F0FF",
  textSub: "#A79FC4",
  textMuted: "#6B6485",

  // 포인트 컬러 — 네온 핑크·시안이 메인, 나머지는 상태/컨텍스트별 보조
  accent: {
    pink: "#FF2E9A",   // 메인 포인트 — 선택/강조
    cyan: "#00F0FF",   // 서브 포인트 — 보조 강조, 정보성
    violet: "#B14AFF",
    blue: "#4C9AFF",
    green: "#34D399",
    orange: "#F5A855",
    red: "#FF4D6A",
    gold: "#FFC93C",
  },
} as const;

export type AccentKey = keyof typeof UI.accent;

// 배경에 겹치는 은은한 그리드 패턴 — 사이버펑크 HUD 느낌의 핵심 텍스처.
// 카드 자체 모서리는 둥글게 유지하니 배경만 각진 그리드로 대비를 줌.
export function gridOverlayStyle(): CSSProperties {
  return {
    backgroundImage:
      "linear-gradient(rgba(255,46,154,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0,240,255,0.05) 1px, transparent 1px)",
    backgroundSize: "28px 28px",
  };
}

// 페이지 루트에 바로 쓰는 배경 — 그라디언트 + 그리드를 한 번에 합쳐서
// background-image 한 속성으로 반환(레이어 순서: 그리드가 위, 그라디언트가 아래).
export function pageBgStyle(): CSSProperties {
  return {
    backgroundImage: `linear-gradient(rgba(255,46,154,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0,240,255,0.05) 1px, transparent 1px), ${UI.bgGradient}`,
    backgroundSize: "28px 28px, 28px 28px, 100% 100%",
  };
}

// 카드(패널) 공통 스타일 — 어두운 유리질 배경 + 얇은 테두리
export function panelStyle(opts?: { border?: string; glow?: string }): CSSProperties {
  return {
    background: UI.panel,
    borderRadius: UI.radius,
    boxShadow: `inset 0 0 0 1px ${opts?.border ?? UI.panelBorder}${opts?.glow ? `, ${opts.glow}` : ""}`,
  };
}

// 네온 발광 테두리 — 선택/강조 상태에 쓰는 강한 글로우(사이버펑크 시그니처).
export function neonGlowStyle(color: string, strength: "soft" | "strong" = "soft"): CSSProperties {
  return strength === "strong"
    ? { boxShadow: `inset 0 0 0 1.5px ${color}, 0 0 16px ${color}90, 0 0 32px ${color}40` }
    : { boxShadow: `inset 0 0 0 1.5px ${color}, 0 0 10px ${color}55` };
}

// 상태 배지(점 + 텍스트) — 네온 발광 점 + 텍스트 필
export function statusPillStyle(color: string): CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", gap: 5,
    padding: "3px 9px", borderRadius: 999,
    background: `${color}22`, color,
    boxShadow: `inset 0 0 0 1px ${color}55`,
    fontSize: 10.5, fontWeight: 800,
  };
}

// 아이콘 배지(둥근 사각형 + 컬러 틴트 배경) — 귀여운 느낌 유지 위해 넉넉히 둥글게
export function iconBadgeStyle(color: string, size = 40): CSSProperties {
  return {
    width: size, height: size, borderRadius: size * 0.4,
    background: `${color}22`,
    boxShadow: `inset 0 0 0 1px ${color}55`,
    display: "flex", alignItems: "center", justifyContent: "center",
  };
}

// 진행 바(트랙 + 컬러 채움) — 네온 글로우가 도는 채움
export function progressTrackStyle(): CSSProperties {
  return { height: 5, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" };
}
export function progressFillStyle(color: string, pct: number): CSSProperties {
  return {
    height: "100%", width: `${Math.max(0, Math.min(100, pct))}%`, background: color, borderRadius: 999,
    boxShadow: `0 0 8px ${color}`,
  };
}
