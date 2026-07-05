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

const CFG = {
  common: {
    bg: "linear-gradient(160deg, #6DB356 0%, #4A8A38 60%, #3A7028 100%)",
    topBar: "rgba(0,0,0,0.30)",
    nameBg: "rgba(0,0,0,0.22)",
    border: "#78C860",
    innerBorder: "rgba(255,255,255,0.30)",
    hpColor: "#CCFF88",
    typeIcon: "🌿",
    typeBg: "#3A7028",
    accent: "#AAEE66",
    glow: "0 0 12px rgba(100,190,60,0.35)",
    label: "일반",
    rarity: "◆",
    holoClass: "",
  },
  uncommon: {
    bg: "linear-gradient(160deg, #5A9ED8 0%, #3070B8 60%, #2458A0 100%)",
    topBar: "rgba(0,0,0,0.30)",
    nameBg: "rgba(0,0,0,0.22)",
    border: "#60AAEE",
    innerBorder: "rgba(255,255,255,0.30)",
    hpColor: "#AAD8FF",
    typeIcon: "💧",
    typeBg: "#2458A0",
    accent: "#80CCFF",
    glow: "0 0 14px rgba(60,130,230,0.40)",
    label: "희귀",
    rarity: "◆◆",
    holoClass: "",
  },
  rare: {
    bg: "linear-gradient(160deg, #B080E8 0%, #8040D0 55%, #6028B8 100%)",
    topBar: "rgba(0,0,0,0.35)",
    nameBg: "rgba(0,0,0,0.28)",
    border: "#C090FF",
    innerBorder: "rgba(255,255,255,0.35)",
    hpColor: "#E8CCFF",
    typeIcon: "⚡",
    typeBg: "#6028B8",
    accent: "#D0A0FF",
    glow: "0 0 20px rgba(160,80,255,0.60), 0 0 40px rgba(160,80,255,0.25)",
    label: "레어",
    rarity: "◆◆◆",
    holoClass: "holo-rare",
  },
  legendary: {
    bg: "linear-gradient(160deg, #FFD050 0%, #E09010 45%, #C07000 75%, #FFD050 100%)",
    topBar: "rgba(0,0,0,0.25)",
    nameBg: "rgba(0,0,0,0.18)",
    border: "#FFD050",
    innerBorder: "rgba(255,255,255,0.45)",
    hpColor: "#FFF8AA",
    typeIcon: "🔥",
    typeBg: "#A06000",
    accent: "#FFE066",
    glow: "0 0 28px rgba(255,180,0,0.80), 0 0 55px rgba(255,180,0,0.35)",
    label: "레전드",
    rarity: "◆◆◆◆",
    holoClass: "holo-legendary",
  },
};

const MOVE_ICONS = ["⚡","🌿","💧","🔥","✨","🌙","☀️","❄️"];
function pickIcon(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return MOVE_ICONS[h % MOVE_ICONS.length];
}

function CardFace({ name, photoUrl, card, size }: Omit<CatCardProps, "onClick"> & { size: "sm" | "md" | "lg" }) {
  const rarity = (card.card_rarity ?? "common") as CardRarity;
  const cfg = CFG[rarity] ?? CFG.common;
  const isSm = size === "sm";
  const isLg = size === "lg";

  const lv = Math.max(1, Math.min(10, card.card_level ?? 1));
  const lvBonus = lv - 1; // 레벨 1 = 보너스 없음

  const hp = card.card_stats
    ? Math.round(card.card_stats.cuteness * 0.8 + card.card_stats.wildness * 0.4) + 40 + lvBonus * 10
    : 60 + lvBonus * 10;
  const hpDisplay = Math.round(hp / 10) * 10;

  const traits = card.card_traits ?? [];
  const move1 = traits[0] ?? "야생의 눈빛";
  const move2 = traits[1] ?? "부드러운 발걸음";
  const move1Power = (card.card_stats ? Math.round(card.card_stats.wildness * 0.8 + 20) : 40) + lvBonus * 5;
  const move2Power = (card.card_stats ? Math.round(card.card_stats.mysteriousness * 0.5 + 15) : 20) + lvBonus * 3;

  // 레벨 5+ 글로우 강화
  const extraGlow = lv >= 10 ? ", 0 0 60px currentColor" : lv >= 5 ? ", 0 0 30px currentColor" : "";

  // 카드 크기
  const W = isLg ? 300 : isSm ? 130 : 190;
  const photoH = isLg ? 164 : isSm ? 72 : 105;
  const topBarPx = isLg ? 32 : isSm ? 22 : 26;
  const nameBannerPx = isLg ? 28 : isSm ? 20 : 24;
  const radius = isLg ? 18 : isSm ? 12 : 14;

  const fs = {
    label: isLg ? 9 : isSm ? 7 : 8,
    name: isLg ? 16 : isSm ? 10 : 13,
    catname: isLg ? 11 : isSm ? 8 : 9,
    hp: isLg ? 18 : isSm ? 12 : 15,
    flavor: isLg ? 10 : 9,
    moveName: isLg ? 11 : 9,
    movePow: isLg ? 16 : isSm ? 10 : 13,
    bottom: isLg ? 9 : 8,
  };

  return (
    <div
      style={{
        width: W,
        borderRadius: radius,
        border: `${isLg ? 3 : 2}px solid ${cfg.border}`,
        boxShadow: cfg.glow + ", 0 6px 24px rgba(0,0,0,0.25)",
        background: cfg.bg,
        overflow: "hidden",
        flexShrink: 0,
        position: "relative",
        userSelect: "none",
      }}
      className={cfg.holoClass}
    >
      {/* 홀로그램 레이어 (rare/legendary) */}
      {(rarity === "rare" || rarity === "legendary") && (
        <div className="holo-overlay" style={{ borderRadius: radius }} />
      )}

      {/* ── 상단 바: 타입 + 이름 + HP ── */}
      <div
        style={{
          height: topBarPx,
          background: cfg.topBar,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingInline: isLg ? 10 : 7,
          gap: 4,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 0 }}>
          <span
            style={{
              background: cfg.typeBg,
              borderRadius: 99,
              width: isLg ? 18 : isSm ? 13 : 15,
              height: isLg ? 18 : isSm ? 13 : 15,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: isLg ? 10 : 8, flexShrink: 0,
            }}
          >
            {cfg.typeIcon}
          </span>
          <span style={{
            fontSize: fs.label,
            color: "rgba(255,255,255,0.75)",
            fontWeight: 700,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
          }}>
            {cfg.label}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
          {/* 레벨 뱃지 */}
          <span style={{
            fontSize: fs.label - 1, fontWeight: 900,
            background: lv >= 10 ? "linear-gradient(135deg,#FFD700,#FF8C00)" : lv >= 5 ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.15)",
            color: lv >= 5 ? "#fff" : "rgba(255,255,255,0.8)",
            borderRadius: 99, padding: "1px 5px", lineHeight: 1.4,
            border: lv >= 10 ? "1px solid #FFD700" : "none",
          }}>
            Lv.{lv}
          </span>
          <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
            <span style={{ fontSize: fs.label - 1, color: "rgba(255,255,255,0.65)", fontWeight: 700 }}>HP</span>
            <span style={{ fontSize: fs.hp, color: cfg.hpColor, fontWeight: 900, lineHeight: 1 }}>{hpDisplay}</span>
          </div>
        </div>
      </div>

      {/* ── 사진 영역 ── */}
      <div style={{
        height: photoH,
        overflow: "hidden",
        position: "relative",
        margin: "0 4px",
        borderRadius: 6,
      }}>
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt={name}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", background: "rgba(0,0,0,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: isSm ? 28 : 40, color: "rgba(255,255,255,0.4)" }}>🐱</div>
        )}
        {/* 하단 그라데이션 (사진→배경 자연스럽게) */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: photoH * 0.35,
          background: `linear-gradient(to bottom, transparent, ${rarity === "legendary" ? "rgba(160,80,0,0.7)" : "rgba(0,0,0,0.55)"})` }} />
      </div>

      {/* ── 카드 이름 배너 ── */}
      <div style={{
        height: nameBannerPx,
        background: cfg.nameBg,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        paddingInline: isLg ? 10 : 7,
        borderTop: `1px solid ${cfg.innerBorder}`,
        borderBottom: `1px solid ${cfg.innerBorder}`,
        marginTop: 3,
      }}>
        <span style={{ fontSize: fs.name, color: "#fff", fontWeight: 900, lineHeight: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {card.card_name ?? name}
        </span>
        {!isSm && (
          <span style={{ fontSize: fs.catname, color: "rgba(255,255,255,0.55)", flexShrink: 0, marginLeft: 4 }}>{name}</span>
        )}
      </div>

      {/* ── 카드 본문 ── */}
      {!isSm && (
        <div style={{ padding: isLg ? "8px 10px" : "5px 7px", display: "flex", flexDirection: "column", gap: isLg ? 6 : 4 }}>
          {/* 플레이버 텍스트 */}
          {card.card_flavor && (
            <p style={{
              fontSize: fs.flavor,
              color: "rgba(255,255,255,0.7)",
              fontStyle: "italic",
              lineHeight: 1.35,
              borderLeft: `2px solid ${cfg.accent}`,
              paddingLeft: 5,
            }}>
              "{card.card_flavor}"
            </p>
          )}

          {/* 기술 1 */}
          <div style={{
            background: cfg.nameBg,
            borderRadius: 6,
            padding: isLg ? "5px 7px" : "3px 6px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            border: `1px solid ${cfg.innerBorder}`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: isLg ? 11 : 9 }}>{pickIcon(move1)}</span>
              <span style={{ fontSize: fs.moveName, color: "#fff", fontWeight: 700 }}>{move1}</span>
            </div>
            <span style={{ fontSize: fs.movePow, color: cfg.accent, fontWeight: 900 }}>{move1Power}</span>
          </div>

          {/* 기술 2 */}
          <div style={{
            background: cfg.nameBg,
            borderRadius: 6,
            padding: isLg ? "5px 7px" : "3px 6px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            border: `1px solid ${cfg.innerBorder}`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: isLg ? 11 : 9 }}>{pickIcon(move2)}</span>
              <span style={{ fontSize: fs.moveName, color: "rgba(255,255,255,0.8)", fontWeight: 700 }}>{move2}</span>
            </div>
            <span style={{ fontSize: fs.movePow - 2, color: "rgba(255,255,255,0.65)", fontWeight: 700 }}>{move2Power}</span>
          </div>
        </div>
      )}

      {/* ── 하단 스트립 ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: isSm ? "2px 6px 3px" : isLg ? "4px 10px 6px" : "3px 7px 5px",
        borderTop: `1px solid ${cfg.innerBorder}`,
        marginTop: isSm ? 3 : 0,
      }}>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <span style={{ fontSize: fs.bottom, color: "rgba(255,255,255,0.45)" }}>약점:</span>
          <span style={{ fontSize: fs.bottom }}>{rarity === "common" ? "💧" : rarity === "uncommon" ? "⚡" : rarity === "rare" ? "🌿" : "💧"}</span>
          <span style={{ fontSize: fs.bottom - 1, color: "rgba(255,255,255,0.35)" }}>×2</span>
        </div>
        <span style={{ fontSize: fs.bottom + 1, color: cfg.accent, letterSpacing: 1 }}>{cfg.rarity}</span>
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
  const cfg = CFG[rarity] ?? CFG.common;

  return (
    <>
      {/* 인라인 CSS */}
      <style>{`
        @keyframes holo-sweep {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes holo-sweep-gold {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .holo-overlay {
          position: absolute; inset: 0; pointer-events: none; z-index: 10;
          background: linear-gradient(105deg,
            transparent 30%,
            rgba(255,255,255,0.12) 45%,
            rgba(255,255,255,0.28) 50%,
            rgba(255,255,255,0.12) 55%,
            transparent 70%
          );
          background-size: 200% 100%;
          animation: holo-sweep 2.4s ease-in-out infinite;
        }
        .holo-legendary .holo-overlay {
          background: linear-gradient(105deg,
            transparent 25%,
            rgba(255,230,50,0.10) 40%,
            rgba(255,255,180,0.35) 50%,
            rgba(255,230,50,0.10) 60%,
            transparent 75%
          );
          background-size: 200% 100%;
          animation: holo-sweep-gold 1.8s ease-in-out infinite;
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
