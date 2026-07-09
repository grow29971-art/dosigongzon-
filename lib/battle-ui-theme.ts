// 배틀/카드/가방/도감/상점/랭킹 페이지 공용 디자인 토큰.
// 참고: 사용자가 준 "Orchestra AI" 스타일 대시보드 스크린샷 — 짙은 배경 +
// 얇은 테두리 카드 + 컬러 포인트 배지 + 은은한 글로우. 판타지 톤(그라디언트
// 범벅, 두꺼운 발광 테두리) 대신 플랫하고 깔끔한 SaaS 대시보드 느낌.

import type { CSSProperties } from "react";

export const UI = {
  // 배경 — 거의 검정에 가까운 톤, 미세한 그라디언트만
  bg: "#0A0A0F",
  bgGradient: "radial-gradient(ellipse at 50% 0%, #12121A 0%, #0A0A0F 55%)",

  // 카드/패널 — 얇은 저채도 테두리 + 살짝 밝은 배경
  panel: "#12121B",
  panelAlt: "#161620",
  panelBorder: "rgba(255,255,255,0.08)",
  panelBorderStrong: "rgba(255,255,255,0.14)",
  radius: 14,
  radiusSm: 10,

  // 텍스트
  textMain: "#F2F2F7",
  textSub: "#9A9AAC",
  textMuted: "#5C5C6E",

  // 포인트 컬러 — 워크플로우 노드 색상처럼 컨텍스트별로 로테이션
  accent: {
    violet: "#8B7CF6",
    blue: "#4C9AFF",
    cyan: "#4FC3E8",
    green: "#34D399",
    orange: "#F5A855",
    pink: "#F472B6",
    red: "#F16A6A",
    gold: "#E8B040",
  },
} as const;

export type AccentKey = keyof typeof UI.accent;

// 카드(패널) 공통 스타일 — 얇은 테두리 + 살짝 뜬 배경
export function panelStyle(opts?: { border?: string; glow?: string }): CSSProperties {
  return {
    background: UI.panel,
    borderRadius: UI.radius,
    boxShadow: `inset 0 0 0 1px ${opts?.border ?? UI.panelBorder}${opts?.glow ? `, ${opts.glow}` : ""}`,
  };
}

// 상태 배지(점 + 텍스트) — "RUNNING" 초록 점 배지 같은 스타일
export function statusPillStyle(color: string): CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", gap: 5,
    padding: "3px 9px", borderRadius: 999,
    background: `${color}1A`, color,
    fontSize: 10.5, fontWeight: 800,
  };
}

// 아이콘 배지(둥근 사각형 + 컬러 틴트 배경) — 워크플로우 노드 아이콘 스타일
export function iconBadgeStyle(color: string, size = 40): CSSProperties {
  return {
    width: size, height: size, borderRadius: size * 0.32,
    background: `${color}1F`,
    boxShadow: `inset 0 0 0 1px ${color}40`,
    display: "flex", alignItems: "center", justifyContent: "center",
  };
}

// 진행 바(트랙 + 컬러 채움) — 토큰/코스트/레이턴시 바 스타일
export function progressTrackStyle(): CSSProperties {
  return { height: 4, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" };
}
export function progressFillStyle(color: string, pct: number): CSSProperties {
  return { height: "100%", width: `${Math.max(0, Math.min(100, pct))}%`, background: color, borderRadius: 999 };
}
