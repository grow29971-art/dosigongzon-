"use client";

export type CardRarity = "common" | "uncommon" | "rare" | "legendary";

export interface CatCardData {
  card_rarity: CardRarity;
  card_name: string | null;
  card_traits: string[];
  card_stats: { cuteness: number; wildness: number; sociability: number; mysteriousness: number } | null;
  card_flavor: string | null;
}

interface CatCardProps {
  name: string;
  photoUrl: string | null;
  card: CatCardData;
  size?: "sm" | "md" | "lg";
}

const RARITY = {
  common:    { label: "COMMON",    gradient: "from-gray-200 to-gray-400",       border: "#9CA3AF", glow: "rgba(156,163,175,0.4)", star: "⭐" },
  uncommon:  { label: "UNCOMMON",  gradient: "from-green-200 to-emerald-500",   border: "#10B981", glow: "rgba(16,185,129,0.4)",  star: "⭐⭐" },
  rare:      { label: "RARE",      gradient: "from-blue-300 to-violet-500",     border: "#6366F1", glow: "rgba(99,102,241,0.5)",  star: "⭐⭐⭐" },
  legendary: { label: "LEGENDARY", gradient: "from-amber-300 via-orange-400 to-yellow-300", border: "#F59E0B", glow: "rgba(245,158,11,0.6)", star: "⭐⭐⭐⭐" },
};

const STAT_LABELS: Record<string, string> = {
  cuteness:      "귀여움",
  wildness:      "야생성",
  sociability:   "친화력",
  mysteriousness:"신비로움",
};

const STAT_COLORS: Record<string, string> = {
  cuteness:      "#F472B6",
  wildness:      "#F97316",
  sociability:   "#34D399",
  mysteriousness:"#A78BFA",
};

export default function CatCard({ name, photoUrl, card, size = "md" }: CatCardProps) {
  const r = RARITY[card.card_rarity] ?? RARITY.common;
  const isLg = size === "lg";
  const isSm = size === "sm";

  const cardW = isLg ? 280 : isSm ? 140 : 200;
  const imgH = isLg ? 200 : isSm ? 100 : 140;
  const nameSz = isLg ? "text-[15px]" : isSm ? "text-[11px]" : "text-[13px]";
  const flavorSz = isLg ? "text-[11px]" : "text-[10px]";
  const badgeSz = isLg ? "text-[10px] px-2 py-0.5" : "text-[9px] px-1.5 py-0.5";
  const statSz = isLg ? "text-[10px]" : "text-[9px]";

  return (
    <div
      style={{
        width: cardW,
        borderRadius: 18,
        border: `2px solid ${r.border}`,
        boxShadow: `0 0 18px ${r.glow}, 0 4px 16px rgba(0,0,0,0.15)`,
        background: "white",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      {/* 상단 그라디언트 헤더 */}
      <div className={`bg-gradient-to-r ${r.gradient} flex items-center justify-between px-3 py-1.5`}>
        <span className={`font-black text-white tracking-wider ${badgeSz}`} style={{ textShadow: "0 1px 2px rgba(0,0,0,0.3)" }}>
          {r.label}
        </span>
        <span className={flavorSz}>{r.star}</span>
      </div>

      {/* 고양이 사진 */}
      <div style={{ height: imgH, background: "#F3F4F6", overflow: "hidden" }}>
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrl}
            alt={name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300 text-4xl">🐱</div>
        )}
      </div>

      {/* 카드 정보 */}
      <div className="px-3 pt-2 pb-3 space-y-2">
        {/* 이름 + 카드명 */}
        <div>
          <p className={`font-black text-gray-900 leading-tight ${nameSz}`}>
            {card.card_name ?? name}
          </p>
          {card.card_name && (
            <p className={`text-gray-400 ${flavorSz}`}>{name}</p>
          )}
          {card.card_flavor && !isSm && (
            <p className={`text-gray-500 italic mt-0.5 ${flavorSz}`}>"{card.card_flavor}"</p>
          )}
        </div>

        {/* 성격 태그 */}
        {card.card_traits.length > 0 && !isSm && (
          <div className="flex flex-wrap gap-1">
            {card.card_traits.slice(0, isLg ? 4 : 3).map((t) => (
              <span
                key={t}
                className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold"
                style={{ background: `${r.border}20`, color: r.border }}
              >
                {t}
              </span>
            ))}
          </div>
        )}

        {/* 스탯 바 */}
        {card.card_stats && !isSm && (
          <div className="space-y-1">
            {Object.entries(card.card_stats).map(([key, val]) => (
              <div key={key}>
                <div className={`flex justify-between items-center mb-0.5 ${statSz}`}>
                  <span className="text-gray-500">{STAT_LABELS[key] ?? key}</span>
                  <span className="font-bold" style={{ color: STAT_COLORS[key] }}>{val}</span>
                </div>
                <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${Math.min(val, 100)}%`, background: STAT_COLORS[key] }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
