"use client";

// 🐾 조우 기록장 (/catch/dex) — 냥줍 app/(main)/dex/page.tsx 이식 (2026-08-04 P3).
//  · 기록: 내가 포획한 냥이들의 시간순 갤러리 (종 아트/사진)
//  · 컬렉션: 등급 컬렉션 + 종 도감(카탈로그 전체, 미획득 실루엣) — 수집 축 ①
//  · 업적: catch_cards/catch_profiles에서 순수 계산 + 보상 수령 — 수집 축 ②
//  · 배틀: P4 이식 예정 — CATCH_BATTLE_ENABLED 플래그로 탭 자리만 (빈 상태)
// 상단에 이번 주 의뢰 배너(lib/catch/quests — 결정적 계산 + catch_profiles.quest_week).
//
// 냥줍 대비 뺀 것: 실사(photo_url) 필터 — city 포획 카드는 전부 종 아트라 전체를
// 기록으로 취급, 실체화(dex_photos) 섹션·PVE 조우 도감(P4)·자체 BottomNav/PageHeader
// (city (main) 레이아웃이 감쌈). 스타일 토큰은 lib/catch/arcade-theme.ts로 자급.

import { useEffect, useMemo, useState, type ReactNode, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import {
  Share2, BookOpen, PawPrint, Gem, Medal, Rainbow, Camera, Backpack, Crown, Star,
  Compass, Target, Flame, ShieldAlert, Trophy, Sparkles, Swords, Map, ChevronLeft,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { RARITY_LABEL, SPAWN_SPECIES, speciesPhotoUrl } from "@/lib/catch/spawn-species";
import {
  computeAchievements, BATTLE_ACHIEVEMENT_KEYS, type Achievement,
} from "@/lib/catch/achievements";
import { currentQuest, currentWeekKey, isQuestDoneThisWeek, questProgressCount, QUEST_REWARD_COINS } from "@/lib/catch/quests";
import { CATCH_BATTLE_ENABLED } from "@/lib/catch/features";
import { celebrateVictory } from "@/lib/catch/celebrate";
import {
  UI, SQUIRCLE, pageBgStyle, RARITY_GRADIENT, dexNo, numFontStyle,
  slashBannerStyle, arcadeChipStyle, silhouetteStyle,
} from "@/lib/catch/arcade-theme";

interface DexCard {
  id: string;
  card_name: string | null;
  card_rarity: string;
  photo_url: string | null;
  species_key: string | null;
  caught_geohash7: string | null;
  caught_at: string;
  bond: number | null;
  is_shiny: boolean | null;
}

const RARITY_KEYS = ["common", "uncommon", "rare", "legendary"] as const;

// 등급 색 — 명도 램프 (arcade-theme UI.grade)
const gradeColor = (r: string): string => UI.grade[r as keyof typeof UI.grade] ?? UI.textMuted;

type TabKey = "log" | "collection" | "achievements" | "battle";
const TAB_DEFS: ReadonlyArray<readonly [TabKey, string]> = CATCH_BATTLE_ENABLED
  ? [["log", "기록"], ["collection", "컬렉션"], ["achievements", "업적"], ["battle", "배틀"]]
  : [["log", "기록"], ["collection", "컬렉션"], ["achievements", "업적"]];

// 업적 아이콘 — key 기반 lucide 매핑 (achievements.ts 이모지는 폴백)
const ACHIEVEMENT_ICONS: Record<string, LucideIcon> = {
  first_catch: PawPrint, catch_10: Camera, catch_30: Backpack, catch_100: Crown,
  rarity_all: Rainbow, rare_1: Gem, legendary_1: Star,
  explorer_5: Map, explorer_20: Compass,
  perfect_10: Target, streak_5: Flame, boss_5: ShieldAlert,
  species_5: PawPrint, species_30: BookOpen, species_all: Trophy,
  shiny_1: Sparkles,
};

// ── 아케이드 스킨 로컬 헬퍼 ──
function chunkyTrackStyle(h = 9): CSSProperties {
  return { height: h, borderRadius: 5, background: "rgba(31,58,86,0.10)", overflow: "hidden" };
}
function chunkyFillStyle(color: string, pct: number): CSSProperties {
  return {
    height: "100%", width: `${Math.max(0, Math.min(100, pct))}%`,
    background: `linear-gradient(90deg, ${color}B3 0%, ${color} 100%)`,
    borderRadius: 5, boxShadow: "inset 0 -2px 0 rgba(2,32,71,0.10)",
  };
}
function SectionBanner({ color, right, children }: { color: string; right?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 mb-2"
      style={{ ...slashBannerStyle(color), color: UI.textSub }}>
      <p className="text-[11.5px] font-black">{children}</p>
      {right}
    </div>
  );
}

export default function CatchDexPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<TabKey>("log");
  const [cards, setCards] = useState<DexCard[] | null>(null);
  const [perfectCount, setPerfectCount] = useState(0);
  const [questWeek, setQuestWeek] = useState<string | null>(null);
  // 업적 보상 수령 — null이면 마이그레이션 전(503)/로딩 중: 수령 버튼을 숨기고 표시만
  const [claimedAch, setClaimedAch] = useState<string[] | null>(null);
  const [claimingKey, setClaimingKey] = useState<string | null>(null);
  const [claimToast, setClaimToast] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace("/login"); return; }
    const supabase = createClient();
    (async () => {
      const [cardsRes, profRes] = await Promise.all([
        supabase.from("catch_cards")
          .select("id, card_name, card_rarity, photo_url, species_key, caught_geohash7, caught_at, bond, is_shiny")
          .eq("owner_id", user.id)
          .order("caught_at", { ascending: false })
          .limit(1000),
        // catch_profiles는 별도 마이그레이션(catch_profile_migration) — 전이면 이 조회만 조용히 실패
        supabase.from("catch_profiles")
          .select("perfect_catch_count, quest_week")
          .eq("user_id", user.id).maybeSingle(),
      ]);
      // catch_cards 마이그레이션 전 — 도감은 빈 상태로 (지도가 이미 503 안내를 담당)
      setCards(cardsRes.error ? [] : ((cardsRes.data ?? []) as unknown as DexCard[]));
      if (!profRes.error && profRes.data) {
        setPerfectCount((profRes.data.perfect_catch_count as number | null) ?? 0);
        setQuestWeek((profRes.data.quest_week as string | null) ?? null);
      }
      // 업적 수령 기록 — 마이그레이션 전(503)·실패면 null 유지(버튼 미노출, 목록은 정상)
      fetch("/api/catch/achievements/claim")
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d && Array.isArray(d.claimed)) setClaimedAch(d.claimed); })
        .catch(() => { /* 오프라인 등 — 조용히 생략 */ });
    })();
  }, [authLoading, user, router]);

  const claimAchievement = async (a: Achievement) => {
    if (claimingKey) return;
    setClaimingKey(a.key);
    try {
      const res = await fetch("/api/catch/achievements/claim", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: a.key }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        // 409 = 다른 기기에서 이미 수령 — 버튼을 "수령 ✓"로 동기화해 재탭 루프 방지
        if (res.status === 409) setClaimedAch(prev => prev?.includes(a.key) ? prev : [...(prev ?? []), a.key]);
        setClaimToast(d.error ?? "수령에 실패했어요.");
        return;
      }
      setClaimedAch(prev => [...(prev ?? []), a.key]);
      celebrateVictory();
      navigator.vibrate?.([20, 30, 20]);
      setClaimToast(`🏅 ${a.title} — 코인 +${d.reward ?? a.reward}!`);
    } catch {
      setClaimToast("네트워크 오류가 발생했어요.");
    } finally {
      setClaimingKey(null);
      setTimeout(() => setClaimToast(null), 2400);
    }
  };

  // ── 통계 집계 (등급/종 컬렉션 + 업적 입력) ──
  const rarityCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of cards ?? []) m[c.card_rarity] = (m[c.card_rarity] ?? 0) + 1;
    return m;
  }, [cards]);

  const speciesOwned = useMemo(() => {
    const m: Record<string, { count: number; shiny: boolean }> = {};
    for (const c of cards ?? []) {
      if (!c.species_key) continue;
      const cur = m[c.species_key] ?? { count: 0, shiny: false };
      m[c.species_key] = { count: cur.count + 1, shiny: cur.shiny || c.is_shiny === true };
    }
    return m;
  }, [cards]);

  const achievements: Achievement[] = useMemo(() => computeAchievements({
    totalCatches: cards?.length ?? 0,
    rarityCounts,
    distinctCells: new Set((cards ?? []).map(c => c.caught_geohash7).filter(Boolean)).size,
    perfectCatches: perfectCount,
    bossDefeats: 0,     // TODO(P4): 배틀 이식 시 전적 소스 연결
    bestWinStreak: 0,   // TODO(P4)
    speciesCount: Object.keys(speciesOwned).length,
    shinyCount: (cards ?? []).filter(c => c.is_shiny).length,
  }).filter(a => CATCH_BATTLE_ENABLED || !BATTLE_ACHIEVEMENT_KEYS.has(a.key)),
  [cards, rarityCounts, perfectCount, speciesOwned]);
  const doneCount = achievements.filter(a => a.done).length;

  // ── 이번 주 의뢰 배너 재료 — 결정적 계산 + catch_profiles.quest_week 진행값 ──
  const quest = useMemo(() => currentQuest(), []);
  const weekKey = useMemo(() => currentWeekKey(), []);
  const questDone = isQuestDoneThisWeek(questWeek, weekKey);
  const questCount = questDone ? quest.target : questProgressCount(questWeek, weekKey);

  // ── 조우 기록 — 날짜별 그룹 (최신 먼저) ──
  const logGroups = useMemo(() => {
    const groups: Array<{ date: string; items: DexCard[] }> = [];
    for (const c of cards ?? []) {
      const date = new Date(c.caught_at).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
      const last = groups[groups.length - 1];
      if (last && last.date === date) last.items.push(c);
      else groups.push({ date, items: [c] });
    }
    return groups;
  }, [cards]);

  const share = async () => {
    const text = `야생냥이 ${cards?.length ?? 0}마리 · 업적 ${doneCount}/${achievements.length} 달성! 🐾`;
    try {
      if (navigator.share) await navigator.share({ title: "도시공존 야생냥이", text, url: location.origin });
      else { await navigator.clipboard.writeText(`${text} ${location.origin}`); setClaimToast("클립보드에 복사됐어요!"); setTimeout(() => setClaimToast(null), 2000); }
    } catch { /* 사용자가 공유 취소 — 무시 */ }
  };

  return (
    <div className="min-h-dvh px-4 pt-4 pb-8" style={{ ...pageBgStyle(), color: UI.textMain }}>
      {/* 헤더 — city (main) 레이아웃 안의 간단 헤더 (냥줍 PageHeader 대체) */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button onClick={() => router.push("/catch")} aria-label="지도로 돌아가기"
            className="w-9 h-9 flex items-center justify-center"
            style={{ borderRadius: SQUIRCLE, background: UI.panel, boxShadow: `inset 0 0 0 1px ${UI.panelBorderStrong}` }}>
            <ChevronLeft size={18} color={UI.textSub} strokeWidth={2.6} />
          </button>
          <BookOpen size={18} color={UI.accent.blue} strokeWidth={2.4} />
          <h1 className="text-[16px] font-black">조우 기록장</h1>
        </div>
        <button onClick={share}
          className="flex items-center gap-1.5 px-3 py-2 rounded-full text-[11.5px] font-black"
          style={{ background: UI.panel, boxShadow: `inset 0 0 0 1px ${UI.panelBorderStrong}`, color: UI.textSub }}>
          <Share2 size={13} /> 자랑하기
        </button>
      </div>

      {/* 이번 주 의뢰 — 지도 플레이에 방향성 부여 (완료 판정·지급은 전부 서버) */}
      <div className="rounded-2xl px-4 py-3 mb-4"
        style={{
          background: UI.panel,
          boxShadow: questDone ? `inset 0 0 0 1.5px ${UI.accent.blue}88` : `inset 0 0 0 1px ${UI.panelBorderStrong}`,
        }}>
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-black" style={{ color: UI.textMuted }}>이번 주 의뢰</p>
          <p className="text-[11px] font-black" style={{ color: questDone ? UI.accent.blue : UI.textMuted }}>
            {questDone ? `완료 ✓ +${QUEST_REWARD_COINS}냥` : `보상 ${QUEST_REWARD_COINS}냥`}
          </p>
        </div>
        <p className="text-[13px] font-black mt-1">{quest.emoji} {quest.title}</p>
        {quest.target > 1 && (
          <div className="mt-2" style={chunkyTrackStyle(7)}>
            <div style={chunkyFillStyle(UI.accent.blue, (questCount / quest.target) * 100)} />
          </div>
        )}
      </div>

      {/* 탭 */}
      <div className="flex p-1 rounded-2xl mb-4"
        style={{ background: "rgba(141,180,220,0.07)", boxShadow: `inset 0 0 0 1px ${UI.panelBorder}` }}>
        {TAB_DEFS.map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className="flex-1 py-2 text-[12px] font-black"
            style={tab === key
              ? arcadeChipStyle(UI.accent.blue)
              : { color: UI.textSub, borderRadius: 10 }}>
            {label}
          </button>
        ))}
      </div>

      {/* ══ 기록 — 시간순 조우 갤러리 ══ */}
      {tab === "log" && (cards === null ? (
        <p className="text-center text-[13px] font-bold py-16" style={{ color: UI.textMuted }}>기록을 불러오는 중...</p>
      ) : cards.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-[44px]">🐾</p>
          <p className="text-[14px] font-black mt-3">아직 만난 냥이가 없어요</p>
          <p className="text-[12px] font-bold mt-1.5" style={{ color: UI.textMuted }}>
            야생냥이 지도에서 첫 냥이를 포획해보세요!
          </p>
          <button onClick={() => router.push("/catch")}
            className="mt-4 px-5 py-2.5 rounded-full text-[12.5px] font-black text-white"
            style={{ background: UI.accent.blue, boxShadow: "0 3px 0 #1B64DA" }}>
            지도 열기
          </button>
        </div>
      ) : (
        <div>
          <p className="text-[11.5px] font-bold mb-3" style={{ color: UI.textSub }}>
            지금까지 <span style={{ color: UI.accent.blue }}><span className="text-[13px]" style={numFontStyle}>{cards.length}</span>마리</span>의 냥이를 만났어요
          </p>
          {logGroups.map(group => (
            <div key={group.date} className="mb-5">
              <p className="text-[11px] font-black mb-2" style={{ color: UI.textMuted }}>{group.date}</p>
              <div className="grid grid-cols-3 gap-2.5">
                {group.items.map(c => {
                  const color = gradeColor(c.card_rarity);
                  const img = c.photo_url ?? speciesPhotoUrl(c.species_key ?? "");
                  return (
                    <button key={c.id} onClick={() => router.push("/mypage/cards")}
                      className="rounded-2xl overflow-hidden flex flex-col"
                      style={{ background: UI.panel, boxShadow: `inset 0 0 0 1px ${UI.panelBorder}` }}>
                      <span className="w-full aspect-square overflow-hidden" style={{ background: "rgba(141,180,220,0.07)" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img} alt={c.card_name ?? "냥이"} className="w-full h-full object-cover" />
                      </span>
                      <span className="px-2 py-2 text-left">
                        <span className="block text-[11px] font-black truncate">
                          {c.is_shiny ? "✨" : ""}{c.card_name ?? "냥이"}
                        </span>
                        <span className="block text-[9.5px] font-black mt-0.5" style={{ color }}>
                          {(RARITY_LABEL as Record<string, string>)[c.card_rarity] ?? c.card_rarity}
                          {(c.bond ?? 0) > 0 && <span style={{ color: UI.accent.blue }}> · 💞{c.bond}</span>}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ))}

      {/* ══ 컬렉션 — 등급 컬렉션 + 종 도감 ══ */}
      {tab === "collection" && (
        <div>
          <SectionBanner color={UI.accent.blue}>등급 컬렉션</SectionBanner>
          <div className="grid grid-cols-2 gap-2.5 mb-2.5">
            {RARITY_KEYS.map(r => {
              const n = rarityCounts[r] ?? 0;
              const color = gradeColor(r);
              return (
                <div key={r} className="rounded-2xl px-4 py-3.5"
                  style={{
                    background: UI.panel,
                    backgroundImage: n > 0 ? RARITY_GRADIENT[r] : undefined,
                    boxShadow: n > 0 ? `inset 0 0 0 1.5px ${color}, 0 0 12px ${color}22` : `inset 0 0 0 1px ${UI.panelBorder}`,
                    opacity: n > 0 ? 1 : 0.55,
                  }}>
                  <p className="text-[11px] font-black" style={{ color: n > 0 ? color : UI.textMuted }}>
                    {RARITY_LABEL[r]}
                  </p>
                  <p className="text-[23px] mt-0.5" style={numFontStyle}>
                    {n}<span className="text-[11px] font-black" style={{ color: UI.textMuted }}>마리</span>
                  </p>
                </div>
              );
            })}
          </div>
          {/* 4등급 완성 진행 */}
          {(() => {
            const got = RARITY_KEYS.filter(r => (rarityCounts[r] ?? 0) > 0).length;
            return (
              <div className="rounded-2xl px-4 py-3 mb-6"
                style={{ background: UI.panel, boxShadow: `inset 0 0 0 1px ${UI.panelBorderStrong}` }}>
                <div className="flex justify-between mb-1.5">
                  <p className="text-[11.5px] font-black" style={{ color: UI.textSub }}>무지개 컬렉션 (4등급 모으기)</p>
                  <p className="text-[13px]" style={{ ...numFontStyle, color: got === 4 ? UI.accent.gold : UI.textMain }}>{got}/4</p>
                </div>
                <div style={chunkyTrackStyle()}>
                  <div style={chunkyFillStyle(got === 4 ? UI.accent.gold : UI.accent.blue, (got / 4) * 100)} />
                </div>
              </div>
            );
          })()}

          {/* 종 컬렉션 — 카탈로그 전체 (수집 진행바가 사냥 동기) */}
          <SectionBanner color={UI.accent.cyan}
            right={
              <p className="text-[13px]" style={numFontStyle}>
                <span style={{ color: UI.accent.blue }}>{Object.keys(speciesOwned).length}</span>
                <span style={{ color: UI.textMuted }}>/{SPAWN_SPECIES.length}</span>
              </p>
            }>
            종 컬렉션
          </SectionBanner>
          <div className="mb-2.5" style={chunkyTrackStyle()}>
            <div style={chunkyFillStyle(UI.accent.blue, (Object.keys(speciesOwned).length / SPAWN_SPECIES.length) * 100)} />
          </div>
          <div className="grid grid-cols-4 gap-2">
            {SPAWN_SPECIES.map((sp, i) => {
              const owned = speciesOwned[sp.key];
              const color = gradeColor(sp.rarity);
              return (
                <div key={sp.key} className="rounded-2xl px-1 pt-1.5 pb-2 flex flex-col items-center"
                  style={{
                    background: UI.panel,
                    boxShadow: owned?.shiny ? `inset 0 0 0 1.5px ${UI.accent.gold}, 0 0 10px ${UI.accent.gold}44`
                      : owned ? `inset 0 0 0 1.5px ${color}88` : `inset 0 0 0 1px ${UI.panelBorder}`,
                    opacity: owned ? 1 : 0.7,
                  }}>
                  {/* 도감 넘버 — 장르 공통 문법 (순서는 SPAWN_SPECIES 정렬 그대로) */}
                  <span className="self-start pl-1 text-[8.5px]"
                    style={{ ...numFontStyle, color: owned ? color : UI.textMuted }}>
                    {dexNo(i + 1)}
                  </span>
                  <span className="w-[52px] h-[52px] flex items-center justify-center overflow-hidden mt-0.5"
                    style={owned
                      ? { borderRadius: SQUIRCLE, boxShadow: `0 0 0 2.5px ${color}` }
                      : { borderRadius: SQUIRCLE, background: "rgba(141,180,220,0.06)", boxShadow: `inset 0 0 0 1.5px ${UI.panelBorderStrong}` }}>
                    {owned
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={speciesPhotoUrl(sp.key)} alt={sp.name} className="w-full h-full object-cover" />
                      // 미획득 실루엣 — 우리 종 아트를 어둡게
                      // eslint-disable-next-line @next/next/no-img-element
                      : <img src={speciesPhotoUrl(sp.key)} alt="???" className="w-full h-full object-cover" style={silhouetteStyle} />}
                  </span>
                  <span className="text-[9.5px] font-black mt-1.5 truncate w-full text-center"
                    style={{ color: owned ? UI.textMain : UI.textMuted }}>
                    {owned ? `${owned.shiny ? "✨" : ""}${sp.name}` : "???"}
                  </span>
                  <span className="text-[8.5px] font-black" style={{ color: owned ? color : UI.textMuted }}>
                    {owned ? `${RARITY_LABEL[sp.rarity]} ×${owned.count}` : RARITY_LABEL[sp.rarity]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══ 업적 ══ */}
      {tab === "achievements" && (
        <div>
          <SectionBanner color={UI.accent.gold}
            right={
              <p className="text-[16px]" style={numFontStyle}>
                <span style={{ color: UI.accent.gold }}>{doneCount}</span>
                <span style={{ color: UI.textMuted }}>/{achievements.length}</span>
              </p>
            }>
            달성한 업적
          </SectionBanner>
          <div className="mb-4" style={chunkyTrackStyle()}>
            <div style={chunkyFillStyle(UI.accent.gold, (doneCount / achievements.length) * 100)} />
          </div>
          <div className="flex flex-col gap-2">
            {achievements.map(a => (
              <div key={a.key} className="rounded-2xl px-4 py-3 flex items-center gap-3"
                style={{
                  background: UI.panel,
                  boxShadow: a.done ? `inset 0 0 0 1.5px ${UI.accent.gold}88` : `inset 0 0 0 1px ${UI.panelBorder}`,
                  opacity: a.done ? 1 : 0.8,
                }}>
                <span className="w-11 h-11 flex items-center justify-center text-[20px] shrink-0"
                  style={{
                    borderRadius: SQUIRCLE,
                    background: a.done ? `${UI.accent.gold}22` : "rgba(141,180,220,0.07)",
                    boxShadow: a.done ? `inset 0 0 0 1.5px ${UI.accent.gold}` : `inset 0 0 0 1px ${UI.panelBorderStrong}`,
                    filter: a.done ? "none" : "grayscale(0.7)",
                  }}>
                  {(() => { const AIcon = ACHIEVEMENT_ICONS[a.key] ?? Medal; return <AIcon size={17} color={a.done ? UI.accent.gold : UI.textMuted} strokeWidth={2.2} />; })()}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[12.5px] font-black" style={{ color: a.done ? UI.accent.gold : UI.textMain }}>
                    {a.title}{a.done && " ✓"}
                  </p>
                  <p className="text-[10.5px] font-bold mt-0.5" style={{ color: UI.textMuted }}>{a.desc}</p>
                  {!a.done && (
                    <div className="mt-1.5" style={chunkyTrackStyle(7)}>
                      <div style={chunkyFillStyle(UI.accent.blue, (a.current / a.target) * 100)} />
                    </div>
                  )}
                </div>
                {/* 우측: 미달성=진행 수치 / 달성+미수령=코인 받기 버튼 / 수령 완료=배지 */}
                {a.done && claimedAch !== null && !claimedAch.includes(a.key) ? (
                  <button onClick={() => claimAchievement(a)} disabled={claimingKey !== null}
                    className="shrink-0 px-3 py-2 text-[11.5px] font-black text-white active:translate-y-0.5"
                    style={{
                      borderRadius: 11,
                      background: `linear-gradient(180deg, ${UI.accent.blue} 0%, #1B64DA 100%)`,
                      boxShadow: "0 3px 0 #1B64DA, 0 4px 10px rgba(49,130,246,0.30)",
                      opacity: claimingKey && claimingKey !== a.key ? 0.6 : 1,
                    }}>
                    {claimingKey === a.key ? "받는 중…" : `+${a.reward} 🪙 받기`}
                  </button>
                ) : a.done && claimedAch?.includes(a.key) ? (
                  <span className="shrink-0 text-[11px] font-black px-2.5 py-1.5"
                    style={{ borderRadius: 10, color: UI.accent.gold, background: `${UI.accent.gold}18`, boxShadow: `inset 0 0 0 1px ${UI.accent.gold}55` }}>
                    수령 ✓
                  </span>
                ) : (
                  <span className="text-[12.5px] shrink-0" style={{ ...numFontStyle, color: a.done ? UI.accent.gold : UI.textSub }}>
                    {a.current}/{a.target}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══ 배틀 — P4 이식 예정 자리 (CATCH_BATTLE_ENABLED) ══ */}
      {CATCH_BATTLE_ENABLED && tab === "battle" && (
        <div className="text-center py-16">
          <span className="inline-flex w-16 h-16 items-center justify-center"
            style={{ borderRadius: SQUIRCLE, background: UI.panel, boxShadow: `inset 0 0 0 1.5px ${UI.panelBorderStrong}` }}>
            <Swords size={26} color={UI.textMuted} strokeWidth={2.2} />
          </span>
          <p className="text-[14px] font-black mt-4">배틀 도감은 준비 중이에요</p>
          <p className="text-[12px] font-bold mt-1.5" style={{ color: UI.textMuted }}>
            곧 야생의 상대들과 겨루고 조우 도감을 채울 수 있어요!
          </p>
        </div>
      )}

      {/* 토스트 (업적 수령 / 공유 복사) */}
      {claimToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[200] px-5 py-3 text-[13px] font-bold max-w-[85vw] text-center"
          style={{
            background: "rgba(255,255,255,0.97)", color: "#191F28", borderRadius: 14,
            boxShadow: `inset 0 0 0 2px ${UI.accent.gold}, 0 6px 20px rgba(31,58,86,0.22)`,
          }}>
          {claimToast}
        </div>
      )}
    </div>
  );
}
