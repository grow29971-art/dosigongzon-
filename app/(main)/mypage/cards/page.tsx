"use client";

// 내 고양이 카드 — 컬렉션·합성·대표 카드·테두리 코스메틱.
// 2026-07-20 카드배틀 삭제: 배틀/랭킹/도감 링크, 스킬 재배정, 부위별 장비창, 전적 표시 제거.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, X, Coins, Star, Zap, Share2, Sparkles, Backpack } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import CatCard, { type CatCardData, type CardRarity } from "@/app/components/CatCard";
import { SHOP_ITEMS, BORDER_FX_ITEM_KEYS, type ShopItemKey } from "@/lib/shop-config";
import { UI, progressTrackStyle, progressFillStyle, pageBgStyle } from "@/lib/battle-ui-theme";
import Link from "next/link";

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
  card_level: number;
  card_exp: number;
  equipped_border_key?: string | null;
}

const RARITY_ORDER: CardRarity[] = ["legendary", "rare", "uncommon", "common"];
const RARITY_LABELS: Record<CardRarity, string> = { legendary: "레전드", rare: "레어", uncommon: "희귀", common: "일반" };
// 등급 승급에 필요한 최소 레벨 (일반Lv5→희귀, 희귀Lv10→레어, 레어Lv15→레전드)
const LEVEL_GATE: Record<string, number> = { common: 5, uncommon: 10, rare: 15 };
const SYNTHESIS_RESULT: Record<string, string> = { common: "희귀", uncommon: "레어", rare: "레전드" };

export default function MyCardsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [cats, setCats] = useState<CardCat[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<CardRarity | "all">("all");
  const [selected, setSelected] = useState<CardCat | null>(null);
  const [repCardId, setRepCardId] = useState<string | null>(null);
  const [synthLoading, setSynthLoading] = useState(false);
  const [synthMsg, setSynthMsg] = useState("");
  const [ownedBorders, setOwnedBorders] = useState<Record<string, number>>({});
  const [equipLoading, setEquipLoading] = useState(false);
  const [equipMsg, setEquipMsg] = useState("");

  const loadCats = async (uid: string) => {
    const [{ data }, { data: profile }] = await Promise.all([
      createClient()
        .from("cats")
        .select("id,name,photo_url,card_rarity,card_name,card_traits,card_stats,card_flavor,card_generated_at,card_level,card_exp,equipped_border_key")
        .eq("caretaker_id", uid)
        .not("card_generated_at", "is", null)
        .order("card_level", { ascending: false })
        .order("card_generated_at", { ascending: false }),
      createClient()
        .from("profiles").select("rep_card_cat_id").eq("id", uid).maybeSingle(),
    ]);
    setCats((data ?? []) as CardCat[]);
    setRepCardId((profile as { rep_card_cat_id?: string | null } | null)?.rep_card_cat_id ?? null);
    setLoading(false);

    // 보유 테두리 아이템 — 실패해도(마이그레이션 전) 카드 목록엔 영향 없게 따로 처리
    const { data: itemRows } = await createClient()
      .from("user_items").select("item_key,quantity").eq("user_id", uid).in("item_key", BORDER_FX_ITEM_KEYS);
    const owned: Record<string, number> = {};
    for (const it of (itemRows ?? []) as { item_key: string; quantity: number }[]) owned[it.item_key] = it.quantity;
    setOwnedBorders(owned);
  };

  const doEquip = async (catId: string, itemKey: string | null) => {
    if (equipLoading) return;
    setEquipLoading(true);
    setEquipMsg("");
    const targetCat = cats.find(c => c.id === catId);
    const prevKey = targetCat?.equipped_border_key ?? null;
    const res = await fetch("/api/cats/equip-item", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ cat_id: catId, item_key: itemKey, slot: "border" }),
    });
    const json = await res.json();
    setEquipLoading(false);
    if (res.ok) {
      setCats(prev => prev.map(c => c.id === catId ? { ...c, equipped_border_key: itemKey } : c));
      setSelected(prev => prev && prev.id === catId ? { ...prev, equipped_border_key: itemKey } : prev);
      // 재고 재조회 없이 응답 결과로 로컬 상태만 바로 갱신
      setOwnedBorders(prev => {
        const next = { ...prev };
        if (prevKey) next[prevKey] = (next[prevKey] ?? 0) + 1;
        if (itemKey) next[itemKey] = Math.max(0, (next[itemKey] ?? 0) - 1);
        return next;
      });
      setEquipMsg(itemKey ? `${SHOP_ITEMS[itemKey as ShopItemKey].name} 장착 완료!` : "장착 해제했어요.");
    } else {
      setEquipMsg(json.error === "no_stock" ? "보유 수량이 없어요. 상점에서 구매해주세요." : "처리 실패");
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace("/login"); return; }
    loadCats(user.id);
  }, [user, authLoading, router]);

  useEffect(() => {
    if (selected) document.body.style.overflow = "hidden";
    else { document.body.style.overflow = ""; setSynthMsg(""); setEquipMsg(""); }
    return () => { document.body.style.overflow = ""; };
  }, [selected]);

  const setRepCard = async (catId: string | null) => {
    await fetch("/api/profile/set-rep-card", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ cat_id: catId }),
    });
    setRepCardId(catId);
    if (catId === selected?.id) setSynthMsg("대표 카드로 설정됐어요 ✨");
  };

  const doSynthesis = async () => {
    if (!selected || !user) return;
    const needLevel = LEVEL_GATE[selected.card_rarity];
    if (!needLevel) { setSynthMsg("이미 최고 등급이에요!"); return; }
    if ((selected.card_level ?? 1) < needLevel) {
      setSynthMsg(`레벨이 부족해요. (Lv.${selected.card_level} / Lv.${needLevel} 필요)`);
      return;
    }
    setSynthLoading(true);
    const res = await fetch("/api/cats/card-synthesis", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ cat_id: selected.id }),
    });
    const json = await res.json();
    setSynthLoading(false);
    if (res.ok) {
      setSynthMsg(`✨ ${SYNTHESIS_RESULT[selected.card_rarity]} 등급으로 승급했어요!`);
      await loadCats(user.id);
      setSelected(prev => prev ? { ...prev, card_rarity: json.new_rarity as CardRarity, card_name: json.new_card_name ?? prev.card_name } : null);
    } else {
      setSynthMsg(json.error === "insufficient_level" ? `레벨 부족 (Lv.${json.have}/${json.need})` : "오류 발생");
    }
  };

  const shareCard = (cat: CardCat) => {
    const text = `내가 돌보는 ${cat.name}가 [${RARITY_LABELS[cat.card_rarity]}] ${cat.card_name ?? cat.name} 카드를 획득했어요! (Lv.${cat.card_level}) 🐱`;
    router.push(`/community/write?t=${encodeURIComponent(text.slice(0, 50))}&content=${encodeURIComponent(text)}`);
  };


  const filtered = filter === "all" ? cats : cats.filter(c => c.card_rarity === filter);
  const counts = RARITY_ORDER.reduce((acc, r) => { acc[r] = cats.filter(c => c.card_rarity === r).length; return acc; }, {} as Record<CardRarity, number>);

  return (
    <>
      <div className="min-h-dvh" style={pageBgStyle()}>
        {/* 헤더 */}
        <div className="sticky top-0 z-10 px-4 pt-safe pt-4 pb-3 flex items-center gap-3" style={{ background: "linear-gradient(180deg, #14141C 0%, rgba(20,20,28,0) 100%)" }}>
          <button onClick={() => router.back()} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.08)" }}>
            <ArrowLeft size={18} style={{ color: UI.textMain }} />
          </button>
          <h1 className="text-[17px] font-extrabold" style={{ color: UI.textMain }}>내 고양이 카드</h1>
          <span className="text-[13px] font-semibold ml-auto" style={{ color: UI.textSub }}>{cats.length}장</span>
        </div>

        <div className="px-4 pb-28">
          {/* 빠른 메뉴 */}
          <div className="grid grid-cols-2 gap-1.5 mb-4 mt-3">
            <Link href="/mypage/shop"
              className="flex flex-col items-center justify-center gap-1 py-3 rounded-2xl font-bold text-[10.5px] text-white"
              style={{ background: "linear-gradient(135deg,#FFC15E,#FFA030)", boxShadow: "0 4px 12px rgba(255,160,48,0.3)" }}>
              <Coins size={15} /> 상점
            </Link>
            <Link href="/mypage/cards/inventory"
              className="flex flex-col items-center justify-center gap-1 py-3 rounded-2xl font-bold text-[10.5px] text-white"
              style={{ background: "linear-gradient(135deg,#B08FE0,#7A5AE0)", boxShadow: "0 4px 12px rgba(122,90,224,0.3)" }}>
              <Backpack size={15} /> 가방
            </Link>
          </div>

          {/* 희귀도 필터 */}
          <div className="flex gap-2 mb-5 overflow-x-auto pb-1 no-scrollbar">
            {(["all", ...RARITY_ORDER] as const).map((r) => (
              <button key={r} onClick={() => setFilter(r)}
                className="shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all"
                style={{
                  background: filter === r ? `${UI.accent.pink}1F` : UI.panel,
                  color: filter === r ? UI.accent.pink : UI.textSub,
                  boxShadow: filter === r ? `inset 0 0 0 1.5px ${UI.accent.pink}` : `inset 0 0 0 1px ${UI.panelBorder}`,
                }}>
                {r === "all" ? `전체 ${cats.length}` : `${RARITY_LABELS[r]} ${counts[r]}`}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin" style={{ color: UI.textMuted }} /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-[32px] mb-3">🃏</p>
              <p className="text-[14px] font-semibold" style={{ color: UI.textSub }}>{filter === "all" ? "아직 카드가 없어요" : `${RARITY_LABELS[filter as CardRarity]} 카드가 없어요`}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {filtered.map((cat) => (
                <div key={cat.id} className="flex flex-col items-center gap-1">
                  <CatCard name={cat.name} photoUrl={cat.photo_url}
                    card={{ card_rarity: cat.card_rarity, card_name: cat.card_name, card_traits: cat.card_traits ?? [], card_stats: cat.card_stats, card_flavor: cat.card_flavor, card_level: cat.card_level, card_exp: cat.card_exp, card_generated_at: cat.card_generated_at, equipped_border_key: cat.equipped_border_key }}
                    size="sm" onClick={() => setSelected(cat)} />
                  {repCardId === cat.id && (
                    <span className="text-[9px] font-bold" style={{ color: UI.accent.gold }}>★ 대표 카드</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 카드 상세 모달 */}
      {selected && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(6,6,10,0.82)", backdropFilter: "blur(4px)", display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 20px calc(20px + env(safe-area-inset-bottom))", gap: 12, overflowY: "auto", WebkitOverflowScrolling: "touch" }}
          onClick={() => setSelected(null)}>
          <button onClick={() => setSelected(null)}
            style={{
              position: "fixed", top: "calc(env(safe-area-inset-top) + 14px)", right: 16, zIndex: 201,
              width: 40, height: 40, borderRadius: "var(--radius-full)",
              background: UI.panelAlt, boxShadow: `inset 0 0 0 1px ${UI.panelBorder}`,
              display: "flex", alignItems: "center", justifyContent: "center", color: UI.textMain, cursor: "pointer",
            }}>
            <X size={20} />
          </button>
          <div onClick={e => e.stopPropagation()} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, width: "100%", maxWidth: 340, margin: "auto 0" }}>

            <CatCard name={selected.name} photoUrl={selected.photo_url}
              card={{ card_rarity: selected.card_rarity, card_name: selected.card_name, card_traits: selected.card_traits ?? [], card_stats: selected.card_stats, card_flavor: selected.card_flavor, card_level: selected.card_level, card_exp: selected.card_exp, card_generated_at: selected.card_generated_at, equipped_border_key: selected.equipped_border_key }}
              size="lg" />

            {/* XP 바 */}
            <div className="w-full px-1 rounded-2xl p-3" style={{ background: UI.panel, boxShadow: `inset 0 0 0 1px ${UI.panelBorder}` }}>
              <div className="flex justify-between text-[11px] font-semibold mb-1" style={{ color: UI.textSub }}>
                <span>EXP</span>
                <span>{selected.card_exp} XP</span>
              </div>
              <div style={progressTrackStyle()}>
                <div style={progressFillStyle(UI.accent.pink, ((selected.card_exp ?? 0) / ([0,90,210,380,610,900,1260,1690,2200,2800][Math.min(selected.card_level ?? 1, 9)] || 2800)) * 100)} />
              </div>
            </div>

            {/* 액션 버튼들 */}
            <div className="grid grid-cols-2 gap-2 w-full">
              {/* 대표 카드 설정 */}
              <button onClick={() => setRepCard(repCardId === selected.id ? null : selected.id)}
                className="py-2.5 rounded-xl text-[11px] font-bold flex flex-col items-center gap-1"
                style={{ background: repCardId === selected.id ? `${UI.accent.gold}1F` : UI.panel, color: repCardId === selected.id ? UI.accent.gold : UI.textSub, boxShadow: `inset 0 0 0 1px ${repCardId === selected.id ? UI.accent.gold : UI.panelBorder}` }}>
                <Star size={14} />
                {repCardId === selected.id ? "대표 해제" : "대표 설정"}
              </button>

              {/* 합성 */}
              <button onClick={doSynthesis} disabled={synthLoading || selected.card_rarity === "legendary"}
                className="py-2.5 rounded-xl text-[11px] font-bold flex flex-col items-center gap-1"
                style={{
                  background: selected.card_rarity === "legendary" ? UI.panel : `${UI.accent.gold}1F`,
                  color: selected.card_rarity === "legendary" ? UI.textMuted : UI.accent.gold,
                  boxShadow: `inset 0 0 0 1px ${selected.card_rarity === "legendary" ? UI.panelBorder : UI.accent.gold}`,
                  opacity: synthLoading ? 0.6 : 1,
                }}>
                <Zap size={14} />
                합성
              </button>
            </div>

            {/* 합성 조건 안내 */}
            {selected.card_rarity !== "legendary" && (
              <p className="text-[11px] text-center font-semibold" style={{ color: UI.textSub }}>
                {RARITY_LABELS[selected.card_rarity]} → {SYNTHESIS_RESULT[selected.card_rarity]} 합성 조건: Lv.{LEVEL_GATE[selected.card_rarity]} 이상
                <br />현재 레벨: <span style={{ color: (selected.card_level ?? 1) >= LEVEL_GATE[selected.card_rarity] ? UI.accent.gold : UI.accent.red }}>Lv.{selected.card_level ?? 1}</span>
              </p>
            )}

            {synthMsg && (
              <p className="text-[13px] font-bold text-center" style={{ color: synthMsg.includes("부족") || synthMsg.includes("오류") ? UI.accent.red : UI.accent.green }}>
                {synthMsg}
              </p>
            )}

            {/* 테두리 코스메틱 */}
            <div className="w-full rounded-2xl p-3" style={{ background: UI.panel, boxShadow: `inset 0 0 0 1px ${UI.panelBorder}` }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] font-bold flex items-center gap-1.5" style={{ color: UI.textMain }}>
                  <Sparkles size={13} /> 테두리 코스메틱
                </span>
                {selected.equipped_border_key && (
                  <button onClick={() => doEquip(selected.id, null)} disabled={equipLoading}
                    className="text-[10.5px] font-bold px-2 py-1 rounded-full" style={{ background: `${UI.accent.red}1A`, color: UI.accent.red }}>
                    해제
                  </button>
                )}
              </div>
              {selected.equipped_border_key ? (
                <div className="flex items-center gap-2 rounded-xl px-2.5 py-2 mb-2" style={{ background: `${UI.accent.gold}1A` }}>
                  <span style={{ fontSize: 18 }}>{SHOP_ITEMS[selected.equipped_border_key as ShopItemKey]?.icon}</span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold truncate" style={{ color: UI.accent.gold }}>{SHOP_ITEMS[selected.equipped_border_key as ShopItemKey]?.name}</p>
                    <p className="text-[10px] truncate" style={{ color: UI.textSub }}>{SHOP_ITEMS[selected.equipped_border_key as ShopItemKey]?.desc}</p>
                  </div>
                </div>
              ) : (
                <p className="text-[10px] mb-2" style={{ color: UI.textSub }}>장착한 테두리가 없어요.</p>
              )}
              <div className="grid grid-cols-2 gap-1.5">
                {BORDER_FX_ITEM_KEYS.filter(k => k !== selected.equipped_border_key).map((key) => {
                  const item = SHOP_ITEMS[key];
                  const qty = ownedBorders[key] ?? 0;
                  return (
                    <button key={key} onClick={() => doEquip(selected.id, key)} disabled={qty <= 0 || equipLoading}
                      className="rounded-xl px-2 py-1.5 text-left flex items-center gap-1.5"
                      style={{ background: UI.panelAlt, opacity: qty > 0 ? 1 : 0.4 }}>
                      <span style={{ fontSize: 14 }}>{item.icon}</span>
                      <span className="text-[10px] font-bold truncate" style={{ color: UI.textMain }}>{item.name} ({qty})</span>
                    </button>
                  );
                })}
              </div>
              {equipMsg && (
                <p className="text-[11px] font-bold text-center mt-1.5" style={{ color: equipMsg.includes("실패") || equipMsg.includes("없어요") ? UI.accent.red : UI.accent.green }}>
                  {equipMsg}
                </p>
              )}
            </div>

            {/* 자랑하기 */}
            <button onClick={() => shareCard(selected)}
              className="w-full py-2.5 rounded-xl text-[12px] font-bold flex items-center justify-center gap-2"
              style={{ background: UI.panel, color: UI.textSub, boxShadow: `inset 0 0 0 1px ${UI.panelBorder}` }}>
              <Share2 size={13} /> 커뮤니티에 자랑하기
            </button>
          </div>
        </div>
      )}
    </>
  );
}
