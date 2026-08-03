// catch 도감 UI 토큰 — 냥줍 go-ui-theme(NDS 라이트) + arcade-theme 필요분 통합 이식
// (2026-08-04 P3). city 전역 디자인을 건드리지 않고 /catch 하위 화면만 이 토큰을 쓴다.
//
// 냥줍 대비 변경: Rajdhani 숫자 폰트 미도입(city 레이아웃에 폰트 변수가 없어
// tabular-nums로 대체), 사용하지 않는 헬퍼(스위치·CTA·리스트 행 등)는 이식 생략.
//
// ── 원본의 법적 차별화 규칙 계승 ──
// 장르 공통 문법(도감 넘버·미획득 실루엣·등급 칩)만 사용, 특정 IP 화면 구성 모방 금지.
// 원형 배지 대신 스쿼클(38%)·사선 컷(-12°), 빨강-하양 콤비 금지(블루·골드 축).

import type { CSSProperties } from "react";

export const UI = {
  // 배경 — 뉴트럴 그레이 (콘텐츠 카드가 떠 보이는 캔버스)
  bg: "#F2F4F6",
  bgGradient: "linear-gradient(180deg, #F7F8FA 0%, #F2F4F6 100%)",

  // 카드/패널
  panel: "#FFFFFF",
  panelAlt: "#F2F4F6",
  panelBorder: "rgba(2,32,71,0.06)",
  panelBorderStrong: "rgba(2,32,71,0.12)",

  // 텍스트 3단 위계
  textMain: "#191F28",
  textSub: "#4E5968",
  textMuted: "#8B95A1",

  // 라운드 반경 — 냥줍 go-ui-theme 계승 (P4 배틀 화면이 radius/radiusSm 사용)
  radius: 20,
  radiusSm: 14,

  // 포인트 — 무채색 + 블루 1색 수렴(냥줍 2026-07-20 모노 전환 최종값 그대로)
  accent: {
    pink: "#3182F6",
    cyan: "#4E5968",
    violet: "#4E5968",
    blue: "#3182F6",
    green: "#4E5968",
    orange: "#8B95A1",
    red: "#E5484D",
    gold: "#191F28",
  },

  // 등급 램프 — 어두울수록 희귀 (일반=밝은회색 → 레전드=잉크블랙)
  grade: {
    common: "#B0B8C1",
    uncommon: "#8B95A1",
    rare: "#4E5968",
    legendary: "#191F28",
  },
} as const;

/** 스쿼클 — 원형(50%) 대신 둥근 네모. 아바타·아이콘 배지에 쓴다 */
export const SQUIRCLE = "38%";

/** 페이지 루트 배경 — 밝은 그라데이션 */
export function pageBgStyle(): CSSProperties {
  return { backgroundImage: UI.bgGradient };
}

export function progressTrackStyle(): CSSProperties {
  return { height: 5, borderRadius: 999, background: "rgba(31,58,86,0.10)", overflow: "hidden" };
}
export function progressFillStyle(color: string, pct: number): CSSProperties {
  return {
    height: "100%", width: `${Math.max(0, Math.min(100, pct))}%`,
    background: color, borderRadius: 999,
  };
}

/** 등급별 아케이드 그라디언트 — 명도 램프(밝을수록 일반) */
export const RARITY_GRADIENT: Record<string, string> = {
  common: "linear-gradient(135deg, #B0B8C122, #B0B8C108)",
  uncommon: "linear-gradient(135deg, #8B95A126, #8B95A108)",
  rare: "linear-gradient(135deg, #4E596826, #4E596808)",
  legendary: "linear-gradient(135deg, #191F2833, #191F2808)",
};

/** 도감 넘버 — No.001 형식 (장르 공통 문법) */
export function dexNo(n: number): string {
  return `No.${String(n).padStart(3, "0")}`;
}

/** 게임 숫자 표기 — 고정폭 숫자로 계기판 느낌 (전용 폰트 미도입) */
export const numFontStyle: CSSProperties = {
  fontVariantNumeric: "tabular-nums",
  fontWeight: 800,
  letterSpacing: "0.02em",
};

/** 사선 컷 배너 — 섹션 헤더/등급 리본용 아케이드 시그니처 */
export function slashBannerStyle(color: string): CSSProperties {
  return {
    background: `linear-gradient(100deg, ${color}26 0%, ${color}10 70%, transparent 100%)`,
    clipPath: "polygon(0 0, 100% 0, calc(100% - 14px) 100%, 0 100%)",
    boxShadow: `inset 3px 0 0 ${color}`,
  };
}

/** 타입/등급 칩 — 굵은 아웃라인 + 라운드 사각 (원형 배지 금지) */
export function arcadeChipStyle(color: string): CSSProperties {
  return {
    background: `${color}1A`,
    color,
    borderRadius: 10,
    boxShadow: `inset 0 0 0 1.5px ${color}`,
    textShadow: "none",
  };
}

/** 미획득 실루엣 필터 — 우리 종 아트를 어둡게 (타사 실루엣 모방 아님) */
export const silhouetteStyle: CSSProperties = {
  filter: "brightness(0.22) saturate(0.3) contrast(0.9)",
  opacity: 0.85,
};

// ── P4 배틀·랭킹 화면 추가분 (냥줍 go-ui-theme 헬퍼 이식, 2026-08-04) ──

/** 아이콘 배지 — 스쿼클 + 컬러 틴트 배경 */
export function iconBadgeStyle(color: string, size = 40): CSSProperties {
  return {
    width: size, height: size, borderRadius: SQUIRCLE,
    background: `${color}14`,
    boxShadow: `inset 0 0 0 1px ${color}44`,
    display: "flex", alignItems: "center", justifyContent: "center",
  };
}

/** 풀폭 CTA 버튼 — 화면 하단 주 행동 */
export function ctaStyle(color: string = UI.accent.blue): CSSProperties {
  return {
    width: "100%", padding: "15px 0", borderRadius: 14,
    background: color, color: "#FFFFFF", fontWeight: 800, fontSize: 15,
    boxShadow: `0 4px 14px ${color}40`,
  };
}

/** 라이트 테마 — 네온 그리드 대신 민무늬 (냥줍 배틀 페이지 호출부 호환용 빈 스타일) */
export function gridOverlayStyle(): CSSProperties {
  return {};
}
