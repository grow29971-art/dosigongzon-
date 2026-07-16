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
import { sfx, primeSfx } from "@/lib/sfx";
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

// 골골 맥동 진동 패턴(ms) — 짧은 on/off 반복으로 "그르르르" 손맛. 총 ~1초.
const PURR_VIBE = [55, 25, 55, 25, 55, 25, 55, 25, 55, 25, 55, 25, 55, 25, 55, 25, 55, 25, 55];
// 만질 때마다 나오는 움직임 종류 수(cthR1~cthR12).
const N_REACT = 12;

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
  // 만질 때마다 여러 움직임 중 하나 — 직전과 다른 변형을 골라 CSS 애니메이션 재시작.
  const [reactVariant, setReactVariant] = useState(-1);
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

  // 다음 움직임 — 직전 변형과 다른 걸 골라 매번 다르게(같은 값이면 CSS가 재생 안 됨).
  const nextReact = () => setReactVariant((v) => v < 0
    ? Math.floor(Math.random() * N_REACT)
    : (v + 1 + Math.floor(Math.random() * (N_REACT - 1))) % N_REACT);

  // 하트 뿅뿅 — 캐릭터 주변에 하트 여러 개를 순차로 팡팡 띄운다.
  const heartBurst = () => {
    const hearts = ["💕", "💗", "💖", "❤️", "💛"];
    for (let i = 0; i < 6; i++) {
      const hx = 50 + (Math.random() * 46 - 23); // 27~73%
      const hy = 36 + (Math.random() * 24 - 8);  // 캐릭터 상체 주변
      const emoji = hearts[i % hearts.length];
      setTimeout(() => spawnFx(emoji, hx, hy), i * 55); // 살짝 시차 → 뿅뿅
    }
  };

  // 쓰다듬기 피드백(즉시) — 골골송 + 골골 맥동 진동 + 캐릭터 움직임 + 하트 뿅뿅.
  const petTap = () => {
    primeSfx();
    sfx.purr();
    try { navigator.vibrate?.(PURR_VIBE); } catch { /* 진동 미지원 */ }
    nextReact(); // 매번 다른 움직임
    heartBurst();
  };

  const act = async (action: "feed" | "pet" | "use_item" | "clean" | "play", itemKey?: ShopItemKey) => {
    if (!cat || busy) return;
    // 쓰다듬기 → 골골송+진동+움직임+하트 즉시(API 왕복과 무관하게 손맛 있게).
    if (action === "pet") petTap();
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
      // 쓰다듬기는 위(petTap)에서 진동·움직임을 이미 걸었으니 여기서 덮어쓰지 않음.
      try { if (action !== "pet") navigator.vibrate?.(12); } catch { /* 햅틱 미지원 */ }
      if (action !== "pet") nextReact();
      if (data.leveled_up) { flash(`🎉 레벨 업! Lv.${data.new_level} 달성!`); spawnFx("🎉", 50, 30); }
      else if (action === "feed") { flash("냠냠! 맛있게 먹었어요 🍚"); spawnFx("🍚", 40, 44); spawnFx("😋", 58, 40); }
      else if (action === "pet") { flash("골골골… 기분 최고예요 💛"); }
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
  // 등록 사진은 코너 뱃지로 — "가상 분신 ↔ 우리 아이" 연결. 메인 캐릭터는 일러스트.
  const photo = sanitizeImageUrl(cat.photo_url ? thumbnailUrl(cat.photo_url, 96) : null);
  const tod = timeOfDay();
  const nPoop = cleanSupported ? poopCount(cleanliness) : 0;
  // careState.face(calm|happy|hungry|pouty) → 일러스트 감정. 밤+기분 좋으면 졸림 변형.
  const emo = state.face === "calm"
    ? (tod === "night" && mood >= 60 ? "sleepy" : "content")
    : state.face;
  // 캐릭터 크기 — 성장할수록 조금씩 커짐 (Lv1 0.92 → Lv10 1.1)
  const scale = Math.min(1.12, 0.9 + level * 0.022);

  // 바닥 오브젝트 위치(인덱스 기반 고정 — 틱마다 안 흔들리게)
  const POOP_POS = [{ l: 22, e: "💩" }, { l: 70, e: "🍂" }, { l: 46, e: "💩" }];

  return (
    <div className="card p-4 mb-4">
      <style dangerouslySetInnerHTML={{ __html: SCENE_CSS }} />

      {/* 헤더: 이름 + 단계/레벨 + 우리 아이 사진 뱃지 */}
      <div className="flex items-center gap-2 mb-2.5">
        <p className="text-[16px] font-extrabold text-text-main truncate">{cat.name}</p>
        <span className="chip-square px-1.5 py-0.5 text-[10px] font-extrabold shrink-0"
          style={{ background: "var(--color-primary-soft)", color: "var(--color-primary-dark)" }}>
          {stage.emoji} {stage.name} · Lv.{level}
        </span>
        <span className="flex-1" />
        {photo && (
          <span className="cth-badge" title={`우리 아이 ${cat.name}`}>
            <Image src={photo} alt={cat.name} fill sizes="34px" style={{ objectFit: "cover" }} />
          </span>
        )}
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
        <div className="cth-plant"><i /><i /><i /><b /></div>

        {/* 캐릭터 — 통일 일러스트(SVG). 감정은 careState, 성장은 scale로 반영 */}
        <button
          type="button"
          className="cth-cat"
          style={{ ["--cth-scale" as string]: scale }}
          onClick={() => { if (!petDone && !busy) act("pet"); else petTap(); }}
          disabled={busy}
          aria-label="쓰다듬기"
        >
          <svg className="cth-catimg" viewBox="0 0 220 210" data-emo={emo} data-dirty={cleanliness < 45 ? "1" : "0"} data-react={reactVariant >= 0 ? reactVariant : undefined} aria-hidden="true">
            <defs>
              <linearGradient id="cthFur" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#EEBE84" /><stop offset="1" stopColor="#D6975A" />
              </linearGradient>
              <radialGradient id="cthBelly" cx="50%" cy="42%" r="60%">
                <stop offset="0" stopColor="#F9EACF" /><stop offset="1" stopColor="#F1DDBB" />
              </radialGradient>
            </defs>
            <ellipse cx="110" cy="196" rx="62" ry="12" fill="rgba(90,60,40,.18)" />
            <path className="cth-tail" d="M168 158 C214 156 214 96 182 92 C202 116 190 146 156 146 Z" fill="url(#cthFur)" />
            <path d="M60 60 L48 16 L98 46 Z" fill="url(#cthFur)" />
            <path d="M160 60 L172 16 L122 46 Z" fill="url(#cthFur)" />
            <path d="M63 52 L56 26 L86 44 Z" fill="#F2A6A0" />
            <path d="M157 52 L164 26 L134 44 Z" fill="#F2A6A0" />
            <path d="M110 30 C66 30 47 76 47 120 C47 178 80 198 110 198 C140 198 173 178 173 120 C173 76 154 30 110 30 Z" fill="url(#cthFur)" />
            <ellipse cx="110" cy="146" rx="43" ry="50" fill="url(#cthBelly)" />
            <path d="M96 44 q14 -12 28 0" fill="none" stroke="#C88A54" strokeWidth="5" strokeLinecap="round" opacity=".55" />
            <path d="M104 40 q6 -8 12 0" fill="none" stroke="#C88A54" strokeWidth="5" strokeLinecap="round" opacity=".55" />
            <ellipse cx="90" cy="192" rx="15" ry="11" fill="#F1DDBB" />
            <ellipse cx="130" cy="192" rx="15" ry="11" fill="#F1DDBB" />
            <ellipse cx="74" cy="128" rx="11" ry="7" fill="#F2A6A0" opacity=".7" />
            <ellipse cx="146" cy="128" rx="11" ry="7" fill="#F2A6A0" opacity=".7" />
            <path d="M104 122 h12 l-6 7 Z" fill="#C77" />
            <g stroke="#B98A63" strokeWidth="1.6" opacity=".6" strokeLinecap="round">
              <line x1="60" y1="118" x2="86" y2="120" /><line x1="60" y1="128" x2="86" y2="126" />
              <line x1="160" y1="118" x2="134" y2="120" /><line x1="160" y1="128" x2="134" y2="126" />
            </g>
            <g className="cth-face">
              <g className="cth-f-content">
                <g className="cth-lids">
                  <ellipse cx="88" cy="112" rx="7" ry="9" fill="#3B2A1E" />
                  <ellipse cx="132" cy="112" rx="7" ry="9" fill="#3B2A1E" />
                </g>
                <circle cx="90" cy="109" r="2.4" fill="#fff" /><circle cx="134" cy="109" r="2.4" fill="#fff" />
                <path d="M104 132 q6 6 12 0" fill="none" stroke="#3B2A1E" strokeWidth="2.6" strokeLinecap="round" />
              </g>
              <g className="cth-f-happy">
                <path d="M81 114 q7 -11 14 0" fill="none" stroke="#3B2A1E" strokeWidth="3.4" strokeLinecap="round" />
                <path d="M125 114 q7 -11 14 0" fill="none" stroke="#3B2A1E" strokeWidth="3.4" strokeLinecap="round" />
                <path d="M101 130 q9 10 18 0" fill="none" stroke="#3B2A1E" strokeWidth="2.8" strokeLinecap="round" />
              </g>
              <g className="cth-f-hungry">
                <ellipse cx="88" cy="111" rx="8" ry="10" fill="#3B2A1E" /><ellipse cx="132" cy="111" rx="8" ry="10" fill="#3B2A1E" />
                <circle cx="91" cy="107" r="3" fill="#fff" /><circle cx="135" cy="107" r="3" fill="#fff" />
                <ellipse cx="110" cy="133" rx="6" ry="7" fill="#8A4A3A" />
                <path d="M116 137 q4 8 0 13" fill="none" stroke="#7FC2E8" strokeWidth="3" strokeLinecap="round" />
              </g>
              <g className="cth-f-sleepy">
                <path d="M80 113 q8 6 16 0" fill="none" stroke="#3B2A1E" strokeWidth="3" strokeLinecap="round" />
                <path d="M124 113 q8 6 16 0" fill="none" stroke="#3B2A1E" strokeWidth="3" strokeLinecap="round" />
                <path d="M105 132 q5 4 10 0" fill="none" stroke="#3B2A1E" strokeWidth="2.4" strokeLinecap="round" />
                <text x="150" y="96" fontSize="16" fill="#8A7660" opacity=".8">z</text>
                <text x="160" y="84" fontSize="12" fill="#8A7660" opacity=".7">z</text>
              </g>
              <g className="cth-f-pouty">
                <line x1="81" y1="112" x2="95" y2="115" stroke="#3B2A1E" strokeWidth="3.4" strokeLinecap="round" />
                <line x1="139" y1="112" x2="125" y2="115" stroke="#3B2A1E" strokeWidth="3.4" strokeLinecap="round" />
                <path d="M104 134 q6 -6 12 0" fill="none" stroke="#3B2A1E" strokeWidth="2.6" strokeLinecap="round" />
              </g>
            </g>
            <g className="cth-smudge" fill="rgba(120,90,60,.5)">
              <ellipse cx="80" cy="150" rx="9" ry="6" transform="rotate(18 80 150)" />
              <ellipse cx="140" cy="160" rx="7" ry="5" />
            </g>
          </svg>
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

// ── 씬 CSS (namespaced cth-) — 통일 일러스트 세계관 ──
const SCENE_CSS = `
.cth-scene{position:relative;height:196px;border-radius:16px;overflow:hidden;isolation:isolate;user-select:none;
  --sky1:#CFEAF2;--sky2:#EAF5EC;--floor:#EAD8BF;--lamp:0}
.cth-scene[data-time="sunset"]{--sky1:#F6C79B;--sky2:#F0A97C;--floor:#E1BC93}
.cth-scene[data-time="night"]{--sky1:#241C40;--sky2:#382F58;--floor:#443A4A;--lamp:1}
.cth-sky{position:absolute;inset:0;z-index:0;transition:background .8s ease,filter .8s ease;
  background:linear-gradient(180deg,var(--sky1) 0%,var(--sky2) 58%,var(--floor) 58%,var(--floor) 100%)}
.cth-scene.cth-rain-on .cth-sky{filter:saturate(.82) brightness(.95)}
.cth-sky::after{content:"";position:absolute;top:18px;right:24px;width:32px;height:32px;border-radius:50%;transition:.8s}
.cth-scene[data-time="day"] .cth-sky::after{background:radial-gradient(circle at 38% 38%,#FFF7DB,#FFD873);box-shadow:0 0 26px 7px rgba(255,214,110,.55)}
.cth-scene[data-time="sunset"] .cth-sky::after{background:radial-gradient(circle at 40% 40%,#FFE7C6,#FF9E5E);box-shadow:0 0 30px 9px rgba(255,140,80,.5)}
.cth-scene[data-time="night"] .cth-sky::after{background:radial-gradient(circle at 60% 34%,#F5F1E2,#D2CBB0);box-shadow:0 0 22px 6px rgba(226,226,205,.4)}
.cth-stars{position:absolute;inset:0;z-index:1;opacity:0;transition:.8s;pointer-events:none}
.cth-scene[data-time="night"] .cth-stars{opacity:1}
.cth-stars i{position:absolute;width:3px;height:3px;border-radius:50%;background:#fff;opacity:.85;animation:cthTwinkle 3s ease-in-out infinite}
.cth-win{position:absolute;top:20px;left:22px;width:48px;height:42px;border-radius:9px;z-index:1;
  background:linear-gradient(180deg,#d3ecf5,#eef7ef);border:4px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,.10);transition:filter .8s}
.cth-scene[data-time="night"] .cth-win{filter:brightness(.66) saturate(.8)}
.cth-win::after{content:"";position:absolute;top:0;bottom:0;left:50%;width:2px;transform:translateX(-1px);background:rgba(255,255,255,.7)}
.cth-plant{position:absolute;top:2px;right:74px;width:22px;height:52px;z-index:1}
.cth-plant b{position:absolute;left:7px;top:26px;width:8px;height:26px;border-radius:0 0 5px 5px;background:#C88A54}
.cth-plant i{position:absolute;width:16px;height:12px;border-radius:60% 60% 60% 0;background:#79B57F;transform-origin:bottom right}
.cth-plant i:nth-child(1){left:0;top:16px;transform:rotate(-18deg)}
.cth-plant i:nth-child(2){left:8px;top:8px;transform:rotate(8deg)}
.cth-plant i:nth-child(3){left:2px;top:2px;transform:rotate(-4deg) scale(.85)}
.cth-lamp{position:absolute;top:-2px;right:120px;width:16px;height:48px;z-index:1;opacity:var(--lamp);transition:.8s}
.cth-lamp::after{content:"";position:absolute;top:24px;left:-3px;width:22px;height:15px;border-radius:0 0 44% 44%;background:#FFD873;box-shadow:0 0 22px 9px rgba(255,216,110,.62)}
.cth-rain{position:absolute;inset:0;z-index:2;pointer-events:none}
.cth-rain i{position:absolute;top:-14px;width:2px;height:13px;border-radius:2px;background:rgba(180,205,225,.72);animation:cthFall linear infinite}
.cth-rug{position:absolute;bottom:12px;left:50%;transform:translateX(-50%);width:150px;height:30px;border-radius:50%;background:rgba(196,126,90,.20);z-index:1}
.cth-bowl{position:absolute;bottom:16px;left:28px;width:42px;height:18px;border-radius:0 0 21px 21px;background:#C47E5A;z-index:2;box-shadow:inset 0 3px 0 rgba(255,255,255,.25)}
.cth-bowl::before{content:"";position:absolute;top:-5px;left:5px;right:5px;height:9px;border-radius:50%;background:#E8B98C}

.cth-badge{position:relative;display:block;width:34px;height:34px;border-radius:11px;overflow:hidden;flex-shrink:0;
  border:2.5px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,.18)}

.cth-cat{position:absolute;bottom:18px;left:50%;padding:0;border:0;background:none;cursor:pointer;line-height:0;
  width:136px;z-index:3;transform:translateX(-50%) scale(var(--cth-scale,1));transform-origin:50% 100%;
  animation:cthBreathe 3.4s ease-in-out infinite}
.cth-cat:disabled{cursor:default}
.cth-catimg{width:100%;height:auto;display:block;overflow:visible;transform-origin:50% 100%}
.cth-catimg[data-react="0"]{animation:cthR1 .6s cubic-bezier(.3,1.35,.5,1)}
.cth-catimg[data-react="1"]{animation:cthR2 .55s ease}
.cth-catimg[data-react="2"]{animation:cthR3 .7s cubic-bezier(.4,1.2,.5,1)}
.cth-catimg[data-react="3"]{animation:cthR4 .55s cubic-bezier(.3,1.5,.5,1)}
.cth-catimg[data-react="4"]{animation:cthR5 .6s ease-in-out}
.cth-catimg[data-react="5"]{animation:cthR6 .7s cubic-bezier(.3,1.3,.5,1)}
.cth-catimg[data-react="6"]{animation:cthR7 .6s cubic-bezier(.3,1.45,.5,1)}
.cth-catimg[data-react="7"]{animation:cthR8 .75s cubic-bezier(.4,1.2,.5,1)}
.cth-catimg[data-react="8"]{animation:cthR9 .6s ease-in-out}
.cth-catimg[data-react="9"]{animation:cthR10 .7s ease-in-out}
.cth-catimg[data-react="10"]{animation:cthR11 .5s linear}
.cth-catimg[data-react="11"]{animation:cthR12 .72s cubic-bezier(.3,1.5,.5,1)}
.cth-catimg .cth-tail{transform-origin:80% 62%;animation:cthTail 2.6s ease-in-out infinite}
.cth-catimg .cth-lids{transform-box:fill-box;transform-origin:center;animation:cthBlink 5s infinite}
.cth-catimg .cth-face>g{display:none}
.cth-catimg[data-emo="content"] .cth-f-content{display:block}
.cth-catimg[data-emo="happy"] .cth-f-happy{display:block}
.cth-catimg[data-emo="hungry"] .cth-f-hungry{display:block}
.cth-catimg[data-emo="sleepy"] .cth-f-sleepy{display:block}
.cth-catimg[data-emo="pouty"] .cth-f-pouty{display:block}
.cth-catimg[data-emo="sleepy"] .cth-lids{animation:none}
.cth-catimg .cth-smudge{opacity:0;transition:opacity .4s}
.cth-catimg[data-dirty="1"] .cth-smudge{opacity:1}

.cth-poop{position:absolute;padding:0;border:0;background:none;font-size:22px;cursor:pointer;z-index:5;
  filter:drop-shadow(0 3px 2px rgba(0,0,0,.25));animation:cthPopIn .3s ease-out backwards;transition:transform .15s}
.cth-poop:hover{transform:scale(1.15) rotate(-6deg)}
.cth-bubble{position:absolute;left:10px;right:10px;bottom:8px;z-index:6;text-align:center;font-size:12px;font-weight:700;
  color:#3E3128;background:rgba(255,255,255,.88);border-radius:11px;padding:5px 10px;backdrop-filter:blur(3px);
  box-shadow:0 3px 10px rgba(0,0,0,.12)}
.cth-scene[data-time="night"] .cth-bubble{color:#F1E8DE;background:rgba(40,34,30,.8)}
.cth-fx{position:absolute;pointer-events:none;font-size:20px;z-index:7;transform:translate(-50%,-50%);animation:cthFloat 1.15s ease-out forwards}

@keyframes cthBreathe{0%,100%{transform:translateX(-50%) scale(var(--cth-scale,1))}50%{transform:translateX(-50%) scale(calc(var(--cth-scale,1) * 1.035))}}
@keyframes cthTail{0%,100%{transform:rotate(-7deg)}50%{transform:rotate(11deg)}}
@keyframes cthBlink{0%,94%,100%{transform:scaleY(1)}97%{transform:scaleY(.08)}}
@keyframes cthTwinkle{0%,100%{opacity:.25}50%{opacity:.9}}
@keyframes cthFall{0%{transform:translateY(0)}100%{transform:translateY(206px)}}
/* 만질 때마다 랜덤으로 나오는 움직임 6종 (svg 로컬 transform, 버튼 숨쉬기와 별개로 합성) */
@keyframes cthR1{ /* 홉+위글 */
  0%,100%{transform:translateY(0) rotate(0) scale(1)}
  18%{transform:translateY(-14px) rotate(-6deg) scale(1.05,.95)}
  40%{transform:translateY(0) rotate(5deg) scale(.97,1.04)}
  62%{transform:translateY(-6px) rotate(-3deg) scale(1)}
  82%{transform:translateY(0) rotate(2deg) scale(1)}}
@keyframes cthR2{ /* 좌우 흔들기 */
  0%,100%{transform:translateX(0) rotate(0)}
  15%{transform:translateX(-10px) rotate(-3deg)}
  30%{transform:translateX(10px) rotate(3deg)}
  45%{transform:translateX(-8px) rotate(-2deg)}
  60%{transform:translateX(7px) rotate(2deg)}
  78%{transform:translateX(-3px) rotate(0)}}
@keyframes cthR3{ /* 점프 스핀 */
  0%{transform:translateY(0) rotate(0) scale(1)}
  50%{transform:translateY(-13px) rotate(360deg) scale(1.03)}
  100%{transform:translateY(0) rotate(360deg) scale(1)}}
@keyframes cthR4{ /* 제자리 스쿼시 */
  0%,100%{transform:scale(1)}
  25%{transform:scale(1.13,.85)}
  50%{transform:scale(.88,1.13)}
  72%{transform:scale(1.04,.97)}}
@keyframes cthR5{ /* 좌우 기우뚱 */
  0%,100%{transform:rotate(0)}
  20%{transform:rotate(-9deg)}
  40%{transform:rotate(8deg)}
  60%{transform:rotate(-6deg)}
  80%{transform:rotate(4deg)}}
@keyframes cthR6{ /* 더블 홉 */
  0%,100%{transform:translateY(0) scale(1)}
  20%{transform:translateY(-16px) scale(1.04,.96)}
  40%{transform:translateY(0) scale(.98,1.03)}
  60%{transform:translateY(-9px) scale(1)}
  80%{transform:translateY(0) scale(1)}}
@keyframes cthR7{ /* 웅크렸다 폭 튀어오르기 */
  0%,100%{transform:translateY(0) scale(1)}
  30%{transform:translateY(6px) scale(1.08,.9)}
  55%{transform:translateY(-13px) scale(.95,1.08)}
  78%{transform:translateY(0) scale(1)}}
@keyframes cthR8{ /* 반대 방향 점프 스핀 */
  0%{transform:translateY(0) rotate(0) scale(1)}
  50%{transform:translateY(-11px) rotate(-360deg) scale(1.03)}
  100%{transform:translateY(0) rotate(-360deg) scale(1)}}
@keyframes cthR9{ /* 젤리 흔들기(스큐) */
  0%,100%{transform:rotate(0) skewX(0)}
  20%{transform:rotate(-5deg) skewX(6deg)}
  40%{transform:rotate(4deg) skewX(-5deg)}
  60%{transform:rotate(-3deg) skewX(3deg)}
  80%{transform:rotate(1deg) skewX(-1deg)}}
@keyframes cthR10{ /* 좌우 스텝 댄스 */
  0%,100%{transform:translateX(0) rotate(0)}
  25%{transform:translateX(-12px) rotate(-7deg)}
  50%{transform:translateX(0) rotate(0)}
  75%{transform:translateX(12px) rotate(7deg)}}
@keyframes cthR11{ /* 부르르 떨기 */
  0%,100%{transform:translateX(0)}
  10%{transform:translateX(-4px)}20%{transform:translateX(4px)}
  30%{transform:translateX(-4px)}40%{transform:translateX(4px)}
  50%{transform:translateX(-3px)}60%{transform:translateX(3px)}
  70%{transform:translateX(-2px)}80%{transform:translateX(2px)}90%{transform:translateX(-1px)}}
@keyframes cthR12{ /* 크게 점프 */
  0%,100%{transform:translateY(0) scale(1)}
  15%{transform:translateY(0) scale(1.1,.86)}
  40%{transform:translateY(-26px) scale(.92,1.12)}
  65%{transform:translateY(0) scale(1.06,.94)}
  85%{transform:translateY(0) scale(1)}}
@keyframes cthPopIn{0%{transform:scale(0)}70%{transform:scale(1.2)}100%{transform:scale(1)}}
@keyframes cthFloat{0%{transform:translate(-50%,-50%) scale(.7);opacity:0}20%{opacity:1}100%{transform:translate(-50%,-130%) scale(1.1);opacity:0}}
@media (prefers-reduced-motion:reduce){.cth-cat,.cth-catimg,.cth-catimg .cth-tail,.cth-catimg .cth-lids,.cth-stars i,.cth-fx{animation:none!important}}
`;
