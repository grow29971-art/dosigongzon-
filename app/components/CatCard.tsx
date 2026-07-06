"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export type CardRarity = "common" | "uncommon" | "rare" | "legendary";

export interface CatCardData {
  card_rarity: CardRarity | string | null;
  card_name: string | null;
  card_traits: string[] | null;
  card_stats: { cuteness: number; wildness: number; sociability: number; mysteriousness: number } | null;
  card_flavor: string | null;
  card_generated_at?: string | null;
  card_level?: number | null;
  card_exp?: number | null;
}

interface CatCardProps {
  name: string;
  photoUrl: string | null;
  card: CatCardData;
  size?: "sm" | "md" | "lg";
  onClick?: () => void;
}

// 속성별 배지 클립 경로 (원형 대신 타입 고유 실루엣)
const BADGE_CLIP = {
  hexagon: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
  droplet: "", // 별도 border-radius+rotate 처리
  bolt: "polygon(60% 0%, 20% 55%, 45% 55%, 35% 100%, 85% 40%, 55% 40%)",
  star: "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)",
} as const;

// 속성별 구획선(사진↔도감 스트립 사이) 클립 경로 — 잎맥/파도/번개/불꽃 실루엣
const DIVIDER_CLIP = {
  grass: "polygon(0% 100%, 0% 55%, 7% 5%, 14% 55%, 21% 5%, 29% 55%, 36% 5%, 43% 55%, 50% 5%, 57% 55%, 64% 5%, 71% 55%, 79% 5%, 86% 55%, 93% 5%, 100% 55%, 100% 100%)",
  water: "polygon(0% 100%, 0% 60%, 6% 35%, 12% 15%, 18% 10%, 24% 20%, 30% 45%, 36% 70%, 42% 85%, 48% 90%, 54% 80%, 60% 55%, 66% 30%, 72% 15%, 78% 10%, 84% 22%, 90% 48%, 96% 72%, 100% 85%, 100% 100%)",
  electric: "polygon(0% 100%, 0% 30%, 10% 65%, 22% 5%, 34% 75%, 46% 15%, 58% 85%, 68% 25%, 80% 70%, 90% 10%, 100% 50%, 100% 100%)",
  fire: "polygon(0% 100%, 0% 45%, 6% 75%, 13% 0%, 22% 60%, 30% 20%, 40% 70%, 50% 5%, 62% 65%, 72% 25%, 82% 75%, 90% 15%, 100% 55%, 100% 100%)",
} as const;

export const CARD_THEME = {
  common: {
    bg: "linear-gradient(155deg, #82CC5E 0%, #5AA040 42%, #3E7A2A 75%, #2E5E1E 100%)",
    frameOuter: "#2E5A20",
    frameInner: "#B8FF8C",
    topBar: "rgba(0,0,0,0.28)",
    panelBg: "rgba(0,0,0,0.24)",
    hpColor: "#D8FFB0",
    typeIcon: "🌿",
    typeBg: "#3A7028",
    accent: "#AAEE66",
    glow: "0 0 12px rgba(120,220,70,0.40)",
    label: "일반",
    rarity: "◆",
    weak: "🔥",
    holo: "sheen",
    sparkle: "none",
    nameFill: false,
    typeKey: "grass",
    badgeShape: "hexagon" as const,
    radiusMult: 1,
  },
  uncommon: {
    bg: "linear-gradient(155deg, #6EC0FF 0%, #3488E0 42%, #1C5CBC 75%, #123E88 100%)",
    frameOuter: "#153E78",
    frameInner: "#B8E4FF",
    topBar: "rgba(0,0,0,0.28)",
    panelBg: "rgba(0,0,0,0.24)",
    hpColor: "#C8E8FF",
    typeIcon: "💧",
    typeBg: "#1E56A0",
    accent: "#80CCFF",
    glow: "0 0 16px rgba(70,150,255,0.50)",
    label: "희귀",
    rarity: "◆◆",
    weak: "⚡",
    holo: "cool",
    sparkle: "none",
    nameFill: false,
    typeKey: "water",
    badgeShape: "droplet" as const,
    radiusMult: 1.3,
  },
  rare: {
    bg: "linear-gradient(155deg, #D0A0FF 0%, #9C58EC 38%, #7028C8 70%, #4C1690 100%)",
    frameOuter: "#3C1478",
    frameInner: "#F0D8FF",
    topBar: "rgba(0,0,0,0.32)",
    panelBg: "rgba(0,0,0,0.28)",
    hpColor: "#F0DCFF",
    typeIcon: "⚡",
    typeBg: "#5C24B0",
    accent: "#E0B8FF",
    glow: "0 0 26px rgba(180,90,255,0.65), 0 0 50px rgba(180,90,255,0.28)",
    label: "레어",
    rarity: "◆◆◆",
    weak: "🌿",
    holo: "prism",
    sparkle: "sparse",
    nameFill: true,
    typeKey: "electric",
    badgeShape: "bolt" as const,
    radiusMult: 0.55,
  },
  legendary: {
    bg: "linear-gradient(155deg, #FFEA98 0%, #FFB730 30%, #F08010 55%, #C05A00 80%, #FFEA98 100%)",
    frameOuter: "#8A4E00",
    frameInner: "#FFF6D0",
    topBar: "rgba(0,0,0,0.24)",
    panelBg: "rgba(0,0,0,0.20)",
    hpColor: "#FFF9C8",
    typeIcon: "🔥",
    typeBg: "#9A5800",
    accent: "#FFE680",
    glow: "0 0 32px rgba(255,190,20,0.85), 0 0 64px rgba(255,150,0,0.40)",
    label: "레전드",
    rarity: "◆◆◆◆",
    weak: "💧",
    holo: "rainbow",
    sparkle: "dense",
    nameFill: true,
    typeKey: "fire",
    badgeShape: "star" as const,
    radiusMult: 1,
  },
};

const MOVE_ICONS = ["⚡", "🌿", "💧", "🔥", "✨", "🌙", "☀️", "❄️"];
function pickIcon(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return MOVE_ICONS[h % MOVE_ICONS.length];
}
export function pseudoDexNo(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 37 + seed.charCodeAt(i)) >>> 0;
  return String((h % 220) + 1).padStart(3, "0");
}

function CardFace({ name, photoUrl, card, size }: Omit<CatCardProps, "onClick"> & { size: "sm" | "md" | "lg" }) {
  const rarity = (card.card_rarity ?? "common") as CardRarity;
  const cfg = CARD_THEME[rarity] ?? CARD_THEME.common;
  const isSm = size === "sm";
  const isLg = size === "lg";

  const lv = Math.max(1, Math.min(10, card.card_level ?? 1));
  const lvBonus = lv - 1;

  const hp = card.card_stats
    ? Math.round(card.card_stats.cuteness * 0.8 + card.card_stats.wildness * 0.4) + 40 + lvBonus * 10
    : 60 + lvBonus * 10;
  const hpDisplay = Math.round(hp / 10) * 10;

  const traits = card.card_traits ?? [];
  const move1 = traits[0] ?? "야생의 눈빛";
  const move2 = traits[1] ?? "부드러운 발걸음";
  const move1Power = (card.card_stats ? Math.round(card.card_stats.wildness * 0.8 + 20) : 40) + lvBonus * 5;
  const move2Power = (card.card_stats ? Math.round(card.card_stats.mysteriousness * 0.5 + 15) : 20) + lvBonus * 3;

  const dexNo = pseudoDexNo(card.card_name ?? name);
  const extraGlow = lv >= 10 ? ", 0 0 55px currentColor" : lv >= 5 ? ", 0 0 26px currentColor" : "";

  // 카드 크기
  const W = isLg ? 300 : isSm ? 130 : 190;
  const photoH = isLg ? 180 : isSm ? 78 : 114;
  const topBarPx = isLg ? 34 : isSm ? 22 : 27;
  const radius = Math.round((isLg ? 20 : isSm ? 13 : 15) * cfg.radiusMult);
  const dividerH = isLg ? 13 : isSm ? 8 : 10;
  const inset = isLg ? 8 : isSm ? 5 : 6;

  const fs = {
    label: isLg ? 9 : isSm ? 7 : 8,
    name: isLg ? 17 : isSm ? 10.5 : 13.5,
    hp: isLg ? 19 : isSm ? 12 : 15,
    flavor: isLg ? 10.5 : 9,
    dex: isLg ? 9 : isSm ? 7 : 8,
    moveName: isLg ? 11.5 : 9,
    movePow: isLg ? 17 : isSm ? 10 : 13,
    bottom: isLg ? 9 : 8,
  };

  return (
    <div
      style={{
        width: W,
        borderRadius: radius,
        border: `${isLg ? 3 : 2}px solid ${cfg.frameOuter}`,
        boxShadow: `${cfg.glow}${extraGlow}, inset 0 0 0 ${isLg ? 5 : 3.5}px ${cfg.accent}33, inset 0 0 0 ${isLg ? 2 : 1.5}px ${cfg.frameInner}77, 0 8px 26px rgba(0,0,0,0.32)`,
        background: `linear-gradient(125deg, rgba(255,255,255,0.28) 0%, transparent 14%, transparent 86%, rgba(255,255,255,0.10) 100%), radial-gradient(circle at 1px 1px, rgba(255,255,255,0.07) 1px, transparent 0), ${cfg.bg}`,
        backgroundSize: "auto, 3px 3px, auto",
        overflow: "hidden",
        flexShrink: 0,
        position: "relative",
        userSelect: "none",
      }}
    >
      {/* 속성 텍스처 (잎맥/물결/스파크/불티 — 등급마다 다른 패턴) */}
      <div className={`type-pattern type-pattern-${cfg.typeKey}`} style={{ borderRadius: radius }} />
      {/* 홀로그램 스윕 (전 등급, 강도 차등) */}
      <div className={`holo-overlay holo-${cfg.holo}`} style={{ borderRadius: radius }} />
      {/* 반짝임 입자 */}
      {cfg.sparkle !== "none" && <div className={`holo-sparkle ${cfg.sparkle === "sparse" ? "holo-sparkle-sparse" : ""}`} style={{ borderRadius: radius }} />}

      {/* ── 상단 바: 등급 + 이름 + HP ── */}
      <div
        style={{
          height: topBarPx,
          background: cfg.topBar,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          paddingInline: isLg ? 11 : 7, gap: 5,
          position: "relative", zIndex: 2,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
          <span style={{
            background: cfg.typeBg, borderRadius: 6,
            padding: isLg ? "2px 6px" : "1px 4px",
            fontSize: fs.label, fontWeight: 800, color: "rgba(255,255,255,0.85)",
            flexShrink: 0, letterSpacing: "0.02em",
          }}>
            {cfg.label}
          </span>
          <span
            className={cfg.nameFill ? "shimmer-text" : undefined}
            style={cfg.nameFill ? {
              fontSize: fs.name, fontWeight: 900, lineHeight: 1.1,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              backgroundImage: `linear-gradient(100deg, #fff 0%, ${cfg.accent} 25%, #fff 50%, ${cfg.accent} 75%, #fff 100%)`,
              WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
              filter: `drop-shadow(0 1px 2px rgba(0,0,0,0.5))`,
            } : {
              fontSize: fs.name, color: "#fff", fontWeight: 900, lineHeight: 1.1,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              textShadow: `0 1px 3px rgba(0,0,0,0.45), 0 0 10px ${cfg.accent}66`,
            }}
          >
            {card.card_name ?? name}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 2, flexShrink: 0 }}>
          <span style={{ fontSize: fs.label - 1, color: "rgba(255,255,255,0.7)", fontWeight: 800 }}>HP</span>
          <span style={{ fontSize: fs.hp, color: cfg.hpColor, fontWeight: 900, lineHeight: 1, textShadow: "0 1px 2px rgba(0,0,0,0.4)" }}>{hpDisplay}</span>
          <span style={{
            marginLeft: 2, position: "relative",
            width: isLg ? 20 : isSm ? 15 : 17, height: isLg ? 20 : isSm ? 15 : 17,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{
              position: "absolute", inset: 0, borderRadius: "50%",
              background: `repeating-conic-gradient(${cfg.accent}99 0deg 12deg, transparent 12deg 30deg)`,
            }} />
            {cfg.badgeShape === "droplet" ? (
              <span style={{
                position: "relative", background: cfg.typeBg,
                width: isLg ? 15 : isSm ? 10.5 : 12.5, height: isLg ? 15 : isSm ? 10.5 : 12.5,
                display: "flex", alignItems: "center", justifyContent: "center",
                border: `1px solid ${cfg.frameInner}bb`,
                borderRadius: "50% 50% 50% 0%", transform: "rotate(-45deg)",
              }}>
                <span style={{ fontSize: isLg ? 9 : 7.5, transform: "rotate(45deg)" }}>{cfg.typeIcon}</span>
              </span>
            ) : (
              <span style={{
                position: "relative", background: cfg.typeBg,
                width: isLg ? 17 : isSm ? 12 : 14, height: isLg ? 17 : isSm ? 12 : 14,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: isLg ? 9 : 7.5, border: `1px solid ${cfg.frameInner}bb`,
                clipPath: BADGE_CLIP[cfg.badgeShape],
              }}>
                {cfg.typeIcon}
              </span>
            )}
          </span>
        </div>
      </div>

      {/* ── 사진 프레임 (액자 스타일) ── */}
      <div style={{ padding: `0 ${isLg ? 8 : isSm ? 5 : 6}px`, position: "relative", zIndex: 2 }}>
        <div style={{
          background: cfg.frameInner, borderRadius: (isLg ? 12 : 9) + 3, padding: isLg ? 3 : 2,
          boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
        }}>
          <div style={{
            height: photoH, overflow: "hidden", position: "relative",
            borderRadius: isLg ? 12 : 9, background: "#1a1a1a",
          }}>
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt={name}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            ) : (
              <div style={{ width: "100%", height: "100%", background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: isSm ? 28 : 42, color: "rgba(255,255,255,0.35)" }}>🐱</div>
            )}
            {/* 속성 워터마크 (사진 프레임 안, 은은하게) */}
            <span style={{
              position: "absolute", right: -6, bottom: -10,
              fontSize: isLg ? 64 : isSm ? 34 : 46,
              opacity: 0.16, filter: "grayscale(0.2)",
              transform: "rotate(-8deg)", pointerEvents: "none",
            }}>
              {cfg.typeIcon}
            </span>
          </div>
        </div>
      </div>

      {/* ── 속성 구획선 (등급마다 다른 실루엣: 잎맥/파도/번개/불꽃) ── */}
      <div style={{
        margin: `${isSm ? 3 : 4}px ${inset}px 0`,
        height: dividerH,
        background: cfg.accent,
        clipPath: DIVIDER_CLIP[cfg.typeKey as keyof typeof DIVIDER_CLIP],
        opacity: 0.65,
        position: "relative", zIndex: 2,
      }} />

      {/* ── 도감 정보 스트립 ── */}
      <div style={{
        margin: `0 ${isLg ? 8 : isSm ? 5 : 6}px 0`,
        background: cfg.panelBg, borderRadius: 5,
        padding: isLg ? "3px 8px" : "2px 6px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "relative", zIndex: 2,
      }}>
        <span style={{ fontSize: fs.dex, color: "rgba(255,255,255,0.6)", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          No.{dexNo} · {name}
        </span>
        <span style={{
          fontSize: fs.dex - 0.5, fontWeight: 900, flexShrink: 0, marginLeft: 4,
          background: lv >= 10 ? "linear-gradient(135deg,#FFD700,#FF8C00)" : "rgba(255,255,255,0.18)",
          color: lv >= 5 ? "#fff" : "rgba(255,255,255,0.75)",
          borderRadius: 99, padding: "1px 5px",
        }}>
          Lv.{lv}
        </span>
      </div>

      {/* ── 카드 본문 (플레이버 + 기술) ── */}
      {!isSm && (
        <div style={{ padding: isLg ? "7px 10px 2px" : "5px 7px 1px", display: "flex", flexDirection: "column", gap: isLg ? 6 : 4, position: "relative", zIndex: 2 }}>
          {card.card_flavor && (
            <p style={{
              fontSize: fs.flavor, color: "rgba(255,255,255,0.72)", fontStyle: "italic",
              lineHeight: 1.35, borderLeft: `2px solid ${cfg.accent}`, paddingLeft: 5,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              &ldquo;{card.card_flavor}&rdquo;
            </p>
          )}

          <div style={{
            background: cfg.panelBg, borderRadius: 6, padding: isLg ? "5px 8px" : "3px 6px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 0 }}>
              <span style={{ fontSize: isLg ? 11 : 9, flexShrink: 0 }}>{pickIcon(move1)}</span>
              <span style={{ fontSize: fs.moveName, color: "#fff", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{move1}</span>
            </div>
            <span style={{ fontSize: fs.movePow, color: cfg.accent, fontWeight: 900, flexShrink: 0, marginLeft: 4 }}>{move1Power}</span>
          </div>

          <div style={{
            background: cfg.panelBg, borderRadius: 6, padding: isLg ? "5px 8px" : "3px 6px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 0 }}>
              <span style={{ fontSize: isLg ? 11 : 9, flexShrink: 0 }}>{pickIcon(move2)}</span>
              <span style={{ fontSize: fs.moveName, color: "rgba(255,255,255,0.82)", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{move2}</span>
            </div>
            <span style={{ fontSize: fs.movePow - 2, color: "rgba(255,255,255,0.68)", fontWeight: 700, flexShrink: 0, marginLeft: 4 }}>{move2Power}</span>
          </div>
        </div>
      )}

      {/* ── 하단 스탯 바 (약점/저항력/후퇴) ── */}
      <div style={{
        display: "flex", alignItems: "center",
        margin: `${isSm ? 4 : 6}px ${isLg ? 8 : isSm ? 5 : 6}px`,
        borderTop: `1px solid ${cfg.frameInner}44`, paddingTop: isSm ? 3 : 5,
        position: "relative", zIndex: 2,
      }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 1 }}>
          <span style={{ fontSize: fs.bottom - 1, color: "rgba(255,255,255,0.4)" }}>약점</span>
          <span style={{ fontSize: fs.bottom + 1 }}>{cfg.weak}<span style={{ fontSize: fs.bottom - 1, color: "rgba(255,255,255,0.5)" }}>×2</span></span>
        </div>
        {!isSm && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
            <span style={{ fontSize: fs.bottom - 1, color: "rgba(255,255,255,0.4)" }}>저항력</span>
            <span style={{ fontSize: fs.bottom, color: "rgba(255,255,255,0.5)" }}>—</span>
          </div>
        )}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1 }}>
          <span style={{ fontSize: fs.bottom - 1, color: "rgba(255,255,255,0.4)" }}>후퇴</span>
          <span className={rarity === "rare" || rarity === "legendary" ? "rarity-glow" : undefined}
            style={{ fontSize: fs.bottom + 1, color: cfg.accent, letterSpacing: 1, textShadow: `0 0 6px ${cfg.accent}` }}>{cfg.rarity}</span>
        </div>
      </div>
    </div>
  );
}

export default function CatCard({ name, photoUrl, card, size = "md", onClick }: CatCardProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const handleClick = () => {
    if (onClick) { onClick(); return; }
    setModalOpen(true);
  };

  const rarity = (card.card_rarity ?? "common") as CardRarity;
  const cfg = CARD_THEME[rarity] ?? CARD_THEME.common;

  return (
    <>
      {/* 인라인 CSS */}
      <style>{`
        @keyframes holo-sweep {
          0%   { background-position: -220% center; }
          100% { background-position: 220% center; }
        }
        .holo-overlay {
          position: absolute; inset: 0; pointer-events: none; z-index: 10;
          background-size: 260% 100%;
          animation: holo-sweep 2.6s ease-in-out infinite;
        }
        .holo-sheen {
          background-image: linear-gradient(105deg,
            transparent 35%,
            rgba(255,255,255,0.22) 48%,
            rgba(255,255,255,0.34) 50%,
            rgba(255,255,255,0.22) 52%,
            transparent 65%
          );
          animation-duration: 3.4s;
        }
        .holo-cool {
          background-image: linear-gradient(105deg,
            transparent 26%,
            rgba(180,140,255,0.18) 40%,
            rgba(255,255,255,0.36) 50%,
            rgba(140,200,255,0.18) 60%,
            transparent 74%
          );
          animation-duration: 2.8s;
        }
        .holo-prism {
          background-image: linear-gradient(105deg,
            transparent 20%,
            rgba(255,150,220,0.24) 34%,
            rgba(200,160,255,0.28) 42%,
            rgba(255,255,255,0.38) 50%,
            rgba(160,200,255,0.28) 58%,
            rgba(220,150,255,0.24) 66%,
            transparent 80%
          );
          animation-duration: 2.3s;
        }
        .holo-rainbow {
          background-image: linear-gradient(105deg,
            transparent 15%,
            rgba(255,140,140,0.26) 28%,
            rgba(255,220,120,0.30) 38%,
            rgba(160,255,180,0.30) 48%,
            rgba(120,200,255,0.30) 58%,
            rgba(220,150,255,0.26) 68%,
            transparent 85%
          );
          animation-duration: 1.9s;
        }
        .holo-sparkle {
          position: absolute; inset: 0; pointer-events: none; z-index: 11;
          background-image:
            radial-gradient(circle, rgba(255,255,255,0.95) 1px, transparent 1.6px),
            radial-gradient(circle, rgba(255,255,255,0.7) 1px, transparent 1.4px);
          background-size: 22px 22px, 34px 34px;
          background-position: 0 0, 12px 18px;
          opacity: 0.32;
          animation: sparkle-drift 7s linear infinite;
        }
        .holo-sparkle-sparse {
          background-size: 34px 34px, 50px 50px;
          opacity: 0.16;
        }
        @keyframes sparkle-drift {
          0%   { background-position: 0 0, 12px 18px; }
          100% { background-position: 60px 90px, 72px 108px; }
        }
        .type-pattern { position: absolute; inset: 0; pointer-events: none; z-index: 1; }
        .type-pattern-grass {
          background-image:
            repeating-linear-gradient(115deg, rgba(255,255,255,0.10) 0 2px, transparent 2px 22px),
            radial-gradient(circle, rgba(255,255,255,0.55) 1px, transparent 1.6px);
          background-size: auto, 26px 26px;
          background-position: 0 0, 6px 10px;
          opacity: 0.5;
          animation: leaf-drift 9s linear infinite;
        }
        @keyframes leaf-drift {
          0%   { background-position: 0 0, 6px 10px; }
          100% { background-position: -40px 30px, 46px 40px; }
        }
        .type-pattern-water {
          background-image: repeating-radial-gradient(circle at 50% 115%, rgba(255,255,255,0.18) 0 2px, transparent 2px 20px);
          background-size: 140% 140%;
          background-position: center bottom;
          opacity: 0.5;
          animation: ripple-pulse 3.2s ease-in-out infinite;
        }
        @keyframes ripple-pulse {
          0%, 100% { background-size: 140% 140%; opacity: 0.5; }
          50%      { background-size: 175% 175%; opacity: 0.26; }
        }
        .type-pattern-electric {
          background-image: repeating-linear-gradient(68deg, rgba(255,255,255,0.24) 0 1.5px, transparent 1.5px 16px);
          opacity: 0.42;
          animation: spark-flicker 1.1s steps(2) infinite;
        }
        @keyframes spark-flicker {
          0%, 100% { opacity: 0.42; }
          50%      { opacity: 0.14; }
        }
        .type-pattern-fire {
          background-image:
            radial-gradient(circle, rgba(255,224,160,0.9) 1px, transparent 1.6px),
            radial-gradient(circle, rgba(255,160,60,0.75) 1px, transparent 1.4px);
          background-size: 24px 24px, 34px 34px;
          background-position: 0 0, 10px 16px;
          opacity: 0.42;
          animation: ember-rise 4.5s linear infinite;
        }
        @keyframes ember-rise {
          0%   { background-position: 0 0, 10px 16px; }
          100% { background-position: -14px -60px, 4px -80px; }
        }
        .shimmer-text {
          background-size: 250% 100%;
          animation: shimmer-sweep 2.6s ease-in-out infinite;
        }
        @keyframes shimmer-sweep {
          0%   { background-position: 200% center; }
          100% { background-position: -200% center; }
        }
        .rarity-glow { animation: rarity-pulse 1.8s ease-in-out infinite; }
        @keyframes rarity-pulse {
          0%,100% { filter: brightness(1); }
          50%     { filter: brightness(1.5); }
        }
        .cat-card-btn { cursor: pointer; transition: transform 0.18s, filter 0.18s; display: inline-flex; }
        .cat-card-btn:active { transform: scale(0.96); }
        @keyframes card-modal-in {
          from { opacity: 0; transform: scale(0.7) translateY(40px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        .card-modal-anim { animation: card-modal-in 0.32s cubic-bezier(0.22,1,0.36,1) both; }
        @keyframes modal-bg-in { from { opacity:0; } to { opacity:1; } }
        .card-modal-bg { animation: modal-bg-in 0.2s ease both; }
      `}</style>

      <div
        className="cat-card-btn"
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === "Enter" && handleClick()}
        style={{ WebkitTapHighlightColor: "transparent" }}
      >
        <CardFace name={name} photoUrl={photoUrl} card={card} size={size} />
      </div>

      {/* 확대 모달 */}
      {mounted && modalOpen && createPortal(
        <div
          className="card-modal-bg"
          style={{
            position: "fixed", inset: 0, zIndex: 500,
            background: "rgba(0,0,0,0.82)",
            display: "flex", alignItems: "center", justifyContent: "center",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
          }}
          onClick={() => setModalOpen(false)}
        >
          <div
            className="card-modal-anim"
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}
            onClick={e => e.stopPropagation()}
          >
            {/* 희귀도 빛 효과 */}
            <div style={{
              position: "absolute",
              width: 320, height: 420,
              borderRadius: 999,
              background: cfg.glow.includes("rgba") ? cfg.glow.match(/rgba\([^)]+\)/g)?.[0] : "transparent",
              filter: "blur(60px)",
              opacity: 0.6,
              pointerEvents: "none",
            }} />
            <CardFace name={name} photoUrl={photoUrl} card={card} size="lg" />
            <button
              onClick={() => setModalOpen(false)}
              style={{
                width: 44, height: 44, borderRadius: 99,
                background: "rgba(255,255,255,0.15)",
                border: "1px solid rgba(255,255,255,0.25)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", cursor: "pointer",
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
