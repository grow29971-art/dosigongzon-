"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { gameFont } from "@/lib/fonts";
import { notchClip, pixelOutline } from "@/lib/pixel-ui";

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
    topBar: "rgba(0,0,0,0.42)",
    panelBg: "rgba(0,0,0,0.36)",
    hpColor: "#D8FFB0",
    typeIcon: "🌿",
    typeBg: "#3A7028",
    accent: "#AAEE66",
    label: "일반",
    rarity: "◆",
    weak: "🔥",
    typeKey: "grass",
    badgeShape: "hexagon" as const,
    notchMult: 1,
  },
  uncommon: {
    bg: "linear-gradient(155deg, #6EC0FF 0%, #3488E0 42%, #1C5CBC 75%, #123E88 100%)",
    frameOuter: "#153E78",
    frameInner: "#B8E4FF",
    topBar: "rgba(0,0,0,0.42)",
    panelBg: "rgba(0,0,0,0.36)",
    hpColor: "#C8E8FF",
    typeIcon: "💧",
    typeBg: "#1E56A0",
    accent: "#80CCFF",
    label: "희귀",
    rarity: "◆◆",
    weak: "⚡",
    typeKey: "water",
    badgeShape: "droplet" as const,
    notchMult: 1.3,
  },
  rare: {
    bg: "linear-gradient(155deg, #D0A0FF 0%, #9C58EC 38%, #7028C8 70%, #4C1690 100%)",
    frameOuter: "#3C1478",
    frameInner: "#F0D8FF",
    topBar: "rgba(0,0,0,0.46)",
    panelBg: "rgba(0,0,0,0.4)",
    hpColor: "#F0DCFF",
    typeIcon: "⚡",
    typeBg: "#5C24B0",
    accent: "#E0B8FF",
    label: "레어",
    rarity: "◆◆◆",
    weak: "🌿",
    typeKey: "electric",
    badgeShape: "bolt" as const,
    notchMult: 0.6,
  },
  legendary: {
    bg: "linear-gradient(155deg, #FFEA98 0%, #FFB730 30%, #F08010 55%, #C05A00 80%, #FFEA98 100%)",
    frameOuter: "#8A4E00",
    frameInner: "#FFF6D0",
    topBar: "rgba(0,0,0,0.4)",
    panelBg: "rgba(0,0,0,0.34)",
    hpColor: "#FFF9C8",
    typeIcon: "🔥",
    typeBg: "#9A5800",
    accent: "#FFE680",
    label: "레전드",
    rarity: "◆◆◆◆",
    weak: "💧",
    typeKey: "fire",
    badgeShape: "star" as const,
    notchMult: 1,
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

  // 카드 크기
  const W = isLg ? 300 : isSm ? 130 : 190;
  const photoH = isLg ? 180 : isSm ? 78 : 114;
  const topBarPx = isLg ? 34 : isSm ? 22 : 27;
  const notchStep = Math.max(2, Math.round((isLg ? 7 : isSm ? 3 : 5) * cfg.notchMult));
  const clip = notchClip(notchStep);
  const dividerH = isLg ? 13 : isSm ? 8 : 10;
  const inset = isLg ? 8 : isSm ? 5 : 6;
  const shadowOffset = isLg ? 6 : isSm ? 3 : 4;

  const fs = {
    label: isLg ? 9 : isSm ? 7 : 8,
    name: isLg ? 18 : isSm ? 11 : 14,
    hp: isLg ? 20 : isSm ? 13 : 16,
    flavor: isLg ? 10.5 : 9,
    dex: isLg ? 9 : isSm ? 7 : 8,
    moveName: isLg ? 11.5 : 9,
    movePow: isLg ? 18 : isSm ? 11 : 14,
    bottom: isLg ? 9 : 8,
  };

  return (
    <div
      style={{
        width: W,
        clipPath: clip,
        filter: `drop-shadow(${shadowOffset}px ${shadowOffset}px 0 rgba(0,0,0,0.45))`,
        overflow: "hidden",
        flexShrink: 0,
        position: "relative",
        userSelect: "none",
      }}
    >
      {/* 픽셀 프레임 테두리 (2겹, 블러 없는 인셋) */}
      <div
        style={{
          position: "absolute", inset: 0, zIndex: 20, pointerEvents: "none",
          boxShadow: `inset 0 0 0 ${isLg ? 4 : 3}px ${cfg.frameOuter}, inset 0 0 0 ${isLg ? 7 : 5}px ${cfg.frameInner}`,
        }}
      />

      <div style={{ background: cfg.bg, position: "relative" }}>
        {/* 속성 텍스처 (잎맥/물결/스파크/불티 — 등급마다 다른 패턴) */}
        <div className={`type-pattern type-pattern-${cfg.typeKey}`} />
        {/* 스캔라인 텍스처 — 부드러운 홀로그램 스윕 대신 하드 CRT 느낌 */}
        <div className="scanlines" />

        {/* ── 상단 바: 등급 + HP (1줄) / 이름 (줄바꿈 허용, 안 잘림) ── */}
        <div
          style={{
            background: cfg.topBar,
            paddingInline: isLg ? 11 : 7,
            paddingBlock: isLg ? 5 : 3,
            position: "relative", zIndex: 2,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 5, minHeight: topBarPx - (isLg ? 10 : 6) }}>
          <span style={{
              background: "#000", border: `2px solid ${cfg.accent}`,
              padding: isLg ? "2px 6px" : "1px 4px",
              fontSize: fs.label, fontWeight: 800, color: cfg.accent,
              flexShrink: 0, letterSpacing: "0.02em",
            }}>
              {cfg.label}
            </span>
          <div style={{ display: "flex", alignItems: "baseline", gap: 2, flexShrink: 0 }}>
            <span className={gameFont.className} style={{ fontSize: fs.label + 1, color: "rgba(255,255,255,0.7)" }}>HP</span>
            <span className={gameFont.className} style={{ fontSize: fs.hp, color: cfg.hpColor, lineHeight: 1, textShadow: pixelOutline("#000", 1.5) }}>{hpDisplay}</span>
            <span style={{
              marginLeft: 3, position: "relative",
              width: isLg ? 20 : isSm ? 15 : 17, height: isLg ? 20 : isSm ? 15 : 17,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {cfg.badgeShape === "droplet" ? (
                <span style={{
                  position: "relative", background: cfg.typeBg,
                  width: isLg ? 16 : isSm ? 11.5 : 13.5, height: isLg ? 16 : isSm ? 11.5 : 13.5,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  border: `2px solid #000`,
                  borderRadius: "50% 50% 50% 0%", transform: "rotate(-45deg)",
                }}>
                  <span style={{ fontSize: isLg ? 9 : 7.5, transform: "rotate(45deg)" }}>{cfg.typeIcon}</span>
                </span>
              ) : (
                <span style={{
                  position: "relative", background: cfg.typeBg,
                  width: isLg ? 19 : isSm ? 14 : 16, height: isLg ? 19 : isSm ? 14 : 16,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: isLg ? 9 : 7.5,
                  clipPath: BADGE_CLIP[cfg.badgeShape],
                }}>
                  {cfg.typeIcon}
                </span>
              )}
            </span>
          </div>
          </div>
          <div style={{ marginTop: isLg ? 2 : 1 }}>
            <span
              className={gameFont.className}
              style={{
                fontSize: fs.name, color: "#fff", lineHeight: 1.22,
                display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                overflow: "hidden", textOverflow: "ellipsis",
                textShadow: pixelOutline("#000", isLg ? 2.5 : 1.8),
              }}
            >
              {card.card_name ?? name}
            </span>
          </div>
        </div>

        {/* ── 사진 프레임 (픽셀 액자) ── */}
        <div style={{ padding: `0 ${isLg ? 8 : isSm ? 5 : 6}px`, position: "relative", zIndex: 2 }}>
          <div style={{
            background: "#000", padding: isLg ? 3 : 2,
            border: `2px solid ${cfg.frameInner}`,
          }}>
            <div style={{
              height: photoH, overflow: "hidden", position: "relative",
              background: "#1a1a1a",
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
          position: "relative", zIndex: 2,
        }} />

        {/* ── 도감 정보 스트립 ── */}
        <div style={{
          margin: `0 ${isLg ? 8 : isSm ? 5 : 6}px 0`,
          background: cfg.panelBg, border: "1px solid rgba(255,255,255,0.12)",
          padding: isLg ? "3px 8px" : "2px 6px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          position: "relative", zIndex: 2,
        }}>
          <span style={{ fontSize: fs.dex, color: "rgba(255,255,255,0.6)", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            No.{dexNo} · {name}
          </span>
          <span className={gameFont.className} style={{
            fontSize: fs.dex + 1, flexShrink: 0, marginLeft: 4,
            background: lv >= 10 ? "#FFD700" : "#000", border: `1.5px solid ${lv >= 10 ? "#000" : cfg.accent}`,
            color: lv >= 10 ? "#000" : cfg.accent,
            padding: "1px 5px",
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
                lineHeight: 1.35, borderLeft: `3px solid ${cfg.accent}`, paddingLeft: 5,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                &ldquo;{card.card_flavor}&rdquo;
              </p>
            )}

            <div style={{
              background: cfg.panelBg, border: "1px solid rgba(255,255,255,0.12)", padding: isLg ? "5px 8px" : "3px 6px",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 0 }}>
                <span style={{ fontSize: isLg ? 11 : 9, flexShrink: 0 }}>{pickIcon(move1)}</span>
                <span style={{ fontSize: fs.moveName, color: "#fff", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{move1}</span>
              </div>
              <span className={gameFont.className} style={{ fontSize: fs.movePow, color: cfg.accent, flexShrink: 0, marginLeft: 4 }}>{move1Power}</span>
            </div>

            <div style={{
              background: cfg.panelBg, border: "1px solid rgba(255,255,255,0.12)", padding: isLg ? "5px 8px" : "3px 6px",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 0 }}>
                <span style={{ fontSize: isLg ? 11 : 9, flexShrink: 0 }}>{pickIcon(move2)}</span>
                <span style={{ fontSize: fs.moveName, color: "rgba(255,255,255,0.82)", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{move2}</span>
              </div>
              <span className={gameFont.className} style={{ fontSize: fs.movePow - 2, color: "rgba(255,255,255,0.68)", flexShrink: 0, marginLeft: 4 }}>{move2Power}</span>
            </div>
          </div>
        )}

        {/* ── 하단 스탯 바 (약점/저항력/후퇴) ── */}
        <div style={{
          display: "flex", alignItems: "center",
          margin: `${isSm ? 4 : 6}px ${isLg ? 8 : isSm ? 5 : 6}px`,
          borderTop: `2px solid ${cfg.frameInner}55`, paddingTop: isSm ? 3 : 5,
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
            <span style={{ fontSize: fs.bottom + 1, color: cfg.accent, letterSpacing: 1 }}>{cfg.rarity}</span>
          </div>
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

  return (
    <>
      {/* 인라인 CSS */}
      <style>{`
        .scanlines {
          position: absolute; inset: 0; pointer-events: none; z-index: 1;
          background-image: repeating-linear-gradient(0deg, rgba(0,0,0,0.16) 0px, rgba(0,0,0,0.16) 1px, transparent 1px, transparent 3px);
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
          background-image: repeating-radial-gradient(circle at 50% 130%, rgba(255,255,255,0.20) 0 2px, transparent 2px 20px);
          background-size: 160% 160%;
          background-position: 50% 100%;
          opacity: 0.38;
          animation: ripple-drift 4.5s ease-in-out infinite;
        }
        @keyframes ripple-drift {
          0%, 100% { background-position: 50% 100%; }
          50%      { background-position: 50% 88%; }
        }
        .type-pattern-electric {
          background-image: repeating-linear-gradient(68deg, rgba(255,255,255,0.22) 0 1.5px, transparent 1.5px 16px);
          background-position: 0 0;
          opacity: 0.36;
          animation: spark-drift 2.4s linear infinite;
        }
        @keyframes spark-drift {
          0%   { background-position: 0 0; }
          100% { background-position: 32px 0; }
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
        .cat-card-btn { cursor: pointer; transition: transform 0.1s; display: inline-flex; }
        .cat-card-btn:active { transform: translate(2px, 2px); }
        @keyframes card-modal-in {
          from { opacity: 0; transform: scale(0.85); }
          to   { opacity: 1; transform: scale(1); }
        }
        .card-modal-anim { animation: card-modal-in 0.2s ease-out both; }
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
            background: "rgba(0,0,0,0.85)",
            display: "flex", flexDirection: "column", alignItems: "center",
            overflowY: "auto", WebkitOverflowScrolling: "touch",
            padding: "20px 0",
          }}
          onClick={() => setModalOpen(false)}
        >
          <button
            onClick={() => setModalOpen(false)}
            style={{
              position: "fixed", top: "calc(env(safe-area-inset-top) + 14px)", right: 16, zIndex: 501,
              width: 40, height: 40,
              background: "#000", border: "2px solid #fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", cursor: "pointer",
            }}
          >
            <X size={20} />
          </button>
          <div
            className="card-modal-anim"
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, margin: "auto 0" }}
            onClick={e => e.stopPropagation()}
          >
            <CardFace name={name} photoUrl={photoUrl} card={card} size="lg" />
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
