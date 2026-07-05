"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import CatCard, { type CatCardData, type CardRarity } from "@/app/components/CatCard";

interface RegionCat {
  id: string;
  name: string;
  photo_url: string | null;
  card_rarity: CardRarity | null;
  card_name: string | null;
  card_traits: string[] | null;
  card_stats: CatCardData["card_stats"];
  card_flavor: string | null;
  card_level: number;
  card_exp: number;
  card_generated_at: string | null;
  caretaker_id: string | null;
  area: string | null;
  isMine: boolean;
  isDiscovered: boolean; // 돌본 적 있는 고양이
}

export default function PokedexPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [cats, setCats] = useState<RegionCat[]>([]);
  const [loading, setLoading] = useState(true);
  const [myRegions, setMyRegions] = useState<string[]>([]);

  useEffect(() => {
    if (authLoading || !user) return;
    const sb = createClient();

    (async () => {
      // 내 활동 지역
      const { data: profile } = await sb
        .from("profiles").select("activity_regions").eq("id", user.id).maybeSingle();
      const regions: string[] = (profile as { activity_regions?: string[] } | null)?.activity_regions ?? [];
      setMyRegions(regions);

      if (regions.length === 0) { setLoading(false); return; }

      // 지역 내 전체 카드 있는 고양이
      const { data: regionCats } = await sb
        .from("cats")
        .select("id,name,photo_url,card_rarity,card_name,card_traits,card_stats,card_flavor,card_level,card_exp,card_generated_at,caretaker_id,area")
        .in("area", regions)
        .not("card_generated_at", "is", null)
        .in("visibility", ["public", "neighborhood"])
        .order("card_rarity", { ascending: false });

      if (!regionCats || regionCats.length === 0) { setLoading(false); return; }

      // 내가 돌본 고양이 ids
      const catIds = regionCats.map((c: {id: string}) => c.id);
      const { data: myLogs } = await sb
        .from("care_logs")
        .select("cat_id")
        .eq("author_id", user.id)
        .in("cat_id", catIds);
      const discoveredIds = new Set((myLogs ?? []).map((l: {cat_id: string}) => l.cat_id));

      setCats((regionCats as RegionCat[]).map(c => ({
        ...c,
        isMine: c.caretaker_id === user.id,
        isDiscovered: discoveredIds.has(c.id),
      })));
      setLoading(false);
    })();
  }, [user, authLoading]);

  const mine    = cats.filter(c => c.isMine);
  const found   = cats.filter(c => !c.isMine && c.isDiscovered);
  const unknown = cats.filter(c => !c.isMine && !c.isDiscovered);

  return (
    <div className="min-h-dvh pb-24" style={{ background: "#0A0F1A" }}>
      <div className="sticky top-0 z-10 flex items-center gap-3 px-4 pt-safe pt-4 pb-3" style={{ background: "rgba(10,15,26,0.95)" }}>
        <button onClick={() => router.back()} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.08)" }}>
          <ArrowLeft size={18} color="white" />
        </button>
        <div>
          <h1 className="text-[17px] font-extrabold text-white">지역 고양이 도감</h1>
          <p className="text-[11px] text-gray-500">{myRegions.join(", ") || "활동 지역 미설정"}</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-[13px] font-black text-white">{mine.length + found.length}<span className="text-gray-500 font-normal text-[11px]"> / {cats.length}</span></p>
          <p className="text-[10px] text-gray-500">수집</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-gray-500" /></div>
      ) : cats.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-[32px] mb-3">🐱</p>
          <p className="text-gray-500 text-[14px]">이 지역에 아직 등록된 카드가 없어요</p>
          <p className="text-gray-600 text-[12px] mt-1">첫 고양이를 등록해보세요!</p>
        </div>
      ) : (
        <div className="px-4 space-y-6 mt-4">

          {/* 진행 바 */}
          <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.05)" }}>
            <div className="flex justify-between text-[12px] text-gray-400 mb-2">
              <span>수집 진행도</span>
              <span className="text-white font-bold">{Math.round((mine.length + found.length) / cats.length * 100)}%</span>
            </div>
            <div className="h-2 rounded-full" style={{ background: "rgba(255,255,255,0.1)" }}>
              <div className="h-full rounded-full transition-all"
                style={{ width: `${(mine.length + found.length) / cats.length * 100}%`, background: "linear-gradient(90deg,#6060FF,#C060FF)" }} />
            </div>
            <div className="flex gap-4 mt-3 text-[11px]">
              <span><span className="text-purple-400 font-bold">{mine.length}</span> 내 카드</span>
              <span><span className="text-blue-400 font-bold">{found.length}</span> 발견</span>
              <span><span className="text-gray-500 font-bold">{unknown.length}</span> 미발견</span>
            </div>
          </div>

          {/* 내 카드 */}
          {mine.length > 0 && (
            <section>
              <p className="text-[13px] font-bold text-purple-300 mb-3">✦ 내 카드 ({mine.length})</p>
              <div className="grid grid-cols-2 gap-3">
                {mine.map(cat => (
                  <div key={cat.id} className="flex justify-center">
                    <CatCard name={cat.name} photoUrl={cat.photo_url}
                      card={{ card_rarity: cat.card_rarity ?? "common", card_name: cat.card_name, card_traits: cat.card_traits ?? [], card_stats: cat.card_stats, card_flavor: cat.card_flavor, card_level: cat.card_level, card_exp: cat.card_exp }}
                      size="sm" />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 발견한 고양이 */}
          {found.length > 0 && (
            <section>
              <p className="text-[13px] font-bold text-blue-300 mb-3">💙 돌본 적 있는 고양이 ({found.length})</p>
              <div className="grid grid-cols-2 gap-3">
                {found.map(cat => (
                  <div key={cat.id} className="flex justify-center" style={{ filter: "saturate(0.4)" }}>
                    <CatCard name={cat.name} photoUrl={cat.photo_url}
                      card={{ card_rarity: cat.card_rarity ?? "common", card_name: cat.card_name, card_traits: cat.card_traits ?? [], card_stats: cat.card_stats, card_flavor: cat.card_flavor, card_level: cat.card_level, card_exp: cat.card_exp }}
                      size="sm" />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 미발견 */}
          {unknown.length > 0 && (
            <section>
              <p className="text-[13px] font-bold text-gray-500 mb-3">❓ 미발견 ({unknown.length})</p>
              <div className="grid grid-cols-2 gap-3">
                {unknown.map(cat => (
                  <div key={cat.id} className="flex justify-center">
                    {/* 실루엣 카드 */}
                    <div style={{
                      width: 130, borderRadius: 12, overflow: "hidden",
                      border: "2px solid rgba(255,255,255,0.08)",
                      background: "rgba(255,255,255,0.04)",
                    }}>
                      <div style={{ height: 22, background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", padding: "0 8px" }}>
                        <div style={{ width: 40, height: 8, borderRadius: 4, background: "rgba(255,255,255,0.1)" }} />
                      </div>
                      <div style={{ height: 72, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.03)" }}>
                        <span style={{ fontSize: 32, filter: "brightness(0)", opacity: 0.25 }}>🐱</span>
                      </div>
                      <div style={{ height: 24, background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", fontWeight: 700 }}>???</span>
                      </div>
                      <div style={{ padding: "6px 8px 8px" }}>
                        <div style={{ width: "80%", height: 7, borderRadius: 4, background: "rgba(255,255,255,0.07)", marginBottom: 4 }} />
                        <div style={{ width: "60%", height: 7, borderRadius: 4, background: "rgba(255,255,255,0.05)" }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-gray-600 text-center mt-3">이 고양이들을 돌봐주면 도감에 등록돼요 🐾</p>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
