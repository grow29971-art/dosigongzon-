"use client";

// ══════════════════════════════════════════
// 다마고치 케어 히어로 — 홈 최상단 (2026-07-16)
// 대표 고양이(rep_card_cat_id, 없으면 첫 등록묘)와의 가상 교감 위젯.
// - 게이지는 서버 폴링 없이 클라가 lib/care.ts로 직접 계산, 1분 틱으로 리렌더만.
// - 액션 성공 후엔 응답 "값"을 gaugeTs로 역산해 로컬 갱신
//   (⚠️ now를 넣으면 게이지가 100으로 뻥튀기 — 냥줍 실버그).
// - 실존 고양이라 "실제 상태 아님" 캡션 필수 (오해 방지).
// ══════════════════════════════════════════

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { thumbnailUrl } from "@/lib/cats-repo";
import { sanitizeImageUrl } from "@/lib/url-validate";
import { SHOP_ITEMS, SHOP_ITEM_KEYS, type ShopItemKey } from "@/lib/shop-config";
import {
  fullnessAt, moodAt, gaugeTs, careState, growthStage, currentCareDay,
  FEED_LIMIT_PER_DAY, FULLNESS_DECAY_HOURS, MOOD_DECAY_HOURS,
} from "@/lib/care";

const CARE_ITEM_KEYS = SHOP_ITEM_KEYS.filter((k) => !!SHOP_ITEMS[k].care);

interface CareCat {
  id: string;
  name: string;
  photo_url: string | null;
  card_level: number | null;
  fed_at: string | null;
  mood_at: string | null;
  fed_day: number | null;
  fed_today: number | null;
  pet_day: number | null;
}

function Gauge({ label, emoji, value, color }: { label: string; emoji: string; value: number; color: string }) {
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-bold text-text-sub">{emoji} {label}</span>
        <span className="text-[11px] font-extrabold tabular-nums" style={{ color }}>{Math.round(value)}</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--color-surface-alt)" }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${value}%`, background: color }}
        />
      </div>
    </div>
  );
}

export default function CareTamagotchiHero() {
  const { user } = useAuth();
  const [cat, setCat] = useState<CareCat | null>(null);
  const [notReady, setNotReady] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [items, setItems] = useState<{ key: ShopItemKey; quantity: number }[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [, setTick] = useState(0); // 1분마다 게이지 리렌더용

  // 로드: 대표묘(없으면 첫 등록묘) + 보유 케어 아이템
  useEffect(() => {
    if (!user) { setLoaded(true); return; }
    let cancelled = false;
    const supabase = createClient();
    (async () => {
      try {
        const { data: prof } = await supabase
          .from("profiles").select("rep_card_cat_id").eq("id", user.id).maybeSingle();
        const repId = (prof as { rep_card_cat_id: string | null } | null)?.rep_card_cat_id ?? null;

        const cols = "id, name, photo_url, card_level, fed_at, mood_at, fed_day, fed_today, pet_day";
        let row: CareCat | null = null;
        if (repId) {
          const { data, error } = await supabase.from("cats").select(cols).eq("id", repId).eq("caretaker_id", user.id).maybeSingle();
          if (error?.code === "42703") { if (!cancelled) { setNotReady(true); setLoaded(true); } return; }
          row = data as CareCat | null;
        }
        if (!row) {
          const { data, error } = await supabase
            .from("cats").select(cols).eq("caretaker_id", user.id)
            .order("created_at", { ascending: true }).limit(1).maybeSingle();
          if (error?.code === "42703") { if (!cancelled) { setNotReady(true); setLoaded(true); } return; }
          row = data as CareCat | null;
        }
        if (cancelled) return;
        setCat(row);
        setLoaded(true);

        if (row) {
          const { data: inv } = await supabase
            .from("user_items").select("item_key, quantity")
            .eq("user_id", user.id).in("item_key", CARE_ITEM_KEYS).gt("quantity", 0);
          if (!cancelled && inv) {
            setItems((inv as { item_key: ShopItemKey; quantity: number }[]).map((r) => ({ key: r.item_key, quantity: r.quantity })));
          }
        }
      } catch {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  // 1분 틱 — lazy decay 게이지 리렌더 (서버 폴링 없음)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 2600);
  };

  const act = async (action: "feed" | "pet" | "use_item", itemKey?: ShopItemKey) => {
    if (!cat || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/care", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_id: cat.id, action, item_key: itemKey }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 503) flash("케어 기능 준비 중이에요 🛠️");
        else if (res.status === 409) flash(`지금은 배불러요! 조금 이따 주세요 😸`);
        else if (res.status === 429 && action === "pet") flash("오늘은 벌써 쓰다듬었어요 😽 내일 또!");
        else if (res.status === 429) flash("오늘 밥은 다 챙겼어요! 내일 또 만나요 🍚");
        else flash("잠시 후 다시 시도해주세요");
        return;
      }
      // ⚠️ 응답 '값'을 역산해 저장 — now로 넣으면 게이지 100 뻥튀기
      const now = Date.now();
      setCat((prev) => prev ? {
        ...prev,
        fed_at: gaugeTs(data.fullness, FULLNESS_DECAY_HOURS, now),
        mood_at: gaugeTs(data.mood, MOOD_DECAY_HOURS, now),
        fed_day: currentCareDay(now),
        fed_today: data.fed_today,
        pet_day: action === "pet" ? currentCareDay(now) : prev.pet_day,
        card_level: data.new_level ?? prev.card_level,
      } : prev);
      if (action === "use_item" && itemKey) {
        setItems((prev) => prev
          .map((it) => it.key === itemKey ? { ...it, quantity: data.item_remaining ?? it.quantity - 1 } : it)
          .filter((it) => it.quantity > 0));
      }
      try { navigator.vibrate?.(12); } catch { /* 햅틱 미지원 */ }
      if (data.leveled_up) flash(`🎉 레벨 업! Lv.${data.new_level} 달성!`);
      else if (action === "feed") flash("냠냠! 맛있게 먹었어요 🍚");
      else if (action === "pet") flash("골골골… 기분 최고예요 💛");
      else flash("아이템을 맛있게 냠냠! ✨");
    } finally {
      setBusy(false);
    }
  };

  if (!user || !loaded) return null;
  if (notReady) {
    return (
      <div className="card px-4 py-3 mb-4">
        <p className="text-[12px] text-text-light">🐾 다마고치 케어 기능 준비 중이에요</p>
      </div>
    );
  }
  if (!cat) return null; // 등록 고양이 0마리 — FirstCheer/OnboardingCard가 담당

  const now = Date.now();
  const today = currentCareDay(now);
  const fullness = fullnessAt(cat.fed_at, now);
  const mood = moodAt(cat.mood_at, now);
  const state = careState(fullness, mood);
  const level = cat.card_level ?? 1;
  const stage = growthStage(level);
  const fedToday = cat.fed_day === today ? (cat.fed_today ?? 0) : 0;
  const petDone = cat.pet_day === today;
  const photo = sanitizeImageUrl(cat.photo_url ? thumbnailUrl(cat.photo_url, 160) : null);

  return (
    <div className="card p-4 mb-4">
      {/* 헤더: 사진 + 이름 + 단계/레벨 + 상태 문구 */}
      <div className="flex items-center gap-3">
        <div
          className="relative w-16 h-16 shrink-0 overflow-hidden"
          style={{ borderRadius: 18, background: "var(--color-surface-alt)" }}
        >
          {photo ? (
            <Image src={photo} alt={cat.name} fill sizes="64px" style={{ objectFit: "cover" }} />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[28px]">{state.emoji}</div>
          )}
          <span className="absolute -bottom-0 -right-0 text-[16px]">{state.emoji}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-[16px] font-extrabold text-text-main truncate">{cat.name}</p>
            <span
              className="chip-square px-1.5 py-0.5 text-[10px] font-extrabold shrink-0"
              style={{ background: "var(--color-primary-soft)", color: "var(--color-primary-dark)" }}
            >
              {stage.emoji} {stage.name} · Lv.{level}
            </span>
          </div>
          <p className="text-[12px] text-text-sub mt-0.5 leading-snug">
            {notice ?? state.line}
          </p>
        </div>
      </div>

      {/* 게이지 2개 */}
      <div className="flex gap-3 mt-3">
        <Gauge label="포만감" emoji="🍚" value={fullness} color="#E88D5A" />
        <Gauge label="기분" emoji="💛" value={mood} color="#E8B040" />
      </div>

      {/* 액션 버튼 */}
      <div className="flex gap-2 mt-3">
        <button
          type="button"
          onClick={() => act("feed")}
          disabled={busy || fedToday >= FEED_LIMIT_PER_DAY}
          className="press flex-1 py-2.5 text-[13px] font-extrabold text-white disabled:opacity-40"
          style={{ borderRadius: "var(--radius-input)", background: "linear-gradient(135deg, #E88D5A 0%, #D9743F 100%)" }}
        >
          🍚 밥 주기 <span className="text-[11px] font-bold opacity-85">({fedToday}/{FEED_LIMIT_PER_DAY})</span>
        </button>
        <button
          type="button"
          onClick={() => act("pet")}
          disabled={busy || petDone}
          className="press flex-1 py-2.5 text-[13px] font-extrabold disabled:opacity-40"
          style={{
            borderRadius: "var(--radius-input)",
            background: petDone ? "var(--color-surface-alt)" : "var(--color-primary-soft)",
            color: petDone ? "var(--color-text-light)" : "var(--color-primary-dark)",
          }}
        >
          {petDone ? "✓ 오늘 쓰담 완료" : "🤚 쓰다듬기"}
        </button>
      </div>

      {/* 보유 케어 아이템 칩 + 상점 진입 (코인 경제 부활 2026-07-16) */}
      <div className="flex gap-1.5 mt-2.5 overflow-x-auto no-scrollbar">
        {items.map((it) => {
          const def = SHOP_ITEMS[it.key];
          return (
            <button
              key={it.key}
              type="button"
              onClick={() => act("use_item", it.key)}
              disabled={busy}
              className="chip-square press shrink-0 px-2.5 py-1.5 text-[11px] font-bold disabled:opacity-40"
              style={{ background: "var(--color-surface-alt)", color: "var(--color-text-sub)" }}
            >
              {def.icon} {def.name} ×{it.quantity}
            </button>
          );
        })}
        <Link
          href="/mypage/shop"
          className="chip-square press shrink-0 px-2.5 py-1.5 text-[11px] font-bold"
          style={{ background: "var(--color-primary-soft)", color: "var(--color-primary-dark)" }}
        >
          🛍️ {items.length > 0 ? "간식 더 사기" : "케어 간식 사러 가기"}
        </Link>
      </div>

      {/* 실존 고양이 오해 방지 캡션 */}
      <p className="text-[10px] text-text-muted mt-2.5">
        우리 둘만의 다마고치 — 실제 아이 상태와는 무관해요 🐾
      </p>
    </div>
  );
}
