"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Backpack, Loader2, Coins, X, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { SHOP_ITEMS, SHOP_ITEM_KEYS, EQUIP_ITEM_KEYS, BORDER_FX_ITEM_KEYS, type ShopItemKey } from "@/lib/shop-config";
import StickerIcon from "@/app/components/StickerIcon";

interface MyCat {
  id: string;
  name: string;
  photo_url: string | null;
  card_level: number;
  card_rarity: string;
  equipped_item_key: string | null;
  equipped_border_key: string | null;
}

const RARITY_LABELS: Record<string, string> = { legendary: "레전드", rare: "레어", uncommon: "희귀", common: "일반" };

export default function InventoryPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [owned, setOwned] = useState<Record<string, number>>({});
  const [cats, setCats] = useState<MyCat[]>([]);
  const [picker, setPicker] = useState<{ key: ShopItemKey; slot: "equip" | "border" } | null>(null);
  const [equipLoading, setEquipLoading] = useState(false);
  const [toast, setToast] = useState("");

  const load = async (uid: string) => {
    const [itemsRes, catsRes] = await Promise.all([
      createClient().from("user_items").select("item_key,quantity").eq("user_id", uid),
      createClient().from("cats").select("id,name,photo_url,card_level,card_rarity,equipped_item_key,equipped_border_key")
        .eq("caretaker_id", uid).not("card_generated_at", "is", null).order("card_level", { ascending: false }),
    ]);
    const rows = (itemsRes.data ?? []) as { item_key: string; quantity: number }[];
    const map: Record<string, number> = {};
    for (const r of rows) if (r.quantity > 0) map[r.item_key] = r.quantity;
    setOwned(map);
    setCats((catsRes.data ?? []) as MyCat[]);
    setLoading(false);
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace("/login"); return; }
    load(user.id);
  }, [user, authLoading, router]);

  const consumableKeys = SHOP_ITEM_KEYS.filter(k => !SHOP_ITEMS[k].equip && !SHOP_ITEMS[k].borderFx && (owned[k] ?? 0) > 0);
  const equipKeys = EQUIP_ITEM_KEYS.filter(k => (owned[k] ?? 0) > 0);
  const borderKeys = BORDER_FX_ITEM_KEYS.filter(k => (owned[k] ?? 0) > 0);
  const isEmpty = !loading && consumableKeys.length === 0 && equipKeys.length === 0 && borderKeys.length === 0;

  const equipOnCat = async (catId: string) => {
    if (!picker || equipLoading || !user) return;
    setEquipLoading(true);
    const field = picker.slot === "border" ? "equipped_border_key" : "equipped_item_key";
    const alreadyOn = cats.find(c => c.id === catId)?.[field] === picker.key;
    const res = await fetch("/api/cats/equip-item", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ cat_id: catId, item_key: alreadyOn ? null : picker.key, slot: picker.slot }),
    });
    const json = await res.json();
    setEquipLoading(false);
    if (res.ok) {
      setToast(alreadyOn ? "장착 해제했어요." : `${SHOP_ITEMS[picker.key].name} 장착 완료!`);
      setPicker(null);
      await load(user.id);
    } else {
      setToast(json.error === "no_stock" ? "보유 수량이 없어요." : "처리 실패");
    }
    setTimeout(() => setToast(""), 2500);
  };

  const Section = ({ title, color, keys, equippable }: { title: string; color: string; keys: ShopItemKey[]; equippable?: "equip" | "border" }) => (
    keys.length === 0 ? null : (
      <div className="mb-5">
        <p className="text-[11px] font-extrabold mb-2" style={{ color }}>{title}</p>
        <div className="grid grid-cols-2 gap-3">
          {keys.map((key) => {
            const item = SHOP_ITEMS[key];
            const equippedCount = cats.filter(c => (equippable === "border" ? c.equipped_border_key : c.equipped_item_key) === key).length;
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
                {equippable && (
                  <button onClick={() => setPicker({ key, slot: equippable })}
                    className="mt-1 py-1.5 rounded-xl text-[11px] font-black"
                    style={{ background: equippedCount > 0 ? "rgba(255,255,255,0.12)" : "linear-gradient(135deg,#6FA0D8,#3E6FA8)", color: "white" }}>
                    {equippedCount > 0 ? `${equippedCount}장에 장착중 · 관리` : "카드에 장착"}
                  </button>
                )}
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
            <Section title="💎 장착 아이템" color="#9CC0E8" keys={equipKeys} equippable="equip" />
            <Section title="✨ 테두리 코스메틱" color="#E8B040" keys={borderKeys} equippable="border" />
          </>
        )}
      </div>

      {/* 카드 선택 시트 */}
      {picker && (
        <div className="fixed inset-0 z-[210] flex items-end justify-center" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setPicker(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-t-3xl p-5" style={{ background: "#1A1A2A", maxHeight: "75vh", overflowY: "auto" }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-white text-[15px] font-extrabold">{SHOP_ITEMS[picker.key].icon} {SHOP_ITEMS[picker.key].name} — 장착할 카드 선택</p>
              <button onClick={() => setPicker(null)} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.1)" }}>
                <X size={14} className="text-white" />
              </button>
            </div>
            {cats.length === 0 ? (
              <p className="text-gray-400 text-[12px] py-6 text-center">카드가 없어요. 고양이를 등록하면 카드가 생겨요.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {cats.map((cat) => {
                  const field = picker.slot === "border" ? "equipped_border_key" : "equipped_item_key";
                  const isThis = cat[field] === picker.key;
                  const hasOther = !!cat[field] && !isThis;
                  return (
                    <button key={cat.id} onClick={() => equipOnCat(cat.id)} disabled={equipLoading}
                      className="flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left"
                      style={{ background: isThis ? "rgba(76,130,188,0.25)" : "rgba(255,255,255,0.05)" }}>
                      {cat.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={cat.photo_url} alt={cat.name} className="w-10 h-10 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center" style={{ background: "rgba(255,255,255,0.08)" }}>🐱</div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-bold text-white truncate">{cat.name} <span className="text-gray-400 font-normal">Lv.{cat.card_level} · {RARITY_LABELS[cat.card_rarity] ?? cat.card_rarity}</span></p>
                        {hasOther && <p className="text-[10px] text-gray-500">다른 아이템 장착중 — 바꾸면 그건 가방으로 돌아가요</p>}
                      </div>
                      {isThis && <CheckCircle2 size={18} style={{ color: "#4C82BC" }} className="shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed left-1/2 bottom-8 -translate-x-1/2 z-[220] px-4 py-2.5 rounded-full text-[12px] font-bold text-white"
          style={{ background: "rgba(20,20,30,0.92)" }}>
          {toast}
        </div>
      )}
    </div>
  );
}
