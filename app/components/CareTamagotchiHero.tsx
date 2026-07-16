"use client";

// ══════════════════════════════════════════
// 다마고치 케어 히어로 — 홈 최상단 (2026-07-16 씬 리디자인)
// 대표 고양이(rep_card_cat_id, 없으면 첫 등록묘)와의 "가상 분신 캐릭터" 교감 위젯.
// - 실존 고양이가 아닌 가상 캐릭터라 똥치우기·꾀죄죄·삐짐 같은 다마고치 재미를 넣어도
//   진짜 아이가 아프다는 오해가 없음. 아픔·죽음·방치 페널티는 없음(순한 상태만).
// - 게이지 3종(포만/기분/청결)은 서버 폴링 없이 클라가 lib/care.ts로 계산, 1분 틱 리렌더.
// - 액션 성공 후엔 응답 "값"을 gaugeTs로 역산해 로컬 갱신
//   (⚠️ now를 넣으면 게이지가 100으로 뻥튀기 — 냥줍 실버그).
// - 씬: 낮/노을/밤(접속 시각) + 비 배경(날씨 API), 캐릭터 반응 애니메이션, 바닥 💩 탭-청소.
// ══════════════════════════════════════════

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { thumbnailUrl } from "@/lib/cats-repo";
import { sanitizeImageUrl } from "@/lib/url-validate";
import { SHOP_ITEMS, SHOP_ITEM_KEYS, type ShopItemKey } from "@/lib/shop-config";
import {
  fullnessAt, moodAt, cleanlinessAt, poopCount, gaugeTs, careState, growthStage, currentCareDay,
  FEED_LIMIT_PER_DAY, FULLNESS_DECAY_HOURS, MOOD_DECAY_HOURS, CLEANLINESS_DECAY_HOURS,
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
  cleaned_at?: string | null;
}

type TimeOfDay = "day" | "sunset" | "night";
function timeOfDay(d = new Date()): TimeOfDay {
  const h = d.getHours();
  if (h >= 6 && h < 17) return "day";
  if (h >= 17 && h < 19) return "sunset";
  return "night";
}

interface Fx { id: number; emoji: string; x: number; y: number }

function Gauge({ label, emoji, value, color }: { label: string; emoji: string; value: number; color: string }) {
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-bold text-text-sub">{emoji} {label}</span>
        <span className="text-[11px] font-extrabold tabular-nums" style={{ color }}>{Math.round(value)}</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--color-surface-alt)" }}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${value}%`, background: color }} />
      </div>
    </div>
  );
}

export default function CareTamagotchiHero() {
  const { user } = useAuth();
  const [cat, setCat] = useState<CareCat | null>(null);
  const [cleanSupported, setCleanSupported] = useState(true);
  const [notReady, setNotReady] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [items, setItems] = useState<{ key: ShopItemKey; quantity: number }[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [raining, setRaining] = useState(false);
  const [fxList, setFxList] = useState<Fx[]>([]);
  const [, setTick] = useState(0);
  const fxId = useRef(0);

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

        const base = "id, name, photo_url, card_level, fed_at, mood_at, fed_day, fed_today, pet_day";
        // cleaned_at 포함 시도 → 그 컬럼만 없으면(청결 마이그레이션 전) 빼고 재조회
        const fetchRow = async (): Promise<{ row: CareCat | null; clean: boolean; hardFail: boolean }> => {
          const q = (cols: string) => repId
            ? supabase.from("cats").select(cols).eq("id", repId).eq("caretaker_id", user.id).maybeSingle()
            : supabase.from("cats").select(cols).eq("caretaker_id", user.id).order("created_at", { ascending: true }).limit(1).maybeSingle();
          const withClean = await q(`${base}, cleaned_at`);
          if (withClean.error?.code === "42703") {
            const b = await q(base);
            if (b.error?.code === "42703") return { row: null, clean: false, hardFail: true };
            return { row: (b.data as unknown as CareCat) ?? null, clean: false, hardFail: false };
          }
          if (withClean.error) return { row: null, clean: true, hardFail: false };
          return { row: (withClean.data as unknown as CareCat) ?? null, clean: true, hardFail: false };
        };

        const { row, clean, hardFail } = await fetchRow();
        if (cancelled) return;
        if (hardFail) { setNotReady(true); setLoaded(true); return; }
        setCleanSupported(clean);
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

  // 날씨 → 비 배경 (실패해도 무시, 맑음 기본)
  useEffect(() => {
    let cancelled = false;
    fetch("/api/weather").then((r) => r.ok ? r.json() : null).then((d) => {
      if (cancelled || !d?.weatherMain) return;
      setRaining(/rain|drizzle|thunder|snow/i.test(String(d.weatherMain)));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // 1분 틱 — lazy decay 게이지 리렌더 (서버 폴링 없음)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 2600);
  };
  const spawnFx = (emoji: string, x: number, y: number) => {
    const id = ++fxId.current;
    setFxList((prev) => [...prev, { id, emoji, x, y }]);
    setTimeout(() => setFxList((prev) => prev.filter((f) => f.id !== id)), 1200);
  };

  const act = async (action: "feed" | "pet" | "use_item" | "clean" | "play", itemKey?: ShopItemKey) => {
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
        else if (res.status === 409) flash("지금은 배불러요! 조금 이따 주세요 😸");
        else if (res.status === 429 && action === "pet") flash("오늘은 벌써 쓰다듬었어요 😽 내일 또!");
        else if (res.status === 429) flash("오늘 밥은 다 챙겼어요! 내일 또 만나요 🍚");
        else flash("잠시 후 다시 시도해주세요");
        return;
      }
      // ⚠️ 응답 '값'을 역산해 저장 — now로 넣으면 게이지 100 뻥튀기.
      // 값이 숫자가 아니면(부분응답·스키마변경) gaugeTs(NaN)→new Date(NaN) RangeError로
      // 히어로가 크래시하므로, 유한 숫자일 때만 역산하고 아니면 기존값 유지.
      const now = Date.now();
      const backTs = (v: unknown, hours: number, fallback: string | null | undefined) =>
        typeof v === "number" && Number.isFinite(v) ? gaugeTs(v, hours, now) : (fallback ?? null);
      setCat((prev) => prev ? {
        ...prev,
        fed_at: backTs(data.fullness, FULLNESS_DECAY_HOURS, prev.fed_at),
        mood_at: backTs(data.mood, MOOD_DECAY_HOURS, prev.mood_at),
        cleaned_at: cleanSupported ? backTs(data.cleanliness, CLEANLINESS_DECAY_HOURS, prev.cleaned_at) : prev.cleaned_at,
        fed_day: action === "feed" ? currentCareDay(now) : prev.fed_day,
        fed_today: typeof data.fed_today === "number" ? data.fed_today : prev.fed_today,
        pet_day: action === "pet" ? currentCareDay(now) : prev.pet_day,
        card_level: data.new_level ?? prev.card_level,
      } : prev);
      if (action === "use_item" && itemKey) {
        setItems((prev) => prev
          .map((it) => it.key === itemKey ? { ...it, quantity: data.item_remaining ?? it.quantity - 1 } : it)
          .filter((it) => it.quantity > 0));
      }
      try { navigator.vibrate?.(12); } catch { /* 햅틱 미지원 */ }
      if (data.leveled_up) { flash(`🎉 레벨 업! Lv.${data.new_level} 달성!`); spawnFx("🎉", 50, 30); }
      else if (action === "feed") { flash("냠냠! 맛있게 먹었어요 🍚"); spawnFx("🍚", 40, 44); spawnFx("😋", 58, 40); }
      else if (action === "pet") { flash("골골골… 기분 최고예요 💛"); spawnFx("💛", 42, 40); spawnFx("💛", 56, 46); }
      else if (action === "clean") { flash("반짝반짝 개운해졌어요 ✨"); spawnFx("✨", 40, 58); spawnFx("✨", 60, 55); }
      else if (action === "play") { flash("까르르! 신나게 놀았어요 🎾"); spawnFx("🎾", 44, 48); spawnFx("😸", 58, 40); }
      else { flash("아이템을 맛있게 냠냠! ✨"); spawnFx("✨", 50, 42); }
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
  const cleanliness = cleanSupported ? cleanlinessAt(cat.cleaned_at ?? null, now) : 100;
  const state = careState(fullness, mood, cleanliness);
  const level = cat.card_level ?? 1;
  const stage = growthStage(level);
  const fedToday = cat.fed_day === today ? (cat.fed_today ?? 0) : 0;
  const petDone = cat.pet_day === today;
  const photo = sanitizeImageUrl(cat.photo_url ? thumbnailUrl(cat.photo_url, 96) : null);
  const tod = timeOfDay();
  const nPoop = cleanSupported ? poopCount(cleanliness) : 0;
  // 캐릭터 크기 — 성장할수록 조금씩 커짐 (Lv1 0.92 → Lv10 1.1)
  const scale = Math.min(1.12, 0.9 + level * 0.022);

  // 바닥 오브젝트 위치(인덱스 기반 고정 — 틱마다 안 흔들리게)
  const POOP_POS = [{ l: 22, e: "💩" }, { l: 70, e: "🍂" }, { l: 46, e: "💩" }];

  return (
    <div className="card p-4 mb-4">
      <style dangerouslySetInnerHTML={{ __html: SCENE_CSS }} />

      {/* 헤더: 이름 + 단계/레벨 + 상태 문구 */}
      <div className="flex items-center gap-2 mb-2.5">
        <p className="text-[16px] font-extrabold text-text-main truncate">{cat.name}</p>
        <span className="chip-square px-1.5 py-0.5 text-[10px] font-extrabold shrink-0"
          style={{ background: "var(--color-primary-soft)", color: "var(--color-primary-dark)" }}>
          {stage.emoji} {stage.name} · Lv.{level}
        </span>
      </div>

      {/* ── 씬 ── */}
      <div className={`cth-scene ${raining ? "cth-rain-on" : ""}`} data-time={tod}>
        <div className="cth-stars">
          {Array.from({ length: 12 }).map((_, i) => (
            <i key={i} style={{ left: `${(i * 37) % 92 + 3}%`, top: `${(i * 53) % 42 + 4}%`, animationDelay: `${(i % 4) * 0.7}s` }} />
          ))}
        </div>
        <div className="cth-sky" />
        <div className="cth-win" />
        <div className="cth-lamp" />
        {raining && (
          <div className="cth-rain">
            {Array.from({ length: 20 }).map((_, i) => (
              <i key={i} style={{ left: `${(i * 51) % 100}%`, animationDuration: `${0.5 + (i % 4) * 0.1}s`, animationDelay: `${(i % 6) * 0.2}s` }} />
            ))}
          </div>
        )}
        <div className="cth-rug" />
        <div className="cth-bowl" />

        {/* 우리 아이 사진 뱃지 — 가상 캐릭터와 실제 아이 연결 */}
        {photo && (
          <div className="cth-portrait" title={`우리 아이 ${cat.name}`}>
            <Image src={photo} alt={cat.name} fill sizes="34px" style={{ objectFit: "cover" }} />
          </div>
        )}

        {/* 캐릭터 */}
        <button
          type="button"
          className={`cth-cat ${cleanliness < 45 ? "cth-messy" : ""}`}
          data-face={state.face}
          style={{ ["--cth-scale" as string]: scale }}
          onClick={() => { if (!petDone && !busy) act("pet"); else spawnFx("🐾", 50, 44); }}
          disabled={busy}
          aria-label="쓰다듬기"
        >
          <span className="cth-tail" />
          <span className="cth-body" />
          <span className="cth-ear l" /><span className="cth-ear r" />
          <span className="cth-face">
            <span className="cth-eye l" /><span className="cth-eye r" />
            <span className="cth-cheek l" /><span className="cth-cheek r" />
            <span className="cth-mouth" />
          </span>
          <span className="cth-smudge a" /><span className="cth-smudge b" />
        </button>

        {/* 바닥 오브젝트 — 탭하면 청소 */}
        {POOP_POS.slice(0, nPoop).map((p, i) => (
          <button
            key={i}
            type="button"
            className="cth-poop"
            style={{ left: `${p.l}%`, bottom: `${6 + (i % 2) * 8}px` }}
            onClick={(e) => { e.stopPropagation(); if (!busy) act("clean"); }}
            disabled={busy}
            aria-label="치워주기"
          >{p.e}</button>
        ))}

        {/* 상태 문구 */}
        <div className="cth-bubble">{notice ?? state.line}</div>

        {/* 반응 이펙트 */}
        {fxList.map((f) => (
          <span key={f.id} className="cth-fx" style={{ left: `${f.x}%`, top: `${f.y}%` }}>{f.emoji}</span>
        ))}
      </div>

      {/* 게이지 */}
      <div className="flex gap-3 mt-3">
        <Gauge label="포만감" emoji="🍚" value={fullness} color="#E88D5A" />
        <Gauge label="기분" emoji="💛" value={mood} color="#E8B040" />
        {cleanSupported && <Gauge label="청결" emoji="🫧" value={cleanliness} color="#4FB39A" />}
      </div>

      {/* 액션 버튼 */}
      <div className="grid grid-cols-2 gap-2 mt-3">
        <button type="button" onClick={() => act("feed")} disabled={busy || fedToday >= FEED_LIMIT_PER_DAY}
          className="press py-2.5 text-[13px] font-extrabold text-white disabled:opacity-40"
          style={{ borderRadius: "var(--radius-input)", background: "linear-gradient(135deg, #E88D5A 0%, #D9743F 100%)" }}>
          🍚 밥 주기 <span className="text-[11px] font-bold opacity-85">({fedToday}/{FEED_LIMIT_PER_DAY})</span>
        </button>
        <button type="button" onClick={() => act("pet")} disabled={busy || petDone}
          className="press py-2.5 text-[13px] font-extrabold disabled:opacity-40"
          style={{ borderRadius: "var(--radius-input)", background: petDone ? "var(--color-surface-alt)" : "var(--color-primary-soft)", color: petDone ? "var(--color-text-light)" : "var(--color-primary-dark)" }}>
          {petDone ? "✓ 오늘 쓰담 완료" : "🤚 쓰다듬기"}
        </button>
        {cleanSupported && (
          <button type="button" onClick={() => act("clean")} disabled={busy || nPoop === 0}
            className="press py-2.5 text-[13px] font-extrabold text-white disabled:opacity-40"
            style={{ borderRadius: "var(--radius-input)", background: "linear-gradient(135deg, #54B89E 0%, #3C9880 100%)" }}>
            🧹 치워주기{nPoop > 0 ? ` (${nPoop})` : ""}
          </button>
        )}
        <button type="button" onClick={() => act("play")} disabled={busy}
          className="press py-2.5 text-[13px] font-extrabold text-white disabled:opacity-40"
          style={{ borderRadius: "var(--radius-input)", background: "linear-gradient(135deg, #C48ACB 0%, #A366AD 100%)" }}>
          🎾 놀아주기
        </button>
      </div>

      {/* 보유 케어 아이템 칩 + 상점 진입 */}
      <div className="flex gap-1.5 mt-2.5 overflow-x-auto no-scrollbar">
        {items.map((it) => {
          const def = SHOP_ITEMS[it.key];
          return (
            <button key={it.key} type="button" onClick={() => act("use_item", it.key)} disabled={busy}
              className="chip-square press shrink-0 px-2.5 py-1.5 text-[11px] font-bold disabled:opacity-40"
              style={{ background: "var(--color-surface-alt)", color: "var(--color-text-sub)" }}>
              {def.icon} {def.name} ×{it.quantity}
            </button>
          );
        })}
        <Link href="/mypage/shop" className="chip-square press shrink-0 px-2.5 py-1.5 text-[11px] font-bold"
          style={{ background: "var(--color-primary-soft)", color: "var(--color-primary-dark)" }}>
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

// ── 씬 CSS (namespaced cth-) ──
const SCENE_CSS = `
.cth-scene{position:relative;height:184px;border-radius:16px;overflow:hidden;isolation:isolate;user-select:none;
  --sky-top:#BEE4F3;--sky-bot:#E9F6EF;--floor:#E7D6C1}
.cth-scene[data-time="sunset"]{--sky-top:#F6C79B;--sky-bot:#F1A97E;--floor:#DCB795}
.cth-scene[data-time="night"]{--sky-top:#25254A;--sky-bot:#39355E;--floor:#483E36}
.cth-sky{position:absolute;inset:0;z-index:0;transition:background .9s ease;
  background:linear-gradient(180deg,var(--sky-top) 0%,var(--sky-bot) 60%,var(--floor) 60%,var(--floor) 100%)}
.cth-sky::after{content:"";position:absolute;top:16px;right:20px;width:34px;height:34px;border-radius:50%;transition:.9s}
.cth-scene[data-time="day"] .cth-sky::after{background:radial-gradient(circle at 40% 40%,#FFF6D8,#FFD86B);box-shadow:0 0 24px 6px rgba(255,214,107,.55)}
.cth-scene[data-time="sunset"] .cth-sky::after{background:radial-gradient(circle at 40% 40%,#FFE9C8,#FF9E5E);box-shadow:0 0 28px 8px rgba(255,140,80,.5)}
.cth-scene[data-time="night"] .cth-sky::after{background:radial-gradient(circle at 60% 35%,#F4F1E4,#CFC9B0);box-shadow:0 0 20px 5px rgba(220,220,200,.35)}
.cth-stars{position:absolute;inset:0;z-index:1;opacity:0;transition:.9s;pointer-events:none}
.cth-scene[data-time="night"] .cth-stars{opacity:1}
.cth-stars i{position:absolute;width:3px;height:3px;border-radius:50%;background:#fff;opacity:.8;animation:cthTwinkle 3s ease-in-out infinite}
.cth-win{position:absolute;top:20px;left:20px;width:46px;height:40px;border-radius:8px;z-index:1;
  background:linear-gradient(180deg,#cfeaf5,#eaf6ef);border:4px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,.12)}
.cth-scene[data-time="night"] .cth-win{filter:brightness(.7)}
.cth-lamp{position:absolute;top:2px;right:56px;width:18px;height:52px;z-index:1;opacity:0;transition:.9s}
.cth-scene[data-time="night"] .cth-lamp{opacity:1}
.cth-lamp::after{content:"";position:absolute;top:26px;left:-2px;width:22px;height:16px;border-radius:0 0 40% 40%;background:#FFD86B;box-shadow:0 0 20px 8px rgba(255,216,107,.6)}
.cth-rain{position:absolute;inset:0;z-index:2;pointer-events:none}
.cth-rain i{position:absolute;top:-12px;width:2px;height:13px;border-radius:2px;background:rgba(180,205,225,.72);animation:cthFall linear infinite}
.cth-rug{position:absolute;bottom:12px;left:50%;transform:translateX(-50%);width:140px;height:30px;border-radius:50%;background:rgba(196,126,90,.22);z-index:1}
.cth-bowl{position:absolute;bottom:16px;left:26px;width:40px;height:18px;border-radius:0 0 20px 20px;background:#C47E5A;z-index:2;box-shadow:inset 0 3px 0 rgba(255,255,255,.25)}
.cth-bowl::before{content:"";position:absolute;top:-5px;left:5px;right:5px;height:9px;border-radius:50%;background:#E8B98C}
.cth-portrait{position:absolute;top:12px;right:14px;width:34px;height:34px;border-radius:11px;overflow:hidden;z-index:4;border:2.5px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,.2)}

.cth-cat{position:absolute;bottom:22px;left:50%;padding:0;border:0;background:none;cursor:pointer;
  width:104px;height:106px;z-index:3;transform:translateX(-50%) scale(var(--cth-scale,1));transform-origin:50% 100%;
  animation:cthBreathe 3.2s ease-in-out infinite}
.cth-cat:disabled{cursor:default}
.cth-cat>span{position:absolute}
.cth-tail{width:50px;height:23px;right:-26px;bottom:16px;border-radius:0 36px 36px 0;background:#E0AE7F;transform-origin:0 50%;animation:cthTail 2.4s ease-in-out infinite}
.cth-body{width:86px;height:74px;left:9px;bottom:0;border-radius:48% 48% 44% 44%/54% 54% 46% 46%;background:#E7B98E;box-shadow:inset -7px -9px 0 rgba(0,0,0,.06)}
.cth-ear{width:0;height:0;top:5px;border-left:15px solid transparent;border-right:15px solid transparent;border-bottom:23px solid #E7B98E}
.cth-ear.l{left:18px;transform:rotate(-16deg);transform-origin:bottom center;animation:cthEarL 5s ease-in-out infinite}
.cth-ear.r{right:18px;transform:rotate(16deg);transform-origin:bottom center;animation:cthEarR 5s ease-in-out infinite}
.cth-ear::after{content:"";position:absolute;left:-7px;bottom:-21px;border-left:7px solid transparent;border-right:7px solid transparent;border-bottom:11px solid #F0A9A0}
.cth-face{width:86px;height:74px;left:9px;bottom:0}
.cth-eye{width:10px;height:13px;top:30px;border-radius:50%;background:#3a2c22;animation:cthBlink 4.3s infinite}
.cth-eye.l{left:24px}.cth-eye.r{right:24px}
.cth-eye::after{content:"";position:absolute;top:2px;left:2px;width:4px;height:4px;border-radius:50%;background:#fff;opacity:.9}
.cth-cheek{width:12px;height:8px;top:41px;border-radius:50%;background:#F0A9A0;opacity:.72}
.cth-cheek.l{left:13px}.cth-cheek.r{right:13px}
.cth-mouth{width:15px;height:8px;left:50%;top:43px;transform:translateX(-50%);border-radius:0 0 15px 15px;border:2.5px solid #3a2c22;border-top:0}
.cth-cat[data-face="happy"] .cth-eye{height:8px;border-radius:11px 11px 0 0;top:32px;animation:none}
.cth-cat[data-face="happy"] .cth-mouth{width:18px;height:11px}
.cth-cat[data-face="hungry"] .cth-mouth{width:10px;height:10px;border-radius:50%;border:2.5px solid #3a2c22;top:42px}
.cth-cat[data-face="pouty"]{transform:translateX(-50%) scale(var(--cth-scale,1)) rotate(-5deg)}
.cth-cat[data-face="pouty"] .cth-eye{height:4px;border-radius:4px;animation:none;top:35px}
.cth-cat[data-face="pouty"] .cth-mouth{border-radius:15px 15px 0 0;border-top:2.5px solid #3a2c22;border-bottom:0;top:47px}
.cth-smudge{position:absolute;border-radius:50%;background:rgba(120,90,60,.5);opacity:0;transition:.4s;z-index:4}
.cth-cat.cth-messy .cth-smudge{opacity:1}
.cth-smudge.a{width:11px;height:8px;left:30px;bottom:22px;transform:rotate(20deg)}
.cth-smudge.b{width:8px;height:6px;left:54px;bottom:38px}

.cth-poop{position:absolute;padding:0;border:0;background:none;font-size:22px;cursor:pointer;z-index:5;
  filter:drop-shadow(0 3px 2px rgba(0,0,0,.25));animation:cthPop .3s ease-out backwards;transition:transform .15s}
.cth-poop:hover{transform:scale(1.15) rotate(-6deg)}
.cth-bubble{position:absolute;left:10px;right:10px;bottom:8px;z-index:6;text-align:center;font-size:12px;font-weight:700;
  color:#3E3128;background:rgba(255,255,255,.86);border-radius:11px;padding:5px 10px;backdrop-filter:blur(3px);
  box-shadow:0 3px 10px rgba(0,0,0,.12)}
.cth-scene[data-time="night"] .cth-bubble{color:#F1E8DE;background:rgba(40,34,30,.78)}
.cth-fx{position:absolute;pointer-events:none;font-size:20px;z-index:7;transform:translate(-50%,-50%);animation:cthFloat 1.15s ease-out forwards}

@keyframes cthBreathe{0%,100%{transform:translateX(-50%) scale(var(--cth-scale,1))}50%{transform:translateX(-50%) scale(calc(var(--cth-scale,1) * 1.035))}}
@keyframes cthTail{0%,100%{transform:rotate(-8deg)}50%{transform:rotate(14deg)}}
@keyframes cthBlink{0%,94%,100%{transform:scaleY(1)}97%{transform:scaleY(.1)}}
@keyframes cthEarL{0%,92%,100%{transform:rotate(-16deg)}96%{transform:rotate(-24deg)}}
@keyframes cthEarR{0%,90%,100%{transform:rotate(16deg)}95%{transform:rotate(24deg)}}
@keyframes cthTwinkle{0%,100%{opacity:.25}50%{opacity:.9}}
@keyframes cthFall{0%{transform:translateY(0)}100%{transform:translateY(200px)}}
@keyframes cthPop{0%{transform:scale(0)}70%{transform:scale(1.2)}100%{transform:scale(1)}}
@keyframes cthFloat{0%{transform:translate(-50%,-50%) scale(.7);opacity:0}20%{opacity:1}100%{transform:translate(-50%,-130%) scale(1.1);opacity:0}}
@media (prefers-reduced-motion:reduce){.cth-cat,.cth-tail,.cth-ear,.cth-eye,.cth-stars i,.cth-fx{animation:none!important}}
`;
