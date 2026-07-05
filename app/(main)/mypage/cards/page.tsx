"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import CatCard, { type CatCardData, type CardRarity } from "@/app/components/CatCard";

interface CardCat {
  id: string;
  name: string;
  photo_url: string | null;
  card_rarity: CardRarity;
  card_name: string | null;
  card_traits: string[];
  card_stats: CatCardData["card_stats"];
  card_flavor: string | null;
  card_generated_at: string;
}

const RARITY_ORDER: CardRarity[] = ["legendary", "rare", "uncommon", "common"];

const RARITY_LABELS: Record<CardRarity, string> = {
  legendary: "레전더리",
  rare: "레어",
  uncommon: "언커먼",
  common: "코먼",
};

export default function MyCardsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [cats, setCats] = useState<CardCat[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<CardRarity | "all">("all");

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace("/login"); return; }

    (async () => {
      const { data } = await createClient()
        .from("cats")
        .select("id,name,photo_url,card_rarity,card_name,card_traits,card_stats,card_flavor,card_generated_at")
        .eq("caretaker_id", user.id)
        .not("card_generated_at", "is", null)
        .order("card_rarity", { ascending: false })
        .order("card_generated_at", { ascending: false });

      setCats((data ?? []) as CardCat[]);
      setLoading(false);
    })();
  }, [user, authLoading, router]);

  const filtered = filter === "all" ? cats : cats.filter(c => c.card_rarity === filter);
  const counts = RARITY_ORDER.reduce((acc, r) => {
    acc[r] = cats.filter(c => c.card_rarity === r).length;
    return acc;
  }, {} as Record<CardRarity, number>);

  return (
    <div className="min-h-dvh" style={{ background: "#0F0F1A" }}>
      {/* 헤더 */}
      <div className="sticky top-0 z-10 px-4 pt-safe pt-4 pb-3 flex items-center gap-3" style={{ background: "#0F0F1A" }}>
        <button onClick={() => router.back()} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.08)" }}>
          <ArrowLeft size={18} className="text-white" />
        </button>
        <h1 className="text-[17px] font-extrabold text-white">내 고양이 카드</h1>
        <span className="text-[13px] text-gray-400 ml-auto">{cats.length}장</span>
      </div>

      <div className="px-4 pb-24">
        {/* 희귀도 필터 */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1 no-scrollbar">
          {(["all", ...RARITY_ORDER] as const).map((r) => (
            <button
              key={r}
              onClick={() => setFilter(r)}
              className="shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all"
              style={{
                background: filter === r ? "white" : "rgba(255,255,255,0.08)",
                color: filter === r ? "#0F0F1A" : "rgba(255,255,255,0.6)",
              }}
            >
              {r === "all" ? `전체 ${cats.length}` : `${RARITY_LABELS[r]} ${counts[r]}`}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 size={28} className="animate-spin text-gray-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-500 text-[14px]">
              {filter === "all" ? "아직 카드가 없어요" : `${RARITY_LABELS[filter as CardRarity]} 카드가 없어요`}
            </p>
            <p className="text-gray-600 text-[12px] mt-1">고양이를 등록하면 카드가 생성돼요</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((cat) => (
              <div key={cat.id} className="flex justify-center">
                <CatCard
                  name={cat.name}
                  photoUrl={cat.photo_url}
                  card={{
                    card_rarity: cat.card_rarity,
                    card_name: cat.card_name,
                    card_traits: cat.card_traits ?? [],
                    card_stats: cat.card_stats,
                    card_flavor: cat.card_flavor,
                  }}
                  size="sm"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
