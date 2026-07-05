"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Coins } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { SHOP_ITEMS, SHOP_ITEM_KEYS, type ShopItemKey } from "@/lib/shop-config";

export default function ShopPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [coins, setCoins] = useState(0);
  const [owned, setOwned] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [buyingKey, setBuyingKey] = useState<ShopItemKey | null>(null);
  const [msg, setMsg] = useState("");

  const load = async (uid: string) => {
    const supabase = createClient();
    const [{ data: profile }, { data: items }] = await Promise.all([
      supabase.from("profiles").select("coins").eq("id", uid).maybeSingle(),
      supabase.from("user_items").select("item_key,quantity").eq("user_id", uid),
    ]);
    setCoins((profile as { coins?: number } | null)?.coins ?? 0);
    const map: Record<string, number> = {};
    for (const it of (items ?? []) as { item_key: string; quantity: number }[]) map[it.item_key] = it.quantity;
    setOwned(map);
    setLoading(false);
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace("/login"); return; }
    load(user.id);
  }, [user, authLoading, router]);

  const buy = async (key: ShopItemKey) => {
    if (!user) return;
    setBuyingKey(key);
    setMsg("");
    const res = await fetch("/api/shop/buy", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ item_key: key }),
    });
    const json = await res.json();
    setBuyingKey(null);
    if (res.ok) {
      setCoins(json.coins);
      setOwned(prev => ({ ...prev, [key]: json.quantity }));
      setMsg(`✨ ${SHOP_ITEMS[key].name} 구매 완료!`);
    } else {
      setMsg(json.error === "insufficient_coins" ? `코인이 부족해요 (${json.have}/${json.need})` : "구매 실패");
    }
  };

  return (
    <div className="min-h-dvh" style={{ background: "#0F0F1A" }}>
      <div className="sticky top-0 z-10 px-4 pt-safe pt-4 pb-3 flex items-center gap-3" style={{ background: "#0F0F1A" }}>
        <button onClick={() => router.back()} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.08)" }}>
          <ArrowLeft size={18} className="text-white" />
        </button>
        <h1 className="text-[17px] font-extrabold text-white">상점</h1>
        <div className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ background: "rgba(255,204,68,0.15)" }}>
          <Coins size={14} color="#FFCC44" />
          <span className="text-[13px] font-black" style={{ color: "#FFCC44" }}>{coins}</span>
        </div>
      </div>

      <div className="px-4 pb-10">
        <p className="text-[12px] text-gray-500 mb-4">
          배틀 승리·돌봄 기록·매일 로그인으로 코인을 모아보세요. 구매한 아이템은 카드 배틀 중에 사용할 수 있어요.
        </p>

        {msg && (
          <p className="text-[13px] font-bold text-center mb-3" style={{ color: msg.includes("부족") || msg.includes("실패") ? "#FF8080" : "#80FF80" }}>
            {msg}
          </p>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-7 h-7 rounded-full border-2 border-gray-600 border-t-white animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {SHOP_ITEM_KEYS.map((key) => {
              const item = SHOP_ITEMS[key];
              const canAfford = coins >= item.price;
              return (
                <div key={key} className="rounded-2xl p-3 flex flex-col gap-2" style={{ background: "rgba(255,255,255,0.05)" }}>
                  <div className="flex items-center justify-between">
                    <span style={{ fontSize: 28 }}>{item.icon}</span>
                    {owned[key] > 0 && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)" }}>
                        보유 {owned[key]}
                      </span>
                    )}
                  </div>
                  <span className="text-[13px] font-bold text-white">{item.name}</span>
                  <span className="text-[11px] text-gray-400 leading-snug">{item.desc}</span>
                  <button
                    onClick={() => buy(key)}
                    disabled={!canAfford || buyingKey === key}
                    className="mt-1 py-2 rounded-xl text-[12px] font-black flex items-center justify-center gap-1"
                    style={{
                      background: canAfford ? "linear-gradient(135deg,#FFB020,#FF8020)" : "rgba(255,255,255,0.06)",
                      color: canAfford ? "white" : "rgba(255,255,255,0.3)",
                      opacity: buyingKey === key ? 0.6 : 1,
                    }}
                  >
                    <Coins size={12} /> {item.price}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
