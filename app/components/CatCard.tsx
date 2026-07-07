"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Heart } from "lucide-react";

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
  // 사진이 없을 때 기본 🐱 대신 보여줄 이모지 — PVE 배틀 상대(바퀴벌레·쥐 등 야생동물)처럼
  // 진짜 고양이가 아닌 카드를 표시할 때 씀. 일반 고양이 카드는 항상 undefined.
  placeholder_emoji?: string | null;
  // 카드 훈장(성장 스티커) + 프레임 숙련도 승급 계산용 — 전부 리셋되지 않는 all-time 누적치.
  best_win_streak?: number | null;
  pve_win_count?: number | null;
}

interface CatCardProps {
  name: string;
  photoUrl: string | null;
  card: CatCardData;
  size?: "sm" | "md" | "lg";
  onClick?: () => void;
}

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

// 카드 프레임의 파스텔 색상 팔레트 — CARD_THEME(map/page.tsx 등 다른 화면의 진한 색 패널이
// 아직 이 값을 그대로 쓰고 있어서 못 바꿈)과는 별개로, 이 컴포넌트의 크림/골드 톤 프레임 전용.
const SOFT_THEME: Record<CardRarity, { shellBg: string; frameOuter: string; accent: string; typeBg: string }> = {
  common:    { shellBg: "linear-gradient(160deg,#FBFEF7,#F1F8E8)", frameOuter: "#A9D488", accent: "#5FA83D", typeBg: "#7BC957" },
  uncommon:  { shellBg: "linear-gradient(160deg,#FAFDFF,#EAF4FF)", frameOuter: "#8FC1F5", accent: "#3D7FC9", typeBg: "#5F9DE8" },
  rare:      { shellBg: "linear-gradient(160deg,#FCFAFF,#F1E9FF)", frameOuter: "#C1A6F0", accent: "#7D53C9", typeBg: "#A47BEE" },
  legendary: { shellBg: "linear-gradient(160deg,#FFFCF2,#FFF1D2)", frameOuter: "#EFC15E", accent: "#C98A1E", typeBg: "#EFAF3A" },
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

// ── 성장 훈장 스티커 ──
// "한 번 얻으면 절대 사라지지 않는" all-time 기록만 조건으로 씀 — 리셋되는 값(현재 연승 등)은 제외.
// 기준이 바뀌면 이 배열만 고치면 되고, 별도 "획득 여부" 컬럼은 두지 않는다(cat-grade와 동일 설계).
interface BadgeDef { emoji: string; label: string; unlocked: (c: CatCardData) => boolean; }
const CARD_BADGES: BadgeDef[] = [
  { emoji: "🎖️", label: "만렙 달성", unlocked: (c) => (c.card_level ?? 1) >= 10 },
  { emoji: "🔥", label: "5연승 달성", unlocked: (c) => (c.best_win_streak ?? 0) >= 5 },
  { emoji: "🛡️", label: "PVE 10승 달성", unlocked: (c) => (c.pve_win_count ?? 0) >= 10 },
  { emoji: "🌱", label: "함께한 지 30일+", unlocked: (c) => {
      if (!c.card_generated_at) return false;
      const days = (Date.now() - new Date(c.card_generated_at).getTime()) / 86400000;
      return days >= 30;
    } },
];

// ── 프레임 숙련도 승급 ──
// 등급(rarity)과는 별개의 축 — 만렙(Lv10) 이후로도 계속 쌓이는 card_exp를 근거로,
// 시간과 노력을 들인 카드일수록 프레임에 은은한 광채가 더해진다.
export type PrestigeTier = "none" | "silver" | "gold" | "prismatic";
export function prestigeTier(exp: number | null | undefined): PrestigeTier {
  const e = exp ?? 0;
  if (e >= 7000) return "prismatic";
  if (e >= 3500) return "gold";
  if (e >= 1670) return "silver";
  return "none";
}
const PRESTIGE_GLOW: Record<PrestigeTier, string> = {
  none: "",
  silver: "drop-shadow(0 0 5px rgba(210,220,230,0.9)) drop-shadow(0 0 11px rgba(210,220,230,0.55))",
  gold: "drop-shadow(0 0 6px rgba(255,215,60,0.95)) drop-shadow(0 0 13px rgba(255,180,0,0.6))",
  prismatic: "drop-shadow(0 0 6px rgba(255,80,80,0.95)) drop-shadow(0 0 13px rgba(255,80,80,0.6))",
};
const PRESTIGE_LABEL: Record<PrestigeTier, string> = { none: "", silver: "은빛 숙련", gold: "금빛 숙련", prismatic: "무지개 숙련" };

function CardFace({ name, photoUrl, card, size }: Omit<CatCardProps, "onClick"> & { size: "sm" | "md" | "lg" }) {
  const rarity = (card.card_rarity ?? "common") as CardRarity;
  const cfg = CARD_THEME[rarity] ?? CARD_THEME.common;
  const soft = SOFT_THEME[rarity] ?? SOFT_THEME.common;
  const isSm = size === "sm";
  const isLg = size === "lg";

  const lv = Math.max(1, Math.min(10, card.card_level ?? 1));
  const lvBonus = lv - 1;
  const tier = prestigeTier(card.card_exp);
  const badges = CARD_BADGES.map((b) => ({ ...b, isUnlocked: b.unlocked(card) }));

  const hp = card.card_stats
    ? Math.round(card.card_stats.cuteness * 0.8 + card.card_stats.wildness * 0.4) + 40 + lvBonus * 10
    : 60 + lvBonus * 10;
  const hpDisplay = Math.round(hp / 10) * 10;

  const stats = card.card_stats ?? { cuteness: 50, wildness: 50, sociability: 50, mysteriousness: 50 };
  const statRow = [
    { icon: "🐾", value: stats.cuteness },
    { icon: "🔥", value: stats.wildness },
    { icon: "🌿", value: stats.sociability },
    { icon: "✨", value: stats.mysteriousness },
  ];

  const traits = card.card_traits ?? [];
  const move1 = traits[0] ?? "야생의 눈빛";
  const move2 = traits[1] ?? "부드러운 발걸음";
  const move1Power = (card.card_stats ? Math.round(card.card_stats.wildness * 0.8 + 20) : 40) + lvBonus * 5;
  const move2Power = (card.card_stats ? Math.round(card.card_stats.mysteriousness * 0.5 + 15) : 20) + lvBonus * 3;

  const dexNo = pseudoDexNo(card.card_name ?? name);

  // 카드 크기
  const W = isLg ? 300 : isSm ? 130 : 190;
  const photoH = isLg ? 180 : isSm ? 78 : 114;
  const radius = isLg ? 26 : isSm ? 16 : 20;
  const innerRadius = Math.max(10, radius - 8);
  const pad = isLg ? 12 : isSm ? 8 : 10;
  const shadowBlur = isLg ? 22 : isSm ? 12 : 16;

  const fs = {
    label: isLg ? 10 : isSm ? 8 : 9,
    name: isLg ? 16 : isSm ? 11 : 13,
    hp: isLg ? 15 : isSm ? 11 : 13,
    flavor: isLg ? 10.5 : 9,
    dex: isLg ? 9 : isSm ? 7 : 8,
    moveName: isLg ? 11.5 : 9,
    movePow: isLg ? 15 : isSm ? 11 : 13,
    bottom: isLg ? 9 : 8,
  };

  return (
    <div
      className={tier === "prismatic" ? "prestige-prismatic" : undefined}
      style={{
        width: W,
        borderRadius: radius,
        background: soft.shellBg,
        boxShadow: `0 ${isLg?8:5}px ${shadowBlur}px rgba(70,60,40,0.14), inset 0 0 0 2px #fff, inset 0 0 0 4px ${soft.frameOuter}`,
        filter: PRESTIGE_GLOW[tier] || undefined,
        overflow: "visible",
        flexShrink: 0,
        position: "relative",
        userSelect: "none",
        padding: pad,
        ["--shadow-offset" as string]: "0px",
      } as React.CSSProperties}
    >
      {/* 모서리 다이아몬드 장식 */}
      {(["-6px,-6px", "-6px,calc(100% - 6px)", "calc(100% - 6px),-6px", "calc(100% - 6px),calc(100% - 6px)"]).map((pos) => {
        const [top, left] = pos.split(",");
        return (
          <span key={pos} style={{
            position: "absolute", top, left, width: isLg ? 11 : 8, height: isLg ? 11 : 8,
            background: soft.frameOuter, transform: "translate(-50%,-50%) rotate(45deg)",
            borderRadius: 2, zIndex: 3, boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
          }} />
        );
      })}

      {/* ── 상단 리본: 등급 + HP ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 5, marginBottom: isSm ? 5 : 7 }}>
        <span style={{
          background: "#fff", borderRadius: 999,
          padding: isLg ? "3px 10px" : "2px 7px",
          fontSize: fs.label, fontWeight: 800, color: soft.accent,
          boxShadow: "0 1px 4px rgba(0,0,0,0.12)", flexShrink: 0,
        }}>
          {cfg.label}
        </span>
        <span style={{
          display: "flex", alignItems: "center", gap: 3,
          background: "#fff", borderRadius: 999,
          padding: isLg ? "3px 9px" : "2px 6px",
          boxShadow: "0 1px 4px rgba(0,0,0,0.12)", flexShrink: 0,
        }}>
          <Heart size={fs.hp - 2} fill="#FF6B81" color="#FF6B81" />
          <span style={{ fontSize: fs.hp, fontWeight: 800, color: "#2B2B3D", lineHeight: 1 }}>{hpDisplay}</span>
        </span>
      </div>

      {/* ── 사진 프레임 ── */}
      <div style={{
        borderRadius: innerRadius, overflow: "hidden", position: "relative",
        boxShadow: `inset 0 0 0 2px #fff, inset 0 0 0 4px ${soft.frameOuter}`,
        background: "#fff",
      }}>
        <div style={{ height: photoH, overflow: "hidden", position: "relative", background: "#F3F1EA" }}>
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt={name}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          ) : (
            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: isSm ? 30 : 46 }}>{card.placeholder_emoji ?? "🐱"}</div>
          )}
        </div>
      </div>

      {/* ── 이름 + 도감번호 + 레벨 ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, marginTop: isSm ? 6 : 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: fs.dex, color: "#A6A196", fontWeight: 600 }}>No.{dexNo}</div>
          <div style={{
            fontSize: fs.name, fontWeight: 800, color: "#3A3630", lineHeight: 1.2,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {card.card_name ?? name}
          </div>
        </div>
        <span style={{
          background: lv >= 10 ? "linear-gradient(135deg,#FFD76A,#FFA83A)" : "#FF6B81",
          color: "#fff", fontWeight: 800, borderRadius: 999,
          padding: isLg ? "3px 10px" : "2px 7px", fontSize: fs.dex + 1, flexShrink: 0,
        }}>
          Lv.{lv}
        </span>
      </div>

      {/* ── 성격 스탯 아이콘 (귀여움/야생성/사교성/신비로움) ── */}
      {!isSm && (
        <div style={{
          display: "flex", justifyContent: "space-between", marginTop: isLg ? 8 : 6,
          background: "#fff", borderRadius: 14, padding: isLg ? "7px 10px" : "5px 8px",
          boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.05)",
        }}>
          {statRow.map((s, i) => (
            <span key={i} style={{ display: "flex", alignItems: "center", gap: 3, fontSize: fs.bottom }}>
              <span style={{ fontSize: isLg ? 13 : 11 }}>{s.icon}</span>
              <span style={{ fontWeight: 700, color: "#5A554C" }}>{s.value}</span>
            </span>
          ))}
        </div>
      )}

      {/* ── 성장 훈장 스티커 (영구 기록) ── */}
      <div style={{ display: "flex", alignItems: "center", gap: isSm ? 3 : 4, marginTop: isSm ? 5 : 7 }}>
        {badges.map((b) => (
          <span key={b.label} title={b.label} style={{
            width: isLg ? 20 : isSm ? 14 : 17, height: isLg ? 20 : isSm ? 14 : 17,
            borderRadius: "50%",
            background: b.isUnlocked ? soft.typeBg : "#EFEDE6",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: isLg ? 11 : isSm ? 7.5 : 9,
            filter: b.isUnlocked ? undefined : "grayscale(1)",
            opacity: b.isUnlocked ? 1 : 0.4,
            flexShrink: 0,
          }}>
            {b.emoji}
          </span>
        ))}
        {tier !== "none" && (
          <span style={{
            marginLeft: "auto", fontSize: fs.dex - 1, fontWeight: 700,
            color: tier === "gold" ? "#C98A1E" : tier === "prismatic" ? "#E0508A" : "#8A96A6",
            flexShrink: 0,
          }}>
            {PRESTIGE_LABEL[tier]}
          </span>
        )}
      </div>

      {/* ── 카드 본문 (플레이버 + 기술) ── */}
      {!isSm && (
        <div style={{ display: "flex", flexDirection: "column", gap: isLg ? 6 : 4, marginTop: isLg ? 8 : 6 }}>
          {card.card_flavor && (
            <p style={{
              fontSize: fs.flavor, color: "#8A8578", fontStyle: "italic",
              lineHeight: 1.35, borderLeft: `3px solid ${soft.frameOuter}`, paddingLeft: 6,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0,
            }}>
              &ldquo;{card.card_flavor}&rdquo;
            </p>
          )}

          <div style={{
            background: "#fff", borderRadius: 12, padding: isLg ? "6px 9px" : "4px 7px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.05)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 0 }}>
              <span style={{ fontSize: isLg ? 11 : 9, flexShrink: 0 }}>{pickIcon(move1)}</span>
              <span style={{ fontSize: fs.moveName, color: "#3A3630", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{move1}</span>
            </div>
            <span style={{ fontSize: fs.movePow, fontWeight: 800, color: soft.accent, flexShrink: 0, marginLeft: 4 }}>{move1Power}</span>
          </div>

          <div style={{
            background: "#fff", borderRadius: 12, padding: isLg ? "6px 9px" : "4px 7px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.05)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 0 }}>
              <span style={{ fontSize: isLg ? 11 : 9, flexShrink: 0 }}>{pickIcon(move2)}</span>
              <span style={{ fontSize: fs.moveName, color: "#6B665C", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{move2}</span>
            </div>
            <span style={{ fontSize: fs.movePow - 2, fontWeight: 700, color: "#9A958A", flexShrink: 0, marginLeft: 4 }}>{move2Power}</span>
          </div>
        </div>
      )}

      {/* ── 하단: 속성 + 약점 ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginTop: isSm ? 5 : 7, paddingTop: isSm ? 5 : 7,
        borderTop: `1.5px dashed ${soft.frameOuter}66`,
      }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: fs.bottom, color: "#9A958A", fontWeight: 600 }}>
          <span style={{
            width: 15, height: 15, borderRadius: "50%", background: soft.typeBg,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8.5,
          }}>{cfg.typeIcon}</span>
          속성
        </span>
        <span style={{ fontSize: fs.bottom, color: "#9A958A", fontWeight: 600 }}>
          약점 {cfg.weak}×2
        </span>
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
        .cat-card-btn { cursor: pointer; transition: transform 0.1s; display: inline-flex; }
        .cat-card-btn:active { transform: translate(2px, 2px); }
        @keyframes card-modal-in {
          from { opacity: 0; transform: scale(0.85); }
          to   { opacity: 1; transform: scale(1); }
        }
        .card-modal-anim { animation: card-modal-in 0.2s ease-out both; }
        @keyframes modal-bg-in { from { opacity:0; } to { opacity:1; } }
        .card-modal-bg { animation: modal-bg-in 0.2s ease both; }
        /* 프레임 숙련도 "무지개" 등급 — 만렙 이후로도 오래 쌓인 카드에만 붙는 은은한 색상 순환 광채 */
        @keyframes prestige-rainbow {
          0%   { filter: drop-shadow(var(--shadow-offset) var(--shadow-offset) 0 rgba(0,0,0,0.45)) drop-shadow(0 0 6px rgba(255,80,80,0.95)) drop-shadow(0 0 13px rgba(255,80,80,0.6)); }
          20%  { filter: drop-shadow(var(--shadow-offset) var(--shadow-offset) 0 rgba(0,0,0,0.45)) drop-shadow(0 0 6px rgba(255,210,60,0.95)) drop-shadow(0 0 13px rgba(255,210,60,0.6)); }
          40%  { filter: drop-shadow(var(--shadow-offset) var(--shadow-offset) 0 rgba(0,0,0,0.45)) drop-shadow(0 0 6px rgba(120,255,140,0.95)) drop-shadow(0 0 13px rgba(120,255,140,0.6)); }
          60%  { filter: drop-shadow(var(--shadow-offset) var(--shadow-offset) 0 rgba(0,0,0,0.45)) drop-shadow(0 0 6px rgba(100,180,255,0.95)) drop-shadow(0 0 13px rgba(100,180,255,0.6)); }
          80%  { filter: drop-shadow(var(--shadow-offset) var(--shadow-offset) 0 rgba(0,0,0,0.45)) drop-shadow(0 0 6px rgba(210,120,255,0.95)) drop-shadow(0 0 13px rgba(210,120,255,0.6)); }
          100% { filter: drop-shadow(var(--shadow-offset) var(--shadow-offset) 0 rgba(0,0,0,0.45)) drop-shadow(0 0 6px rgba(255,80,80,0.95)) drop-shadow(0 0 13px rgba(255,80,80,0.6)); }
        }
        .prestige-prismatic { animation: prestige-rainbow 4s linear infinite; }
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
