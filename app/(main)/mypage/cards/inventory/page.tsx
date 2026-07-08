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

// 인형(paper-doll) 배치 — 고양이 사진을 중심에 두고 5부위를 오각형으로 둘러쌈
const SLOT_POS: Record<BodySlot, React.CSSProperties> = {
  head: { top: 0, left: "50%", transform: "translateX(-50%)" },
  arm: { top: "34%", left: 0 },
  leg: { top: "34%", right: 0 },
  body: { bottom: 6, left: "12%" },
  foot: { bottom: 6, right: "12%" },
};

type Tab = "all" | "consumable" | "equip" | "border";
const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "consumable", label: "소모품" },
  { key: "equip", label: "장비" },
  { key: "border", label: "테두리" },
];

export default function InventoryPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [owned, setOwned] = useState<Record<string, number>>({});
  const [cats, setCats] = useState<MyCat[]>([]);
  const [activeCatId, setActiveCatId] = useState<string | null>(null);
  const [borderPicker, setBorderPicker] = useState(false);
  const [tab, setTab] = useState<Tab>("all");
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

  const activeCat = cats.find(c => c.id === activeCatId) ?? null;

  const doEquip = async (itemKey: string | null, slot: BodySlot | "border") => {
    if (!activeCat || equipLoading || !user) return;
    setEquipLoading(true);
    const prevKey = slot === "border" ? activeCat.equipped_border_key : (activeCat.equipped_slots?.[slot as BodySlot] ?? null);
    const res = await fetch("/api/cats/equip-item", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ cat_id: activeCat.id, item_key: itemKey, slot }),
    });
    const json = await res.json();
    setEquipLoading(false);
    if (res.ok) {
      // 전체 재조회(user_items + cats 두 번 더 쿼리) 없이 응답 결과로 로컬 상태만
      // 바로 갱신 — API 호출 1번으로 끝나서 체감 속도가 눈에 띄게 빨라짐.
      const catId = activeCat.id;
      setCats(prev => prev.map(c => {
        if (c.id !== catId) return c;
        if (slot === "border") return { ...c, equipped_border_key: itemKey };
        return { ...c, equipped_slots: { ...(c.equipped_slots ?? {}), [slot]: itemKey } };
      }));
      setOwned(prev => {
        const next = { ...prev };
        if (prevKey) next[prevKey] = (next[prevKey] ?? 0) + 1;
        if (itemKey) next[itemKey] = Math.max(0, (next[itemKey] ?? 0) - 1);
        return next;
      });
      setToast(itemKey ? `${SHOP_ITEMS[itemKey as ShopItemKey].name} 장착!` : "해제했어요.");
      setBorderPicker(false);
    } else {
      setToast(json.error === "no_stock" ? "보유 수량이 없어요." : "처리 실패");
    }
    setTimeout(() => setToast(""), 2200);
  };

  const tapSlot = (slot: BodySlot) => {
    if (!activeCat) return;
    const slotItemKey = EQUIP_ITEM_KEYS.find(k => SHOP_ITEMS[k].bodySlot === slot);
    if (!slotItemKey) return;
    const equipped = activeCat.equipped_slots?.[slot] === slotItemKey;
    if (equipped) { doEquip(null, slot); return; }
    if ((owned[slotItemKey] ?? 0) <= 0) { setToast("보유 수량이 없어요."); setTimeout(() => setToast(""), 2200); return; }
    doEquip(slotItemKey, slot);
  };

  const consumableKeys = SHOP_ITEM_KEYS.filter(k => !SHOP_ITEMS[k].equip && !SHOP_ITEMS[k].borderFx && (owned[k] ?? 0) > 0);
  const equipKeys = EQUIP_ITEM_KEYS.filter(k => (owned[k] ?? 0) > 0 || activeCat?.equipped_slots?.[SHOP_ITEMS[k].bodySlot!] === k);
  const borderKeys = BORDER_FX_ITEM_KEYS.filter(k => (owned[k] ?? 0) > 0 || activeCat?.equipped_border_key === k);
  const listKeys: ShopItemKey[] =
    tab === "consumable" ? consumableKeys :
    tab === "equip" ? equipKeys :
    tab === "border" ? borderKeys :
    [...consumableKeys, ...equipKeys, ...borderKeys];
  const totalOwnedCount = consumableKeys.length + equipKeys.length + borderKeys.length;

  const rowTap = (key: ShopItemKey) => {
    const item = SHOP_ITEMS[key];
    if (item.bodySlot) tapSlot(item.bodySlot);
    else if (item.borderFx) setBorderPicker(true);
    // 소모품은 배틀 중에만 쓰는 아이템이라 가방에서는 탭해도 동작 없음(정보 확인만)
  };

  return (
    <div className="min-h-dvh" style={{ background: "#0F0F1A" }}>
      <div className="sticky top-0 z-10 px-4 pt-safe pt-4 pb-3 flex items-center gap-3" style={{ background: "#0F0F1A" }}>
        <button onClick={() => router.back()} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.08)" }}>
          <ArrowLeft size={18} className="text-white" />
        </button>
        <h1 className="text-[17px] font-extrabold text-white flex items-center gap-2"><StickerIcon icon={Backpack} color="#7A5AE0" size={30} /> 소지품 &amp; 장비</h1>
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
            <div className="flex gap-2 overflow-x-auto pb-1 mb-3 no-scrollbar">
              {cats.map((cat) => (
                <button key={cat.id} onClick={() => setActiveCatId(cat.id)}
                  className="shrink-0 flex flex-col items-center gap-1 px-1"
                  style={{ opacity: activeCatId === cat.id ? 1 : 0.5 }}>
                  <div className="rounded-full overflow-hidden flex items-center justify-center" style={{
                    width: 40, height: 40,
                    boxShadow: activeCatId === cat.id ? "0 0 0 2px #4C82BC" : "0 0 0 1px rgba(255,255,255,0.1)",
                  }}>
                    {cat.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={cat.photo_url} alt={cat.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.08)" }}>🐱</div>
                    )}
                  </div>
                  <span className="text-[9px] font-bold text-white max-w-[44px] truncate">{cat.name}</span>
                </button>
              ))}
            </div>

            {/* ── 상단: 장비칸(인형) / 하단: 소지품 목록 — 폰 비율에 맞게 세로 배치 ── */}
            {activeCat && (
              <>
                {/* 상단 장비 패널 — 캐릭터 사진 중심에 5부위를 오각형으로 둘러쌈 */}
                <div className="rounded-2xl p-3 mb-3" style={{ background: "rgba(255,255,255,0.04)" }}>
                  <p className="text-[10.5px] font-extrabold text-center mb-2" style={{ color: "#8A8598" }}>캐릭터 장비</p>
                  <div className="relative mx-auto" style={{ width: 240, height: 240 }}>
                    <div className="absolute rounded-full overflow-hidden flex items-center justify-center"
                      style={{ width: 108, height: 108, top: "50%", left: "50%", transform: "translate(-50%,-50%)", boxShadow: "0 0 0 3px rgba(255,255,255,0.12)" }}>
                      {activeCat.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={activeCat.photo_url} alt={activeCat.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[38px]" style={{ background: "rgba(255,255,255,0.06)" }}>🐱</div>
                      )}
                    </div>
                    {BODY_SLOTS.map((slot) => {
                      const slotItemKey = EQUIP_ITEM_KEYS.find(k => SHOP_ITEMS[k].bodySlot === slot);
                      if (!slotItemKey) return null;
                      const item = SHOP_ITEMS[slotItemKey];
                      const equipped = activeCat.equipped_slots?.[slot] === slotItemKey;
                      const qty = owned[slotItemKey] ?? 0;
                      return (
                        <button key={slot} onClick={() => tapSlot(slot)} disabled={equipLoading}
                          className="absolute flex flex-col items-center gap-0.5" style={SLOT_POS[slot]}>
                          <div className="rounded-2xl flex items-center justify-center" style={{
                            width: 46, height: 46,
                            background: equipped ? "rgba(76,130,188,0.3)" : "rgba(255,255,255,0.06)",
                            boxShadow: equipped ? "0 0 0 2px #4C82BC" : qty > 0 ? "0 0 0 1.5px rgba(255,255,255,0.25)" : "0 0 0 1px rgba(255,255,255,0.08)",
                            opacity: qty > 0 || equipped ? 1 : 0.4,
                          }}>
                            <span style={{ fontSize: 19 }}>{item.icon}</span>
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
                    className="w-full flex items-center gap-3 rounded-2xl px-3 py-2.5 mt-2"
                    style={{ background: activeCat.equipped_border_key ? "rgba(232,176,64,0.18)" : "rgba(255,255,255,0.05)" }}>
                    <span style={{ fontSize: 20 }}>{activeCat.equipped_border_key ? SHOP_ITEMS[activeCat.equipped_border_key as ShopItemKey]?.icon : "✨"}</span>
                    <div className="min-w-0 flex-1 text-left">
                      <p className="text-[11.5px] font-bold" style={{ color: activeCat.equipped_border_key ? "#E8B040" : "white" }}>
                        {activeCat.equipped_border_key ? SHOP_ITEMS[activeCat.equipped_border_key as ShopItemKey]?.name : "테두리 오라 — 미장착"}
                      </p>
                      <p className="text-[9.5px] text-gray-500">탭해서 바꾸기</p>
                    </div>
                  </button>
                </div>

                {/* 하단 소지품 목록 */}
                <div className="rounded-2xl p-3" style={{ background: "rgba(255,255,255,0.04)" }}>
                  <div className="flex gap-1.5 mb-2.5">
                    {TABS.map((t) => (
                      <button key={t.key} onClick={() => setTab(t.key)}
                        className="px-3 py-1.5 rounded-full text-[11px] font-bold"
                        style={{ background: tab === t.key ? "#4C82BC" : "rgba(255,255,255,0.06)", color: tab === t.key ? "white" : "#8A8598" }}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                  {listKeys.length === 0 ? (
                    <p className="text-[12px] text-gray-500 text-center py-10">보유한 아이템이 없어요</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {listKeys.map((key) => {
                        const item = SHOP_ITEMS[key];
                        const isEquipped = item.bodySlot
                          ? activeCat.equipped_slots?.[item.bodySlot] === key
                          : item.borderFx ? activeCat.equipped_border_key === key : false;
                        const qty = owned[key] ?? 0;
                        return (
                          <button key={key} onClick={() => rowTap(key)}
                            className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-left"
                            style={{ background: isEquipped ? "rgba(76,130,188,0.18)" : "rgba(255,255,255,0.03)" }}>
                            <span className="rounded-lg flex items-center justify-center shrink-0" style={{ width: 32, height: 32, fontSize: 17, background: "rgba(255,255,255,0.06)" }}>
                              {item.icon}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-[11px] font-bold text-white truncate">{item.name} {qty > 0 && <span className="text-gray-400 font-normal">x{qty}</span>}</p>
                              <p className="text-[9.5px] text-gray-500 truncate">{item.desc}</p>
                            </div>
                            {isEquipped && <CheckCircle2 size={14} style={{ color: "#4C82BC" }} className="shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}

            {totalOwnedCount === 0 && (
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
            {BORDER_FX_ITEM_KEYS.filter(k => (owned[k] ?? 0) > 0).length === 0 ? (
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
