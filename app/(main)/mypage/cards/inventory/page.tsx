"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Backpack, Loader2, Coins } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { SHOP_ITEMS, SHOP_ITEM_KEYS, EQUIP_ITEM_KEYS, BORDER_FX_ITEM_KEYS, type ShopItemKey } from "@/lib/shop-config";
import StickerIcon from "@/app/components/StickerIcon";

export default function InventoryPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [owned, setOwned] = useState<Record<string, number>>({});

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace("/login"); return; }
    createClient()
      .from("user_items").select("item_key,quantity").eq("user_id", user.id)
      .then((res: { data: unknown }) => {
        const rows = (res.data ?? []) as { item_key: string; quantity: number }[];
        const map: Record<string, number> = {};
        for (const r of rows) if (r.quantity > 0) map[r.item_key] = r.quantity;
        setOwned(map);
        setLoading(false);
      });
  }, [user, authLoading, router]);

  const consumableKeys = SHOP_ITEM_KEYS.filter(k => !SHOP_ITEMS[k].equip && !SHOP_ITEMS[k].borderFx && (owned[k] ?? 0) > 0);
  const equipKeys = EQUIP_ITEM_KEYS.filter(k => (owned[k] ?? 0) > 0);
  const borderKeys = BORDER_FX_ITEM_KEYS.filter(k => (owned[k] ?? 0) > 0);
  const isEmpty = !loading && consumableKeys.length === 0 && equipKeys.length === 0 && borderKeys.length === 0;

  const Section = ({ title, color, keys }: { title: string; color: string; keys: ShopItemKey[] }) => (
    keys.length === 0 ? null : (
      <div className="mb-5">
        <p className="text-[11px] font-extrabold mb-2" style={{ color }}>{title}</p>
        <div className="grid grid-cols-2 gap-3">
          {keys.map((key) => {
            const item = SHOP_ITEMS[key];
            return (
              <div key={key} className="rounded-2xl p-3 flex flex-col gap-1.5" style={{ background: "rgba(255,255,255,0.05)" }}>
                <div className="flex items-center justify-between">
                  <span style={{ fontSize: 26 }}>{item.icon}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)" }}>
                    보유 {owned[key]}
                  </span>
                </div>
                <span className="text-[12.5px] font-bold text-white">{item.name}</span>
                <span className="text-[10.5px] text-gray-400 leading-snug">{item.desc}</span>
              </div>
            );
          })}
        </div>
      </div>
    )
  );

  return (
    <div className="min-h-dvh" style={{ background: "#0F0F1A" }}>
      <div className="sticky top-0 z-10 px-4 pt-safe pt-4 pb-3 flex items-center gap-3" style={{ background: "#0F0F1A" }}>
        <button onClick={() => router.back()} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.08)" }}>
          <ArrowLeft size={18} className="text-white" />
        </button>
        <h1 className="text-[17px] font-extrabold text-white flex items-center gap-2"><StickerIcon icon={Backpack} color="#7A5AE0" size={30} /> 가방</h1>
      </div>

      <div className="px-4 pb-10">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-gray-500" /></div>
        ) : isEmpty ? (
          <div className="text-center py-20">
            <p className="text-[32px] mb-3">🎒</p>
            <p className="text-gray-400 text-[13px] mb-5">아직 보유한 아이템이 없어요</p>
            <Link href="/mypage/shop"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-[13px] font-extrabold text-white"
              style={{ background: "linear-gradient(135deg,#FFB020,#FF8020)" }}>
              <Coins size={14} /> 상점 가기
            </Link>
          </div>
        ) : (
          <>
            <Section title="⚔️ 전투 소모품" color="#6FA0D8" keys={consumableKeys} />
            <Section title="💎 장착 아이템" color="#9CC0E8" keys={equipKeys} />
            <Section title="✨ 테두리 코스메틱" color="#E8B040" keys={borderKeys} />
            <p className="text-[10px] text-gray-500 mt-2">장착/해제는 카드창고에서 카드를 눌러 진행할 수 있어요.</p>
          </>
        )}
      </div>
    </div>
  );
}
