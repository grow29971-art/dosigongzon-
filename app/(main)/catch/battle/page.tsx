"use client";

// ⚔️ 야생냥이 카드 배틀 (/catch/battle) — 냥줍 app/(main)/battle/page.tsx 이식 (2026-08-04 P4).
// 수동(턴제 직접 조작)/자동(서버 시뮬레이션 리플레이) × PVE(야생 불청객·빌런)/PVP(다른 유저 카드).
//
// 냥줍 대비 변경:
//  · cards→catch_cards (RLS 본인 SELECT), useUser→useAuth, 테마→lib/catch/arcade-theme.
//  · 배틀 소모품/장착 아이템 시스템 미이식 — city 상점에 전투 아이템이 없다
//    (아이템 패널·방어막/파워업/부적 로직 제거. 복원 시 냥줍 원본 참조).
//  · 카드 아트: catch_cards.photo_url은 null(종 아트)이라 speciesPhotoUrl로 폴백.
//  · 자체 BottomNav 없음 — city (main) 레이아웃이 감싼다.

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Swords, Zap, Shield, Sparkles, Flame, Star, Trophy, Heart, type LucideIcon } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import CatCard, { type CatCardData, type CardRarity } from "@/app/components/CatCard";
import { SPECIAL_SKILLS } from "@/lib/battle-config";
import { CATCH_BATTLE_ENABLED } from "@/lib/catch/features";
import { speciesPhotoUrl } from "@/lib/catch/spawn-species";
import ParticleCanvas, { type ParticleCanvasHandle } from "@/app/components/ParticleCanvas";
import BattleWeather from "@/app/components/catch/BattleWeather";
import SfxToggle from "@/app/components/SfxToggle";
import StickerIcon from "@/app/components/StickerIcon";
import { sfx, primeSfx, setAmbientEnv, stopAmbient } from "@/lib/sfx";
import { celebrateVictory } from "@/lib/catch/celebrate";
import { UI, gridOverlayStyle } from "@/lib/catch/arcade-theme";

/* ──────────── 배틀 환경 ──────────── */
const BATTLE_ENVS = {
  night:  { emoji:"🌙", name:"심야 골목",  desc:"회피+15%",         evaBonus:15,  critBonus:0,   dmgMult:1.0,  dotMult:1.0 },
  noon:   { emoji:"☀️", name:"한낮 광장",  desc:"크리티컬+10%",     evaBonus:0,   critBonus:10,  dmgMult:1.0,  dotMult:1.0 },
  rain:   { emoji:"🌧️", name:"빗속 골목", desc:"독·출혈 피해 2배",  evaBonus:0,   critBonus:0,   dmgMult:1.0,  dotMult:2.0 },
  heat:   { emoji:"🔥", name:"여름 골목",  desc:"데미지+15%",        evaBonus:0,   critBonus:0,   dmgMult:1.15, dotMult:1.0 },
  fog:    { emoji:"🌫️", name:"안개 골목", desc:"회피+20%/크리티컬↓", evaBonus:20,  critBonus:-10, dmgMult:1.0,  dotMult:1.0 },
  snow:   { emoji:"❄️", name:"눈 오는 골목", desc:"회피+10%/독·출혈 ½", evaBonus:10,  critBonus:0,   dmgMult:1.0,  dotMult:0.5 },
} as const;
type BattleEnvKey = keyof typeof BATTLE_ENVS;

// HD-2D 픽셀 베이스 배경 (public/battle-bg/) — 배틀마다 랜덤.
// 이미지 안에 배틀 플랫폼 2개가 그려져 있다: 초록(아군, 좌하단)·빨강(상대, 우상단).
const BATTLE_BASES = [
  { key: "alley",  name: "주택가 골목", src: "/battle-bg/alley.png" },
  { key: "stream", name: "하천변",     src: "/battle-bg/stream.png" },
  { key: "plaza",  name: "동네 광장",  src: "/battle-bg/plaza.png" },
] as const;
type BattleBase = typeof BATTLE_BASES[number];
const ENV_KEYS = Object.keys(BATTLE_ENVS) as BattleEnvKey[];

// 환경별 배경 — 파스텔 하늘 톤 그라디언트
const ENV_BACKGROUNDS: Record<BattleEnvKey, string> = {
  night: "linear-gradient(180deg, #C7D3F2 0%, #DDE4F5 55%, #F2F4F6 100%)",
  noon:  "linear-gradient(180deg, #FFE9C2 0%, #FFF3DC 55%, #F7F4EC 100%)",
  rain:  "linear-gradient(180deg, #C9D9E8 0%, #DCE7F0 55%, #F0F3F6 100%)",
  heat:  "linear-gradient(180deg, #FFD9BE 0%, #FFE8D6 55%, #F8F2ED 100%)",
  fog:   "linear-gradient(180deg, #DBDCE4 0%, #E8E9EF 55%, #F2F3F6 100%)",
  snow:  "linear-gradient(180deg, #D6E4F2 0%, #E5EEF7 55%, #F2F5F8 100%)",
};

// 액션 슬롯 순서: [기본공격, 방어, 스킬1, 스킬2, 스킬3, 스킬4]
// 4개 스킬을 빈틈없이 순환 못 하게 쿨다운 5턴 — 5턴마다 최소 1턴은 기본공격/방어 강제.
const SKILL_COOLDOWNS = [0, 1, 5, 5, 5, 5];
const NORMAL_IDX = 0;
const GUARD_IDX = 1;
const SKILL_START_IDX = 2; // 스킬1의 인덱스, 스킬n = SKILL_START_IDX + slot

// 방어 자세 배틀당 사용 가능 횟수. 기본공격은 의도적으로 무제한(항상 쓸 수 있는 안전판).
const GUARD_USES = 5;

// 등급별 상성 타입 (카드에 표시되는 "약점" 아이콘과 동일한 4각 상성)
const RARITY_TYPE: Record<string, string> = { common: "grass", uncommon: "water", rare: "electric", legendary: "fire" };
const WEAK_TO: Record<string, string> = { grass: "fire", fire: "water", water: "electric", electric: "grass" };

/* ──────────── 타입 ──────────── */
interface BattleCat {
  id: string; name: string; photo_url: string | null;
  card_rarity: CardRarity; card_name: string | null;
  card_traits: string[]; card_stats: CatCardData["card_stats"];
  card_flavor: string | null; card_level: number; card_exp: number;
  owner_id?: string;
  species_key?: string | null; // city 종 아트 키 (PVE 합성 상대는 null)
  battle_atk: number | null; battle_def: number | null;
  battle_eva: number | null; battle_crit: number | null;
  battle_special: string | null; battle_special2: string | null;
  battle_special3: string | null; battle_special4: string | null;
  placeholder_emoji?: string | null; // PVE 야생동물 상대(사진 없음) 표시용
  card_generated_at?: string | null; best_win_streak?: number | null; pve_win_count?: number | null;
  win_streak?: number | null;
  equipped_border_key?: string | null;
}
interface BattleStats { hp: number; atk: number; def: number; spd: number; }
interface Skill { name: string; icon: string; type: "normal"|"guard"|"special"; slot?: number; desc: string; color: string; }
type Phase = "select"|"loading"|"countdown"|"player_choose"|"animating"|"opp_thinking"|"result";
type Mode = "manual"|"auto";
type CardAnim = "idle"|"attack"|"hit"|"dodge";

interface AutoLogEntry {
  turn:number; actor:string; dmg:number; aHp:number; dHp:number; isCritical:boolean; isDodge:boolean; isCounterAttack:boolean; skillName:string;
  skillId?:string; isDot?:boolean; isStunSkip?:boolean;
  statusType?:"stun"|"poison"|"bleed"|"bind"; statusTurns?:number;
}
interface AutoResult { winner:"me"|"opponent"|"draw"; my_hp_left:number; opp_hp_left:number; my_max_hp:number; opp_max_hp:number; rounds:number; log:AutoLogEntry[]; exp_gained:number; my_new_level:number; leveled_up:boolean; coins_gained?:number; }

/* ──────────── 헬퍼 ──────────── */
const SKILL_SLOT_COLORS = ["#DD4422", "#CC8822", "#22AACC", "#9933CC"];

// 카드 아트 — 실사(photo_url)가 없으면 종 아트로 폴백 (city 포획 카드는 전부 종 아트)
function artUrl(cat: BattleCat): string | null {
  if (cat.photo_url) return cat.photo_url;
  if (cat.species_key) return speciesPhotoUrl(cat.species_key);
  return null;
}

// 스킬별 "성격" — 상태이상 계열을 색/연출로 구분해 전투 액션을 다채롭게 만든다
type FxFlavor = "ice"|"fear"|"shock"|"sleep"|"poison"|"bleed"|"bind"|"life"|"impact";
const SKILL_FLAVOR: Partial<Record<string, FxFlavor>> = {
  freeze:"ice", cold_glare:"ice",
  hiss:"fear", intimidate:"fear",
  static_shock:"shock", thunderclap:"shock", judgment:"shock",
  slow:"sleep",
  poison:"poison", venom_fang:"poison", curse:"poison", dominate:"poison",
  scratch:"bleed", rend:"bleed",
  bind:"bind", howl:"bind", intimidate_sm:"bind",
  grooming:"life", warm_nap:"life", regen:"life", eclipse:"life", cleanse:"life", vampirism:"life",
  // 순수 고배율 데미지 궁극기 — 폭발 톤으로 임팩트를 살린다
  dash_strike:"impact", frenzy:"impact", shockwave:"impact", overdrive:"impact", meteor:"impact", apocalypse_strike:"impact",
};
const FX_COLOR: Record<FxFlavor,string> = {
  ice:"140,215,255", fear:"190,120,255", shock:"255,220,50", sleep:"170,175,255",
  poison:"130,240,110", bleed:"255,70,90", bind:"205,150,90", life:"150,255,190",
  impact:"255,110,40",
};
const STUN_LABEL: Partial<Record<FxFlavor,string>> = { ice:"❄️ 빙결", fear:"😱 공포", shock:"⚡ 감전", sleep:"😴 수면" };
function flavorForId(id: string | null): FxFlavor | undefined {
  return id ? SKILL_FLAVOR[id] : undefined;
}
function flavorColorForId(id: string | null): string | undefined {
  const f = flavorForId(id);
  return f ? FX_COLOR[f] : undefined;
}
const FLAVOR_SFX: Record<FxFlavor, () => void> = {
  ice: sfx.ice, fear: sfx.fear, shock: sfx.shock, sleep: sfx.sleep,
  poison: sfx.poison, bleed: sfx.bleed, bind: sfx.bind, life: sfx.life, impact: sfx.impact,
};
// 자신에게만 적용되는 스킬 — 0피해로 성공해도 상대는 아무 반응이 없어야 함 (회복/버프류)
const SELF_TARGET_IDS = new Set(["quick_dodge","grooming","warm_nap","regen","eclipse","cleanse","invincible"]);
function isSelfTargetSkill(id: string | null): boolean {
  return id !== null && SELF_TARGET_IDS.has(id);
}
function getSlotSkillId(cat: BattleCat, slot: number): string {
  const fallback = ["sharp_claws", "scratch", "sharp_claws", "scratch"];
  const raw = slot === 0 ? cat.battle_special
            : slot === 1 ? cat.battle_special2
            : slot === 2 ? cat.battle_special3
            : cat.battle_special4;
  return raw ?? fallback[slot] ?? "sharp_claws";
}
function buildSkills(cat: BattleCat): Skill[] {
  const skills: Skill[] = [
    { name: "기본 공격", icon:"⚔️", type:"normal", desc:`공격 (ATK ${cat.battle_atk??40})`, color:"#7070AA" },
    { name: "방어 자세", icon:"🛡️", type:"guard",  desc:`방어 (DEF ${cat.battle_def??25})`, color:"#2255CC" },
  ];
  for (let slot = 0; slot < 4; slot++) {
    const id = getSlotSkillId(cat, slot);
    const special = SPECIAL_SKILLS[id as keyof typeof SPECIAL_SKILLS] ?? SPECIAL_SKILLS.sharp_claws;
    skills.push({ name: special.name, icon: special.icon, type: "special", slot, desc: special.desc, color: SKILL_SLOT_COLORS[slot] });
  }
  return skills;
}
function calcDmg(atk: number, def: number, mult: number, critChance: number) {
  // 매 타격 변동폭 0.80~1.30 — 자동전투 엔진(lib/catch/battle-engine)과 동일 수치.
  const base = Math.max(Math.max(4, Math.round(atk * 0.15)), (atk - def * 0.35) * (0.80 + Math.random() * 0.50));
  const isCrit = Math.random() * 100 < critChance;
  return { dmg: Math.round(base * mult * (isCrit ? 2.0 : 1)), isCrit };
}
function checkEvasion(evaChance: number): boolean {
  return Math.random() * 100 < evaChance;
}
// 인덱스: 0=기본공격, 1=방어, 2~5=스킬1~4
function oppAI(hp: number, maxHp: number, targetHpRatio = 1, targetVulnerable = false): number {
  const ratio = hp / maxHp;
  const skillIdx = () => SKILL_START_IDX + Math.floor(Math.random() * 4);
  // 상대가 회피 불가(속박) 상태거나 빈사 상태면 기본공격 대신 스킬로 확실히 압박
  if (targetVulnerable || targetHpRatio < 0.3) return Math.random() < 0.85 ? skillIdx() : NORMAL_IDX;
  if (ratio < 0.25) return Math.random() < 0.7 ? skillIdx() : GUARD_IDX;
  if (ratio < 0.55) return Math.random() < 0.55 ? skillIdx() : (Math.random() < 0.5 ? NORMAL_IDX : GUARD_IDX);
  return Math.random() < 0.4 ? skillIdx() : NORMAL_IDX;
}
// 지금 실제로 쓸 수 있는 행동인지 확인하고, 막혀있으면 다른 가능한 행동으로 대체한다.
function pickAvailableAutoAction(hp: number, maxHp: number, skillCds: number[], guardLeft: number, targetHpRatio = 1, targetVulnerable = false): number {
  const preferred = oppAI(hp, maxHp, targetHpRatio, targetVulnerable);
  const isUsable = (idx: number) => {
    if (idx === GUARD_IDX) return guardLeft > 0 && (skillCds[GUARD_IDX] ?? 0) === 0;
    return (skillCds[idx] ?? 0) === 0;
  };
  if (isUsable(preferred)) return preferred;

  const availableSkills = [2, 3, 4, 5].filter(i => (skillCds[i] ?? 0) === 0);
  if (availableSkills.length > 0) return availableSkills[Math.floor(Math.random() * availableSkills.length)];
  if (isUsable(GUARD_IDX)) return GUARD_IDX;
  return NORMAL_IDX; // 스킬 전부 쿨다운 + 방어도 못 쓰면 무제한인 기본공격으로
}
function toCard(cat: BattleCat): CatCardData {
  return { card_rarity:cat.card_rarity, card_name:cat.card_name, card_traits:cat.card_traits??[], card_stats:cat.card_stats, card_flavor:cat.card_flavor, card_level:cat.card_level, card_exp:cat.card_exp, placeholder_emoji:cat.placeholder_emoji, card_generated_at:cat.card_generated_at, best_win_streak:cat.best_win_streak, pve_win_count:cat.pve_win_count, equipped_border_key:cat.equipped_border_key };
}

/* ──────────── 환경 씬 (만다라 링 + 해/달/안개 + 파티클) ──────────── */
function EnvScene({ env, hideDecor = false }: { env: BattleEnvKey | null; hideDecor?: boolean }) {
  const particleRef = useRef<ParticleCanvasHandle>(null);
  useEffect(() => {
    if (env === "rain") particleRef.current?.setAmbient("rain", "120,170,230", 1);
    else if (env === "heat") particleRef.current?.setAmbient("ember", "255,150,90", 1);
    else if (env === "night") particleRef.current?.setAmbient("firefly", "255,235,180", 1);
    else if (env === "noon") particleRef.current?.setAmbient("dust", "255,220,150", 1);
    else if (env === "fog") particleRef.current?.setAmbient("mist", "180,180,210", 1);
    else if (env === "snow") particleRef.current?.setAmbient("snow", "235,242,250", 1);
    else particleRef.current?.setAmbient(null);
  }, [env]);
  if (!env) return null;
  if (hideDecor) {
    // HD-2D 이미지 배경 위 — 날씨 파티클만 최상단에 얹는다 (장식은 이미지가 대신함)
    return (
      <div style={{ position:"absolute", inset:0, zIndex:2, overflow:"hidden", pointerEvents:"none" }}>
        <ParticleCanvas ref={particleRef} />
      </div>
    );
  }
  return (
    <div style={{ position:"absolute", inset:0, zIndex:-1, overflow:"hidden", pointerEvents:"none" }}>
      {/* 만다라 링 — 화면 중앙 뒤에 은은하게 깔리는 원형 장식 패턴 */}
      <div style={{ position:"absolute", top:"30%", left:"50%", transform:"translate(-50%,-50%)", width:280, height:280 }}>
        {[280, 220, 165].map((size) => (
          <div key={size} style={{
            position:"absolute", top:"50%", left:"50%", width:size, height:size,
            transform:"translate(-50%,-50%)", borderRadius:"50%",
            border:"1px solid rgba(255,255,255,0.35)",
          }} />
        ))}
      </div>
      {env === "night" && (
        <>
          <div style={{ position:"absolute", top:"6%", right:"12%", width:52, height:52, borderRadius:"50%",
            background:"radial-gradient(circle, #FFFCEF 0%, #FFEFB8 55%, transparent 75%)",
            boxShadow:"0 0 40px 14px rgba(255,240,180,0.4)" }} />
          <div className="env-stars" />
        </>
      )}
      {env === "noon" && (
        <div style={{ position:"absolute", top:"-6%", left:"50%", transform:"translateX(-50%)", width:150, height:150, borderRadius:"50%",
          background:"radial-gradient(circle, rgba(255,240,190,0.95) 0%, rgba(255,205,120,0.55) 40%, transparent 72%)",
          boxShadow:"0 0 70px 30px rgba(255,210,120,0.30)" }} />
      )}
      {env === "fog" && <div className="env-fog" />}
      <ParticleCanvas ref={particleRef} />
      {/* 바닥 아레나 — 부드러운 타원형 플로어 글로우 */}
      <div style={{ position:"absolute", left:"50%", bottom:"6%", width:"120%", height:130, transform:"translateX(-50%)",
        borderRadius:"50%", background:"radial-gradient(ellipse, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.18) 55%, transparent 75%)" }} />
    </div>
  );
}

/* ──────────── HP 바 ──────────── */
function HpBar({ current, max }: { current:number; max:number }) {
  const pct = Math.max(0, Math.min(100, (current/max)*100));
  const grad = pct>50 ? "linear-gradient(90deg,#7CE38F,#3FCB6B)" : pct>25 ? "linear-gradient(90deg,#FFDA7C,#FFB93F)" : "linear-gradient(90deg,#FF9C9C,#FF5C5C)";
  return (
    <div style={{ height:9, borderRadius:99, background:"rgba(2,32,71,0.10)", overflow:"hidden" }}>
      <div style={{
        height:"100%", width:`${pct}%`, background:grad, borderRadius:99, transition:"width 0.45s ease, background 0.45s",
        animation: pct<25 ? "pulse 0.6s infinite" : undefined,
      }} />
    </div>
  );
}

/* ──────────── 상태이상 비주얼 (카드 위 오버레이) ──────────── */
function StatusFx({ frozen, feared, shocked, sleepy, poisoned, bleeding, bound }: {
  frozen:boolean; feared:boolean; shocked:boolean; sleepy:boolean;
  poisoned:boolean; bleeding:boolean; bound:boolean;
}) {
  if(!frozen && !feared && !shocked && !sleepy && !poisoned && !bleeding && !bound) return null;
  return (
    <>
      {frozen && (
        <div style={{ position:"absolute", inset:0, zIndex:7, borderRadius:13, pointerEvents:"none", overflow:"hidden" }}>
          <div style={{ position:"absolute", inset:0, background:"linear-gradient(160deg, rgba(190,230,255,0.55), rgba(120,190,255,0.22) 55%, rgba(90,170,255,0.4))", mixBlendMode:"screen" }} />
          <div style={{ position:"absolute", inset:0, background:"repeating-linear-gradient(115deg, rgba(255,255,255,0.4) 0px, rgba(255,255,255,0.4) 2px, transparent 2px, transparent 9px)", animation:"iceShimmer 2.4s ease-in-out infinite" }} />
          <div style={{ position:"absolute", inset:0, border:"2px solid rgba(160,225,255,0.85)", borderRadius:13, boxShadow:"inset 0 0 14px rgba(140,210,255,0.7), 0 0 10px rgba(140,210,255,0.6)" }} />
          <span style={{ position:"absolute", top:1, left:2, fontSize:13 }}>❄️</span>
        </div>
      )}
      {shocked && (
        <div style={{ position:"absolute", inset:0, zIndex:7, borderRadius:13, pointerEvents:"none", overflow:"hidden" }}>
          <div style={{ position:"absolute", inset:0, background:"rgba(255,230,60,0.24)", animation:"shockFlicker 0.35s steps(2) infinite" }} />
          <div style={{ position:"absolute", inset:0, border:"2px solid rgba(255,225,60,0.85)", borderRadius:13, boxShadow:"0 0 10px rgba(255,220,60,0.7)", animation:"shockFlicker 0.35s steps(2) infinite" }} />
          <span style={{ position:"absolute", top:1, right:2, fontSize:13 }}>⚡</span>
        </div>
      )}
      {poisoned && (
        <div style={{ position:"absolute", inset:0, zIndex:7, borderRadius:13, pointerEvents:"none", overflow:"hidden" }}>
          <div style={{ position:"absolute", inset:0, background:"rgba(120,220,60,0.24)", mixBlendMode:"multiply", animation:"poisonPulse 1.6s ease-in-out infinite" }} />
          <div className="poison-bubbles" />
          <div style={{ position:"absolute", inset:0, border:"2px solid rgba(140,230,80,0.55)", borderRadius:13 }} />
        </div>
      )}
      {bleeding && (
        <div style={{ position:"absolute", inset:0, zIndex:7, borderRadius:13, pointerEvents:"none", overflow:"hidden" }}>
          <div className="bleed-drips" />
          <div style={{ position:"absolute", inset:0, boxShadow:"inset 0 -22px 18px -10px rgba(200,20,30,0.45)" }} />
        </div>
      )}
      {bound && (
        <div style={{ position:"absolute", inset:0, zIndex:7, borderRadius:13, pointerEvents:"none", overflow:"hidden" }}>
          <div style={{ position:"absolute", inset:0, background:"repeating-linear-gradient(135deg, rgba(120,90,50,0.4) 0px, rgba(120,90,50,0.4) 5px, transparent 5px, transparent 16px)" }} />
          <span style={{ position:"absolute", bottom:1, left:2, fontSize:11 }}>⛓️</span>
        </div>
      )}
      {feared && (
        <div style={{ position:"absolute", top:-15, left:"50%", zIndex:11, pointerEvents:"none", animation:"fearSwirl 1.4s linear infinite" }}>
          <span style={{ fontSize:13 }}>💫</span>
        </div>
      )}
      {sleepy && (
        <div style={{ position:"absolute", top:-14, right:2, zIndex:11, pointerEvents:"none" }}>
          <span style={{ fontSize:12, animation:"sleepFloat 1.8s ease-in-out infinite" }}>💤</span>
        </div>
      )}
    </>
  );
}

/* ──────────── 기술 버튼 ──────────── */
function SkillBtn({ skill, idx, disabled, cooldown=0, usesLeft, onPick, variant="compact" }: { skill:Skill; idx:number; disabled:boolean; cooldown?:number; usesLeft?:number; onPick:(i:number)=>void; variant?:"primary"|"compact" }) {
  const isPrimary = variant === "primary";
  const icons = [<Swords key={0} size={15}/>, <Shield key={1} size={15}/>, <Zap key={2} size={15}/>, <Sparkles key={3} size={15}/>, <Flame key={4} size={15}/>, <Star key={5} size={15}/>];
  const isCd = cooldown > 0;
  const isExhausted = usesLeft !== undefined && usesLeft <= 0;
  const isOff = disabled || isCd || isExhausted;
  return (
    <button onClick={() => { if (isOff) return; primeSfx(); sfx.click(); onPick(idx); }} disabled={isOff}
      style={{
        position:"relative", flex:1, minWidth:0, width:"100%",
        display:"flex", flexDirection:"column",
        alignItems:"center", justifyContent:"center",
        gap:3,
        padding:"9px 6px 8px",
        borderRadius: 18,
        boxShadow: isOff ? `inset 0 0 0 1px ${UI.panelBorder}` : `inset 0 0 0 1.5px ${skill.color}88`,
        background: isOff ? UI.panelAlt : UI.panel,
        transition:"transform 0.08s",
        opacity: isOff ? 0.6 : 1, cursor: isOff?"default":"pointer",
        WebkitTapHighlightColor:"transparent",
        textAlign:"center",
      }}>
      {/* 아이콘 배지 */}
      <span style={{
        flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center",
        width:32, height:32, borderRadius:"50%",
        background: isOff ? "rgba(2,32,71,0.06)" : `${skill.color}22`, color: isOff ? UI.textMuted : skill.color,
      }}>
        {isPrimary ? icons[idx] : <span style={{ fontSize:15, lineHeight:1, width:18, height:18, display:"flex", alignItems:"center", justifyContent:"center" }}>{skill.icon}</span>}
      </span>

      <span style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:1, minWidth:0, width:"100%" }}>
        <span style={{
          fontSize:11.5, fontWeight:800, color:UI.textMain,
          whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", maxWidth: "100%",
        }}>
          {skill.name}
        </span>
        <span style={{
          fontSize:9.5, color:UI.textSub, fontWeight:600, textAlign:"center",
          whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", maxWidth:"100%",
        }}>
          {skill.desc}
        </span>
      </span>

      {usesLeft !== undefined && !isCd && (
        <span style={{
          position:"absolute", top: isPrimary?10:6, right: isPrimary?12:7,
          fontSize:10, fontWeight:800, padding:"2px 7px", borderRadius:999,
          background: isExhausted ? `${UI.accent.red}22` : `${UI.accent.blue}22`,
          color: isExhausted ? UI.accent.red : UI.accent.blue,
        }}>
          {usesLeft}회
        </span>
      )}
      {isCd && (
        <div style={{ position:"absolute", inset:0, borderRadius:18, background:"rgba(10,10,15,0.88)", display:"flex", flexDirection: isPrimary?"row":"column", alignItems:"center", justifyContent:"center", gap: isPrimary?6:1 }}>
          <span style={{ fontSize:isPrimary?20:17, fontWeight:800, color:UI.accent.red }}>{cooldown}</span>
          <span style={{ fontSize:isPrimary?11:8.5, color:"#B0B8C1", fontWeight:700 }}>턴 남음</span>
        </div>
      )}
      {isExhausted && !isCd && (
        <div style={{ position:"absolute", inset:0, borderRadius:18, background:"rgba(10,10,15,0.88)", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <span style={{ fontSize:isPrimary?13:11, fontWeight:800, color:UI.accent.red }}>소진</span>
        </div>
      )}
    </button>
  );
}

/* ══════════════ 메인 페이지 ══════════════ */
export default function CatchBattlePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const mounted = useRef(true);

  // 배틀 미노출 중엔 직접 진입도 지도 화면으로 돌려보낸다 (API도 503).
  useEffect(() => {
    if (!CATCH_BATTLE_ENABLED) router.replace("/catch");
  }, [router]);

  const [myCats, setMyCats] = useState<BattleCat[]>([]);
  const [selected, setSelected] = useState<BattleCat | null>(null);
  // 누구와 싸울지(PVE/PVP)와 어떻게 싸울지(수동/자동)는 서로 다른 축. "평소엔 PVE"가 기본값.
  const [battleType, setBattleType] = useState<"pve"|"pvp">("pve");
  const [mode, setMode] = useState<Mode>("manual");
  const [phase, setPhase] = useState<Phase>("select");
  const [autoPilot, setAutoPilot] = useState(false); // 수동 배틀 중 자동전투 전환
  // 자동전투(mode==="auto") 재생 배속 — 반복 파밍할 때 답답하지 않게.
  const [autoSpeed, setAutoSpeed] = useState<1|2|3>(1);
  const autoSpeedRef = useRef<1|2|3>(1);
  useEffect(() => { autoSpeedRef.current = autoSpeed; }, [autoSpeed]);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(3);
  // PVP 상대 0명(콜드스타트) → PVE 자동 전환 안내 토스트
  const [pvpFallbackNotice, setPvpFallbackNotice] = useState(false);
  const pvpFallbackTimerRef = useRef<ReturnType<typeof setTimeout>|null>(null);

  // 수동 배틀 결과 기록(record) 위조 방지용 서명 토큰 — 매칭 API가 내려준 걸 보관.
  const battleTokenRef = useRef<string | null>(null);
  const [opponent, setOpponent] = useState<BattleCat | null>(null);
  const [myStats, setMyStats] = useState<BattleStats | null>(null);
  const [oppStats, setOppStats] = useState<BattleStats | null>(null);

  // 현재 HP (state + ref 쌍)
  const [myHp, _setMyHp] = useState(0);
  const [oppHp, _setOppHp] = useState(0);
  const [myMaxHp, setMyMaxHp] = useState(1);
  const [oppMaxHp, setOppMaxHp] = useState(1);
  const myHpRef = useRef(0);
  const oppHpRef = useRef(0);
  const setMyHp = (v:number) => { myHpRef.current=v; if(mounted.current)_setMyHp(v); };
  const setOppHp = (v:number) => { oppHpRef.current=v; if(mounted.current)_setOppHp(v); };

  // 배틀 환경
  const [battleEnv, setBattleEnv] = useState<BattleEnvKey|null>(null);
  const [battleBase, setBattleBase] = useState<BattleBase|null>(null);
  const lastBaseKeyRef = useRef<string|null>(null);
  // 자동전투 리플레이에서 내 카드가 방금 쓴 스킬 이름 — 스킬창 버튼을 잠깐 빛나게 한다
  const [autoCastName, setAutoCastName] = useState<string|null>(null);
  const autoCastTimerRef = useRef<ReturnType<typeof setTimeout>|null>(null);
  const battleEnvRef = useRef<BattleEnvKey|null>(null);

  // 상태이상 (기절/방어)
  const myGuardRef = useRef(false);
  const oppGuardRef = useRef(false);
  const myStunnedRef = useRef(0);   // 남은 기절 턴수
  const oppStunnedRef = useRef(0);
  const [myGuardVis, setMyGuardVis] = useState(false);
  const [oppGuardVis, setOppGuardVis] = useState(false);
  const [myStunVis, setMyStunVis] = useState(false);
  const [oppStunVis, setOppStunVis] = useState(false);
  const [myStunFlavor, setMyStunFlavor] = useState<FxFlavor|null>(null);
  const [oppStunFlavor, setOppStunFlavor] = useState<FxFlavor|null>(null);

  // 지속 상태이상 DoT/속박
  const myPoisonRef  = useRef(0);   // 남은 독 턴수
  const oppPoisonRef = useRef(0);
  const myBleedRef   = useRef(0);   // 남은 출혈 턴수
  const oppBleedRef  = useRef(0);
  const myBoundRef   = useRef(0);   // 남은 속박 턴수 (회피 불가)
  const oppBoundRef  = useRef(0);
  const [myStatusBadges,  setMyStatusBadges]  = useState<string[]>([]);
  const [oppStatusBadges, setOppStatusBadges] = useState<string[]>([]);

  // 스킬 쿨다운 [normal, guard, skill1, skill2, skill3, skill4]
  const mySkillCdRef = useRef([0,0,0,0,0,0]);
  const [mySkillCd,  setMySkillCd]  = useState([0,0,0,0,0,0]);
  // 상대(수동 배틀 라이브 상대)도 같은 쿨다운/방어 제한을 받아야 스킬만 계속 쓰지 않음.
  const oppSkillCdRef = useRef([0,0,0,0,0,0]);
  const oppGuardUsesRef = useRef(GUARD_USES);

  // 방어 사용 횟수 제한 (기본공격은 무제한이라 카운터 없음)
  const myGuardUsesRef  = useRef(GUARD_USES);
  const [myGuardUses,  setMyGuardUses]  = useState(GUARD_USES);

  // 애니메이션
  const [myAnim, setMyAnim] = useState<CardAnim>("idle");
  const [oppAnim, setOppAnim] = useState<CardAnim>("idle");
  const [critFlash, setCritFlash] = useState(false);
  // 임팩트 연출 — 타격감을 위한 화면 흔들림 + 충격파 (0=없음, 1=일반타격, 2=크리티컬)
  const [screenShake, setScreenShake] = useState<0|1|2>(0);
  const [impactBurst, setImpactBurst] = useState<{ side:"me"|"opp"; big:boolean; color?:string } | null>(null);
  const shakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const myParticleRef = useRef<ParticleCanvasHandle>(null);
  const oppParticleRef = useRef<ParticleCanvasHandle>(null);
  const triggerImpact = (side:"me"|"opp", isCrit: boolean, color?: string, flavor?: FxFlavor) => {
    setScreenShake(isCrit ? 2 : 1);
    setImpactBurst({ side, big: isCrit, color });
    if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
    shakeTimerRef.current = setTimeout(() => { setScreenShake(0); setImpactBurst(null); }, isCrit ? 480 : 320);
    const pref = side === "me" ? myParticleRef : oppParticleRef;
    const c = color ?? (isCrit ? "255,220,80" : "255,255,255");
    pref.current?.burst(0.5, 0.4, "spark", isCrit ? 20 : 9, c);
    if (isCrit) pref.current?.burst(0.5, 0.4, "shockwave", 1, c);
    if (flavor) FLAVOR_SFX[flavor]();
    else if (isCrit) sfx.crit();
    else sfx.hit();
  };
  const [dmgPopup, setDmgPopup] = useState<{target:"me"|"opp"; val:number; isCrit:boolean; msg?:string}|null>(null);
  // 기술명 컷인 — 스킬 사용 시 상태이상 컷인과 같은 슬라이드 배너 (스킬 색으로 발광).
  const [skillCutin, setSkillCutin] = useState<{icon:string; name:string; color:string; side:"me"|"opp"; key:number}|null>(null);
  const cutinTimerRef = useRef<ReturnType<typeof setTimeout>|null>(null);
  const fireSkillCutin = (icon:string, name:string, color:string, side:"me"|"opp") => {
    setSkillCutin({ icon, name, color, side, key: Date.now() });
    if(cutinTimerRef.current) clearTimeout(cutinTimerRef.current);
    cutinTimerRef.current = setTimeout(() => setSkillCutin(null), 1100);
  };

  // ── 상태이상 컷인 — 걸리는 순간 슬라이드처럼 옆에서 쓱 들어왔다 쓱 빠진다 ──
  const STATUS_CUTIN_META: Record<string, { label: string; color: string }> = {
    "☠️": { label: "중독", color: "#7ED957" },
    "🩸": { label: "출혈", color: "#FF5E5E" },
    "⛓️": { label: "속박", color: "#C9D4E0" },
    "😵": { label: "기절", color: "#FFD700" },
  };
  const [statusCutin, setStatusCutin] = useState<{icon:string; side:"me"|"opp"; key:number}|null>(null);
  const statusCutinTimerRef = useRef<ReturnType<typeof setTimeout>|null>(null);
  const fireStatusCutin = useCallback((side:"me"|"opp", icon:string, delay=0) => {
    setTimeout(() => {
      if(!mounted.current) return;
      setStatusCutin({ side, icon, key: Date.now() + Math.random() });
      if(statusCutinTimerRef.current) clearTimeout(statusCutinTimerRef.current);
      statusCutinTimerRef.current = setTimeout(() => setStatusCutin(null), 1350);
    }, delay);
  }, []);
  const prevStatusRef = useRef<{me:Set<string>; opp:Set<string>}>({ me: new Set(), opp: new Set() });
  useEffect(() => {
    const kindsOf = (arr:string[]) => new Set(arr.map(b => b.replace(/\d+/g, "")));
    const me = kindsOf(myStatusBadges), opp = kindsOf(oppStatusBadges);
    let delay = 0; // 동시 다중 상태(지배=속박+중독)는 0.75초 간격으로 순차 등장
    for(const k of me) if(!prevStatusRef.current.me.has(k)) { fireStatusCutin("me", k, delay); delay += 750; }
    for(const k of opp) if(!prevStatusRef.current.opp.has(k)) { fireStatusCutin("opp", k, delay); delay += 750; }
    prevStatusRef.current = { me, opp };
  }, [myStatusBadges, oppStatusBadges, fireStatusCutin]);
  // 기절은 뱃지 배열이 아니라 별도 상태라 상승 에지에서 직접 발화
  useEffect(() => { if(myStunVis) fireStatusCutin("me", "😵"); }, [myStunVis, fireStatusCutin]);
  useEffect(() => { if(oppStunVis) fireStatusCutin("opp", "😵"); }, [oppStunVis, fireStatusCutin]);
  const [actionMsg, setActionMsg] = useState("");
  const [turnCount, setTurnCount] = useState(0);
  // applySkill/pickSkill 클로저에서 최신 턴수를 읽기 위한 ref
  const turnCountRef = useRef(0);
  useEffect(() => { turnCountRef.current = turnCount; }, [turnCount]);

  // 타이머
  const [timerLeft, setTimerLeft] = useState(6);
  const timerRef = useRef<ReturnType<typeof setInterval>|null>(null);
  // startTimer는 deps=[]라 최초 클로저를 붙잡음 — ref로 항상 최신 pickSkill을 참조
  const pickSkillRef = useRef<(skillIdx: number | null, forfeitMsg?: string) => void>(() => {});

  // 결과
  const [battleResult, setBattleResult] = useState<{winner:"me"|"opponent"|"draw"; exp:number; newLevel:number; leveledUp:boolean; coinsGained?:number}|null>(null);
  useEffect(() => { if (battleResult?.leveledUp) { sfx.levelUp(); navigator.vibrate?.([30,30,30,30,60]); } }, [battleResult]);

  // 승리/패배 풀스크린 배너 — 결과 패널이 뜨기 전 1.7초간 화면 전체를 덮는 연출.
  const [resultBanner, setResultBanner] = useState<{winner:"me"|"opponent"|"draw"; key:number}|null>(null);
  useEffect(() => {
    if (phase !== "result" || !battleResult) return;
    setResultBanner({ winner: battleResult.winner, key: Date.now() });
    const t = setTimeout(() => { if (mounted.current) setResultBanner(null); }, 1700);
    return () => clearTimeout(t);
  }, [phase, battleResult]);

  // PVE 조우 여부 — 서버가 is_boss로 알려줌 (진짜 보스=고양이학대범만 true)
  const [isBossBattle, setIsBossBattle] = useState(false);
  const [showBossIntro, setShowBossIntro] = useState(false);

  // 자동 전투용
  const [autoResult, setAutoResult] = useState<AutoResult|null>(null);
  const autoTimerRef = useRef<ReturnType<typeof setTimeout>|null>(null);
  void autoResult;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; clearTimer(); if(autoTimerRef.current) clearTimeout(autoTimerRef.current); if(shakeTimerRef.current) clearTimeout(shakeTimerRef.current); if(pvpFallbackTimerRef.current) clearTimeout(pvpFallbackTimerRef.current); stopAmbient(); };
  }, []);

  const CARD_COLS = "id,species_key,photo_url,card_rarity,card_name,card_traits,card_stats,card_flavor,card_level,card_exp,caught_at,best_win_streak,pve_win_count,win_streak,battle_atk,battle_def,battle_eva,battle_crit,battle_special,battle_special2,battle_special3,battle_special4,equipped_border_key";

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace("/login"); return; }
    createClient().from("catch_cards")
      .select(CARD_COLS)
      .eq("owner_id", user.id)
      .order("card_level",{ascending:false})
      .then(({ data }:{ data:(BattleCat & { caught_at?: string })[]|null }) => {
        if(mounted.current) setMyCats((data??[]).map(c => ({
          ...c, name: c.card_name ?? "이름없냥", card_generated_at: c.caught_at ?? null,
        })));
      });
  }, [user, authLoading, router]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── 🏆 승리 골드 샤워 — 결과 화면이 뜨는 프레임에 1회 ── */
  useEffect(() => {
    if (phase === "result" && battleResult?.winner === "me") celebrateVictory();
  }, [phase, battleResult]);

  /* ── ⚡ 바로 배틀 — /catch/battle?quick=1 진입 시 직전 프리셋으로 즉시 시작 ── */
  const quickTriedRef = useRef(false);
  useEffect(() => {
    if (quickTriedRef.current || phase !== "select" || myCats.length === 0) return;
    quickTriedRef.current = true; // 한 번만 — 배틀 후 select로 돌아와도 재발동하지 않게
    if (new URLSearchParams(window.location.search).get("quick") !== "1") return;
    let saved: { cardId?: string; mode?: string; battleType?: string } | null = null;
    try { saved = JSON.parse(localStorage.getItem("city_catch_quick_battle") ?? "null"); } catch { /* 손상된 프리셋 */ }
    const card = myCats.find(c => c.id === saved?.cardId) ?? myCats[0];
    startBattle({
      card,
      mode: saved?.mode === "auto" ? "auto" : "manual",
      type: saved?.battleType === "pvp" ? "pvp" : "pve",
    });
  }, [phase, myCats]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── 타이머 ── */
  function clearTimer() { if(timerRef.current){ clearInterval(timerRef.current); timerRef.current=null; } }

  const startTimer = useCallback(() => {
    clearTimer();
    setTimerLeft(6);
    let t = 6;
    timerRef.current = setInterval(() => {
      t--;
      if(mounted.current) setTimerLeft(t);
      if(t > 0 && t <= 3) navigator.vibrate?.(t === 1 ? 90 : 40); // 마감 임박 심장 조이기
      if(t <= 0) {
        clearTimer();
        if(mounted.current) pickSkillRef.current(null); // 타임오버 → 턴 패스 (상대에게 넘어감)
      }
    }, 1000);
  }, []); // eslint-disable-line

  useEffect(() => {
    if(phase !== "player_choose") { clearTimer(); return; }
    if(autoPilot) {
      clearTimer();
      const t = setTimeout(() => {
        if(!mounted.current) return;
        const oppHpRatio = oppHpRef.current / Math.max(1, oppMaxHp);
        const oppVulnerable = oppStunnedRef.current > 0 || oppBoundRef.current > 0;
        const action = pickAvailableAutoAction(myHpRef.current, myMaxHp, mySkillCdRef.current, myGuardUsesRef.current, oppHpRatio, oppVulnerable);
        pickSkillRef.current(action);
      }, 500);
      return () => clearTimeout(t);
    }
    queueMicrotask(startTimer);
  }, [phase, autoPilot]); // eslint-disable-line

  /* ── 배틀 시작 ── */
  const startBattle = async (opts?: { card?: BattleCat; mode?: Mode; type?: "pve"|"pvp"; skipPreset?: boolean }) => {
    const card = opts?.card ?? selected;
    const m = opts?.mode ?? mode;
    const bt = opts?.type ?? battleType;
    if(!card) return;
    if(opts) { setSelected(card); setMode(m); setBattleType(bt); }
    setPhase("loading"); setError("");
    // 직전 설정 저장 — "⚡ 바로 배틀"이 이 프리셋으로 원탭 재매칭
    if(!opts?.skipPreset) {
      try { localStorage.setItem("city_catch_quick_battle", JSON.stringify({ cardId: card.id, mode: m, battleType: bt })); } catch { /* 시크릿 모드 등 */ }
    }

    const res = await fetch("/api/catch/battle", {
      method:"POST", headers:{"content-type":"application/json"},
      body: JSON.stringify({ my_card_id: card.id, mode: m, battle_type: bt }),
    });
    const json = await res.json();
    if(!res.ok) {
      // 콜드스타트 폴백 — 초기엔 다른 유저 카드가 없어 PVP 매칭이 404(no_opponents).
      // 같은 카드·모드 그대로 PVE로 재요청해 배틀을 이어준다.
      if(json.error === "no_opponents" && bt === "pvp") {
        setPvpFallbackNotice(true);
        if(pvpFallbackTimerRef.current) clearTimeout(pvpFallbackTimerRef.current);
        pvpFallbackTimerRef.current = setTimeout(() => { if(mounted.current) setPvpFallbackNotice(false); }, 4500);
        startBattle({ card, mode: m, type: "pve", skipPreset: true });
        return;
      }
      setError(json.error==="no_opponents"?"아직 배틀할 상대가 없어요. 다른 집사가 냥이를 잡으면 도전할 수 있어요!":(json.error ?? "배틀 오류"));
      setPhase("select"); return;
    }

    const rawOpp = json.opponent as BattleCat;
    const opp: BattleCat = { ...rawOpp, name: rawOpp.card_name ?? "상대", photo_url: rawOpp.photo_url ?? null };
    setOpponent(opp);
    const isBoss = !!json.is_boss;
    setIsBossBattle(isBoss);
    battleTokenRef.current = typeof json.battle_token === "string" ? json.battle_token : null;

    // 배틀 환경 — 랜덤. ?env=night|noon|rain|heat|fog|snow 로 강제 프리뷰 가능(연출 튜닝용)
    const forcedEnv = typeof window !== "undefined"
      ? (new URLSearchParams(window.location.search).get("env") as BattleEnvKey | null) : null;
    const envKey = (forcedEnv && BATTLE_ENVS[forcedEnv]) ? forcedEnv
      : isBoss ? "night" : ENV_KEYS[Math.floor(Math.random() * ENV_KEYS.length)];
    setBattleEnv(envKey); battleEnvRef.current = envKey;
    // 골목/하천/광장 랜덤 — 직전 배틀과 같은 배경은 제외
    {
      const pool = BATTLE_BASES.filter(b => b.key !== lastBaseKeyRef.current);
      const base = pool[Math.floor(Math.random() * pool.length)];
      lastBaseKeyRef.current = base.key;
      setBattleBase(base);
    }
    setAmbientEnv(envKey);

    if(m === "manual") {
      const ms = json.my_stats as BattleStats;
      const os = json.opp_stats as BattleStats;
      setMyStats(ms); setOppStats(os);
      setMyHp(ms.hp); setOppHp(os.hp);
      setMyMaxHp(ms.hp); setOppMaxHp(os.hp);
      myGuardRef.current=false; oppGuardRef.current=false;
      myStunnedRef.current=0; oppStunnedRef.current=0;
      setMyGuardVis(false); setOppGuardVis(false);
      setMyStunVis(false); setOppStunVis(false);
      setMyStunFlavor(null); setOppStunFlavor(null);
      myPoisonRef.current=0; oppPoisonRef.current=0;
      myBleedRef.current=0; oppBleedRef.current=0;
      myBoundRef.current=0; oppBoundRef.current=0;
      setMyStatusBadges([]); setOppStatusBadges([]);
      mySkillCdRef.current=[0,0,0,0,0,0]; setMySkillCd([0,0,0,0,0,0]);
      oppSkillCdRef.current=[0,0,0,0,0,0]; oppGuardUsesRef.current=GUARD_USES;
      myGuardUsesRef.current=GUARD_USES; setMyGuardUses(GUARD_USES);
    } else {
      // 자동 전투 — 리플레이 중 실제 상태이상을 반영하므로 이전 배틀의 잔여 상태를 초기화
      const r = json.result as AutoResult;
      setAutoResult(r);
      setMyHp(r.my_max_hp); setOppHp(r.opp_max_hp);
      setMyMaxHp(r.my_max_hp); setOppMaxHp(r.opp_max_hp);
      myStunnedRef.current=0; oppStunnedRef.current=0;
      setMyStunVis(false); setOppStunVis(false);
      setMyStunFlavor(null); setOppStunFlavor(null);
      myPoisonRef.current=0; oppPoisonRef.current=0;
      myBleedRef.current=0; oppBleedRef.current=0;
      myBoundRef.current=0; oppBoundRef.current=0;
      setMyStatusBadges([]); setOppStatusBadges([]);
    }

    // 카운트다운
    const beginCountdown = () => {
      if(!mounted.current) return;
      setShowBossIntro(false);
      setPhase("countdown"); setCountdown(3);
      sfx.countdownTick();
      let cd = 3;
      const cdTick = () => {
        cd--;
        if(!mounted.current) return;
        setCountdown(cd);
        navigator.vibrate?.(40);
        if(cd > 0) { sfx.countdownTick(); setTimeout(cdTick, 650); }
        else {
          sfx.countdownGo();
          setTimeout(() => {
            if(!mounted.current) return;
            if(m==="manual") {
              setTurnCount(1);
              setActionMsg("기술을 선택하세요!");
              setPhase("player_choose");
            } else {
              setPhase("animating");
              replayAuto(json.result as AutoResult, card.name);
            }
          }, 500);
        }
      };
      setTimeout(cdTick, 700);
    };

    // "OOO 등장!" 인트로 — PVE로 마주치는 모든 상대에게 보여준다(보스는 진동·사운드 강화).
    if(bt === "pve") {
      setShowBossIntro(true);
      if (isBoss) { navigator.vibrate?.([50, 60, 50, 60, 120]); sfx.bossAppear(); }
      else { navigator.vibrate?.(40); sfx.bossAppear(); }
      setTimeout(beginCountdown, 2200);
    } else {
      beginCountdown();
    }
  };

  /* ── 자동 배틀 재생 ── */
  const replayAuto = (r: AutoResult, myName: string) => {
    const log = r.log;
    let i = 0;
    const tick = () => {
      if(!mounted.current) return;
      const TICK = 1100 / autoSpeedRef.current;
      if(i >= log.length) {
        setTimeout(() => {
          if(!mounted.current) return;
          setTurnCount(r.rounds); // 서버 시뮬레이션의 턴 수 — 안 넣으면 결과에 "0턴"
          setBattleResult({ winner:r.winner, exp:r.exp_gained, newLevel:r.my_new_level, leveledUp:r.leveled_up, coinsGained:r.coins_gained });
          setPhase("result");
        }, 600);
        return;
      }
      const e = log[i++];
      const isMe = e.actor===myName;
      if (isMe && !e.isDot && e.skillName) {
        setAutoCastName(e.skillName);
        if (autoCastTimerRef.current) clearTimeout(autoCastTimerRef.current);
        autoCastTimerRef.current = setTimeout(() => { if (mounted.current) setAutoCastName(null); }, 850);
      }

      // 도트(독/출혈) 틱 — 공격 모션 없이 HP만 갱신하고 짧게 표시
      if(e.isDot) {
        setMyHp(e.aHp); setOppHp(e.dHp);
        setDmgPopup({ target:isMe?"me":"opp", val:e.dmg, isCrit:false, msg:"☠️ 상태이상 피해" });
        sfx.poisonTick();
        autoTimerRef.current = setTimeout(() => { if(!mounted.current) return; setDmgPopup(null); tick(); }, TICK*0.55);
        return;
      }

      // 기절로 행동 불가한 턴
      if(e.isStunSkip) {
        setActionMsg(`${e.actor}는 기절해서 움직일 수 없다!`);
        if(isMe) { myStunnedRef.current = Math.max(0, myStunnedRef.current-1); if(myStunnedRef.current===0){ setMyStunVis(false); setMyStunFlavor(null); } }
        else { oppStunnedRef.current = Math.max(0, oppStunnedRef.current-1); if(oppStunnedRef.current===0){ setOppStunVis(false); setOppStunFlavor(null); } }
        autoTimerRef.current = setTimeout(tick, TICK);
        return;
      }

      const flavor = flavorForId(e.skillId ?? null);
      const color = flavor ? FX_COLOR[flavor] : undefined;
      // 스킬 사용 컷인 — 자동 리플레이도 수동과 동일 (기본공격/방어는 제외 — 소음 방지)
      const cutinSkill = e.skillId ? SPECIAL_SKILLS[e.skillId as keyof typeof SPECIAL_SKILLS] : undefined;
      if (cutinSkill) fireSkillCutin(cutinSkill.icon, e.skillName, color ?? "#3182F6", isMe ? "me" : "opp");
      setActionMsg(`${e.actor}의 ${e.skillName}!${e.isCritical?" 💥 크리티컬!":""}${e.isCounterAttack?" ⚡ 위기반격!":""}`);
      if(isMe){ setMyAnim("attack"); } else { setOppAnim("attack"); }

      // 속박 소모(회피 불가) — 공격받는 쪽 카운트를 먼저 줄이고, 새 상태이상은 아래서 덮어씀
      if(isMe) oppBoundRef.current = Math.max(0, oppBoundRef.current-1);
      else myBoundRef.current = Math.max(0, myBoundRef.current-1);

      // 이번 턴에 상대에게 새로 걸린 상태이상 반영
      if(e.statusType) {
        const targetIsMe = !isMe;
        const turns = e.statusTurns ?? 2;
        if(e.statusType==="stun") {
          if(targetIsMe) { myStunnedRef.current=turns; setMyStunVis(true); setMyStunFlavor(flavor ?? null); }
          else { oppStunnedRef.current=turns; setOppStunVis(true); setOppStunFlavor(flavor ?? null); }
        } else if(e.statusType==="bind") {
          if(targetIsMe) myBoundRef.current=turns; else oppBoundRef.current=turns;
        } else if(e.statusType==="poison") {
          if(targetIsMe) myPoisonRef.current=turns; else oppPoisonRef.current=turns;
        } else if(e.statusType==="bleed") {
          if(targetIsMe) myBleedRef.current=turns; else oppBleedRef.current=turns;
        }
      }
      const mb: string[] = [];
      if(myPoisonRef.current>0) mb.push(`☠️${myPoisonRef.current}`);
      if(myBleedRef.current>0) mb.push(`🩸${myBleedRef.current}`);
      if(myBoundRef.current>0) mb.push(`⛓️${myBoundRef.current}`);
      setMyStatusBadges(mb);
      const ob: string[] = [];
      if(oppPoisonRef.current>0) ob.push(`☠️${oppPoisonRef.current}`);
      if(oppBleedRef.current>0) ob.push(`🩸${oppBleedRef.current}`);
      if(oppBoundRef.current>0) ob.push(`⛓️${oppBoundRef.current}`);
      setOppStatusBadges(ob);

      setTimeout(() => {
        if(!mounted.current) return;
        setMyAnim("idle"); setOppAnim("idle");
        setMyHp(e.aHp); setOppHp(e.dHp);
        if(!e.isDodge && e.dmg>0) {
          if(isMe){ setOppAnim("hit"); } else { setMyAnim("hit"); }
          triggerImpact(isMe?"opp":"me", e.isCritical, color, flavor);
          setDmgPopup({ target:isMe?"opp":"me", val:e.dmg, isCrit:e.isCritical });
          if(e.isCritical){ setCritFlash(true); navigator.vibrate?.([80,30,80]); }
          else navigator.vibrate?.(30);
        } else if(e.isDodge) {
          sfx.dodge();
          setDmgPopup({ target:isMe?"opp":"me", val:0, isCrit:false, msg:"회피!" });
        } else if(e.statusType) {
          const targetSide = isMe ? "opp" : "me";
          if(targetSide==="opp") setOppAnim("hit"); else setMyAnim("hit");
          triggerImpact(targetSide, false, color, flavor);
          const label = (flavor && STUN_LABEL[flavor]) ? `${STUN_LABEL[flavor]} 성공!` : e.statusType==="bind" ? "⛓️ 속박!" : e.statusType==="poison" ? "☠️ 중독!" : "🩸 출혈!";
          setDmgPopup({ target:targetSide, val:0, isCrit:false, msg:label });
        }
        setTimeout(() => {
          if(!mounted.current) return;
          setMyAnim("idle"); setOppAnim("idle"); setDmgPopup(null); setCritFlash(false);
          autoTimerRef.current = setTimeout(tick, 100 / autoSpeedRef.current);
        }, 650 / autoSpeedRef.current);
      }, 380 / autoSpeedRef.current);
    };
    autoTimerRef.current = setTimeout(tick, 300);
  };

  /* ── 수동: 기술 선택 ── */
  const mySkills  = useMemo(() => selected  ? buildSkills(selected)  : [], [selected]);
  const oppSkills = useMemo(() => opponent  ? buildSkills(opponent)  : [], [opponent]);

  const applySkill = (
    skillIdx: number, isPlayer: boolean,
    mySt: BattleStats, oppSt: BattleStats,
    myMaxH: number, oppMaxH: number,
    myCat: BattleCat, oppCat: BattleCat,
  ) => {
    const skill    = isPlayer ? mySkills[skillIdx]  : oppSkills[skillIdx];
    const attacker = isPlayer ? myCat  : oppCat;
    const defender = isPlayer ? oppCat : myCat;
    const atkSt    = isPlayer ? mySt   : oppSt;
    const defSt    = isPlayer ? oppSt  : mySt;
    const myGuard  = myGuardRef.current;
    const oppGuard = oppGuardRef.current;

    // 기절 부여 헬퍼 — 스킬마다 "성격"(얼음/공포/전기/수면)을 함께 기록해 시각 연출에 사용
    const setStun = (turns: number, flavor: FxFlavor) => {
      if (isPlayer) { oppStunnedRef.current = turns; setOppStunVis(true); setOppStunFlavor(flavor); }
      else { myStunnedRef.current = turns; setMyStunVis(true); setMyStunFlavor(flavor); }
    };

    // 환경 보정
    const env = battleEnvRef.current ? BATTLE_ENVS[battleEnvRef.current] : null;
    const envEvaBonus  = env?.evaBonus  ?? 0;
    const envCritBonus = env?.critBonus ?? 0;

    // 상성 보정 (카드 등급 = 타입)
    const atkType = RARITY_TYPE[attacker.card_rarity] ?? "grass";
    const defType = RARITY_TYPE[defender.card_rarity] ?? "grass";
    const isEffective = WEAK_TO[defType] === atkType;

    // 필사의 역전 — 공격자 체력이 30% 미만이면 피해량·크리티컬 확률 보너스
    const atkHpRatio = (isPlayer ? myHpRef.current : oppHpRef.current) / (isPlayer ? myMaxH : oppMaxH);
    const comebackActive = atkHpRatio < 0.3;
    const comebackDmgMult = comebackActive ? 1.15 : 1.0;
    const comebackCritBonus = comebackActive ? 15 : 0;

    // 격전 — 8턴을 넘기면 매 턴 피해량이 5%씩 증가 (최대 +50%) — 무한 대치 차단
    const escalationMult = 1 + Math.min(0.5, Math.max(0, (turnCountRef.current - 8) * 0.05));

    const envDmgMult = (env?.dmgMult ?? 1.0) * (isEffective ? 2.0 : 1.0) * comebackDmgMult * escalationMult;

    // 이번에 사용할 스킬 ID 미리 확인 (야습의 회피 무시 판정에 필요)
    const usedSkillId = skill.type === "special" && skill.slot !== undefined ? getSlotSkillId(attacker, skill.slot) : null;
    const forceHit = usedSkillId === "night_prowl";

    // 속박 체크 (속박 남은 턴수 > 0 이면 회피 불가, 대상 공격당 1턴씩 소모)
    const defBound = (isPlayer ? oppBoundRef.current : myBoundRef.current) > 0;
    if (isPlayer) oppBoundRef.current = Math.max(0, oppBoundRef.current - 1);
    else myBoundRef.current = Math.max(0, myBoundRef.current - 1);

    // 회피 체크 (공격 전, 속박/야습 시 무조건 맞음)
    const defEva = (defender.battle_eva ?? 8) + envEvaBonus;
    if(!defBound && !forceHit && skill.type !== "guard" && checkEvasion(defEva)) {
      if(isPlayer){ setOppAnim("dodge"); } else { setMyAnim("dodge"); }
      sfx.dodge();
      navigator.vibrate?.(20);
      setTimeout(()=>{ setMyAnim("idle"); setOppAnim("idle"); }, 350);
      return { dmg:0, isCrit:false, msg:"💨 회피!", dodged:true, skillId: usedSkillId };
    }

    const atkCrit = (attacker.battle_crit ?? 8) + envCritBonus + comebackCritBonus;
    const ownMaxHp = isPlayer ? myMaxH : oppMaxH;
    let dmg=0, isCrit=false, msg="";

    // 카드 고유 특수 스킬 실행 (강공격/특수기 슬롯 공용)
    const runSpecial = (skillId: string): { dmg:number; isCrit:boolean; msg:string } => {
      let sDmg=0, sCrit=false, sMsg="";
      switch(skillId) {
        case "sharp_claws": { const r=calcDmg(atkSt.atk,defSt.def,1.4*envDmgMult,atkCrit); sDmg=r.dmg; sCrit=r.isCrit; sMsg="🐾 날카로운 발톱!"; break; }
        case "quick_dodge":   sMsg="💨 재빠른 도약!"; if(isPlayer){myGuardRef.current=true;setMyGuardVis(true);}else{oppGuardRef.current=true;setOppGuardVis(true);} sfx.guard(); navigator.vibrate?.(25); break;
        case "focus":        { const r=calcDmg(atkSt.atk,defSt.def,0.78*envDmgMult,100); sDmg=r.dmg; sCrit=true; sMsg="👁️ 집중! 크리티컬 확정"; break; }
        case "intimidate_sm": {
          const r=calcDmg(atkSt.atk*0.85,defSt.def,1.0,atkCrit); sDmg=r.dmg; sCrit=r.isCrit;
          if(Math.random()<0.3){ if(isPlayer){oppBoundRef.current=2;}else{myBoundRef.current=2;} sMsg="😠 견제! 2턴 속박(회피 불가)"; }
          else sMsg="😠 견제! (속박 실패)";
          break;
        }
        case "hiss": {
          const r=calcDmg(atkSt.atk,defSt.def,0.5*envDmgMult,atkCrit); sDmg=r.dmg; sCrit=r.isCrit;
          if(Math.random()<0.3){ setStun(2,"fear"); sMsg="😾 하악 위협! 2턴 기절"; }
          else sMsg="😾 하악 위협!";
          break;
        }
        case "grooming":   { const heal=Math.round(ownMaxHp*0.16); if(isPlayer)setMyHp(Math.min(myMaxH,myHpRef.current+heal));else setOppHp(Math.min(oppMaxH,oppHpRef.current+heal)); sMsg=`🧼 그루밍! +${heal}HP 회복`; break; }
        case "warm_nap":   { const heal=Math.round(ownMaxHp*0.14); if(isPlayer)setMyHp(Math.min(myMaxH,myHpRef.current+heal));else setOppHp(Math.min(oppMaxH,oppHpRef.current+heal)); sMsg=`😴 따뜻한 낮잠! +${heal}HP 회복`; break; }
        case "tail_whip":  { const r=calcDmg(atkSt.atk,defSt.def*0.7,1.0*envDmgMult,atkCrit); sDmg=r.dmg; sCrit=r.isCrit; sMsg="🐈 꼬리 치기! 방어 일부 무시"; break; }
        case "claw_flurry": {
          const r1=calcDmg(atkSt.atk,defSt.def,0.6*envDmgMult,atkCrit);
          const r2=calcDmg(atkSt.atk,defSt.def,0.6*envDmgMult,atkCrit);
          sDmg=r1.dmg+r2.dmg; sCrit=r1.isCrit||r2.isCrit;
          sMsg=`🐾 발톱 연타! ${r1.dmg}+${r2.dmg}`;
          break;
        }
        case "body_slam":  { const r=calcDmg(atkSt.atk,defSt.def,1.3*envDmgMult,atkCrit); sDmg=r.dmg; sCrit=r.isCrit; sMsg="💥 몸통 박치기!"; break; }
        case "freeze": {
          const r=calcDmg(atkSt.atk,defSt.def,0.5*envDmgMult,atkCrit); sDmg=r.dmg; sCrit=r.isCrit;
          if(Math.random()<0.45){ setStun(2,"ice"); sMsg="❄️ 얼리기 성공! 2턴 기절"; }
          else sMsg="❄️ 얼리기... 저항!";
          break;
        }
        case "scratch":    { const r=calcDmg(atkSt.atk,defSt.def,0.8*envDmgMult,atkCrit); sDmg=r.dmg; sCrit=r.isCrit; if(isPlayer)oppBleedRef.current=3;else myBleedRef.current=3; sMsg="🩸 할퀴기! 출혈 3턴"; break; }
        case "intimidate": {
          const r=calcDmg(atkSt.atk,defSt.def,0.5*envDmgMult,atkCrit); sDmg=r.dmg; sCrit=r.isCrit;
          if(Math.random()<0.55){ setStun(2,"fear"); sMsg="😱 공포의 눈빛! 2턴 기절"; }
          else sMsg="😱 공포의 눈빛!";
          break;
        }
        case "pounce":     { const r=calcDmg(atkSt.atk,5,1.1*envDmgMult,atkCrit); sDmg=r.dmg; sCrit=r.isCrit; sMsg="🦘 도약 강타! 방어 무시"; break; }
        case "ambush":     { const r=calcDmg(atkSt.atk,defSt.def,0.88*envDmgMult,100); sDmg=r.dmg; sCrit=true; sMsg="🌑 급습! 크리티컬 확정"; break; }
        case "static_shock": {
          const r=calcDmg(atkSt.atk,defSt.def,0.6*envDmgMult,atkCrit); sDmg=r.dmg; sCrit=r.isCrit;
          if(Math.random()<0.3){ setStun(2,"shock"); sMsg="⚡ 정전기! 2턴 기절"; }
          else sMsg="⚡ 정전기!";
          break;
        }
        case "night_prowl": { const r=calcDmg(atkSt.atk,defSt.def,1.25*envDmgMult,atkCrit); sDmg=r.dmg; sCrit=r.isCrit; sMsg="🌌 야습! 회피 불가 관통"; break; }
        case "thunderclap": {
          const r=calcDmg(atkSt.atk,defSt.def,0.8*envDmgMult,atkCrit); sDmg=r.dmg; sCrit=r.isCrit;
          if(Math.random()<0.25){ setStun(2,"shock"); sMsg="🌩️ 천둥벽력! 2턴 기절"; }
          else sMsg="🌩️ 천둥벽력!";
          break;
        }
        case "cold_glare": {
          const r=calcDmg(atkSt.atk,defSt.def,0.7*envDmgMult,atkCrit); sDmg=r.dmg; sCrit=r.isCrit;
          if(Math.random()<0.3){ setStun(2,"ice"); sMsg="🥶 차가운 눈초리! 2턴 기절"; }
          else sMsg="🥶 차가운 눈초리!";
          break;
        }
        case "dash_strike": { const r=calcDmg(atkSt.atk,defSt.def,1.5*envDmgMult,atkCrit); sDmg=r.dmg; sCrit=r.isCrit; sMsg="💨 돌진!"; break; }
        case "poison":     { const r=calcDmg(atkSt.atk,defSt.def,0.85*envDmgMult,atkCrit); sDmg=r.dmg; sCrit=r.isCrit; if(isPlayer)oppPoisonRef.current=4;else myPoisonRef.current=4; sMsg="☠️ 독 중독! 4턴 지속"; break; }
        case "bind": {
          const r=calcDmg(atkSt.atk,defSt.def,0.7*envDmgMult,atkCrit); sDmg=r.dmg; sCrit=r.isCrit;
          if(Math.random()<0.75){ if(isPlayer)oppBoundRef.current=3;else myBoundRef.current=3; sMsg="⛓️ 속박! 3턴 회피 불가"; }
          else sMsg="⛓️ 속박!";
          break;
        }
        case "slow": {
          const r=calcDmg(atkSt.atk,defSt.def,0.55*envDmgMult,atkCrit); sDmg=r.dmg; sCrit=r.isCrit;
          if(Math.random()<0.6){ setStun(2,"sleep"); sMsg="🐌 느리게! 2턴 스킵"; }
          else sMsg="🐌 느리게!";
          break;
        }
        case "double_strike": {
          const r1=calcDmg(atkSt.atk,defSt.def,0.75*envDmgMult,atkCrit);
          const r2=calcDmg(atkSt.atk,defSt.def,0.75*envDmgMult,atkCrit);
          sDmg=r1.dmg+r2.dmg; sCrit=r1.isCrit||r2.isCrit;
          sMsg=`⚡ 연속 공격! ${r1.dmg}+${r2.dmg}`;
          break;
        }
        case "rend":       { const r=calcDmg(atkSt.atk,5,1.0*envDmgMult,atkCrit); sDmg=r.dmg; sCrit=r.isCrit; if(isPlayer)oppBleedRef.current=3;else myBleedRef.current=3; sMsg="🗡️ 찢기! 방어 무시+출혈"; break; }
        case "howl": {
          const r=calcDmg(atkSt.atk,defSt.def,0.7*envDmgMult,atkCrit); sDmg=r.dmg; sCrit=r.isCrit;
          if(Math.random()<0.75){ if(isPlayer)oppBoundRef.current=3;else myBoundRef.current=3; sMsg="🐺 하울링! 3턴 속박"; }
          else sMsg="🐺 하울링!";
          break;
        }
        case "frenzy":     { const r=calcDmg(atkSt.atk,defSt.def,1.6*envDmgMult,atkCrit); sDmg=r.dmg; sCrit=r.isCrit; sMsg="🔱 맹공!"; break; }
        case "curse":      { const r=calcDmg(atkSt.atk,defSt.def,0.85*envDmgMult,atkCrit); sDmg=r.dmg; sCrit=r.isCrit; if(isPlayer)oppPoisonRef.current=5;else myPoisonRef.current=5; sMsg="👹 저주! 5턴 지속"; break; }
        case "venom_fang": { const r=calcDmg(atkSt.atk,defSt.def,1.1*envDmgMult,atkCrit); sDmg=r.dmg; sCrit=r.isCrit; if(isPlayer)oppPoisonRef.current=4;else myPoisonRef.current=4; sMsg="🦷 맹독니! 4턴 중독"; break; }
        case "shockwave":  { const r=calcDmg(atkSt.atk,defSt.def,1.6*envDmgMult,atkCrit); sDmg=r.dmg; sCrit=r.isCrit; sMsg="💥 충격파!"; break; }
        case "vampirism":  { const r=calcDmg(atkSt.atk,defSt.def,1.2*envDmgMult,atkCrit); sDmg=r.dmg; sCrit=r.isCrit; const heal=Math.round(sDmg*0.45); if(isPlayer)setMyHp(Math.min(myMaxH,myHpRef.current+heal));else setOppHp(Math.min(oppMaxH,oppHpRef.current+heal)); sMsg=`🧛 흡혈! +${heal}HP 흡수`; break; }
        case "invincible": { if(isPlayer){myGuardRef.current=true;setMyGuardVis(true);}else{oppGuardRef.current=true;setOppGuardVis(true);} sfx.guard(); navigator.vibrate?.(25); sMsg="✨ 무적 발동! 다음 피해 무효"; break; }
        case "dominate":   { const r=calcDmg(atkSt.atk*1.2,5,1.0*envDmgMult,atkCrit); sDmg=r.dmg; sCrit=r.isCrit; if(isPlayer){oppBoundRef.current=3;oppPoisonRef.current=3;}else{myBoundRef.current=3;myPoisonRef.current=3;} sMsg="👑 지배! 3턴 속박+3턴 중독"; break; }
        case "regen":      { const heal=Math.round(ownMaxHp*0.34); if(isPlayer)setMyHp(Math.min(myMaxH,myHpRef.current+heal));else setOppHp(Math.min(oppMaxH,oppHpRef.current+heal)); sMsg=`💚 재생! +${heal}HP`; break; }
        case "eclipse":    { const r=calcDmg(atkSt.atk,defSt.def,1.3*envDmgMult,atkCrit); sDmg=r.dmg; sCrit=r.isCrit; const heal=Math.round(ownMaxHp*0.15); if(isPlayer)setMyHp(Math.min(myMaxH,myHpRef.current+heal));else setOppHp(Math.min(oppMaxH,oppHpRef.current+heal)); sMsg=`🌘 월식! +${heal}HP 회복`; break; }
        case "overdrive":  { const r=calcDmg(atkSt.atk,defSt.def,1.8*envDmgMult,atkCrit); sDmg=r.dmg; sCrit=r.isCrit; const recoil=Math.round(ownMaxHp*0.08); if(isPlayer)setMyHp(Math.max(0,myHpRef.current-recoil));else setOppHp(Math.max(0,oppHpRef.current-recoil)); sMsg=`💢 폭주! 반동 -${recoil}HP`; break; }
        case "meteor":     { const r=calcDmg(atkSt.atk,defSt.def,2.0*envDmgMult,atkCrit); sDmg=r.dmg; sCrit=r.isCrit; sMsg="☄️ 메테오!"; break; }
        case "judgment": {
          const r=calcDmg(atkSt.atk,defSt.def,1.05*envDmgMult,atkCrit); sDmg=r.dmg; sCrit=r.isCrit;
          if(Math.random()<0.5){
            if(isPlayer){oppBoundRef.current=2;}else{myBoundRef.current=2;}
            setStun(2,"shock");
            sMsg="⚡ 천벌! 2턴 속박+기절";
          } else sMsg="⚡ 천벌!";
          break;
        }
        case "apocalypse_strike": { const r=calcDmg(atkSt.atk,defSt.def,2.05*envDmgMult,atkCrit); sDmg=r.dmg; sCrit=r.isCrit; sMsg="🌋 종말의 일격!"; break; }
        case "cleanse": {
          const heal=Math.round(ownMaxHp*0.32);
          if(isPlayer){
            myPoisonRef.current=0; myBleedRef.current=0; myBoundRef.current=0;
            myStunnedRef.current=0; setMyStunVis(false); setMyStunFlavor(null); setMyStatusBadges([]);
            setMyHp(Math.min(myMaxH,myHpRef.current+heal));
          } else {
            oppPoisonRef.current=0; oppBleedRef.current=0; oppBoundRef.current=0;
            oppStunnedRef.current=0; setOppStunVis(false); setOppStunFlavor(null); setOppStatusBadges([]);
            setOppHp(Math.min(oppMaxH,oppHpRef.current+heal));
          }
          sMsg=`💫 정화! 상태이상 해제 +${heal}HP`;
          break;
        }
        default:           { const r=calcDmg(atkSt.atk,defSt.def,1.3*envDmgMult,atkCrit); sDmg=r.dmg; sCrit=r.isCrit; break; }
      }
      return { dmg:sDmg, isCrit:sCrit, msg:sMsg };
    };

    switch(skill.type) {
      case "normal": { const r=calcDmg(atkSt.atk,defSt.def,1.0*envDmgMult,atkCrit); dmg=r.dmg; isCrit=r.isCrit; break; }
      case "guard": {
        if(isPlayer){ myGuardRef.current=true; setMyGuardVis(true); }
        else { oppGuardRef.current=true; setOppGuardVis(true); }
        sfx.guard();
        navigator.vibrate?.(25);
        msg="🛡️ 방어 자세!";
        break;
      }
      case "special": { const r=runSpecial(usedSkillId ?? "sharp_claws"); dmg=r.dmg; isCrit=r.isCrit; msg=r.msg; break; }
    }

    // 상성 우위 표시
    if(dmg>0 && isEffective) {
      msg = msg ? `${msg} · 효과는 굉장했다!` : "효과는 굉장했다!";
    }

    // 필사의 역전 발동 알림
    if(dmg>0 && comebackActive) {
      msg = msg ? `${msg} · 🔥 필사의 역전!` : "🔥 필사의 역전!";
      sfx.comeback();
      navigator.vibrate?.([40,40,80]);
    }

    // 방어 적용
    if(dmg>0) {
      const guardActive = isPlayer ? oppGuard : myGuard;
      if(guardActive) {
        dmg=Math.round(dmg*0.6);
        if(isPlayer){ oppGuardRef.current=false; setOppGuardVis(false); }
        else { myGuardRef.current=false; setMyGuardVis(false); }
      }
    }

    // 데미지 적용
    if(dmg>0) {
      if(isPlayer) { const h=Math.max(0,oppHpRef.current-dmg); setOppHp(h); }
      else { const h=Math.max(0,myHpRef.current-dmg); setMyHp(h); }
    }

    return { dmg, isCrit, msg, dodged:false, skillId: usedSkillId };
  };

  /* ── 라운드 종료: 독/출혈 틱 + 쿨다운 감소 ── */
  const applyDotTick = useCallback((): boolean => {
    const env = battleEnvRef.current ? BATTLE_ENVS[battleEnvRef.current] : null;
    const dotMult = env?.dotMult ?? 1.0;

    let myNewHp = myHpRef.current;
    let oppNewHp = oppHpRef.current;

    // 도트는 최대 HP 비례(독 3.5%/출혈 2.5%) — 자동전투 엔진과 동일 수치
    const myPo = Math.max(6, Math.round(myMaxHp*0.035)), myBl = Math.max(4, Math.round(myMaxHp*0.025));
    const opPo = Math.max(6, Math.round(oppMaxHp*0.035)), opBl = Math.max(4, Math.round(oppMaxHp*0.025));
    if(myPoisonRef.current > 0) { myNewHp = Math.max(0, myNewHp - Math.round(myPo*dotMult)); myPoisonRef.current--; sfx.poisonTick(); }
    if(myBleedRef.current > 0) { myNewHp = Math.max(0, myNewHp - Math.round(myBl*dotMult)); myBleedRef.current--; sfx.bleedTick(); }
    if(oppPoisonRef.current > 0) { oppNewHp = Math.max(0, oppNewHp - Math.round(opPo*dotMult)); oppPoisonRef.current--; sfx.poisonTick(); }
    if(oppBleedRef.current > 0) { oppNewHp = Math.max(0, oppNewHp - Math.round(opBl*dotMult)); oppBleedRef.current--; sfx.bleedTick(); }

    const myBadges: string[] = [];
    const oppBadges: string[] = [];
    if(myPoisonRef.current>0) myBadges.push(`☠️${myPoisonRef.current}`);
    if(myBleedRef.current>0) myBadges.push(`🩸${myBleedRef.current}`);
    if(myBoundRef.current>0) myBadges.push(`⛓️${myBoundRef.current}`);
    if(oppPoisonRef.current>0) oppBadges.push(`☠️${oppPoisonRef.current}`);
    if(oppBleedRef.current>0) oppBadges.push(`🩸${oppBleedRef.current}`);
    if(oppBoundRef.current>0) oppBadges.push(`⛓️${oppBoundRef.current}`);
    setMyStatusBadges(myBadges);
    setOppStatusBadges(oppBadges);

    setMyHp(myNewHp);
    setOppHp(oppNewHp);

    mySkillCdRef.current = mySkillCdRef.current.map(c => Math.max(0, c-1));
    setMySkillCd([...mySkillCdRef.current]);
    oppSkillCdRef.current = oppSkillCdRef.current.map(c => Math.max(0, c-1));

    // 도트로 양쪽이 동시에 0이 되면 무승부
    if(myNewHp<=0 && oppNewHp<=0) { endBattle("draw"); return true; }
    if(myNewHp<=0) { endBattle("opponent"); return true; }
    if(oppNewHp<=0) { endBattle("me"); return true; }
    return false;
  }, []); // eslint-disable-line

  const pickSkill = useCallback((skillIdx: number | null, forfeitMsg?: string) => {
    if(!myStats || !oppStats || !selected || !opponent || !mounted.current) return;
    if(skillIdx !== null && mySkillCdRef.current[skillIdx] > 0) return;
    if(skillIdx === GUARD_IDX && myGuardUsesRef.current <= 0) return;
    clearTimer();
    setPhase("animating");

    let dmg = 0, isCrit = false, msg = "";
    let castSkillId: string | null = null;
    if(skillIdx === null) {
      // 타임오버: 공격 없이 턴 진행
      msg = forfeitMsg ?? "⏰ 시간 초과! 턴 패스";
      setActionMsg(msg);
    } else {
      if(SKILL_COOLDOWNS[skillIdx] > 0) {
        mySkillCdRef.current[skillIdx] = SKILL_COOLDOWNS[skillIdx];
        setMySkillCd([...mySkillCdRef.current]);
      }
      if(skillIdx === GUARD_IDX) { myGuardUsesRef.current--; setMyGuardUses(myGuardUsesRef.current); }
      const r = applySkill(skillIdx, true, myStats, oppStats, myMaxHp, oppMaxHp, selected, opponent);
      dmg = r.dmg; isCrit = r.isCrit; msg = r.msg; castSkillId = r.skillId;
      const skill = mySkills[skillIdx];
      setActionMsg(`${selected.name}의 ${skill.name}!${isCrit?" 💥 크리티컬!":""}${msg?" "+msg:""}`);
      // 기술명 컷인 — 필살기(special)만 화면을 가로지르는 배너 연출
      if(skill.type === "special") fireSkillCutin(skill.icon, skill.name, skill.color, "me");
      setMyAnim("attack");
    }

    setTimeout(() => {
      if(!mounted.current) return;
      setMyAnim("idle");
      if(dmg>0) {
        setOppAnim("hit");
        triggerImpact("opp", isCrit, flavorColorForId(castSkillId), flavorForId(castSkillId));
        setDmgPopup({ target:"opp", val:dmg, isCrit, msg:msg||undefined });
        if(isCrit){ setCritFlash(true); navigator.vibrate?.([80,30,80]); }
        else navigator.vibrate?.(35);
      } else if(msg) {
        if(isSelfTargetSkill(castSkillId)) {
          setDmgPopup({ target:"me", val:0, isCrit:false, msg });
        } else {
          // 0피해라도 상대에게 걸리는 효과(빙결/속박/독 등)면 상대 쪽에 반응을 준다
          setOppAnim("hit");
          triggerImpact("opp", false, flavorColorForId(castSkillId), flavorForId(castSkillId));
          setDmgPopup({ target:"opp", val:0, isCrit:false, msg });
        }
      }

      setTimeout(() => {
        if(!mounted.current) return;
        setOppAnim("idle"); setDmgPopup(null); setCritFlash(false);

        if(oppHpRef.current<=0) { endBattle("me"); return; }

        // 상대 턴
        setPhase("opp_thinking");
        const isStunned = oppStunnedRef.current > 0;
        setActionMsg(isStunned ? `${opponent.name}는 기절해서 움직일 수 없다!` : `${opponent.name}가 기술을 선택 중...`);
        if(isStunned) {
          oppStunnedRef.current = Math.max(0, oppStunnedRef.current - 1);
          if(oppStunnedRef.current === 0) { setOppStunVis(false); setOppStunFlavor(null); }
        }

        setTimeout(() => {
          if(!mounted.current) return;
          if(isStunned) {
            setTurnCount(t=>t+1);
            if(applyDotTick()) return;
            if(myStunnedRef.current > 0) {
              myStunnedRef.current = Math.max(0, myStunnedRef.current - 1);
              if(myStunnedRef.current === 0) { setMyStunVis(false); setMyStunFlavor(null); }
              setActionMsg("기절해서 행동할 수 없다!"); setTimeout(()=>{ if(mounted.current){ setActionMsg("기술을 선택하세요!"); setPhase("player_choose"); }}, 1200);
            }
            else { setActionMsg("기술을 선택하세요!"); setPhase("player_choose"); }
            return;
          }

          // AI 기술 선택 — 상대도 나와 동일한 쿨다운/방어 횟수 제한을 받는다.
          const myHpRatioForAi = myHpRef.current / Math.max(1, myMaxHp);
          const myVulnerableForAi = myStunnedRef.current > 0 || myBoundRef.current > 0;
          const aiSkillIdx = pickAvailableAutoAction(oppHpRef.current, oppMaxHp, oppSkillCdRef.current, oppGuardUsesRef.current, myHpRatioForAi, myVulnerableForAi);
          if (SKILL_COOLDOWNS[aiSkillIdx] > 0) oppSkillCdRef.current[aiSkillIdx] = SKILL_COOLDOWNS[aiSkillIdx];
          if (aiSkillIdx === GUARD_IDX) oppGuardUsesRef.current--;
          const { dmg:od, isCrit:oc, msg:om, skillId:aiSkillId } = applySkill(aiSkillIdx, false, myStats, oppStats, myMaxHp, oppMaxHp, selected, opponent);
          const oppSkill = oppSkills[aiSkillIdx];
          setActionMsg(`${opponent.name}의 ${oppSkill.name}!${oc?" 💥 크리티컬!":""}${om?" "+om:""}`);
          if(oppSkill.type === "special") fireSkillCutin(oppSkill.icon, oppSkill.name, oppSkill.color, "opp");
          setOppAnim("attack");

          setTimeout(() => {
            if(!mounted.current) return;
            setOppAnim("idle");
            if(od>0) {
              setMyAnim("hit");
              triggerImpact("me", oc, flavorColorForId(aiSkillId), flavorForId(aiSkillId));
              setDmgPopup({ target:"me", val:od, isCrit:oc, msg:om||undefined });
              if(oc){ setCritFlash(true); navigator.vibrate?.([80,30,80]); }
              else navigator.vibrate?.(30);
            } else if(om) {
              if(isSelfTargetSkill(aiSkillId)) {
                setDmgPopup({ target:"opp", val:0, isCrit:false, msg:om });
              } else {
                setMyAnim("hit");
                triggerImpact("me", false, flavorColorForId(aiSkillId), flavorForId(aiSkillId));
                setDmgPopup({ target:"me", val:0, isCrit:false, msg:om });
              }
            }

            setTimeout(() => {
              if(!mounted.current) return;
              setMyAnim("idle"); setDmgPopup(null); setCritFlash(false);

              if(myHpRef.current<=0) { endBattle("opponent"); return; }

              setTurnCount(t=>t+1);
              if(applyDotTick()) return;
              if(myStunnedRef.current > 0) {
                myStunnedRef.current = Math.max(0, myStunnedRef.current - 1);
                if(myStunnedRef.current === 0) { setMyStunVis(false); setMyStunFlavor(null); }
                setActionMsg("기절해서 행동할 수 없다!");
                setTimeout(()=>{ if(mounted.current){ setTurnCount(t=>t+1); setActionMsg("기술을 선택하세요!"); setPhase("player_choose"); }}, 1300);
              } else {
                setActionMsg("기술을 선택하세요!");
                setPhase("player_choose");
              }
            }, 650);
          }, 380);
        }, isStunned ? 900 : 850);
      }, 620);
    }, 380);
  }, [myStats, oppStats, selected, opponent, mySkills, oppSkills, myMaxHp, oppMaxHp]); // eslint-disable-line

  useEffect(() => { pickSkillRef.current = pickSkill; }, [pickSkill]);

  // 워치독 — 턴 연출 중 타이머 체인이 아주 드물게 멈추면 6초 후 강제 복구.
  useEffect(() => {
    if (phase !== "animating" && phase !== "opp_thinking") return;
    const watchdog = setTimeout(() => {
      if (!mounted.current) return;
      setMyAnim("idle"); setOppAnim("idle"); setDmgPopup(null); setCritFlash(false);
      setActionMsg("기술을 선택하세요!");
      setPhase("player_choose");
    }, 6000);
    return () => clearTimeout(watchdog);
  }, [phase]);

  /* ── 배틀 종료 ── */
  const endBattle = useCallback(async (winner:"me"|"opponent"|"draw") => {
    if(!selected || !opponent) return;
    setPhase("result");
    setActionMsg(winner==="me"?"🏆 승리!":winner==="draw"?"🤝 무승부!":"💔 패배...");
    stopAmbient();
    if(winner==="me") { sfx.win(); navigator.vibrate?.([40,40,40,40,100]); }
    else if(winner==="draw") { sfx.lose(); navigator.vibrate?.([60,60,60]); }
    else { sfx.lose(); navigator.vibrate?.(150); }

    try {
      const res = await fetch("/api/catch/battle/record", {
        method:"POST", headers:{"content-type":"application/json"},
        body: JSON.stringify({ my_cat_id:selected.id, opp_cat_id:opponent.id, opp_owner_id:opponent.owner_id, winner, rounds:turnCount, my_hp_left:myHpRef.current, opp_hp_left:oppHpRef.current, battle_token:battleTokenRef.current }),
      });
      const json = await res.json();
      if(mounted.current) setBattleResult({ winner, exp:json.exp_gained??0, newLevel:json.my_new_level??1, leveledUp:json.leveled_up??false, coinsGained:json.coins_gained });
    } catch {
      // 기록 API가 실패해도 결과 화면은 항상 떠야 함
      if(mounted.current) setBattleResult({ winner, exp:0, newLevel:selected.card_level, leveledUp:false });
    }
  }, [selected, opponent, turnCount]);

  /* ── 리셋 ── */
  const reset = () => {
    clearTimer();
    if(autoTimerRef.current) clearTimeout(autoTimerRef.current);
    stopAmbient();
    setPhase("select"); setSelected(null); setOpponent(null);
    setMyStats(null); setOppStats(null); setAutoResult(null);
    setBattleResult(null); setTurnCount(0); setActionMsg("");
    setMyAnim("idle"); setOppAnim("idle"); setDmgPopup(null); setCritFlash(false);
    setScreenShake(0); setImpactBurst(null);
    setIsBossBattle(false); setShowBossIntro(false);
    if(user) createClient().from("catch_cards").select(CARD_COLS).eq("owner_id",user.id).order("card_level",{ascending:false}).then(({data}:{data:(BattleCat & { caught_at?: string })[]|null})=>{ if(mounted.current) setMyCats((data??[]).map(c=>({ ...c, name:c.card_name??"이름없냥", card_generated_at:c.caught_at??null }))); });
  };

  /* ── 카드 애니 스타일 ── */
  const cardStyle = (anim:CardAnim, side:"left"|"right"): React.CSSProperties => {
    const d = side==="left"?1:-1;
    if(anim==="attack") return { ["--d" as string]:d, animation:"bAttack 0.42s cubic-bezier(0.25,0.6,0.35,1)", filter:"brightness(1.3)" } as React.CSSProperties;
    if(anim==="hit") return { animation:"bHit 0.4s ease" };
    if(anim==="dodge") return { ["--d" as string]:d, animation:"bDodge 0.32s ease-out", opacity:0.5 } as React.CSSProperties;
    return { transform:"translateX(0) scale(1)", transition:"transform 0.22s" };
  };

  const myDanger = myHp/Math.max(1,myMaxHp)<0.25;
  const oppDanger = oppHp/Math.max(1,oppMaxHp)<0.25;
  const isFightPhase = ["player_choose","animating","opp_thinking"].includes(phase);

  // 위기 진입 스팅어 — 체력이 처음 25% 밑으로 떨어지는 순간에만 한 번 울림
  const myDangerRef = useRef(false);
  const oppDangerRef = useRef(false);
  useEffect(() => {
    if (myDanger && !myDangerRef.current) { sfx.danger(); navigator.vibrate?.([60,50,60]); }
    myDangerRef.current = myDanger;
  }, [myDanger]);
  useEffect(() => {
    if (oppDanger && !oppDangerRef.current) sfx.danger();
    oppDangerRef.current = oppDanger;
  }, [oppDanger]);
  // 누군가 위기 상태인 동안 계속되는 하트비트로 긴장감 유지
  useEffect(() => {
    if (!isFightPhase || (!myDanger && !oppDanger)) return;
    const id = setInterval(() => sfx.heartbeat(), 1100);
    return () => clearInterval(id);
  }, [isFightPhase, myDanger, oppDanger]);

  const myFrozen  = myStunVis && myStunFlavor==="ice";
  const myFeared  = myStunVis && myStunFlavor==="fear";
  const myShocked = myStunVis && myStunFlavor==="shock";
  const mySleepy  = myStunVis && myStunFlavor==="sleep";
  const myPoisoned = myStatusBadges.some(b=>b.startsWith("☠️"));
  const myBleeding = myStatusBadges.some(b=>b.startsWith("🩸"));
  const myBound    = myStatusBadges.some(b=>b.startsWith("⛓️"));
  const oppFrozen  = oppStunVis && oppStunFlavor==="ice";
  const oppFeared  = oppStunVis && oppStunFlavor==="fear";
  const oppShocked = oppStunVis && oppStunFlavor==="shock";
  const oppSleepy  = oppStunVis && oppStunFlavor==="sleep";
  const oppPoisoned = oppStatusBadges.some(b=>b.startsWith("☠️"));
  const oppBleeding = oppStatusBadges.some(b=>b.startsWith("🩸"));
  const oppBound    = oppStatusBadges.some(b=>b.startsWith("⛓️"));

  const dangerTint = myDanger&&!oppDanger ? "rgba(255,70,70,0.16)" : oppDanger&&!myDanger ? "rgba(60,220,120,0.14)" : "rgba(0,0,0,0)";
  const rootBg = battleEnv
    ? `linear-gradient(180deg, ${dangerTint} 0%, transparent 30%), ${ENV_BACKGROUNDS[battleEnv]}`
    : UI.bgGradient;

  return (
    <>
      <style>{`
        @keyframes bAttack {
          0%   { transform:translateX(0) scale(1); }
          30%  { transform:translateX(calc(var(--d) * -7px)) scale(0.95); }
          60%  { transform:translateX(calc(var(--d) * 28px)) scale(1.14); }
          100% { transform:translateX(calc(var(--d) * 20px)) scale(1.07); }
        }
        @keyframes bDodge {
          0%   { transform:translateY(0) rotate(0deg); filter:blur(0px); }
          35%  { filter:blur(3px); }
          100% { transform:translateY(-18px) rotate(calc(var(--d) * -7deg)); filter:blur(0px); }
        }
        @keyframes bHit { 0%{transform:translateX(0)}20%{transform:translateX(-10px) rotate(-3deg)}50%{transform:translateX(9px) rotate(2.5deg)}75%{transform:translateX(-5px)}100%{transform:translateX(0)} }
        @keyframes shakeScreen { 0%,100%{transform:translate(0,0)} 20%{transform:translate(-3px,2px)} 40%{transform:translate(3px,-2px)} 60%{transform:translate(-2px,1px)} 80%{transform:translate(2px,-1px)} }
        @keyframes shakeScreenBig { 0%,100%{transform:translate(0,0) rotate(0deg)} 15%{transform:translate(-7px,4px) rotate(-0.4deg)} 30%{transform:translate(7px,-4px) rotate(0.4deg)} 45%{transform:translate(-5px,3px)} 60%{transform:translate(5px,-3px)} 75%{transform:translate(-2px,1px)} }
        @keyframes impactBurst { 0%{opacity:0.95; transform:scale(0.2);} 100%{opacity:0; transform:scale(1.9);} }
        @keyframes critFlashFade { 0%{opacity:0;} 15%{opacity:1;} 100%{opacity:0;} }
        @keyframes bossIntroIn { 0%{opacity:0; transform:scale(1.04);} 100%{opacity:1; transform:scale(1);} }
        @keyframes dPop { 0%{opacity:1;transform:translateY(0)scale(1)}60%{opacity:1;transform:translateY(-26px)scale(1.25)}100%{opacity:0;transform:translateY(-42px)scale(0.9)} }
        @keyframes cdPop { 0%{opacity:0;transform:scale(0.3)}45%{opacity:1;transform:scale(1.18)}70%{transform:scale(0.94)}100%{transform:scale(1)} }
        @keyframes msgIn { 0%{opacity:0;transform:translateY(5px)}100%{opacity:1;transform:translateY(0)} }
        @keyframes resIn { 0%{opacity:0;transform:scale(0.6)}65%{transform:scale(1.1)}100%{opacity:1;transform:scale(1)} }
        @keyframes pulse { 0%,100%{box-shadow:0 0 0 0 rgba(255,50,50,0.5)}50%{box-shadow:0 0 0 6px rgba(255,50,50,0)} }

        /* 상태이상 연출 */
        @keyframes iceShimmer { 0%,100%{opacity:0.28; transform:translateX(-6%)} 50%{opacity:0.5; transform:translateX(6%)} }
        @keyframes shockFlicker { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes fearSwirl {
          0%   { transform:translateX(-50%) rotate(0deg) translateY(0); }
          50%  { transform:translateX(-50%) rotate(180deg) translateY(-4px); }
          100% { transform:translateX(-50%) rotate(360deg) translateY(0); }
        }
        @keyframes sleepFloat { 0%{transform:translateY(0); opacity:0.9} 100%{transform:translateY(-10px); opacity:0} }
        @keyframes poisonPulse { 0%,100%{opacity:0.5} 50%{opacity:0.85} }
        .poison-bubbles {
          position:absolute; inset:0;
          background-image:
            radial-gradient(circle, rgba(150,255,120,0.9) 2px, transparent 2.5px),
            radial-gradient(circle, rgba(90,220,80,0.8) 1.5px, transparent 2px);
          background-size: 26px 40px, 20px 30px;
          background-position: 22% 100%, 68% 100%;
          animation: bubble-rise 2.1s linear infinite;
        }
        @keyframes bubble-rise { 0%{background-position:22% 100%,68% 100%; opacity:0.9} 100%{background-position:22% -20%,68% -20%; opacity:0.15} }
        .bleed-drips {
          position:absolute; inset:0;
          background-image:
            linear-gradient(180deg, rgba(220,20,40,0.85), transparent 55%),
            linear-gradient(180deg, rgba(200,10,30,0.7), transparent 40%);
          background-size: 3px 22px, 3px 16px;
          background-repeat: no-repeat;
          background-position: 32% 0%, 66% 0%;
          animation: drip-fall 1.3s ease-in infinite;
        }
        @keyframes drip-fall { 0%{background-position:32% -12%,66% -16%; opacity:0} 30%{opacity:1} 100%{background-position:32% 42%,66% 48%; opacity:0} }

        /* 환경 씬 애니메이션 */
        .env-stars {
          position:absolute; inset:0;
          background-image:
            radial-gradient(circle, rgba(255,255,255,0.85) 1px, transparent 1.4px),
            radial-gradient(circle, rgba(255,255,255,0.55) 1px, transparent 1.3px);
          background-size: 90px 90px, 130px 130px;
          background-position: 10px 20px, 60px 80px;
          animation: star-twinkle 3.2s ease-in-out infinite alternate;
        }
        @keyframes star-twinkle { 0%{opacity:0.35} 100%{opacity:0.9} }

        .env-fog {
          position:absolute; inset:0;
          background-image:
            radial-gradient(ellipse 60% 30% at 20% 40%, rgba(220,224,232,0.35), transparent 70%),
            radial-gradient(ellipse 55% 25% at 80% 55%, rgba(220,224,232,0.28), transparent 70%);
          animation: fog-drift 8s ease-in-out infinite alternate;
        }
        @keyframes fog-drift { 0%{transform:translateX(-4%)} 100%{transform:translateX(4%)} }
      `}</style>

      {critFlash && <div style={{position:"fixed",inset:0,zIndex:999,background:"radial-gradient(ellipse at center, rgba(255,220,80,0.55) 0%, rgba(255,200,0,0.22) 55%, transparent 80%)",pointerEvents:"none",animation:"critFlashFade 0.45s ease-out"}}/>}

      {/* 기술명 컷인 — 내 스킬은 아래쪽·왼쪽에서, 상대 스킬은 위쪽·오른쪽에서 쓱 들어왔다 쓱 빠진다 */}
      {skillCutin && (() => {
        const fromLeft = skillCutin.side === "me";
        return (
          <div key={skillCutin.key} style={{position:"fixed",left:0,right:0,top:skillCutin.side==="me"?"62%":"20%",zIndex:998,pointerEvents:"none",display:"flex",justifyContent:"center",overflow:"hidden"}}>
            <style>{`
              @keyframes skill-slide {
                0%   { transform: translateX(${fromLeft?"-":""}110vw); opacity: 0; }
                18%  { transform: translateX(0); opacity: 1; }
                78%  { transform: translateX(0); opacity: 1; }
                100% { transform: translateX(${fromLeft?"":"-"}110vw); opacity: 0; }
              }
            `}</style>
            <div style={{
              animation:"skill-slide 1.1s cubic-bezier(0.22,1,0.36,1) forwards",
              display:"flex", alignItems:"center", gap:8, padding:"7px 22px", borderRadius:99,
              background:"rgba(255,255,255,0.96)",
              boxShadow:`inset 0 0 0 1.5px ${skillCutin.color}, 0 6px 20px rgba(2,32,71,0.22)`,
            }}>
              <span style={{fontSize:20}}>{skillCutin.icon}</span>
              <span style={{fontSize:15,fontWeight:900,color:"#191F28",letterSpacing:0.5,whiteSpace:"nowrap"}}>
                {skillCutin.name}
              </span>
            </div>
          </div>
        );
      })()}

      {/* 상태이상 컷인 — 걸린 순간 슬라이드 배너 */}
      {statusCutin && (() => {
        const meta = STATUS_CUTIN_META[statusCutin.icon] ?? { label: "상태이상", color: "#C9D4E0" };
        const fromLeft = statusCutin.side === "me";
        return (
          <div key={statusCutin.key} style={{position:"fixed",left:0,right:0,top:statusCutin.side==="me"?"56%":"26%",zIndex:997,pointerEvents:"none",display:"flex",justifyContent:"center",overflow:"hidden"}}>
            <style>{`
              @keyframes status-slide {
                0%   { transform: translateX(${fromLeft?"-":""}110vw); opacity: 0; }
                16%  { transform: translateX(0); opacity: 1; }
                80%  { transform: translateX(0); opacity: 1; }
                100% { transform: translateX(${fromLeft?"":"-"}110vw); opacity: 0; }
              }
            `}</style>
            <div style={{
              animation:"status-slide 1.35s cubic-bezier(0.22,1,0.36,1) forwards",
              display:"flex", alignItems:"center", gap:8, padding:"7px 22px", borderRadius:99,
              background:"rgba(255,255,255,0.96)",
              boxShadow:`inset 0 0 0 1.5px ${meta.color}, 0 6px 20px rgba(2,32,71,0.22)`,
            }}>
              <span style={{fontSize:20}}>{statusCutin.icon}</span>
              <span style={{fontSize:14.5,fontWeight:900,color:meta.color,whiteSpace:"nowrap"}}>
                {statusCutin.side==="me" ? "내 냥이" : "상대"} {meta.label}!
              </span>
            </div>
          </div>
        );
      })()}

      {/* 승리/패배 풀스크린 배너 — 결과 패널 공개 전 1.7초 연출 */}
      {resultBanner && (() => {
        const W = resultBanner.winner;
        const color = W === "me" ? "#F5A623" : W === "draw" ? "#4DD7FF" : "#FF5C5C";
        const big = W === "me" ? "승리!" : W === "draw" ? "무승부" : "패배...";
        const sub = W === "me" ? "VICTORY" : W === "draw" ? "DRAW" : "DEFEAT";
        const backdrop = W === "me"
          ? "radial-gradient(ellipse at 50% 42%, rgba(245,166,35,0.20) 0%, rgba(6,8,16,0.86) 62%)"
          : W === "draw"
            ? "radial-gradient(ellipse at 50% 42%, rgba(77,215,255,0.12) 0%, rgba(6,8,16,0.86) 62%)"
            : "radial-gradient(ellipse at 50% 42%, rgba(60,10,16,0.55) 0%, rgba(5,5,10,0.92) 70%)";
        return (
          <div key={resultBanner.key} style={{position:"fixed",inset:0,zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden"}}>
            <style>{`
              @keyframes resb-backdrop { 0% { opacity:0; } 10% { opacity:1; } 82% { opacity:1; } 100% { opacity:0; } }
              @keyframes resb-slam { 0% { transform:scale(2.6); opacity:0; } 30% { transform:scale(0.92); opacity:1; } 46% { transform:scale(1.06); } 60% { transform:scale(1); } 100% { transform:scale(1); opacity:1; } }
              @keyframes resb-sink { 0% { transform:translateY(-52px); opacity:0; } 38% { transform:translateY(8px); opacity:1; } 55% { transform:translateY(0); } 100% { transform:translateY(0); opacity:1; } }
              @keyframes resb-rays { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
              @keyframes resb-sweep { 0%,42% { transform:translateX(-140%) skewX(-18deg); opacity:0; } 50% { opacity:1; } 74% { transform:translateX(240%) skewX(-18deg); opacity:0; } 100% { transform:translateX(240%) skewX(-18deg); opacity:0; } }
              @keyframes resb-sub { 0%,36% { opacity:0; letter-spacing:22px; } 62% { opacity:1; letter-spacing:10px; } 82% { opacity:1; } 100% { opacity:0; } }
              @keyframes resb-out { 0%,80% { opacity:1; } 100% { opacity:0; } }
            `}</style>
            {/* 배경 딤 — 결과 패널을 잠깐 가렸다가 걷히며 공개 */}
            <div style={{position:"absolute",inset:0,background:backdrop,animation:"resb-backdrop 1.7s ease forwards"}}/>
            {/* 승리 한정 회전 광선 */}
            {W === "me" && (
              <div style={{position:"absolute",left:"50%",top:"42%",width:"160vmax",height:"160vmax",marginLeft:"-80vmax",marginTop:"-80vmax",
                background:`repeating-conic-gradient(from 0deg, ${color}1F 0deg 9deg, transparent 9deg 24deg)`,
                WebkitMaskImage:"radial-gradient(circle, black 0%, transparent 58%)", maskImage:"radial-gradient(circle, black 0%, transparent 58%)",
                animation:"resb-rays 14s linear infinite, resb-out 1.7s ease forwards"}}/>
            )}
            <div style={{position:"relative",display:"flex",flexDirection:"column",alignItems:"center",gap:2,marginTop:"-8vh",animation:"resb-out 1.7s ease forwards"}}>
              <div style={{fontSize:56,lineHeight:1,animation:`${W==="opponent"?"resb-sink":"resb-slam"} 1.7s cubic-bezier(0.22,1,0.36,1) forwards`,
                filter:`drop-shadow(0 0 22px ${color}55)`}}>
                {W==="me" ? (isBossBattle?"🎉":"🏆") : W==="draw" ? "🤝" : "💔"}
              </div>
              <div style={{position:"relative",overflow:"hidden",padding:"4px 28px",animation:`${W==="opponent"?"resb-sink":"resb-slam"} 1.7s cubic-bezier(0.22,1,0.36,1) forwards`}}>
                <span style={{
                  fontSize:58, fontWeight:900, letterSpacing:2, whiteSpace:"nowrap",
                  background:W==="me" ? "linear-gradient(180deg, #FFF3CF 8%, #FFD269 38%, #F5A623 62%, #B36F0E 95%)"
                    : W==="draw" ? "linear-gradient(180deg, #E6FAFF 10%, #4DD7FF 55%, #1C8FBF 95%)"
                    : "linear-gradient(180deg, #FFD9D9 10%, #FF5C5C 55%, #99262B 95%)",
                  WebkitBackgroundClip:"text", backgroundClip:"text", color:"transparent",
                  filter:`drop-shadow(0 0 18px ${color}66) drop-shadow(0 3px 10px rgba(0,0,0,0.85))`,
                }}>{big}</span>
                {/* 하이라이트 스윕 */}
                <div style={{position:"absolute",inset:0,width:"46%",background:"linear-gradient(90deg, transparent, rgba(255,255,255,0.32), transparent)",
                  animation:"resb-sweep 1.7s ease forwards",pointerEvents:"none"}}/>
              </div>
              <span style={{fontSize:16,fontWeight:700,color,
                textShadow:`0 0 14px ${color}88`,animation:"resb-sub 1.7s ease forwards",whiteSpace:"nowrap"}}>{sub}</span>
            </div>
          </div>
        );
      })()}

      {/* PVP 콜드스타트 폴백 토스트 — 도전자가 없어 PVE로 자동 전환됐음을 알린다 */}
      {pvpFallbackNotice && (
        <div style={{ position:"fixed", top:"calc(env(safe-area-inset-top, 0px) + 16px)", left:"50%", zIndex:1200, pointerEvents:"none", transform:"translateX(-50%)", width:"min(92vw, 400px)" }}>
          <style>{`@keyframes pvpFallbackIn { 0% { transform:translateY(-24px); opacity:0; } 12% { transform:translateY(0); opacity:1; } 88% { transform:translateY(0); opacity:1; } 100% { transform:translateY(-14px); opacity:0; } }`}</style>
          <div style={{
            display:"flex", alignItems:"center", gap:10, padding:"12px 16px", borderRadius:14,
            background:"rgba(12,16,26,0.96)",
            boxShadow:`inset 0 0 0 1.5px ${UI.accent.blue}, 0 0 18px ${UI.accent.blue}44, 0 6px 18px rgba(0,0,0,0.5)`,
            animation:"pvpFallbackIn 4.5s ease forwards",
          }}>
            <span style={{ flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", width:32, height:32, borderRadius:"50%", background:`${UI.accent.blue}22`, color:UI.accent.blue }}>
              <Swords size={16}/>
            </span>
            <p style={{ margin:0, fontSize:12.5, fontWeight:700, lineHeight:1.5, color:"#F5F0FF" }}>
              아직 도전자가 없어요 — <span style={{ color:UI.accent.blue }}>동네 불청객과 몸 풀기 한 판</span> 어때요?
            </p>
          </div>
        </div>
      )}

      {showBossIntro && (
        <div style={{ position:"fixed", inset:0, zIndex:998, background:"#0A0A18", animation:"bossIntroIn 0.4s ease", display:"flex", flexDirection:"column" }}>
          {opponent?.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={opponent.photo_url} alt={opponent.name} style={{ flex:1, width:"100%", minHeight:0, objectFit:"contain" }} />
          ) : (
            <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <span style={{ fontSize:140 }}>{opponent?.placeholder_emoji ?? "❓"}</span>
            </div>
          )}
          <div style={{ marginLeft:16, marginRight:16, marginBottom:"max(24px, env(safe-area-inset-bottom))", padding:"16px 18px", borderRadius:14, background:"rgba(20,20,28,0.96)", border:"2px solid #CC3333", boxShadow:"0 0 24px rgba(200,40,40,0.35)" }}>
            <p style={{ color:"white", fontWeight:800, fontSize:15, lineHeight:1.6, margin:0 }}>
              {opponent?.name ?? "적"} 등장!
            </p>
          </div>
        </div>
      )}

      <div className="min-h-dvh flex flex-col" style={{
        background:rootBg, transition:"background 1.2s", position:"relative", zIndex:0,
        animation: screenShake===2 ? "shakeScreenBig 0.45s ease" : screenShake===1 ? "shakeScreen 0.3s ease" : undefined,
      }}>
        {/* HD-2D 베이스 배경(전체 화면 무드용) — 전투 씬이 뜨면 씬 안의 배경으로 대체 */}
        {battleBase && !isFightPhase && (
          <div style={{ position:"absolute", top:0, left:0, right:0, zIndex:0, pointerEvents:"none",
            aspectRatio:"394/540",
            backgroundImage:`url(${battleBase.src})`, backgroundSize:"100% 100%",
            imageRendering:"pixelated" }}>
            {/* 임시 환경 틴트 — 날씨/시간 오버레이 이미지가 들어오기 전까지의 무드 보정 */}
            {battleEnv && battleEnv !== "noon" && (
              <div style={{ position:"absolute", inset:0, background: {
                night: "linear-gradient(180deg, rgba(16,24,64,0.55) 0%, rgba(14,20,52,0.4) 100%)",
                rain:  "rgba(58,76,104,0.38)",
                heat:  "linear-gradient(180deg, rgba(255,120,50,0.22) 0%, rgba(180,60,80,0.18) 100%)",
                fog:   "rgba(188,188,210,0.3)",
                snow:  "rgba(198,218,244,0.26)",
                noon:  "transparent",
              }[battleEnv], transition:"background 1s" }} />
            )}
            <div style={{ position:"absolute", left:0, right:0, bottom:0, height:"26%",
              background:"linear-gradient(180deg, transparent 0%, rgba(242,244,246,0.96) 88%)" }} />
          </div>
        )}
        <EnvScene env={battleEnv} hideDecor={battleBase !== null} />
        {/* 저체력 하트비트 — 내 HP 25% 미만이면 화면 가장자리가 붉게 조여온다 */}
        {isFightPhase && myDanger && <div className="danger-vignette" />}
        <div style={{ position:"absolute", inset:0, zIndex:1, pointerEvents:"none", opacity:0.5, ...gridOverlayStyle() }} />

        {/* 헤더 — 배틀 중엔 떠 있는 아이콘만 남기고 최소화 */}
        <div className={`flex items-center gap-3 px-4 shrink-0 ${isFightPhase ? "pt-3 pb-1" : "pt-4 pb-3"}`}
          style={isFightPhase ? undefined : {background:"linear-gradient(180deg, rgba(242,244,246,0.9) 0%, rgba(242,244,246,0) 100%)"}}>
          <button onClick={()=>{reset();router.push("/catch");}} aria-label="지도로 돌아가기" className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{background:"rgba(255,255,255,0.85)", boxShadow: `inset 0 0 0 1px ${UI.panelBorder}`}}>
            <ArrowLeft size={18} color={UI.textMain}/>
          </button>
          {!isFightPhase && <h1 className="text-[17px] font-extrabold flex items-center gap-2" style={{color:UI.textMain}}><StickerIcon icon={Swords} color={UI.accent.blue} size={30}/> 카드 배틀</h1>}
          {isFightPhase && mode==="auto" && (
            <button onClick={()=>{ sfx.click(); setAutoSpeed(s=>s===1?2:s===2?3:1); }}
              className="ml-auto"
              style={{ fontSize:11, fontWeight:800, padding:"4px 10px", borderRadius:999, color:UI.accent.blue, background:`${UI.accent.blue}22` }}>
              {autoSpeed}배속
            </button>
          )}
          {isFightPhase && mode!=="auto" && <span className="ml-auto text-[12px] font-bold" style={{color:UI.textSub}}>{turnCount}턴</span>}
          {!isFightPhase && (
            <button onClick={()=>router.push("/catch/ranking")} aria-label="주간 랭킹" className="ml-auto w-9 h-9 rounded-full flex items-center justify-center"
              style={{background:"rgba(255,255,255,0.85)", boxShadow: `inset 0 0 0 1px ${UI.panelBorder}`}}>
              <Trophy size={16} color={UI.textSub}/>
            </button>
          )}
          <SfxToggle style={isFightPhase ? { marginLeft: "auto" } : undefined}/>
        </div>

        {/* ──────── 선택 화면(대기실) ──────── */}
        {(phase==="select"||phase==="loading") && (
          <div className="flex-1 overflow-y-auto px-4 pb-6 w-full" style={{ maxWidth: 520, margin: "0 auto" }}>
            {/* 누구와 싸울지 */}
            <p className="text-[10px] font-extrabold tracking-widest mt-4 mb-2" style={{ color: UI.textMuted }}>MATCH TYPE</p>
            <div className="flex gap-2 mb-2.5">
              {([
                { key:"pve" as const, label:"🐾 동네 불청객과 대결", color: UI.accent.red },
                { key:"pvp" as const, label:"⚔️ 다른 유저와 대결", color: UI.accent.blue },
              ]).map(bt=>(
                <button key={bt.key} onClick={()=>setBattleType(bt.key)}
                  className="flex-1"
                  style={{
                    padding:"12px 4px", fontSize:12.5, fontWeight:800, borderRadius:UI.radiusSm,
                    background: battleType===bt.key ? `${bt.color}1F` : UI.panel,
                    boxShadow: battleType===bt.key ? `inset 0 0 0 1.5px ${bt.color}` : `inset 0 0 0 1px ${UI.panelBorder}`,
                    color: battleType===bt.key ? bt.color : UI.textSub,
                    transition:"transform 0.08s",
                  }}>
                  {bt.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-center mb-4 font-semibold" style={{ color: battleType==="pve" ? UI.accent.red : UI.accent.blue }}>
              {battleType==="pve" ? "언제든 도전할 수 있는 PVE — 이겨도 져도 코인은 받아요" : "실제 다른 집사의 냥이 카드와 겨루는 PVP"}
            </p>

            {/* 어떻게 싸울지 — 수동(직접 조작)/자동(시뮬레이션) */}
            <p className="text-[10px] font-extrabold tracking-widest mb-2" style={{ color: UI.textMuted }}>MODE</p>
            <div className="flex gap-2 mb-4">
              {(["manual","auto"] as Mode[]).map(m=>(
                <button key={m} onClick={()=>setMode(m)}
                  className="flex-1"
                  style={{
                    padding:"12px 0", fontSize:13, fontWeight:800, borderRadius:UI.radiusSm,
                    background: mode===m ? `${UI.accent.blue}1F` : UI.panel,
                    boxShadow: mode===m ? `inset 0 0 0 1.5px ${UI.accent.blue}` : `inset 0 0 0 1px ${UI.panelBorder}`,
                    color: mode===m ? UI.accent.blue : UI.textSub,
                    transition:"transform 0.08s",
                  }}>
                  {m==="manual"?"🎮 수동 전투":"⚡ 자동 전투"}
                </button>
              ))}
            </div>
            {mode==="manual"&&<p className="text-[11px] text-center mb-4 font-semibold" style={{color:UI.textSub}}>턴마다 기술을 직접 선택! 6초 안에 고르세요</p>}

            <p className="text-[10px] font-extrabold tracking-widest mb-3" style={{ color: UI.textMuted }}>SELECT YOUR CAT</p>
            {error&&<p className="text-[13px] mb-3 text-center font-semibold" style={{ color: UI.accent.red }}>{error}</p>}
            <div className="grid grid-cols-2 gap-3 mb-6 justify-items-center">
              {myCats.map(cat=>(
                <div key={cat.id}
                  style={{
                    outline:selected?.id===cat.id?`3px solid ${UI.accent.blue}`:"2px solid transparent",outlineOffset:2,borderRadius:20,
                    filter:selected?.id===cat.id?`drop-shadow(0 0 10px ${UI.accent.blue}66)`:undefined,
                    transition:"transform 0.12s, filter 0.15s",transform:selected?.id===cat.id?"scale(1.02)":"scale(1)",
                  }}>
                  <CatCard name={cat.name} photoUrl={artUrl(cat)} card={toCard(cat)} size="sm"
                    onClick={()=>phase==="select"&&setSelected(s=>s?.id===cat.id?null:cat)}/>
                  {selected?.id===cat.id&&<div className="text-center text-[10px] font-bold mt-1" style={{ color: UI.accent.blue }}>✓ 선택됨</div>}
                </div>
              ))}
            </div>
            {myCats.length===0&&(
              <div className="text-center py-16">
                <p className="text-[14px] mb-4" style={{ color: UI.textSub }}>아직 카드가 없어요. 지도에서 야생냥이를 포획하면 카드가 생겨요!</p>
                <button onClick={()=>router.push("/catch")}
                  className="px-5 py-2.5 rounded-full text-[12.5px] font-black text-white"
                  style={{ background: UI.accent.blue, boxShadow: "0 3px 0 #1B64DA" }}>
                  지도 열기
                </button>
              </div>
            )}
            {selected&&(
              <button onClick={()=>startBattle()} disabled={phase==="loading"}
                className="w-full relative overflow-hidden text-white"
                style={{
                  padding:"16px 0", fontSize:15, fontWeight:800, display:"flex", alignItems:"center", justifyContent:"center", gap:8,
                  borderRadius:UI.radius, background: UI.accent.blue,
                  boxShadow:`0 4px 14px ${UI.accent.blue}55`,
                  opacity:phase==="loading"?0.6:1,
                }}>
                {phase==="loading"?<span className="animate-pulse">상대 찾는 중...</span>:<><Swords size={18}/> 배틀 시작!</>}
              </button>
            )}
          </div>
        )}

        {/* ──────── 카운트다운 ──────── */}
        {phase==="countdown"&&(
          <div className="flex-1 flex flex-col items-center justify-center">
            <div key={countdown} style={{fontSize:countdown===0?64:100,fontWeight:900,color:countdown===0?"#FF8A3D":UI.textMain,textShadow:"0 4px 20px rgba(0,0,0,0.3)",animation:"cdPop 0.55s ease forwards"}}>
              {countdown===0?"GO!":countdown}
            </div>
          </div>
        )}

        {/* ──────── 배틀 화면 ──────── */}
        {(isFightPhase||phase==="animating") && selected && opponent && (
          <div className="flex-1 flex flex-col px-4 gap-2 w-full" style={{paddingTop:8,paddingBottom:8,maxWidth:430,margin:"0 auto"}}>

            {/* 전투 씬 — 배경 이미지 원본 비율 박스. 이미지 속 플랫폼 좌표에 카드를 정렬 */}
            <div style={{position:"relative", width:"min(100%, calc((100dvh - 450px) * 394 / 540))", aspectRatio:"394/540", overflow:"visible", margin:"0 auto"}}>
              {battleBase && (
                <div style={{ position:"absolute", inset:0, zIndex:0, pointerEvents:"none", borderRadius:14, overflow:"hidden",
                  backgroundImage:`url(${battleBase.src})`, backgroundSize:"100% 100%", imageRendering:"pixelated" }}>
                  {/* 날씨/시간 오버레이 — CSS+SVG 레이어 */}
                  <BattleWeather env={battleEnv} />
                </div>
              )}
              {/* 환경 필 — 씬 좌상단 */}
              {battleEnv && (
                <span style={{
                  position:"absolute", top:8, left:8, zIndex:5,
                  fontSize:10, fontWeight:800, color:"#191F28",
                  background:"rgba(255,255,255,0.92)", borderRadius:999, padding:"4px 10px",
                  boxShadow:"inset 0 0 0 1px rgba(141,180,220,0.25)", backdropFilter:"blur(4px)",
                }}>
                  {BATTLE_ENVS[battleEnv].emoji} {BATTLE_ENVS[battleEnv].name} · {BATTLE_ENVS[battleEnv].desc}
                </span>
              )}
              {/* 내 카드 — 초록 플랫폼 위 */}
              <div style={{position:"absolute", left:"26.5%", bottom:"0.5%", transform:"translateX(-50%) scale(0.72)", transformOrigin:"bottom center", zIndex:3}}>
                <div style={{position:"relative"}}>
                  {myDanger&&<div style={{position:"absolute",top:-8,left:"50%",transform:"translateX(-50%)",zIndex:10,background:"#FF3333",color:"white",fontSize:9,fontWeight:900,padding:"2px 6px",borderRadius:99,whiteSpace:"nowrap"}}>⚠️ 위기</div>}
                  {myStunVis&&<div style={{position:"absolute",top:-8,left:"50%",transform:"translateX(-50%)",zIndex:10,background:"#8800CC",color:"white",fontSize:9,fontWeight:900,padding:"2px 6px",borderRadius:99,whiteSpace:"nowrap"}}>{(myStunFlavor && STUN_LABEL[myStunFlavor]) || "💫 기절"}</div>}
                  {myStatusBadges.length>0&&(
                    <div style={{position:"absolute",top:-8,right:-4,zIndex:10,display:"flex",flexDirection:"column",gap:2}}>
                      {myStatusBadges.map((b,i)=>(<span key={i} style={{background:"rgba(0,0,0,0.75)",color:"#FFAA88",fontSize:9,fontWeight:900,padding:"1px 5px",borderRadius:99,whiteSpace:"nowrap"}}>{b}</span>))}
                    </div>
                  )}
                  <div style={cardStyle(myAnim,"left")}><CatCard name={selected.name} photoUrl={artUrl(selected)} card={toCard(selected)} size="battle"/></div>
                  <StatusFx frozen={myFrozen} feared={myFeared} shocked={myShocked} sleepy={mySleepy} poisoned={myPoisoned} bleeding={myBleeding} bound={myBound}/>
                  <ParticleCanvas ref={myParticleRef} zIndex={9}/>
                  {impactBurst?.side==="me" && (
                    <div style={{
                      position:"absolute", inset:"-14px", zIndex:8, pointerEvents:"none", borderRadius:"50%",
                      background: impactBurst.color
                        ? `radial-gradient(circle, rgba(${impactBurst.color},0.95) 0%, rgba(${impactBurst.color},0.5) 45%, transparent 72%)`
                        : impactBurst.big
                          ? "radial-gradient(circle, rgba(255,220,80,0.9) 0%, rgba(255,150,0,0.5) 45%, transparent 72%)"
                          : "radial-gradient(circle, rgba(255,255,255,0.85) 0%, transparent 68%)",
                      animation:"impactBurst 0.35s ease-out forwards",
                    }}/>
                  )}
                  {dmgPopup?.target==="me"&&(
                    <div key={`me${Date.now()}`} style={{position:"absolute",top:"25%",left:"50%",transform:"translateX(-50%)",fontWeight:900,color:dmgPopup.msg?.includes("효과는 굉장했다")?"#FF7A3C":dmgPopup.isCrit?"#FFD700":"white",fontSize:dmgPopup.msg?.includes("효과는 굉장했다")?14.5:dmgPopup.msg?13:18,textShadow:"0 2px 8px rgba(0,0,0,0.9)",animation:"dPop 0.8s ease forwards",pointerEvents:"none",whiteSpace:"nowrap"}}>
                      {dmgPopup.msg||(dmgPopup.val>0?`-${dmgPopup.val}`:"")}
                    </div>
                  )}
                  {myGuardVis&&<div style={{position:"absolute",bottom:-4,left:"50%",transform:"translateX(-50%)",fontSize:9,color:"#4488FF",fontWeight:900,whiteSpace:"nowrap"}}>🛡️ 방어중</div>}
                </div>
              </div>

              {/* 중앙 메시지 — 두 플랫폼 사이 대각선 가운데 */}
              <div className="flex flex-col items-center" style={{position:"absolute", left:"50%", top:"52%", transform:"translate(-50%,-50%)", zIndex:4, minWidth:48}}>
                <span style={{
                  position:"relative", overflow:"hidden",
                  width:40, height:40, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:13, fontWeight:900, color:"#fff", letterSpacing:0.5, flexShrink:0,
                  background:"linear-gradient(160deg,#A9CCFF 0%,#5C93F0 45%,#1B64DA 100%)",
                  boxShadow:"0 0 0 3px #fff, 0 4px 10px rgba(27,100,218,0.45), 0 1px 3px rgba(27,100,218,0.3), inset 0 -2px 4px rgba(30,50,110,0.35)",
                }}>
                  <span aria-hidden="true" style={{ position:"absolute", inset:0, top:0, height:"55%", background:"linear-gradient(180deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0) 100%)", borderRadius:"999px 999px 0 0" }} />
                  <span style={{ position:"relative", textShadow:"0 1px 2px rgba(20,40,100,0.4)" }}>VS</span>
                </span>
                {actionMsg&&!actionMsg.includes("기술을 선택")&&<div key={actionMsg} style={{fontSize:9,fontWeight:800,color:"#1B64DA",textShadow:"0 1px 3px rgba(255,255,255,0.8)",textAlign:"center",maxWidth:60,lineHeight:1.3,marginTop:4,animation:"msgIn 0.3s ease"}}>{actionMsg}</div>}
              </div>

              {/* 상대 카드 — 빨강 플랫폼 위, 원근감으로 살짝 작게 */}
              <div style={{position:"absolute", left:"74.5%", bottom:"33%", zIndex:2, transform:"translateX(-50%) scale(0.57)", transformOrigin:"bottom center"}}>
                <div style={{position:"relative"}}>
                  {oppDanger&&<div style={{position:"absolute",top:-8,left:"50%",transform:"translateX(-50%)",zIndex:10,background:"#FF3333",color:"white",fontSize:9,fontWeight:900,padding:"2px 6px",borderRadius:99,whiteSpace:"nowrap"}}>⚠️ 위기</div>}
                  {oppStunVis&&<div style={{position:"absolute",top:-8,left:"50%",transform:"translateX(-50%)",zIndex:10,background:"#8800CC",color:"white",fontSize:9,fontWeight:900,padding:"2px 6px",borderRadius:99,whiteSpace:"nowrap"}}>{(oppStunFlavor && STUN_LABEL[oppStunFlavor]) || "💫 기절"}</div>}
                  {oppStatusBadges.length>0&&(
                    <div style={{position:"absolute",top:-8,right:-4,zIndex:10,display:"flex",flexDirection:"column",gap:2}}>
                      {oppStatusBadges.map((b,i)=>(<span key={i} style={{background:"rgba(0,0,0,0.75)",color:"#FFAA88",fontSize:9,fontWeight:900,padding:"1px 5px",borderRadius:99,whiteSpace:"nowrap"}}>{b}</span>))}
                    </div>
                  )}
                  <div style={cardStyle(oppAnim,"right")}><CatCard name={opponent.name} photoUrl={artUrl(opponent)} card={toCard(opponent)} size="battle"/></div>
                  <StatusFx frozen={oppFrozen} feared={oppFeared} shocked={oppShocked} sleepy={oppSleepy} poisoned={oppPoisoned} bleeding={oppBleeding} bound={oppBound}/>
                  <ParticleCanvas ref={oppParticleRef} zIndex={9}/>
                  {impactBurst?.side==="opp" && (
                    <div style={{
                      position:"absolute", inset:"-14px", zIndex:8, pointerEvents:"none", borderRadius:"50%",
                      background: impactBurst.color
                        ? `radial-gradient(circle, rgba(${impactBurst.color},0.95) 0%, rgba(${impactBurst.color},0.5) 45%, transparent 72%)`
                        : impactBurst.big
                          ? "radial-gradient(circle, rgba(255,220,80,0.9) 0%, rgba(255,150,0,0.5) 45%, transparent 72%)"
                          : "radial-gradient(circle, rgba(255,255,255,0.85) 0%, transparent 68%)",
                      animation:"impactBurst 0.35s ease-out forwards",
                    }}/>
                  )}
                  {dmgPopup?.target==="opp"&&(
                    <div key={`op${Date.now()}`} style={{position:"absolute",top:"25%",left:"50%",transform:"translateX(-50%)",fontWeight:900,color:dmgPopup.msg?.includes("효과는 굉장했다")?"#FF7A3C":dmgPopup.isCrit?"#FFD700":"white",fontSize:dmgPopup.msg?.includes("효과는 굉장했다")?14.5:dmgPopup.msg?13:18,textShadow:"0 2px 8px rgba(0,0,0,0.9)",animation:"dPop 0.8s ease forwards",pointerEvents:"none",whiteSpace:"nowrap"}}>
                      {dmgPopup.msg||(dmgPopup.val>0?`-${dmgPopup.val}`:"")}
                    </div>
                  )}
                  {oppGuardVis&&<div style={{position:"absolute",bottom:-4,left:"50%",transform:"translateX(-50%)",fontSize:9,color:"#4488FF",fontWeight:900,whiteSpace:"nowrap"}}>🛡️ 방어중</div>}
                </div>
              </div>
            </div>

            {/* HP 바 줄 — 양쪽 HP + 가운데 안내 문구 */}
            <div className="flex items-center gap-2">
              <div style={{flex:1}}>
                <div className="flex justify-between text-[9px] mb-0.5">
                  <span style={{color:myDanger?UI.accent.red:UI.textSub,fontWeight:700}}>HP</span>
                  <span style={{color:myDanger?UI.accent.red:UI.textMuted,fontWeight:700}}>{myHp}/{myMaxHp}</span>
                </div>
                <HpBar current={myHp} max={myMaxHp}/>
              </div>
              <span style={{fontSize:9,fontWeight:700,color:UI.textMuted,flexShrink:0,whiteSpace:"nowrap"}}>
                {(selected?.win_streak ?? 0) > 0 ? `🔥${selected!.win_streak}연승 중` : mode==="auto"?"⚡ 자동 전투 중":"기술을 선택하세요!"}
              </span>
              <div style={{flex:1}}>
                <div className="flex justify-between text-[9px] mb-0.5">
                  <span style={{color:oppDanger?UI.accent.red:UI.textSub,fontWeight:700}}>HP</span>
                  <span style={{color:oppDanger?UI.accent.red:UI.textMuted,fontWeight:700}}>{oppHp}/{oppMaxHp}</span>
                </div>
                <HpBar current={oppHp} max={oppMaxHp}/>
              </div>
            </div>

            {/* 수동: 자동전투 토글 + 타이머 바 */}
            {mode==="manual"&&(
              <div className="flex items-center gap-2">
                <button onClick={()=>setAutoPilot(a=>!a)}
                  style={{
                    fontSize:9.5, fontWeight:800, padding:"5px 10px", whiteSpace:"nowrap", borderRadius:999,
                    background: autoPilot ? `${UI.accent.blue}22` : UI.panel,
                    color: autoPilot ? UI.accent.blue : UI.textSub,
                    boxShadow: autoPilot ? `inset 0 0 0 1px ${UI.accent.blue}` : `inset 0 0 0 1px ${UI.panelBorder}`,
                  }}>
                  ⚡ 자동전투 {autoPilot?"ON":"OFF"}
                </button>
                <div style={{flex:1, height:16, borderRadius:999, background:"rgba(2,32,71,0.10)", overflow:"hidden", position:"relative", display:"flex", alignItems:"center"}}>
                  {!autoPilot && (
                    <div style={{height:"100%",width:`${(timerLeft/6)*100}%`,borderRadius:999,transition:"width 0.9s linear",background:timerLeft<=2?"linear-gradient(90deg,#FF9C9C,#FF6B6B)":timerLeft<=4?"linear-gradient(90deg,#FFDA7C,#FFB84D)":"linear-gradient(90deg,#9CC4FF,#6B9DFF)",animation:timerLeft<=2?"pulse 0.6s infinite":undefined}}/>
                  )}
                  <Heart size={11} fill="#fff" color="#fff" style={{position:"absolute", left:"50%", top:"50%", transform:"translate(-50%,-50%)", filter:"drop-shadow(0 1px 2px rgba(0,0,0,0.25))"}}/>
                </div>
              </div>
            )}

            {/* 기술 버튼 — 수동: 조작 / 자동: 관전용(사용 스킬이 빛남) */}
            <div>
              {mode==="manual"&&phase==="player_choose"&&(
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold flex items-center gap-1.5" style={{color:UI.textSub}}>
                    {autoPilot?"자동으로 선택 중...":"기술 선택"}
                    {turnCount>8 && (
                      <span className="px-1.5 py-0.5 rounded-md text-[9.5px] font-black"
                        style={{background:"rgba(255,92,92,0.16)", color:"#E5484D", boxShadow:"inset 0 0 0 1px rgba(255,92,92,0.4)", animation:"pulse 1.2s infinite"}}>
                        ⚡ 격전 +{Math.min(50,(turnCount-8)*5)}%
                      </span>
                    )}
                  </span>
                  {!autoPilot && <span className="text-[13px] font-black" style={{color:timerLeft<=2?UI.accent.red:timerLeft<=4?"#FF8A3D":UI.accent.blue}}>{timerLeft}s</span>}
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 mb-2.5">
                {mySkills.slice(SKILL_START_IDX).map((sk,j)=>{
                  const i = SKILL_START_IDX + j;
                  return (
                    <div key={i} style={autoCastName===sk.name ? {borderRadius:16, boxShadow:`0 0 0 2px ${sk.color}, 0 0 18px ${sk.color}`, transition:"box-shadow 0.15s"} : undefined}>
                      <SkillBtn skill={sk} idx={i} disabled={mode==="auto"||phase!=="player_choose"} cooldown={mySkillCd[i]} onPick={pickSkill}/>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-2">
                {mySkills.slice(0, SKILL_START_IDX).map((sk,i)=>(
                  <div key={i} style={{flex:1, ...(autoCastName===sk.name ? {borderRadius:16, boxShadow:`0 0 0 2px ${sk.color}, 0 0 18px ${sk.color}`} : {})}}>
                    <SkillBtn skill={sk} idx={i} disabled={mode==="auto"||phase!=="player_choose"} cooldown={mySkillCd[i]}
                      usesLeft={i===GUARD_IDX?myGuardUses:undefined} onPick={pickSkill} variant="primary"/>
                  </div>
                ))}
              </div>

              {phase==="opp_thinking"&&(
                <p className="text-center text-[11px] mt-2 animate-pulse font-semibold" style={{color:UI.textSub}}>{actionMsg}</p>
              )}
            </div>

            {/* 자동: 액션 메시지 */}
            {mode==="auto"&&actionMsg&&(
              <div style={{
                padding:"11px 16px", textAlign:"center", borderRadius:16,
                background:UI.panel, boxShadow:`inset 0 0 0 1px ${UI.panelBorder}`,
              }}>
                <p key={actionMsg} style={{ fontSize:13.5, fontWeight:700, color:UI.textMain, letterSpacing:0.2, animation:"msgIn 0.3s ease" }}>{actionMsg}</p>
              </div>
            )}
          </div>
        )}

        {/* ──────── 결과 화면 ──────── */}
        {/* 결과 패널은 승리/패배 배너가 걷힌 뒤에 등장 */}
        {phase==="result"&&selected&&opponent&&battleResult&&!resultBanner&&(
          <div className="flex-1 flex flex-col items-center justify-center px-4 gap-4">
            <div style={{animation:"resIn 0.5s ease forwards",display:"flex",flexDirection:"column",alignItems:"center",gap:12,width:"100%",maxWidth:340}}>
              <div style={{fontSize:64}}>{battleResult.winner==="me"?(isBossBattle?"🎉":"🏆"):battleResult.winner==="draw"?"🤝":"💔"}</div>
              <p style={{fontSize:26,fontWeight:900,color:battleResult.winner==="me"?"#3FCB6B":battleResult.winner==="draw"?"#F5A623":UI.accent.red}}>
                {battleResult.winner==="draw"
                  ? (isBossBattle ? `${opponent?.name??"적"}과 무승부...` : "무승부!")
                  : isBossBattle
                    ? (battleResult.winner==="me" ? `${opponent?.name??"적"} 격퇴!` : `${opponent?.name??"적"}에게 당했다...`)
                    : (battleResult.winner==="me" ? "승리!" : "패배...")}
              </p>
              {isBossBattle && !!opponent?.photo_url && battleResult.winner==="me" && (
                <p className="text-[12px] font-bold -mt-2" style={{color:"#F5A623"}}>🐾 갇혀있던 냥이를 구했다!</p>
              )}
              {typeof battleResult.coinsGained==="number" && (
                <p className="text-[13px] font-bold -mt-1" style={{color:"#F5A623"}}>💰 코인 +{battleResult.coinsGained}</p>
              )}
              <p className="text-[13px] font-semibold" style={{color:UI.textSub}}>
                {turnCount}턴 · EXP +{battleResult.exp}
                {battleResult.leveledUp&&<span style={{color:"#F5A623",fontWeight:800,marginLeft:8}}>⬆ Lv.{battleResult.newLevel}!</span>}
              </p>
              <div className="w-full space-y-2 p-3" style={{ borderRadius:UI.radius, background:UI.panel, boxShadow:`inset 0 0 0 1px ${UI.panelBorder}` }}>
                <div className="flex gap-3 items-center">
                  <span className="text-[11px] font-bold shrink-0 w-14 truncate" style={{color:UI.accent.blue}}>{selected.name}</span>
                  <div style={{flex:1}}><HpBar current={myHp} max={myMaxHp}/></div>
                  <span className="text-[10px] shrink-0" style={{color:UI.textSub}}>{myHp}/{myMaxHp}</span>
                </div>
                <div className="flex gap-3 items-center">
                  <span className="text-[11px] font-bold shrink-0 w-14 truncate" style={{color:UI.textSub}}>{opponent.name}</span>
                  <div style={{flex:1}}><HpBar current={oppHp} max={oppMaxHp}/></div>
                  <span className="text-[10px] shrink-0" style={{color:UI.textSub}}>{oppHp}/{oppMaxHp}</span>
                </div>
              </div>
              <div className="flex gap-2 w-full">
                <button onClick={reset} className="flex-1"
                  style={{ padding:"12px 0", fontSize:13, fontWeight:800, color:UI.textSub, borderRadius:UI.radiusSm, background:UI.panel, boxShadow:`inset 0 0 0 1px ${UI.panelBorder}` }}>
                  다시 선택
                </button>
                <button onClick={()=>startBattle()} className="flex-1 text-white"
                  style={{ padding:"12px 0", fontSize:13, fontWeight:800, display:"flex", alignItems:"center", justifyContent:"center", gap:6, borderRadius:UI.radiusSm, background:UI.accent.blue, boxShadow:`0 4px 14px ${UI.accent.blue}55` }}>
                  <Swords size={14}/> 재도전
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
