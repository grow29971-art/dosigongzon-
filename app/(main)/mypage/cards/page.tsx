"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, X, Swords, Trophy, Coins, Star, Zap, Share2, Scroll, BookMarked, Gem, Sparkles, Backpack } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import CatCard, { type CatCardData, type CardRarity } from "@/app/components/CatCard";
import { SPECIAL_SKILLS } from "@/lib/battle-config";
import { PVE_BESTIARY } from "@/lib/pve-bestiary";
import { SHOP_ITEMS, EQUIP_ITEM_KEYS, BORDER_FX_ITEM_KEYS, type ShopItemKey } from "@/lib/shop-config";
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
  best_win_streak?: number | null;
  pve_win_count?: number | null;
  battle_special: string | null;
  battle_special2: string | null;
  battle_special3: string | null;
  battle_special4: string | null;
  equipped_item_key?: string | null;
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
  const [relearnQty, setRelearnQty] = useState(0);
  const [relearnLoading, setRelearnLoading] = useState(false);
  const [relearnMsg, setRelearnMsg] = useState("");
  const [seenKeys, setSeenKeys] = useState<string[]>([]);
  const [ownedEquip, setOwnedEquip] = useState<Record<string, number>>({});
  const [equipLoading, setEquipLoading] = useState(false);
  const [equipMsg, setEquipMsg] = useState("");

  const loadCats = async (uid: string) => {
    const [{ data }, { data: profile }, { data: relearnItem }] = await Promise.all([
      createClient()
        .from("cats")
        .select("id,name,photo_url,card_rarity,card_name,card_traits,card_stats,card_flavor,card_generated_at,card_level,card_exp,best_win_streak,pve_win_count,battle_special,battle_special2,battle_special3,battle_special4")
        .eq("caretaker_id", uid)
        .not("card_generated_at", "is", null)
        .order("card_level", { ascending: false })
        .order("card_generated_at", { ascending: false }),
      createClient()
        .from("profiles").select("rep_card_cat_id").eq("id", uid).maybeSingle(),
      createClient()
        .from("user_items").select("quantity").eq("user_id", uid).eq("item_key", "skill_relearn").maybeSingle(),
    ]);
    const loadedCats = (data ?? []) as CardCat[];
    setCats(loadedCats);
    setRepCardId((profile as { rep_card_cat_id?: string | null } | null)?.rep_card_cat_id ?? null);
    setRelearnQty((relearnItem as { quantity?: number } | null)?.quantity ?? 0);
    setLoading(false);

    // 도감 진행 개수(4번째 빠른메뉴 배지용) — box/supabase_pve_bestiary_migration.sql 실행 전이면
    // 컬럼이 없어 이 쿼리만 조용히 실패(빈 배열 유지)하고 나머지 페이지는 정상 동작.
    try {
      const { data: bestiary } = await createClient()
        .from("profiles").select("pve_seen_keys").eq("id", uid).maybeSingle();
      setSeenKeys((bestiary as { pve_seen_keys?: string[] } | null)?.pve_seen_keys ?? []);
    } catch { /* 마이그레이션 전이면 조용히 무시 */ }

    // 장착 아이템/테두리 — box/supabase_equip_item_migration.sql,
    // box/supabase_border_fx_migration.sql 실행 전이면 컬럼이 없어 이 쿼리만
    // 조용히 실패(전부 미장착으로 처리)하고 나머지 페이지는 정상 동작.
    try {
      const { data: eqRows } = await createClient()
        .from("cats").select("id,equipped_item_key,equipped_border_key").eq("caretaker_id", uid);
      const eqMap = new Map(((eqRows ?? []) as { id: string; equipped_item_key: string | null; equipped_border_key: string | null }[]).map(r => [r.id, r]));
      setCats(loadedCats.map(c => ({ ...c, equipped_item_key: eqMap.get(c.id)?.equipped_item_key ?? null, equipped_border_key: eqMap.get(c.id)?.equipped_border_key ?? null })));
    } catch { /* 마이그레이션 전이면 조용히 무시 */ }

    const allCosmeticKeys = [...EQUIP_ITEM_KEYS, ...BORDER_FX_ITEM_KEYS];
    const { data: itemRows } = await createClient()
      .from("user_items").select("item_key,quantity").eq("user_id", uid).in("item_key", allCosmeticKeys);
    const owned: Record<string, number> = {};
    for (const it of (itemRows ?? []) as { item_key: string; quantity: number }[]) owned[it.item_key] = it.quantity;
    setOwnedEquip(owned);
  };

  const doEquip = async (catId: string, itemKey: string | null, slot: "equip" | "border" = "equip") => {
    if (equipLoading) return;
    setEquipLoading(true);
    setEquipMsg("");
    const res = await fetch("/api/cats/equip-item", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ cat_id: catId, item_key: itemKey, slot }),
    });
    const json = await res.json();
    setEquipLoading(false);
    const field = slot === "border" ? "equipped_border_key" : "equipped_item_key";
    if (res.ok) {
      setCats(prev => prev.map(c => c.id === catId ? { ...c, [field]: itemKey } : c));
      setSelected(prev => prev && prev.id === catId ? { ...prev, [field]: itemKey } : prev);
      if (user) {
        const allCosmeticKeys = [...EQUIP_ITEM_KEYS, ...BORDER_FX_ITEM_KEYS];
        const { data: itemRows } = await createClient()
          .from("user_items").select("item_key,quantity").eq("user_id", user.id).in("item_key", allCosmeticKeys);
        const owned: Record<string, number> = {};
        for (const it of (itemRows ?? []) as { item_key: string; quantity: number }[]) owned[it.item_key] = it.quantity;
        setOwnedEquip(owned);
      }
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
    else { document.body.style.overflow = ""; setSynthMsg(""); setRelearnMsg(""); }
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

  const doRelearn = async (slot: number) => {
    if (!selected || relearnQty <= 0 || relearnLoading) return;
    setRelearnLoading(true);
    setRelearnMsg("");
    const res = await fetch("/api/shop/relearn-skill", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ cat_id: selected.id, slot }),
    });
    const json = await res.json();
    setRelearnLoading(false);
    if (res.ok) {
      setRelearnQty(json.remaining);
      const key = (["battle_special", "battle_special2", "battle_special3", "battle_special4"] as const)[slot];
      setSelected(prev => prev ? { ...prev, [key]: json.new_skill_id } : null);
      setCats(prev => prev.map(c => c.id === selected.id ? { ...c, [key]: json.new_skill_id } : c));
      setRelearnMsg(`📜 스킬 ${slot + 1}이(가) "${json.new_skill_name}"(으)로 바뀌었어요!`);
    } else {
      setRelearnMsg(json.error === "no_stock" ? "머신이 없어요. 상점에서 구매해주세요." : "오류 발생");
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
      <div className="min-h-dvh" style={{ background: "radial-gradient(circle at 50% 0%, #EEF4FF, #F4F7FC 40%)" }}>
        {/* 헤더 */}
        <div className="sticky top-0 z-10 px-4 pt-safe pt-4 pb-3 flex items-center gap-3" style={{ background: "rgba(255,255,255,0.7)", backdropFilter: "blur(12px)" }}>
          <button onClick={() => router.back()} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "#fff", boxShadow: "0 2px 6px rgba(60,50,90,0.1)" }}>
            <ArrowLeft size={18} style={{ color: "#2B2B3D" }} />
          </button>
          <h1 className="text-[17px] font-extrabold" style={{ color: "#2B2B3D" }}>내 고양이 카드</h1>
          <span className="text-[13px] font-semibold ml-auto" style={{ color: "#8A8598" }}>{cats.length}장</span>
        </div>

        <div className="px-4 pb-28">
          {/* 빠른 메뉴 */}
          <div className="grid grid-cols-5 gap-1.5 mb-4 mt-3">
            <Link href="/mypage/cards/battle"
              className="flex flex-col items-center justify-center gap-1 py-3 rounded-2xl font-bold text-[10.5px] text-white"
              style={{ background: "linear-gradient(135deg,#6FA0D8,#2F5E93)", boxShadow: "0 4px 12px rgba(47,94,147,0.3)" }}>
              <Swords size={15} /> 배틀
            </Link>
            <Link href="/mypage/cards/ranking"
              className="flex flex-col items-center justify-center gap-1 py-3 rounded-2xl font-bold text-[10.5px] text-white"
              style={{ background: "linear-gradient(135deg,#8FC0FF,#5C93F0)", boxShadow: "0 4px 12px rgba(92,147,240,0.3)" }}>
              <Trophy size={15} /> 랭킹
            </Link>
            <Link href="/mypage/shop"
              className="flex flex-col items-center justify-center gap-1 py-3 rounded-2xl font-bold text-[10.5px] text-white"
              style={{ background: "linear-gradient(135deg,#FFC15E,#FFA030)", boxShadow: "0 4px 12px rgba(255,160,48,0.3)" }}>
              <Coins size={15} /> 상점
            </Link>
            <Link href="/mypage/cards/bestiary"
              className="relative flex flex-col items-center justify-center gap-1 py-3 rounded-2xl font-bold text-[10.5px] text-white"
              style={{ background: "linear-gradient(135deg,#7FCB8A,#4FAF63)", boxShadow: "0 4px 12px rgba(79,175,99,0.3)" }}>
              <BookMarked size={15} /> 도감
              {(() => {
                const total = PVE_BESTIARY.length + 1;
                const seenCount = seenKeys.length;
                return seenCount > 0 ? (
                  <span className="absolute -top-1.5 -right-1.5 rounded-full text-[9px] font-extrabold px-1.5 py-0.5"
                    style={{ background: "#fff", color: "#4FAF63", boxShadow: "0 2px 6px rgba(0,0,0,0.15)" }}>
                    {seenCount}/{total}
                  </span>
                ) : null;
              })()}
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
                style={{ background: filter === r ? "#4C82BC" : "#fff", color: filter === r ? "#fff" : "#8A8598", boxShadow: filter === r ? "0 2px 8px rgba(76,130,188,0.35)" : "0 1px 4px rgba(60,50,90,0.06)" }}>
                {r === "all" ? `전체 ${cats.length}` : `${RARITY_LABELS[r]} ${counts[r]}`}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin" style={{ color: "#B4AFC2" }} /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-[32px] mb-3">🃏</p>
              <p className="text-[14px] font-semibold" style={{ color: "#9A94A8" }}>{filter === "all" ? "아직 카드가 없어요" : `${RARITY_LABELS[filter as CardRarity]} 카드가 없어요`}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {filtered.map((cat) => (
                <div key={cat.id} className="flex flex-col items-center gap-1">
                  <CatCard name={cat.name} photoUrl={cat.photo_url}
                    card={{ card_rarity: cat.card_rarity, card_name: cat.card_name, card_traits: cat.card_traits ?? [], card_stats: cat.card_stats, card_flavor: cat.card_flavor, card_level: cat.card_level, card_exp: cat.card_exp, card_generated_at: cat.card_generated_at, best_win_streak: cat.best_win_streak, pve_win_count: cat.pve_win_count, equipped_border_key: cat.equipped_border_key }}
                    size="sm" onClick={() => setSelected(cat)} />
                  {repCardId === cat.id && (
                    <span className="text-[9px] text-yellow-400 font-bold">★ 대표 카드</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 카드 상세 모달 */}
      {selected && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(30,28,45,0.72)", backdropFilter: "blur(4px)", display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 20px calc(20px + env(safe-area-inset-bottom))", gap: 12, overflowY: "auto", WebkitOverflowScrolling: "touch" }}
          onClick={() => setSelected(null)}>
          <button onClick={() => setSelected(null)}
            style={{
              position: "fixed", top: "calc(env(safe-area-inset-top) + 14px)", right: 16, zIndex: 201,
              width: 40, height: 40, borderRadius: 99,
              background: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center", color: "#2B2B3D", cursor: "pointer",
            }}>
            <X size={20} />
          </button>
          <div onClick={e => e.stopPropagation()} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, width: "100%", maxWidth: 340, margin: "auto 0" }}>

            <CatCard name={selected.name} photoUrl={selected.photo_url}
              card={{ card_rarity: selected.card_rarity, card_name: selected.card_name, card_traits: selected.card_traits ?? [], card_stats: selected.card_stats, card_flavor: selected.card_flavor, card_level: selected.card_level, card_exp: selected.card_exp, card_generated_at: selected.card_generated_at, best_win_streak: selected.best_win_streak, pve_win_count: selected.pve_win_count, equipped_border_key: selected.equipped_border_key }}
              size="lg" />

            {/* XP 바 */}
            <div className="w-full px-1 rounded-2xl p-3" style={{ background: "#fff" }}>
              <div className="flex justify-between text-[11px] font-semibold mb-1" style={{ color: "#8A8598" }}>
                <span>EXP</span>
                <span>{selected.card_exp} XP</span>
              </div>
              <div className="h-1.5 rounded-full" style={{ background: "#EEEDF4" }}>
                <div className="h-full rounded-full" style={{
                  width: `${Math.min(((selected.card_exp ?? 0) / ([0,90,210,380,610,900,1260,1690,2200,2800][Math.min(selected.card_level ?? 1, 9)] || 2800)) * 100, 100)}%`,
                  background: "linear-gradient(90deg,#6FA0D8,#FF9CC6)",
                }} />
              </div>
            </div>

            {/* 액션 버튼들 */}
            <div className="grid grid-cols-3 gap-2 w-full">
              {/* 대표 카드 설정 */}
              <button onClick={() => setRepCard(repCardId === selected.id ? null : selected.id)}
                className="py-2.5 rounded-xl text-[11px] font-bold flex flex-col items-center gap-1"
                style={{ background: repCardId === selected.id ? "#FFF3D6" : "#fff", color: repCardId === selected.id ? "#C98A1E" : "#6B6578" }}>
                <Star size={14} />
                {repCardId === selected.id ? "대표 해제" : "대표 설정"}
              </button>

              {/* 배틀 */}
              <Link href="/mypage/cards/battle"
                className="py-2.5 rounded-xl text-[11px] font-bold flex flex-col items-center gap-1"
                style={{ background: "#E3EEF9", color: "#2F5E93", textDecoration: "none" }}>
                <Swords size={14} />
                배틀
              </Link>

              {/* 합성 */}
              <button onClick={doSynthesis} disabled={synthLoading || selected.card_rarity === "legendary"}
                className="py-2.5 rounded-xl text-[11px] font-bold flex flex-col items-center gap-1"
                style={{ background: selected.card_rarity === "legendary" ? "#F1F0F5" : "#FFF3D6", color: selected.card_rarity === "legendary" ? "#C4C0CE" : "#C98A1E", opacity: synthLoading ? 0.6 : 1 }}>
                <Zap size={14} />
                합성
              </button>
            </div>

            {/* 합성 조건 안내 */}
            {selected.card_rarity !== "legendary" && (
              <p className="text-[11px] text-center font-semibold" style={{ color: "#EDEBF7" }}>
                {RARITY_LABELS[selected.card_rarity]} → {SYNTHESIS_RESULT[selected.card_rarity]} 합성 조건: Lv.{LEVEL_GATE[selected.card_rarity]} 이상
                <br />현재 레벨: <span style={{ color: (selected.card_level ?? 1) >= LEVEL_GATE[selected.card_rarity] ? "#FFD76A" : "#FF9C9C" }}>Lv.{selected.card_level ?? 1}</span>
              </p>
            )}

            {synthMsg && (
              <p className="text-[13px] font-bold text-center" style={{ color: synthMsg.includes("부족") || synthMsg.includes("오류") ? "#FF9C9C" : "#9CF0B4" }}>
                {synthMsg}
              </p>
            )}

            {/* 기술 다시 배우기 */}
            <div className="w-full rounded-2xl p-3" style={{ background: "#fff" }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] font-bold flex items-center gap-1.5" style={{ color: "#2B2B3D" }}>
                  <Scroll size={13} /> 기술 다시 배우기
                </span>
                <span className="text-[11px] font-bold" style={{ color: relearnQty > 0 ? "#C98A1E" : "#C4C0CE" }}>
                  머신 보유 {relearnQty}개
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {([selected.battle_special, selected.battle_special2, selected.battle_special3, selected.battle_special4]).map((id, i) => {
                  const skill = SPECIAL_SKILLS[id as keyof typeof SPECIAL_SKILLS];
                  return (
                    <button key={i} onClick={() => doRelearn(i)} disabled={relearnQty <= 0 || relearnLoading}
                      className="rounded-xl px-2 py-1.5 text-left flex items-center gap-1.5"
                      style={{ background: "#F6F5FA", opacity: relearnQty > 0 ? 1 : 0.4 }}>
                      <span style={{ fontSize: 14 }}>{skill?.icon ?? "❔"}</span>
                      <span className="text-[10.5px] font-bold truncate" style={{ color: "#2B2B3D" }}>{skill?.name ?? "?"}</span>
                    </button>
                  );
                })}
              </div>
              {relearnQty <= 0 && (
                <p className="text-[10px] mt-1.5" style={{ color: "#9A94A8" }}>상점에서 &quot;기술 다시 배우기 머신&quot;을 구매하면 스킬을 눌러 재배정할 수 있어요.</p>
              )}
              {relearnMsg && (
                <p className="text-[11px] font-bold text-center mt-1.5" style={{ color: relearnMsg.includes("오류") || relearnMsg.includes("없어요") ? "#E1505F" : "#3FCB6B" }}>
                  {relearnMsg}
                </p>
              )}
            </div>

            {/* 장착 아이템 */}
            <div className="w-full rounded-2xl p-3" style={{ background: "#fff" }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] font-bold flex items-center gap-1.5" style={{ color: "#2B2B3D" }}>
                  <Gem size={13} /> 장착 아이템
                </span>
                {selected.equipped_item_key && (
                  <button onClick={() => doEquip(selected.id, null)} disabled={equipLoading}
                    className="text-[10.5px] font-bold px-2 py-1 rounded-full" style={{ background: "#FDECEC", color: "#E1505F" }}>
                    해제
                  </button>
                )}
              </div>
              {selected.equipped_item_key ? (
                <div className="flex items-center gap-2 rounded-xl px-2.5 py-2 mb-2" style={{ background: "#E3EEF9" }}>
                  <span style={{ fontSize: 18 }}>{SHOP_ITEMS[selected.equipped_item_key as ShopItemKey]?.icon}</span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold truncate" style={{ color: "#2F5E93" }}>{SHOP_ITEMS[selected.equipped_item_key as ShopItemKey]?.name}</p>
                    <p className="text-[10px] truncate" style={{ color: "#6B8FB5" }}>{SHOP_ITEMS[selected.equipped_item_key as ShopItemKey]?.desc}</p>
                  </div>
                </div>
              ) : (
                <p className="text-[10px] mb-2" style={{ color: "#9A94A8" }}>장착한 아이템이 없어요.</p>
              )}
              <div className="grid grid-cols-2 gap-1.5">
                {EQUIP_ITEM_KEYS.filter(k => k !== selected.equipped_item_key).map((key) => {
                  const item = SHOP_ITEMS[key];
                  const qty = ownedEquip[key] ?? 0;
                  return (
                    <button key={key} onClick={() => doEquip(selected.id, key)} disabled={qty <= 0 || equipLoading}
                      className="rounded-xl px-2 py-1.5 text-left flex items-center gap-1.5"
                      style={{ background: "#F6F5FA", opacity: qty > 0 ? 1 : 0.4 }}>
                      <span style={{ fontSize: 14 }}>{item.icon}</span>
                      <span className="text-[10px] font-bold truncate" style={{ color: "#2B2B3D" }}>{item.name} ({qty})</span>
                    </button>
                  );
                })}
              </div>
              {equipMsg && (
                <p className="text-[11px] font-bold text-center mt-1.5" style={{ color: equipMsg.includes("실패") || equipMsg.includes("없어요") ? "#E1505F" : "#3FCB6B" }}>
                  {equipMsg}
                </p>
              )}
            </div>

            {/* 테두리 코스메틱 */}
            <div className="w-full rounded-2xl p-3" style={{ background: "#fff" }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] font-bold flex items-center gap-1.5" style={{ color: "#2B2B3D" }}>
                  <Sparkles size={13} /> 테두리 코스메틱
                </span>
                {selected.equipped_border_key && (
                  <button onClick={() => doEquip(selected.id, null, "border")} disabled={equipLoading}
                    className="text-[10.5px] font-bold px-2 py-1 rounded-full" style={{ background: "#FDECEC", color: "#E1505F" }}>
                    해제
                  </button>
                )}
              </div>
              {selected.equipped_border_key ? (
                <div className="flex items-center gap-2 rounded-xl px-2.5 py-2 mb-2" style={{ background: "#FFF3D6" }}>
                  <span style={{ fontSize: 18 }}>{SHOP_ITEMS[selected.equipped_border_key as ShopItemKey]?.icon}</span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold truncate" style={{ color: "#C98A1E" }}>{SHOP_ITEMS[selected.equipped_border_key as ShopItemKey]?.name}</p>
                    <p className="text-[10px] truncate" style={{ color: "#B4966B" }}>{SHOP_ITEMS[selected.equipped_border_key as ShopItemKey]?.desc}</p>
                  </div>
                </div>
              ) : (
                <p className="text-[10px] mb-2" style={{ color: "#9A94A8" }}>장착한 테두리가 없어요.</p>
              )}
              <div className="grid grid-cols-2 gap-1.5">
                {BORDER_FX_ITEM_KEYS.filter(k => k !== selected.equipped_border_key).map((key) => {
                  const item = SHOP_ITEMS[key];
                  const qty = ownedEquip[key] ?? 0;
                  return (
                    <button key={key} onClick={() => doEquip(selected.id, key, "border")} disabled={qty <= 0 || equipLoading}
                      className="rounded-xl px-2 py-1.5 text-left flex items-center gap-1.5"
                      style={{ background: "#F6F5FA", opacity: qty > 0 ? 1 : 0.4 }}>
                      <span style={{ fontSize: 14 }}>{item.icon}</span>
                      <span className="text-[10px] font-bold truncate" style={{ color: "#2B2B3D" }}>{item.name} ({qty})</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 자랑하기 */}
            <button onClick={() => shareCard(selected)}
              className="w-full py-2.5 rounded-xl text-[12px] font-bold flex items-center justify-center gap-2"
              style={{ background: "#fff", color: "#6B6578" }}>
              <Share2 size={13} /> 커뮤니티에 자랑하기
            </button>
          </div>
        </div>
      )}
    </>
  );
}
