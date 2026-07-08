"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Backpack, Loader2, Coins, X, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import {
  SHOP_ITEMS, SHOP_ITEM_KEYS, EQUIP_ITEM_KEYS, BORDER_FX_ITEM_KEYS,
  BODY_SLOTS, BODY_SLOT_LABELS, type ShopItemKey, type BodySlot, type EquippedSlots,
} from "@/lib/shop-config";
import StickerIcon from "@/app/components/StickerIcon";

interface MyCat {
  id: string;
  name: string;
  photo_url: string | null;
  card_level: number;
  card_rarity: string;
  equipped_slots: EquippedSlots | null;
  equipped_border_key: string | null;
}

const RARITY_LABELS: Record<string, string> = { legendary: "레전드", rare: "레어", uncommon: "희귀", common: "일반" };

// 인형(paper-doll) 배치 — 고양이 사진을 중심에 두고 5부위를 오각형으로 둘러쌈
const SLOT_POS: Record<BodySlot, React.CSSProperties> = {
  head: { top: 0, left: "50%", transform: "translateX(-50%)" },
  arm: { top: "34%", left: 0 },
  leg: { top: "34%", right: 0 },
  body: { bottom: 6, left: "12%" },
  foot: { bottom: 6, right: "12%" },
};

export default function InventoryPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [owned, setOwned] = useState<Record<string, number>>({});
  const [cats, setCats] = useState<MyCat[]>([]);
  const [activeCatId, setActiveCatId] = useState<string | null>(null);
  const [borderPicker, setBorderPicker] = useState(false);
  const [equipLoading, setEquipLoading] = useState(false);
  const [toast, setToast] = useState("");

  const load = async (uid: string, keepActive?: string) => {
    const [itemsRes, catsRes] = await Promise.all([
      createClient().from("user_items").select("item_key,quantity").eq("user_id", uid),
      createClient().from("cats").select("id,name,photo_url,card_level,card_rarity,equipped_slots,equipped_border_key")
        .eq("caretaker_id", uid).not("card_generated_at", "is", null).order("card_level", { ascending: false }),
    ]);
    const rows = (itemsRes.data ?? []) as { item_key: string; quantity: number }[];
    const map: Record<string, number> = {};
    for (const r of rows) if (r.quantity > 0) map[r.item_key] = r.quantity;
    setOwned(map);
    const catRows = (catsRes.data ?? []) as MyCat[];
    setCats(catRows);
    if (catRows.length > 0) setActiveCatId(keepActive && catRows.some(c => c.id === keepActive) ? keepActive : catRows[0].id);
    setLoading(false);
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace("/login"); return; }
    load(user.id);
  }, [user, authLoading, router]);

  const consumableKeys = SHOP_ITEM_KEYS.filter(k => !SHOP_ITEMS[k].equip && !SHOP_ITEMS[k].borderFx && (owned[k] ?? 0) > 0);
  const activeCat = cats.find(c => c.id === activeCatId) ?? null;

  const doEquip = async (itemKey: string | null, slot: BodySlot | "border") => {
    if (!activeCat || equipLoading || !user) return;
    setEquipLoading(true);
    const res = await fetch("/api/cats/equip-item", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ cat_id: activeCat.id, item_key: itemKey, slot }),
    });
    const json = await res.json();
    setEquipLoading(false);
    if (res.ok) {
      setToast(itemKey ? `${SHOP_ITEMS[itemKey as ShopItemKey].name} 장착!` : "해제했어요.");
      setBorderPicker(false);
      await load(user.id, activeCat.id);
    } else {
      setToast(json.error === "no_stock" ? "보유 수량이 없어요. 상점에서 구매해주세요." : "처리 실패");
    }
    setTimeout(() => setToast(""), 2200);
  };

  const tapSlot = (slot: BodySlot) => {
    if (!activeCat) return;
    const slotItemKey = EQUIP_ITEM_KEYS.find(k => SHOP_ITEMS[k].bodySlot === slot);
    if (!slotItemKey) return;
    const equipped = activeCat.equipped_slots?.[slot] === slotItemKey;
    if (equipped) { doEquip(null, slot); return; }
    if ((owned[slotItemKey] ?? 0) <= 0) { setToast("보유 수량이 없어요. 상점에서 구매해주세요."); setTimeout(() => setToast(""), 2200); return; }
    doEquip(slotItemKey, slot);
  };

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
        ) : cats.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-[32px] mb-3">🐱</p>
            <p className="text-gray-400 text-[13px]">카드가 있는 고양이가 없어요</p>
          </div>
        ) : (
          <>
            {/* 카드 선택 스트립 */}
            <div className="flex gap-2 overflow-x-auto pb-1 mb-4 no-scrollbar">
              {cats.map((cat) => (
                <button key={cat.id} onClick={() => setActiveCatId(cat.id)}
                  className="shrink-0 flex flex-col items-center gap-1 px-1"
                  style={{ opacity: activeCatId === cat.id ? 1 : 0.5 }}>
                  <div className="rounded-full overflow-hidden flex items-center justify-center" style={{
                    width: 48, height: 48,
                    boxShadow: activeCatId === cat.id ? "0 0 0 2px #4C82BC" : "0 0 0 1px rgba(255,255,255,0.1)",
                  }}>
                    {cat.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={cat.photo_url} alt={cat.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.08)" }}>🐱</div>
                    )}
                  </div>
                  <span className="text-[9.5px] font-bold text-white max-w-[52px] truncate">{cat.name}</span>
                </button>
              ))}
            </div>

            {activeCat && (
              <>
                {/* 인형(paper-doll) 장비창 */}
                <div className="relative mx-auto mb-4" style={{ width: 260, height: 260 }}>
                  {/* 중앙 고양이 */}
                  <div className="absolute rounded-full overflow-hidden flex items-center justify-center"
                    style={{ width: 118, height: 118, top: "50%", left: "50%", transform: "translate(-50%,-50%)", boxShadow: "0 0 0 3px rgba(255,255,255,0.12)" }}>
                    {activeCat.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={activeCat.photo_url} alt={activeCat.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[40px]" style={{ background: "rgba(255,255,255,0.06)" }}>🐱</div>
                    )}
                  </div>

                  {/* 5부위 슬롯 */}
                  {BODY_SLOTS.map((slot) => {
                    const slotItemKey = EQUIP_ITEM_KEYS.find(k => SHOP_ITEMS[k].bodySlot === slot);
                    if (!slotItemKey) return null;
                    const item = SHOP_ITEMS[slotItemKey];
                    const equipped = activeCat.equipped_slots?.[slot] === slotItemKey;
                    const qty = owned[slotItemKey] ?? 0;
                    return (
                      <button key={slot} onClick={() => tapSlot(slot)} disabled={equipLoading}
                        className="absolute flex flex-col items-center gap-0.5"
                        style={SLOT_POS[slot]}>
                        <div className="rounded-2xl flex items-center justify-center" style={{
                          width: 48, height: 48,
                          background: equipped ? "rgba(76,130,188,0.3)" : "rgba(255,255,255,0.06)",
                          boxShadow: equipped ? "0 0 0 2px #4C82BC" : qty > 0 ? "0 0 0 1.5px rgba(255,255,255,0.25)" : "0 0 0 1px rgba(255,255,255,0.08)",
                          opacity: qty > 0 || equipped ? 1 : 0.4,
                        }}>
                          <span style={{ fontSize: 20 }}>{item.icon}</span>
                        </div>
                        <span className="text-[8.5px] font-bold" style={{ color: equipped ? "#6FA0D8" : "#75718A" }}>
                          {BODY_SLOT_LABELS[slot].label}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* 테두리(오라) 슬롯 */}
                <button onClick={() => setBorderPicker(true)}
                  className="w-full flex items-center gap-3 rounded-2xl px-3 py-2.5 mb-5"
                  style={{ background: activeCat.equipped_border_key ? "rgba(232,176,64,0.18)" : "rgba(255,255,255,0.05)" }}>
                  <span style={{ fontSize: 22 }}>{activeCat.equipped_border_key ? SHOP_ITEMS[activeCat.equipped_border_key as ShopItemKey]?.icon : "✨"}</span>
                  <div className="min-w-0 flex-1 text-left">
                    <p className="text-[12px] font-bold" style={{ color: activeCat.equipped_border_key ? "#E8B040" : "white" }}>
                      {activeCat.equipped_border_key ? SHOP_ITEMS[activeCat.equipped_border_key as ShopItemKey]?.name : "테두리 오라 — 미장착"}
                    </p>
                    <p className="text-[10px] text-gray-500">탭해서 바꾸기</p>
                  </div>
                </button>
              </>
            )}

            {consumableKeys.length > 0 && (
              <div className="mb-5">
                <p className="text-[11px] font-extrabold mb-2" style={{ color: "#6FA0D8" }}>⚔️ 전투 소모품</p>
                <div className="grid grid-cols-2 gap-3">
                  {consumableKeys.map((key) => {
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
            )}

            {/* 🗡️ 장비(무기·방어구) — 5부위 스탯 아이템, 보유분 전부 표시 + 여기서 바로 장착/해제 가능 */}
            {activeCat && EQUIP_ITEM_KEYS.some(k => (owned[k] ?? 0) > 0 || Object.values(activeCat.equipped_slots ?? {}).includes(k)) && (
              <div className="mb-5">
                <p className="text-[11px] font-extrabold mb-2" style={{ color: "#9CC0E8" }}>🗡️ 장비 (무기·방어구)</p>
                <div className="grid grid-cols-2 gap-3">
                  {EQUIP_ITEM_KEYS.filter(k => (owned[k] ?? 0) > 0 || activeCat.equipped_slots?.[SHOP_ITEMS[k].bodySlot!] === k).map((key) => {
                    const item = SHOP_ITEMS[key];
                    const slot = item.bodySlot!;
                    const equipped = activeCat.equipped_slots?.[slot] === key;
                    const qty = owned[key] ?? 0;
                    return (
                      <button key={key} onClick={() => tapSlot(slot)} disabled={equipLoading}
                        className="rounded-2xl p-3 flex flex-col gap-1.5 text-left" style={{ background: equipped ? "rgba(76,130,188,0.2)" : "rgba(255,255,255,0.05)" }}>
                        <div className="flex items-center justify-between">
                          <span style={{ fontSize: 26 }}>{item.icon}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: equipped ? "#4C82BC" : "rgba(255,255,255,0.12)", color: equipped ? "white" : "rgba(255,255,255,0.7)" }}>
                            {equipped ? "장착중" : `보유 ${qty}`}
                          </span>
                        </div>
                        <span className="text-[12.5px] font-bold text-white">{item.name}</span>
                        <span className="text-[10.5px] text-gray-400 leading-snug">{item.desc} · {BODY_SLOT_LABELS[slot].label} 부위</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ✨ 테두리 — 보유분 전부 표시 + 여기서 바로 장착/해제 가능 */}
            {activeCat && BORDER_FX_ITEM_KEYS.some(k => (owned[k] ?? 0) > 0 || activeCat.equipped_border_key === k) && (
              <div className="mb-5">
                <p className="text-[11px] font-extrabold mb-2" style={{ color: "#E8B040" }}>✨ 테두리 코스메틱</p>
                <div className="grid grid-cols-2 gap-3">
                  {BORDER_FX_ITEM_KEYS.filter(k => (owned[k] ?? 0) > 0 || activeCat.equipped_border_key === k).map((key) => {
                    const item = SHOP_ITEMS[key];
                    const equipped = activeCat.equipped_border_key === key;
                    const qty = owned[key] ?? 0;
                    return (
                      <button key={key} onClick={() => doEquip(equipped ? null : key, "border")} disabled={equipLoading || (!equipped && qty <= 0)}
                        className="rounded-2xl p-3 flex flex-col gap-1.5 text-left" style={{ background: equipped ? "rgba(232,176,64,0.2)" : "rgba(255,255,255,0.05)" }}>
                        <div className="flex items-center justify-between">
                          <span style={{ fontSize: 26 }}>{item.icon}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: equipped ? "#E8B040" : "rgba(255,255,255,0.12)", color: equipped ? "white" : "rgba(255,255,255,0.7)" }}>
                            {equipped ? "장착중" : `보유 ${qty}`}
                          </span>
                        </div>
                        <span className="text-[12.5px] font-bold text-white">{item.name}</span>
                        <span className="text-[10.5px] text-gray-400 leading-snug">{item.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {consumableKeys.length === 0 && Object.keys(owned).length === 0 && (
              <div className="text-center py-6">
                <p className="text-gray-400 text-[12px] mb-3">가방이 비어있어요</p>
                <Link href="/mypage/shop"
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-[13px] font-extrabold text-white"
                  style={{ background: "linear-gradient(135deg,#FFB020,#FF8020)" }}>
                  <Coins size={14} /> 상점 가기
                </Link>
              </div>
            )}
          </>
        )}
      </div>

      {/* 테두리 선택 시트 */}
      {borderPicker && activeCat && (
        <div className="fixed inset-0 z-[210] flex items-end justify-center" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setBorderPicker(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-t-3xl p-5" style={{ background: "#1A1A2A", maxHeight: "75vh", overflowY: "auto" }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-white text-[15px] font-extrabold">✨ 테두리 오라 선택</p>
              <button onClick={() => setBorderPicker(false)} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.1)" }}>
                <X size={14} className="text-white" />
              </button>
            </div>
            {activeCat.equipped_border_key && (
              <button onClick={() => doEquip(null, "border")} disabled={equipLoading}
                className="w-full flex items-center gap-2 rounded-2xl px-3 py-2.5 mb-2 text-left" style={{ background: "rgba(225,80,95,0.15)" }}>
                <X size={14} style={{ color: "#E1505F" }} />
                <span className="text-[12px] font-bold" style={{ color: "#E1505F" }}>해제하기</span>
              </button>
            )}
            {BORDER_FX_ITEM_KEYS.filter(k => (owned[k] ?? 0) > 0 || activeCat.equipped_border_key === k).length === 0 ? (
              <p className="text-gray-400 text-[12px] py-6 text-center">보유한 테두리 아이템이 없어요. 상점에서 구매해보세요!</p>
            ) : (
              <div className="flex flex-col gap-2">
                {BORDER_FX_ITEM_KEYS.filter(k => (owned[k] ?? 0) > 0).map((key) => {
                  const item = SHOP_ITEMS[key];
                  const isThis = activeCat.equipped_border_key === key;
                  return (
                    <button key={key} onClick={() => doEquip(isThis ? null : key, "border")} disabled={equipLoading}
                      className="flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left"
                      style={{ background: isThis ? "rgba(232,176,64,0.22)" : "rgba(255,255,255,0.05)" }}>
                      <span style={{ fontSize: 22 }}>{item.icon}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12.5px] font-bold text-white truncate">{item.name}</p>
                        <p className="text-[10px] text-gray-500 truncate">{item.desc}</p>
                      </div>
                      {isThis && <CheckCircle2 size={18} style={{ color: "#E8B040" }} className="shrink-0" />}
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
