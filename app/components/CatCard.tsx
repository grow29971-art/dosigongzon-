"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Heart } from "lucide-react";
import { SHOP_ITEMS, type ShopItemKey } from "@/lib/shop-config";

export type CardRarity = "common" | "uncommon" | "rare" | "legendary";

// 반짝이 가루 / 별빛 가루 테두리 코스메틱용 — 매 렌더마다 랜덤이면 깜빡이는 위치가
// 계속 바뀌어 어수선해 보여서, 고정된 배치를 카드 둘레에 고르게 흩어놓고 딜레이만 다르게 줌.
const SPARKLE_POS = [
  { x: 8, y: 12, delay: 0 }, { x: 88, y: 8, delay: 0.3 }, { x: 95, y: 45, delay: 0.7 },
  { x: 85, y: 88, delay: 0.15 }, { x: 50, y: 96, delay: 0.5 }, { x: 12, y: 85, delay: 0.9 },
  { x: 3, y: 50, delay: 1.1 }, { x: 30, y: 4, delay: 1.3 },
];

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
  // PVP/PVE 승·패·무 전적(box/supabase_battle_record_draw_migration.sql) — 카드 상세 표시용.
  pvp_wins?: number | null;
  pvp_losses?: number | null;
  pvp_draws?: number | null;
  pve_losses?: number | null;
  pve_draws?: number | null;
  // 상점에서 산 테두리 코스메틱(lib/shop-config.ts BorderFxKey) — 전투 능력치엔 영향 없음.
  // 있으면 프레임 숙련도 광채보다 우선 표시(둘 다 필터 애니메이션이라 섞으면 지저분해짐).
  equipped_border_key?: string | null;
}

interface CatCardProps {
  name: string;
  photoUrl: string | null;
  card: CatCardData;
  // "battle" = 배틀 화면 1:1 대결 카드 전용 크기 (sm보다 큼, 기술 미리보기 생략)
  size?: "sm" | "md" | "lg" | "battle";
  onClick?: () => void;
}

// 등급별 테마 — CatCard(파스텔 카드 프레임)와 map/page.tsx(고양이 상세 팝업)가
// 공유하는 단일 소스. 예전엔 이 둘이 CARD_THEME(진한 원색)/SOFT_THEME(파스텔)로
// 나뉘어 있었는데, map 팝업도 이미 파스텔 톤으로 옮겨가면서 진한 버전을 쓰는 곳이
// 하나도 안 남아 하나로 합침.
export const CARD_THEME = {
  common: {
    shellBg: "linear-gradient(160deg,#FBFEF7,#F1F8E8)",
    frameOuter: "#A9D488",
    accent: "#5FA83D",
    typeIcon: "🌿",
    typeBg: "#7BC957",
    label: "일반",
    rarity: "◆",
    weak: "🔥",
  },
  uncommon: {
    shellBg: "linear-gradient(160deg,#FAFDFF,#EAF4FF)",
    frameOuter: "#8FC1F5",
    accent: "#3D7FC9",
    typeIcon: "💧",
    typeBg: "#5F9DE8",
    label: "희귀",
    rarity: "◆◆",
    weak: "⚡",
  },
  rare: {
    shellBg: "linear-gradient(160deg,#FCFAFF,#F1E9FF)",
    frameOuter: "#C1A6F0",
    accent: "#7D53C9",
    typeIcon: "⚡",
    typeBg: "#A47BEE",
    label: "레어",
    rarity: "◆◆◆",
    weak: "🌿",
  },
  legendary: {
    shellBg: "linear-gradient(160deg,#FFFCF2,#FFF1D2)",
    frameOuter: "#EFC15E",
    accent: "#C98A1E",
    typeIcon: "🔥",
    typeBg: "#EFAF3A",
    label: "레전드",
    rarity: "◆◆◆◆",
    weak: "💧",
  },
};

// ── 성격 스탯 레이더 차트 (귀여움/야생성/사교성/신비로움 4축) ──
// lg 사이즈(확대 모달)에서만 보여줌 — 그리드에 여러 장 깔리는 sm/md/battle은
// 차트가 너무 작아져 안 보이므로 기존 아이콘+숫자 한 줄이 더 적합.
function RadarChart({ stats, color }: { stats: { cuteness: number; wildness: number; sociability: number; mysteriousness: number }; color: string }) {
  const size = 132;
  const cx = size / 2, cy = size / 2, maxR = 48;
  const axes = [
    { key: "cuteness", label: "🐾", value: stats.cuteness, angle: -90 },
    { key: "wildness", label: "🔥", value: stats.wildness, angle: 0 },
    { key: "sociability", label: "🌿", value: stats.sociability, angle: 90 },
    { key: "mysteriousness", label: "✨", value: stats.mysteriousness, angle: 180 },
  ];
  const pt = (angleDeg: number, r: number) => {
    const rad = (angleDeg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };
  const dataPoints = axes.map(a => pt(a.angle, (Math.max(0, Math.min(100, a.value)) / 100) * maxR));
  const dataPath = dataPoints.map(p => `${p.x},${p.y}`).join(" ");
  const gridLevels = [0.33, 0.66, 1];
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {gridLevels.map((lv, i) => {
        const ring = axes.map(a => pt(a.angle, maxR * lv)).map(p => `${p.x},${p.y}`).join(" ");
        return <polygon key={i} points={ring} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth={1} />;
      })}
      {axes.map((a, i) => {
        const edge = pt(a.angle, maxR);
        return <line key={i} x1={cx} y1={cy} x2={edge.x} y2={edge.y} stroke="rgba(0,0,0,0.08)" strokeWidth={1} />;
      })}
      <polygon points={dataPath} fill={`${color}33`} stroke={color} strokeWidth={2} strokeLinejoin="round" />
      {dataPoints.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={2.5} fill={color} />)}
      {axes.map((a, i) => {
        const labelPt = pt(a.angle, maxR + 14);
        return (
          <text key={i} x={labelPt.x} y={labelPt.y + 4} textAnchor="middle" fontSize={13}>
            {a.label}
          </text>
        );
      })}
    </svg>
  );
}

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

function CardFace({ name, photoUrl, card, size }: Omit<CatCardProps, "onClick"> & { size: "sm" | "md" | "lg" | "battle" }) {
  // 스토리지에서 사진이 삭제됐거나 네트워크 오류로 로드 실패하면 깨진 이미지 아이콘
  // 대신 이모지 placeholder로 대체 — photoUrl이 바뀌면(다른 카드로 교체) 다시 시도.
  const [photoFailed, setPhotoFailed] = useState(false);
  useEffect(() => { setPhotoFailed(false); }, [photoUrl]);

  const rarity = (card.card_rarity ?? "common") as CardRarity;
  const cfg = CARD_THEME[rarity] ?? CARD_THEME.common;
  const isSm = size === "sm";
  const isLg = size === "lg";
  const isBattle = size === "battle";
  const compact = isSm || isBattle; // 기술 미리보기 등 부가 정보를 생략하는 좁은 카드 공통 처리

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
  const W = isLg ? 300 : isBattle ? 138 : isSm ? 130 : 190;
  const photoH = isLg ? 180 : isBattle ? 96 : isSm ? 78 : 114;
  const radius = isLg ? 26 : isBattle ? 18 : isSm ? 16 : 20;
  const innerRadius = Math.max(10, radius - 8);
  const pad = isLg ? 12 : isBattle ? 9 : isSm ? 8 : 10;
  const shadowBlur = isLg ? 22 : isSm ? 12 : 16;

  const fs = {
    label: isLg ? 10 : isBattle ? 8.5 : isSm ? 8 : 9,
    name: isLg ? 16 : isBattle ? 12.5 : isSm ? 11 : 13,
    hp: isLg ? 15 : isBattle ? 12.5 : isSm ? 11 : 13,
    flavor: isLg ? 10.5 : 9,
    dex: isLg ? 9 : isBattle ? 7.5 : isSm ? 7 : 8,
    subtitle: isLg ? 9.5 : isBattle ? 8 : 7.5,
    moveName: isLg ? 11.5 : 9,
    movePow: isLg ? 15 : isSm ? 11 : 13,
    bottom: isLg ? 9 : isBattle ? 8 : 8,
  };

  // 테두리 코스메틱이 장착돼 있으면 프레임 숙련도 광채보다 우선 표시.
  // card.equipped_border_key는 상점 아이템 키("border_gold")가 그대로 들어있어서
  // CSS 클래스명(.border-fx-gold)과 안 맞았던 버그가 있었음 — SHOP_ITEMS에서
  // 실제 이펙트 접미사("gold")를 찾아서 써야 클래스가 정확히 매칭된다.
  const borderFxKey = card.equipped_border_key;
  const borderFx = borderFxKey ? SHOP_ITEMS[borderFxKey as ShopItemKey]?.borderFx : undefined;
  const borderFxClass = borderFx ? `border-fx-${borderFx}` : (tier === "prismatic" ? "prestige-prismatic" : undefined);

  return (
    <div
      className={borderFxClass}
      style={{
        width: W,
        borderRadius: radius,
        background: cfg.shellBg,
        boxShadow: `0 ${isLg?8:5}px ${shadowBlur}px rgba(70,60,40,0.14), inset 0 0 0 2px #fff, inset 0 0 0 4px ${cfg.frameOuter}`,
        filter: borderFxKey ? undefined : (PRESTIGE_GLOW[tier] || undefined),
        overflow: "visible",
        flexShrink: 0,
        position: "relative",
        userSelect: "none",
        padding: pad,
        ["--shadow-offset" as string]: "0px",
      } as React.CSSProperties}
    >
      {/* ── 상단 리본: 등급 + HP ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 5, marginBottom: isSm ? 5 : 6 }}>
        <span style={{
          background: "#fff", borderRadius: "var(--radius-full)",
          padding: isLg ? "3px 10px" : "2px 7px",
          fontSize: fs.label, fontWeight: 800, color: cfg.accent,
          boxShadow: "0 1px 4px rgba(0,0,0,0.12)", flexShrink: 0,
        }}>
          {cfg.label}
        </span>
        <span style={{
          display: "flex", alignItems: "center", gap: 3,
          background: "#fff", borderRadius: "var(--radius-full)",
          padding: isLg ? "3px 9px" : "2px 6px",
          boxShadow: "0 1px 4px rgba(0,0,0,0.12)", flexShrink: 0,
        }}>
          <Heart size={fs.hp - 2} fill="#FF6B81" color="#FF6B81" />
          <span style={{ fontSize: fs.hp, fontWeight: 800, color: "#2B2B3D", lineHeight: 1 }}>{hpDisplay}</span>
        </span>
      </div>

      {/* ── 부제(플레이버) + 이름 — 사진 위 ── */}
      <div style={{ marginBottom: isSm ? 4 : 5 }}>
        {!isSm && card.card_flavor && (
          <div style={{
            fontSize: fs.subtitle, color: "#9A958A", fontWeight: 600, lineHeight: 1.25,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {card.card_flavor}
          </div>
        )}
        <div style={{
          fontSize: fs.name, fontWeight: 800, color: "#3A3630", lineHeight: 1.2,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {card.card_name ?? name}
        </div>
      </div>

      {/* ── 사진 프레임 ── */}
      <div style={{
        borderRadius: innerRadius, overflow: "hidden", position: "relative",
        boxShadow: `inset 0 0 0 2px #fff, inset 0 0 0 4px ${cfg.frameOuter}`,
        background: "#fff",
      }}>
        <div style={{ height: photoH, overflow: "hidden", position: "relative", background: "#F3F1EA" }}>
          {photoUrl && !photoFailed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt={name} onError={() => setPhotoFailed(true)}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          ) : (
            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: isSm ? 30 : 46 }}>{card.placeholder_emoji ?? "🐱"}</div>
          )}
        </div>
      </div>

      {/* ── 도감번호 + 이름(축약) + 레벨 — 사진 아래 ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, marginTop: isSm ? 5 : 7 }}>
        <span style={{
          fontSize: fs.dex, color: "#9A958A", fontWeight: 600,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0,
        }}>
          No.{dexNo} · {name}
        </span>
        <span style={{
          background: lv >= 10 ? "linear-gradient(135deg,#FFD76A,#FFA83A)" : "#FF6B81",
          color: "#fff", fontWeight: 800, borderRadius: "var(--radius-full)",
          padding: isLg ? "3px 10px" : "2px 7px", fontSize: fs.dex + 1, flexShrink: 0,
        }}>
          Lv.{lv}
        </span>
      </div>

      {/* ── 성격 스탯 — lg(확대 모달)는 레이더 차트, md는 기존 아이콘+숫자 한 줄 ── */}
      {isLg && (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
          <RadarChart stats={stats} color={cfg.accent} />
        </div>
      )}
      {!isSm && !isLg && (
        <div style={{
          display: "flex", justifyContent: "space-between", marginTop: 6,
          background: "#fff", borderRadius: "var(--radius-input)", padding: "5px 6px",
          boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.05)",
        }}>
          {statRow.map((s, i) => (
            <span key={i} style={{ display: "flex", alignItems: "center", gap: 3, fontSize: fs.bottom }}>
              <span style={{ fontSize: 11 }}>{s.icon}</span>
              <span style={{ fontWeight: 700, color: "#5A554C" }}>{s.value}</span>
            </span>
          ))}
        </div>
      )}

      {/* ── 성장 훈장 스티커 (영구 기록) — 배틀 카드는 공간상 생략 ── */}
      {!isBattle && (
        <div style={{ display: "flex", alignItems: "center", gap: isSm ? 3 : 4, marginTop: isSm ? 5 : 7 }}>
          {badges.map((b) => (
            <span key={b.label} title={b.label} style={{
              width: isLg ? 20 : isSm ? 14 : 17, height: isLg ? 20 : isSm ? 14 : 17,
              borderRadius: "50%",
              background: b.isUnlocked ? cfg.typeBg : "#EFEDE6",
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
      )}

      {/* ── PVP/PVE 전적 — 카드 공간이 넉넉한 확대 보기(lg)에서만 표시 ── */}
      {isLg && (
        <div style={{
          display: "flex", flexDirection: "column", gap: 3, marginTop: 6,
          background: "#fff", borderRadius: 12, padding: "7px 10px",
          boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.05)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11 }}>
            <span style={{ fontWeight: 800, color: "var(--color-primary-dark)", flexShrink: 0 }}>⚔️ PVP</span>
            <span style={{ color: "#5A554C", fontWeight: 600 }}>
              {card.pvp_wins ?? 0}승 {card.pvp_losses ?? 0}패 {card.pvp_draws ?? 0}무
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11 }}>
            <span style={{ fontWeight: 800, color: "#5FA83D", flexShrink: 0 }}>🐾 PVE</span>
            <span style={{ color: "#5A554C", fontWeight: 600 }}>
              {card.pve_win_count ?? 0}승 {card.pve_losses ?? 0}패 {card.pve_draws ?? 0}무
            </span>
          </div>
        </div>
      )}

      {/* ── 카드 본문 (기술) — 배틀 카드는 생략(하단 스킬 버튼과 중복) ── */}
      {!compact && (
        <div style={{ display: "flex", flexDirection: "column", gap: isLg ? 6 : 4, marginTop: isLg ? 8 : 6 }}>
          <div style={{
            background: "#fff", borderRadius: 12, padding: isLg ? "6px 9px" : "4px 7px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.05)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 0 }}>
              <span style={{ fontSize: isLg ? 11 : 9, flexShrink: 0 }}>{pickIcon(move1)}</span>
              <span style={{ fontSize: fs.moveName, color: "#3A3630", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{move1}</span>
            </div>
            <span style={{ fontSize: fs.movePow, fontWeight: 800, color: cfg.accent, flexShrink: 0, marginLeft: 4 }}>{move1Power}</span>
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

      {/* ── 하단: 속성(+약점) / 후퇴 ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginTop: isSm ? 5 : 7, paddingTop: isSm ? 5 : 7,
        borderTop: `1.5px dashed ${cfg.frameOuter}66`,
      }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: fs.bottom, color: "#9A958A", fontWeight: 600 }}>
          <span style={{
            width: 15, height: 15, borderRadius: "50%", background: cfg.typeBg,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8.5,
          }}>{cfg.typeIcon}</span>
          속성
          <span style={{ color: "#C4BFB2" }}>·</span>
          {cfg.weak}×2
        </span>
        <span style={{ fontSize: fs.bottom, color: "#9A958A", fontWeight: 600, display: "flex", alignItems: "center", gap: 3 }}>
          후퇴
          <span style={{ color: cfg.accent, letterSpacing: 1 }}>{cfg.rarity}</span>
        </span>
      </div>

      {/* ── 테두리 코스메틱 오버레이 — 이름이 약속하는 느낌에 맞게 기법을 나눔 ──
          gold/holo/rainbow = 광택이 대각선으로 스윽 훑고 지나감
          sparkle/starlight = 카드 둘레에서 반짝임이 팝팝 터짐
          그 외(neon_*, fire, ice, shadow) = 아래 border-fx-* 클래스의 은은한 맥박 그대로 */}
      {(borderFx === "gold" || borderFx === "holo" || borderFx === "rainbow") && (
        <div style={{ position: "absolute", inset: 0, borderRadius: radius, overflow: "hidden", pointerEvents: "none", zIndex: 40 }}>
          <div style={{
            position: "absolute", top: "-60%", left: "-60%", width: "220%", height: "220%",
            background: borderFx === "gold"
              ? "linear-gradient(112deg, transparent 44%, rgba(255,240,170,0.9) 50%, transparent 56%)"
              : borderFx === "holo"
                ? "linear-gradient(112deg, transparent 38%, rgba(120,220,255,0.55) 45%, rgba(255,120,220,0.55) 50%, rgba(255,235,120,0.55) 55%, transparent 62%)"
                : "conic-gradient(from 0deg, #FF5050, #FFD23C, #78FF8C, #64B4FF, #D278FF, #FF5050)",
            opacity: borderFx === "rainbow" ? 0.35 : 1,
            animation: borderFx === "rainbow" ? "border-sweep-spin 3.5s linear infinite" : "border-sweep-move 2.4s ease-in-out infinite",
          }} />
        </div>
      )}
      {(borderFx === "sparkle" || borderFx === "starlight") && (
        <div style={{ position: "absolute", inset: -3, pointerEvents: "none", zIndex: 40 }}>
          {SPARKLE_POS.map((p, i) => (
            <span key={i} style={{
              position: "absolute", left: `${p.x}%`, top: `${p.y}%`, transform: "translate(-50%,-50%)",
              fontSize: borderFx === "starlight" ? 11 : 8,
              animation: `sparkle-twinkle ${borderFx === "starlight" ? 2.2 : 1.3}s ease-in-out infinite`,
              animationDelay: `${p.delay}s`,
            }}>{borderFx === "starlight" ? "✨" : "･"}</span>
          ))}
        </div>
      )}
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

        /* ── 상점 테두리 코스메틱 10종 — 순수 시각 효과, 프레임 숙련도와 같은
           drop-shadow 필터 애니메이션 기법을 재사용해 카드 모양은 안 건드림 ── */
        @keyframes fx-rainbow {
          0%   { filter: drop-shadow(0 0 6px rgba(255,80,80,0.95)) drop-shadow(0 0 14px rgba(255,80,80,0.6)); }
          20%  { filter: drop-shadow(0 0 6px rgba(255,210,60,0.95)) drop-shadow(0 0 14px rgba(255,210,60,0.6)); }
          40%  { filter: drop-shadow(0 0 6px rgba(120,255,140,0.95)) drop-shadow(0 0 14px rgba(120,255,140,0.6)); }
          60%  { filter: drop-shadow(0 0 6px rgba(100,180,255,0.95)) drop-shadow(0 0 14px rgba(100,180,255,0.6)); }
          80%  { filter: drop-shadow(0 0 6px rgba(210,120,255,0.95)) drop-shadow(0 0 14px rgba(210,120,255,0.6)); }
          100% { filter: drop-shadow(0 0 6px rgba(255,80,80,0.95)) drop-shadow(0 0 14px rgba(255,80,80,0.6)); }
        }
        .border-fx-rainbow { animation: fx-rainbow 3s linear infinite; }

        @keyframes fx-gold {
          0%,100% { filter: drop-shadow(0 0 6px rgba(255,215,60,0.95)) drop-shadow(0 0 14px rgba(255,180,0,0.65)); }
          50% { filter: drop-shadow(0 0 10px rgba(255,235,140,1)) drop-shadow(0 0 20px rgba(255,200,40,0.85)); }
        }
        .border-fx-gold { animation: fx-gold 2.2s ease-in-out infinite; }

        @keyframes fx-holo {
          0% { filter: drop-shadow(0 0 7px rgba(120,220,255,0.9)) drop-shadow(0 0 14px rgba(120,220,255,0.5)); }
          33% { filter: drop-shadow(0 0 7px rgba(255,120,220,0.9)) drop-shadow(0 0 14px rgba(255,120,220,0.5)); }
          66% { filter: drop-shadow(0 0 7px rgba(255,235,120,0.9)) drop-shadow(0 0 14px rgba(255,235,120,0.5)); }
          100% { filter: drop-shadow(0 0 7px rgba(120,220,255,0.9)) drop-shadow(0 0 14px rgba(120,220,255,0.5)); }
        }
        .border-fx-holo { animation: fx-holo 3s ease-in-out infinite; }

        @keyframes fx-sparkle {
          0%,100% { filter: drop-shadow(0 0 4px rgba(255,255,255,0.9)) drop-shadow(0 0 9px rgba(255,255,255,0.5)); }
          50% { filter: drop-shadow(0 0 11px rgba(255,255,255,1)) drop-shadow(0 0 22px rgba(255,255,255,0.85)); }
        }
        .border-fx-sparkle { animation: fx-sparkle 1.1s ease-in-out infinite; }

        @keyframes fx-neon_blue {
          0%,100% { filter: drop-shadow(0 0 5px rgba(80,160,255,0.9)) drop-shadow(0 0 12px rgba(80,160,255,0.55)); }
          50% { filter: drop-shadow(0 0 9px rgba(120,190,255,1)) drop-shadow(0 0 18px rgba(80,160,255,0.8)); }
        }
        .border-fx-neon_blue { animation: fx-neon_blue 1.8s ease-in-out infinite; }

        @keyframes fx-neon_pink {
          0%,100% { filter: drop-shadow(0 0 5px rgba(255,100,190,0.9)) drop-shadow(0 0 12px rgba(255,100,190,0.55)); }
          50% { filter: drop-shadow(0 0 9px rgba(255,150,210,1)) drop-shadow(0 0 18px rgba(255,100,190,0.8)); }
        }
        .border-fx-neon_pink { animation: fx-neon_pink 1.8s ease-in-out infinite; }

        @keyframes fx-fire {
          0%,100% { filter: drop-shadow(0 0 6px rgba(255,120,40,0.95)) drop-shadow(0 0 13px rgba(255,60,20,0.65)); }
          50% { filter: drop-shadow(0 0 10px rgba(255,180,60,1)) drop-shadow(0 0 20px rgba(255,90,20,0.85)); }
        }
        .border-fx-fire { animation: fx-fire 0.9s ease-in-out infinite; }

        @keyframes fx-ice {
          0%,100% { filter: drop-shadow(0 0 6px rgba(160,230,255,0.9)) drop-shadow(0 0 13px rgba(120,210,255,0.55)); }
          50% { filter: drop-shadow(0 0 10px rgba(220,250,255,1)) drop-shadow(0 0 20px rgba(160,230,255,0.8)); }
        }
        .border-fx-ice { animation: fx-ice 2.5s ease-in-out infinite; }

        @keyframes fx-starlight {
          0%,100% { filter: drop-shadow(0 0 5px rgba(255,245,200,0.85)) drop-shadow(0 0 12px rgba(255,220,140,0.5)); }
          50% { filter: drop-shadow(0 0 9px rgba(255,250,220,1)) drop-shadow(0 0 18px rgba(255,230,160,0.75)); }
        }
        .border-fx-starlight { animation: fx-starlight 2.6s ease-in-out infinite; }

        @keyframes fx-shadow {
          0%,100% { filter: drop-shadow(0 0 6px rgba(110,60,160,0.8)) drop-shadow(0 0 14px rgba(40,20,60,0.6)); }
          50% { filter: drop-shadow(0 0 10px rgba(150,90,200,0.9)) drop-shadow(0 0 20px rgba(60,30,90,0.8)); }
        }
        .border-fx-shadow { animation: fx-shadow 2.8s ease-in-out infinite; }

        /* 골드 샤인 / 홀로그램 — 대각선 광택 밴드가 카드를 스윽 훑고 지나감 */
        @keyframes border-sweep-move {
          0%   { transform: translate(-30%, -30%); }
          50%  { transform: translate(30%, 30%); }
          100% { transform: translate(-30%, -30%); }
        }
        /* 무지개 테두리 — 링 자체가 실제로 빙글빙글 회전 */
        @keyframes border-sweep-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        /* 반짝이 가루 / 별빛 가루 — 카드 둘레에서 팝팝 터지듯 반짝임 */
        @keyframes sparkle-twinkle {
          0%, 100% { opacity: 0; transform: translate(-50%,-50%) scale(0.4); }
          50%      { opacity: 1; transform: translate(-50%,-50%) scale(1.15); }
        }
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
