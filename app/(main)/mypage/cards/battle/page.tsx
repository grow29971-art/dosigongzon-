"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Swords, Zap, Shield, Sparkles, Flame, Star } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import CatCard, { type CatCardData, type CardRarity } from "@/app/components/CatCard";
import { SPECIAL_SKILLS } from "@/lib/battle-config";
import { SHOP_ITEMS, BATTLE_ITEM_KEYS, type ShopItemKey } from "@/lib/shop-config";
import ParticleCanvas, { type ParticleCanvasHandle } from "@/app/components/ParticleCanvas";
import SfxToggle from "@/app/components/SfxToggle";
import { sfx, primeSfx } from "@/lib/sfx";

/* ──────────── 배틀 환경 ──────────── */
const BATTLE_ENVS = {
  night:  { emoji:"🌙", name:"심야 골목",  desc:"회피+15%",         evaBonus:15,  critBonus:0,   dmgMult:1.0,  dotMult:1.0 },
  noon:   { emoji:"☀️", name:"한낮 광장",  desc:"크리티컬+10%",     evaBonus:0,   critBonus:10,  dmgMult:1.0,  dotMult:1.0 },
  rain:   { emoji:"🌧️", name:"빗속 골목", desc:"독·출혈 피해 2배",  evaBonus:0,   critBonus:0,   dmgMult:1.0,  dotMult:2.0 },
  heat:   { emoji:"🔥", name:"여름 골목",  desc:"데미지+15%",        evaBonus:0,   critBonus:0,   dmgMult:1.15, dotMult:1.0 },
  fog:    { emoji:"🌫️", name:"안개 골목", desc:"회피+20%/크리티컬↓", evaBonus:20,  critBonus:-10, dmgMult:1.0,  dotMult:1.0 },
} as const;
type BattleEnvKey = keyof typeof BATTLE_ENVS;
const ENV_KEYS = Object.keys(BATTLE_ENVS) as BattleEnvKey[];

// 환경별 배경 (레이어드 그라디언트, 이미지 없이 CSS만으로 — 뚜렷하게 구분되도록 채도/명도 차이를 크게)
const ENV_BACKGROUNDS: Record<BattleEnvKey, string> = {
  night: "radial-gradient(circle at 20% 10%, rgba(160,180,255,0.35), transparent 30%), radial-gradient(circle at 82% 6%, rgba(220,220,255,0.22), transparent 22%), radial-gradient(circle at 60% 20%, rgba(140,160,255,0.15), transparent 18%), linear-gradient(180deg, #04051C 0%, #0C1042 45%, #1A0A2E 100%)",
  noon:  "radial-gradient(circle at 50% -8%, rgba(255,210,110,0.55), transparent 42%), radial-gradient(circle at 50% 10%, rgba(255,170,60,0.25), transparent 55%), linear-gradient(180deg, #8A5416 0%, #4A2A10 42%, #1A0A2E 100%)",
  rain:  "repeating-linear-gradient(112deg, rgba(160,210,255,0.16) 0px, rgba(160,210,255,0.16) 2px, transparent 2px, transparent 11px), linear-gradient(180deg, #062838 0%, #0A3350 42%, #1A0A2E 100%)",
  heat:  "radial-gradient(circle at 50% 100%, rgba(255,110,30,0.55), transparent 55%), radial-gradient(circle at 50% 30%, rgba(255,60,20,0.18), transparent 50%), linear-gradient(180deg, #601505 0%, #380D08 42%, #1A0A2E 100%)",
  fog:   "linear-gradient(180deg, rgba(215,220,230,0.42), transparent 48%), linear-gradient(180deg, #4A4D58 0%, #33303F 42%, #1A0A2E 100%)",
};

// 액션 슬롯 순서: [기본공격, 방어, 스킬1, 스킬2, 스킬3, 스킬4]
// 스킬별 쿨다운 턴수 (스킬만 연타하는 단조로움을 줄이려고 기본공격/방어 섞도록 쿨다운 늘림)
const SKILL_COOLDOWNS = [0, 1, 3, 3, 3, 3];
const NORMAL_IDX = 0;
const GUARD_IDX = 1;
const SKILL_START_IDX = 2; // 스킬1의 인덱스, 스킬n = SKILL_START_IDX + slot

// 기본공격/방어 자세 배틀당 사용 가능 횟수
const NORMAL_ATTACK_USES = 8;
const GUARD_USES = 5;

// 등급별 상성 타입 (카드에 표시되는 "약점" 아이콘과 동일한 4각 상성)
// 🌿 풀 → 🔥 불에 약함 / 🔥 불 → 💧 물에 약함 / 💧 물 → ⚡ 전기에 약함 / ⚡ 전기 → 🌿 풀에 약함
const RARITY_TYPE: Record<string, string> = { common: "grass", uncommon: "water", rare: "electric", legendary: "fire" };
const WEAK_TO: Record<string, string> = { grass: "fire", fire: "water", water: "electric", electric: "grass" };

/* ──────────── 타입 ──────────── */
interface BattleCat {
  id: string; name: string; photo_url: string | null;
  card_rarity: CardRarity; card_name: string | null;
  card_traits: string[]; card_stats: CatCardData["card_stats"];
  card_flavor: string | null; card_level: number; card_exp: number;
  caretaker_id?: string;
  battle_atk: number | null; battle_def: number | null;
  battle_eva: number | null; battle_crit: number | null;
  battle_special: string | null; battle_special2: string | null;
  battle_special3: string | null; battle_special4: string | null;
}
interface BattleStats { hp: number; atk: number; def: number; spd: number; }
interface Skill { name: string; icon: string; type: "normal"|"guard"|"special"; slot?: number; desc: string; color: string; }
type Phase = "select"|"loading"|"countdown"|"player_choose"|"animating"|"opp_thinking"|"result";
type Mode = "manual"|"auto";
type CardAnim = "idle"|"attack"|"hit"|"dodge";

interface AutoLogEntry { turn:number; actor:string; dmg:number; aHp:number; dHp:number; isCritical:boolean; isDodge:boolean; isCounterAttack:boolean; skillName:string; }
interface AutoResult { winner:"me"|"opponent"; my_hp_left:number; opp_hp_left:number; my_max_hp:number; opp_max_hp:number; rounds:number; log:AutoLogEntry[]; exp_gained:number; my_new_level:number; leveled_up:boolean; }

/* ──────────── 헬퍼 ──────────── */
const SKILL_SLOT_COLORS = ["#DD4422", "#CC8822", "#22AACC", "#9933CC"];

// 스킬별 "성격" — 상태이상 계열을 색/연출로 구분해 전투 액션을 다채롭게 만든다
type FxFlavor = "ice"|"fear"|"shock"|"sleep"|"poison"|"bleed"|"bind"|"life";
const SKILL_FLAVOR: Partial<Record<string, FxFlavor>> = {
  freeze:"ice", cold_glare:"ice",
  hiss:"fear", intimidate:"fear",
  static_shock:"shock", thunderclap:"shock", judgment:"shock",
  slow:"sleep",
  poison:"poison", venom_fang:"poison", curse:"poison", dominate:"poison",
  scratch:"bleed", rend:"bleed",
  bind:"bind", howl:"bind", intimidate_sm:"bind",
  grooming:"life", warm_nap:"life", regen:"life", eclipse:"life", cleanse:"life", vampirism:"life",
};
const FX_COLOR: Record<FxFlavor,string> = {
  ice:"140,215,255", fear:"190,120,255", shock:"255,220,50", sleep:"170,175,255",
  poison:"130,240,110", bleed:"255,70,90", bind:"205,150,90", life:"150,255,190",
};
const STUN_LABEL: Partial<Record<FxFlavor,string>> = { ice:"❄️ 빙결", fear:"😱 공포", shock:"⚡ 감전", sleep:"😴 수면" };
function flavorColorForId(id: string | null): string | undefined {
  if (!id) return undefined;
  const f = SKILL_FLAVOR[id];
  return f ? FX_COLOR[f] : undefined;
}
// 자동전투 로그는 스킬 이름만 갖고 있어서, 이름 → id 역매핑을 통해 같은 색상 연출을 재사용한다
const SKILL_NAME_TO_ID: Record<string,string> = Object.fromEntries(Object.entries(SPECIAL_SKILLS).map(([id,s])=>[s.name,id]));
function flavorColorForName(name: string): string | undefined {
  return flavorColorForId(SKILL_NAME_TO_ID[name] ?? null);
}
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
  // 매 타격 변동폭을 넓혀서(0.80~1.30) 전개가 더 다채롭고 예측하기 어렵게
  const base = Math.max(5, (atk - def * 0.4) * (0.80 + Math.random() * 0.50));
  const isCrit = Math.random() * 100 < critChance;
  return { dmg: Math.round(base * mult * (isCrit ? 2.0 : 1)), isCrit };
}
function checkEvasion(evaChance: number): boolean {
  return Math.random() * 100 < evaChance;
}
// 인덱스: 0=기본공격, 1=방어, 2~5=스킬1~4
function oppAI(hp: number, maxHp: number): number {
  const ratio = hp / maxHp;
  const skillIdx = () => SKILL_START_IDX + Math.floor(Math.random() * 4);
  if (ratio < 0.25) return Math.random() < 0.7 ? skillIdx() : GUARD_IDX;
  if (ratio < 0.55) return Math.random() < 0.55 ? skillIdx() : (Math.random() < 0.5 ? NORMAL_IDX : GUARD_IDX);
  return Math.random() < 0.4 ? skillIdx() : NORMAL_IDX;
}
// 자동전투용 — oppAI는 쿨다운/사용횟수를 모르고 그냥 랜덤으로 골라서, 하필 쿨다운 중이거나
// 소진된 행동을 고르면 pickSkill이 조용히 무시해버려 "가끔 자동전투가 안 먹는" 버그가 있었음.
// 실제로 지금 쓸 수 있는 행동인지 확인하고, 막혀있으면 다른 가능한 행동으로 대체한다.
function pickAvailableAutoAction(hp: number, maxHp: number, skillCds: number[], normalLeft: number, guardLeft: number): number | null {
  const preferred = oppAI(hp, maxHp);
  // 방어는 총 사용 횟수 제한(guardLeft)과 별개로 1턴 쿨다운도 있어서 둘 다 확인해야 함
  const isUsable = (idx: number) => {
    if (idx === NORMAL_IDX) return normalLeft > 0;
    if (idx === GUARD_IDX) return guardLeft > 0 && (skillCds[GUARD_IDX] ?? 0) === 0;
    return (skillCds[idx] ?? 0) === 0;
  };
  if (isUsable(preferred)) return preferred;

  const availableSkills = [2, 3, 4, 5].filter(i => (skillCds[i] ?? 0) === 0);
  if (availableSkills.length > 0) return availableSkills[Math.floor(Math.random() * availableSkills.length)];
  if (normalLeft > 0) return NORMAL_IDX;
  if (isUsable(GUARD_IDX)) return GUARD_IDX;
  return null; // 정말 아무것도 못 쓰는 극단적인 경우 — 턴 패스로 처리
}
function toCard(cat: BattleCat): CatCardData {
  return { card_rarity:cat.card_rarity, card_name:cat.card_name, card_traits:cat.card_traits??[], card_stats:cat.card_stats, card_flavor:cat.card_flavor, card_level:cat.card_level, card_exp:cat.card_exp };
}

/* ──────────── 환경 씬 (달/해/별/비/안개/불씨 + 골목 스카이라인 실루엣) ──────────── */
const SKYLINE_CLIP = "polygon(0% 100%,0% 62%,7% 62%,7% 42%,15% 42%,15% 68%,24% 68%,24% 30%,33% 30%,33% 58%,42% 58%,42% 20%,50% 20%,50% 66%,60% 66%,60% 44%,68% 44%,68% 76%,78% 76%,78% 36%,87% 36%,87% 60%,100% 60%,100% 100%)";
const SKYLINE_COLOR: Record<BattleEnvKey, string> = {
  night: "rgba(6,8,30,0.55)", noon: "rgba(80,50,15,0.30)", rain: "rgba(4,18,26,0.60)",
  heat: "rgba(60,15,5,0.45)", fog: "rgba(30,32,40,0.35)",
};
function EnvScene({ env }: { env: BattleEnvKey | null }) {
  const particleRef = useRef<ParticleCanvasHandle>(null);
  useEffect(() => {
    if (env === "rain") particleRef.current?.setAmbient("rain", "190,220,255", 1);
    else if (env === "heat") particleRef.current?.setAmbient("ember", "255,140,50", 1);
    else particleRef.current?.setAmbient(null);
  }, [env]);
  if (!env) return null;
  return (
    <div style={{ position:"absolute", inset:0, zIndex:-1, overflow:"hidden", pointerEvents:"none" }}>
      {env === "night" && (
        <>
          <div style={{ position:"absolute", top:"6%", right:"12%", width:52, height:52, borderRadius:"50%",
            background:"radial-gradient(circle, #FFF8D8 0%, #FFE9A0 55%, transparent 75%)",
            boxShadow:"0 0 40px 14px rgba(255,240,180,0.35)" }} />
          <div className="env-stars" />
        </>
      )}
      {env === "noon" && (
        <div style={{ position:"absolute", top:"-6%", left:"50%", transform:"translateX(-50%)", width:150, height:150, borderRadius:"50%",
          background:"radial-gradient(circle, rgba(255,230,150,0.9) 0%, rgba(255,190,80,0.5) 40%, transparent 72%)",
          boxShadow:"0 0 70px 30px rgba(255,200,90,0.30)" }} />
      )}
      {env === "fog" && <div className="env-fog" />}
      {(env === "rain" || env === "heat") && <ParticleCanvas ref={particleRef} />}
      <div style={{ position:"absolute", left:0, right:0, bottom:0, height:110, clipPath:SKYLINE_CLIP, background:SKYLINE_COLOR[env] }} />
    </div>
  );
}

/* ──────────── HP 바 ──────────── */
function HpBar({ current, max }: { current:number; max:number }) {
  const pct = Math.max(0, Math.min(100, (current/max)*100));
  const col = pct>50?"#44DD66":pct>25?"#FFCC22":"#FF3333";
  return (
    <div style={{ height:10, borderRadius:99, background:"rgba(255,255,255,0.1)", overflow:"hidden" }}>
      <div style={{ height:"100%", width:`${pct}%`, background:col, borderRadius:99, transition:"width 0.45s ease, background 0.45s", boxShadow:pct<25?`0 0 8px ${col}`:undefined }} />
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
function SkillBtn({ skill, idx, disabled, cooldown=0, usesLeft, onPick }: { skill:Skill; idx:number; disabled:boolean; cooldown?:number; usesLeft?:number; onPick:(i:number)=>void }) {
  const icons = [<Swords key={0} size={14}/>, <Shield key={1} size={14}/>, <Zap key={2} size={14}/>, <Sparkles key={3} size={14}/>, <Flame key={4} size={14}/>, <Star key={5} size={14}/>];
  const isCd = cooldown > 0;
  const isExhausted = usesLeft !== undefined && usesLeft <= 0;
  const isOff = disabled || isCd || isExhausted;
  return (
    <button onClick={() => { if (isOff) return; primeSfx(); sfx.click(); onPick(idx); }} disabled={isOff}
      style={{
        flex:1, minWidth:0, display:"flex", flexDirection:"column", alignItems:"center", gap:3,
        padding:"10px 4px", borderRadius:14, border:`1.5px solid ${skill.color}44`,
        background: isOff ? "rgba(255,255,255,0.04)" : `${skill.color}22`,
        opacity: isOff ? 0.45 : 1, cursor: isOff?"default":"pointer",
        transition:"transform 0.1s, opacity 0.2s", position:"relative",
        WebkitTapHighlightColor:"transparent",
      }}
      onPointerDown={e => { if (!isOff) (e.currentTarget as HTMLButtonElement).style.transform="scale(0.93)"; }}
      onPointerUp={e => { (e.currentTarget as HTMLButtonElement).style.transform="scale(1)"; }}>
      <span style={{ color:skill.color, display:"flex", alignItems:"center", gap:3, fontSize:13, fontWeight:900 }}>
        {icons[idx]} {skill.icon}
      </span>
      <span style={{ fontSize:10, fontWeight:800, color:"rgba(255,255,255,0.85)", textAlign:"center", lineHeight:1.2, maxWidth:70 }}>
        {skill.name}
      </span>
      <span style={{ fontSize:9, color:"rgba(255,255,255,0.4)", textAlign:"center" }}>{skill.desc}</span>
      {usesLeft !== undefined && !isCd && (
        <span style={{ position:"absolute", top:3, right:5, fontSize:8, fontWeight:800, color: isExhausted?"#FF8080":"rgba(255,255,255,0.4)" }}>
          {usesLeft}회
        </span>
      )}
      {isCd && (
        <div style={{ position:"absolute", inset:0, borderRadius:14, background:"rgba(0,0,0,0.65)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:1 }}>
          <span style={{ fontSize:18, fontWeight:900, color:"#FF8888" }}>{cooldown}</span>
          <span style={{ fontSize:8, color:"rgba(255,180,180,0.8)" }}>쿨다운</span>
        </div>
      )}
      {isExhausted && !isCd && (
        <div style={{ position:"absolute", inset:0, borderRadius:14, background:"rgba(0,0,0,0.65)", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <span style={{ fontSize:9, fontWeight:800, color:"#FF8888" }}>소진</span>
        </div>
      )}
    </button>
  );
}

/* ══════════════ 메인 페이지 ══════════════ */
export default function BattlePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const mounted = useRef(true);

  const [myCats, setMyCats] = useState<BattleCat[]>([]);
  const [selected, setSelected] = useState<BattleCat | null>(null);
  const [mode, setMode] = useState<Mode>("manual");
  const [phase, setPhase] = useState<Phase>("select");
  const [autoPilot, setAutoPilot] = useState(false); // 수동 배틀 중 자동전투 전환
  const [autoUseItems, setAutoUseItems] = useState(false); // 자동전투 중 아이템도 자동 사용할지
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(3);

  // 배틀 데이터
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

  // 기본공격/방어 사용 횟수 제한
  const myNormalUsesRef = useRef(NORMAL_ATTACK_USES);
  const myGuardUsesRef  = useRef(GUARD_USES);
  const [myNormalUses, setMyNormalUses] = useState(NORMAL_ATTACK_USES);
  const [myGuardUses,  setMyGuardUses]  = useState(GUARD_USES);

  // 아이템 효과 상태 (전부 나 자신에게만 적용 — 아이템은 플레이어만 사용 가능)
  const myShieldRef = useRef(false);          // 방어막: 다음 피해 완전 무효화
  const myPowerBuffRef = useRef(false);       // 파워업 캔: 다음 공격 피해 +30%
  const myDodgeGuaranteedRef = useRef(false); // 행운의 부적: 상대 다음 공격 100% 회피

  // 아이템 인벤토리
  const [inventory, setInventory] = useState<Record<string, number>>({});
  const [itemPanelOpen, setItemPanelOpen] = useState(false);

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
  const triggerImpact = (side:"me"|"opp", isCrit: boolean, color?: string) => {
    setScreenShake(isCrit ? 2 : 1);
    setImpactBurst({ side, big: isCrit, color });
    if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
    shakeTimerRef.current = setTimeout(() => { setScreenShake(0); setImpactBurst(null); }, isCrit ? 480 : 320);
    const pref = side === "me" ? myParticleRef : oppParticleRef;
    const c = color ?? (isCrit ? "255,220,80" : "255,255,255");
    pref.current?.burst(0.5, 0.4, "spark", isCrit ? 20 : 9, c);
    if (isCrit) pref.current?.burst(0.5, 0.4, "shockwave", 1, c);
    if (isCrit) sfx.crit(); else sfx.hit();
  };
  const [dmgPopup, setDmgPopup] = useState<{target:"me"|"opp"; val:number; isCrit:boolean; msg?:string}|null>(null);
  const [actionMsg, setActionMsg] = useState("");
  const [turnCount, setTurnCount] = useState(0);
  // applySkill/pickSkill은 첫 배틀 시작 시 한 번 얼려진 클로저를 계속 쓰므로(스킬/스탯이 안 바뀌면
  // useCallback deps가 안 바뀜) turnCount state를 직접 읽으면 항상 0으로 고정됨 — ref로 최신값 참조
  const turnCountRef = useRef(0);
  useEffect(() => { turnCountRef.current = turnCount; }, [turnCount]);

  // 타이머
  const [timerLeft, setTimerLeft] = useState(6);
  const timerRef = useRef<ReturnType<typeof setInterval>|null>(null);
  // pickSkill은 매 렌더 새 클로저를 갖는데, startTimer는 deps=[]라 최초 클로저(스탯이 null이던 시점)를
  // 영원히 붙잡고 있어서 시간초과 시 턴이 안 넘어가는 버그가 있었음 — ref로 항상 최신 함수를 참조
  const pickSkillRef = useRef<(skillIdx: number | null, forfeitMsg?: string) => void>(() => {});

  // 결과
  const [battleResult, setBattleResult] = useState<{winner:"me"|"opponent"; exp:number; newLevel:number; leveledUp:boolean}|null>(null);

  // 자동 전투용
  const [autoResult, setAutoResult] = useState<AutoResult|null>(null);
  const [autoLogIdx, setAutoLogIdx] = useState(0);
  const autoTimerRef = useRef<ReturnType<typeof setTimeout>|null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; clearTimer(); if(autoTimerRef.current) clearTimeout(autoTimerRef.current); if(shakeTimerRef.current) clearTimeout(shakeTimerRef.current); };
  }, []);

  useEffect(() => {
    if (authLoading || !user) return;
    createClient().from("cats")
      .select("id,name,photo_url,card_rarity,card_name,card_traits,card_stats,card_flavor,card_level,card_exp,battle_atk,battle_def,battle_eva,battle_crit,battle_special,battle_special2,battle_special3,battle_special4")
      .eq("caretaker_id", user.id).not("card_generated_at","is",null)
      .order("card_level",{ascending:false})
      .then(({ data }:{ data:BattleCat[]|null }) => { if(mounted.current) setMyCats(data??[]); });
  }, [user, authLoading]);

  useEffect(() => {
    if (authLoading || !user) return;
    createClient().from("user_items").select("item_key,quantity").eq("user_id", user.id)
      .then(({ data }: { data: { item_key:string; quantity:number }[]|null }) => {
        if (!mounted.current) return;
        const map: Record<string, number> = {};
        for (const it of data ?? []) map[it.item_key] = it.quantity;
        setInventory(map);
      });
  }, [user, authLoading]);

  /* ── 타이머 ── */
  const clearTimer = () => { if(timerRef.current){ clearInterval(timerRef.current); timerRef.current=null; } };

  const startTimer = useCallback(() => {
    clearTimer();
    setTimerLeft(6);
    let t = 6;
    timerRef.current = setInterval(() => {
      t--;
      if(mounted.current) setTimerLeft(t);
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
        if(autoUseItems) {
          const hpRatio = myHpRef.current / Math.max(1, myMaxHp);
          const debuffed = myStunnedRef.current>0 || myPoisonRef.current>0 || myBleedRef.current>0 || myBoundRef.current>0;
          if(hpRatio < 0.35 && (inventory.heal_potion ?? 0) > 0) { useItem("heal_potion"); return; }
          if(debuffed && (inventory.cleanse_potion ?? 0) > 0) { useItem("cleanse_potion"); return; }
          if(hpRatio < 0.5 && !myShieldRef.current && (inventory.shield ?? 0) > 0) { useItem("shield"); return; }
        }
        const action = pickAvailableAutoAction(myHpRef.current, myMaxHp, mySkillCdRef.current, myNormalUsesRef.current, myGuardUsesRef.current);
        pickSkill(action, action === null ? "⏳ 쓸 수 있는 행동이 없어 턴 패스" : undefined);
      }, 500);
      return () => clearTimeout(t);
    }
    startTimer();
  }, [phase, autoPilot, autoUseItems]); // eslint-disable-line

  /* ── 배틀 시작 ── */
  const startBattle = async () => {
    if(!selected) return;
    setPhase("loading"); setError("");

    const res = await fetch("/api/cats/card-battle", {
      method:"POST", headers:{"content-type":"application/json"},
      body: JSON.stringify({ my_cat_id: selected.id, mode }),
    });
    const json = await res.json();
    if(!res.ok) {
      setError(json.error==="no_opponents"?"아직 배틀할 상대가 없어요. 다른 유저가 고양이를 등록하면 도전할 수 있어요!":"배틀 오류");
      setPhase("select"); return;
    }

    const opp = json.opponent as BattleCat;
    setOpponent(opp);

    // 랜덤 배틀 환경 선택
    const envKey = ENV_KEYS[Math.floor(Math.random() * ENV_KEYS.length)];
    setBattleEnv(envKey); battleEnvRef.current = envKey;

    if(mode === "manual") {
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
      myNormalUsesRef.current=NORMAL_ATTACK_USES; setMyNormalUses(NORMAL_ATTACK_USES);
      myGuardUsesRef.current=GUARD_USES; setMyGuardUses(GUARD_USES);
      myShieldRef.current=false; myPowerBuffRef.current=false; myDodgeGuaranteedRef.current=false;
    } else {
      // 자동 전투
      const r = json.result as AutoResult;
      setAutoResult(r); setAutoLogIdx(0);
      setMyHp(r.my_max_hp); setOppHp(r.opp_max_hp);
      setMyMaxHp(r.my_max_hp); setOppMaxHp(r.opp_max_hp);
    }

    // 카운트다운
    setPhase("countdown"); setCountdown(3);
    let cd = 3;
    const cdTick = () => {
      cd--;
      if(!mounted.current) return;
      setCountdown(cd);
      navigator.vibrate?.(40);
      if(cd > 0) { setTimeout(cdTick, 650); }
      else {
        setTimeout(() => {
          if(!mounted.current) return;
          if(mode==="manual") {
            setTurnCount(1);
            setActionMsg("기술을 선택하세요!");
            setPhase("player_choose");
          } else {
            setPhase("animating");
            replayAuto(json.result as AutoResult, selected.name, opp.name);
          }
        }, 500);
      }
    };
    setTimeout(cdTick, 700);
  };

  /* ── 자동 배틀 재생 ── */
  const replayAuto = (r: AutoResult, myName: string, oppName: string) => {
    const log = r.log;
    let i = 0;
    const TICK = 1100;
    const tick = () => {
      if(!mounted.current) return;
      if(i >= log.length) {
        setTimeout(() => {
          if(!mounted.current) return;
          setBattleResult({ winner:r.winner, exp:r.exp_gained, newLevel:r.my_new_level, leveledUp:r.leveled_up });
          setPhase("result");
        }, 600);
        return;
      }
      const e = log[i++];
      const isMe = e.actor===myName;
      setActionMsg(`${e.actor}의 ${e.skillName}!${e.isCritical?" 💥 크리티컬!":""}${e.isCounterAttack?" ⚡ 위기반격!":""}`);
      if(isMe){ setMyAnim("attack"); } else { setOppAnim("attack"); }
      setTimeout(() => {
        if(!mounted.current) return;
        setMyAnim("idle"); setOppAnim("idle");
        if(!e.isDodge && e.dmg>0) {
          if(isMe){ setOppAnim("hit"); setOppHp(e.dHp); }
          else { setMyAnim("hit"); setMyHp(e.aHp); }
          triggerImpact(isMe?"opp":"me", e.isCritical, flavorColorForName(e.skillName));
          setDmgPopup({ target:isMe?"opp":"me", val:e.dmg, isCrit:e.isCritical });
          if(e.isCritical){ setCritFlash(true); navigator.vibrate?.([80,30,80]); }
          else navigator.vibrate?.(30);
        } else if(e.isDodge) {
          setDmgPopup({ target:isMe?"opp":"me", val:0, isCrit:false, msg:"회피!" });
        }
        setTimeout(() => {
          if(!mounted.current) return;
          setMyAnim("idle"); setOppAnim("idle"); setDmgPopup(null); setCritFlash(false);
          autoTimerRef.current = setTimeout(tick, 100);
        }, 650);
      }, 380);
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

    // 상성 보정 (카드 등급 = 타입, 카드에 표시된 "약점" 그대로 적용)
    const atkType = RARITY_TYPE[attacker.card_rarity] ?? "grass";
    const defType = RARITY_TYPE[defender.card_rarity] ?? "grass";
    const isEffective = WEAK_TO[defType] === atkType;
    // 파워업 캔 효과 (내 다음 공격 한정, 즉시 소모)
    const powerBuffMult = (isPlayer && myPowerBuffRef.current) ? 1.3 : 1.0;
    if (isPlayer && myPowerBuffRef.current) myPowerBuffRef.current = false;

    // 필사의 역전 — 공격자 체력이 30% 미만이면 피해량·크리티컬 확률 보너스 (역전 가능성↑)
    const atkHpRatio = (isPlayer ? myHpRef.current : oppHpRef.current) / (isPlayer ? myMaxH : oppMaxH);
    const comebackActive = atkHpRatio < 0.3;
    const comebackDmgMult = comebackActive ? 1.15 : 1.0;
    const comebackCritBonus = comebackActive ? 15 : 0;

    // 장기전 방지 — 10턴을 넘기면 매 턴 피해량이 조금씩 증가해 긴박감을 줌 (최대 +25%)
    const escalationMult = 1 + Math.min(0.25, Math.max(0, (turnCountRef.current - 10) * 0.025));

    const envDmgMult = (env?.dmgMult ?? 1.0) * (isEffective ? 2.0 : 1.0) * powerBuffMult * comebackDmgMult * escalationMult;

    // 이번에 사용할 스킬 ID 미리 확인 (야습의 회피 무시 판정에 필요)
    const usedSkillId = skill.type === "special" && skill.slot !== undefined ? getSlotSkillId(attacker, skill.slot) : null;
    const forceHit = usedSkillId === "night_prowl";

    // 속박 체크 (속박 남은 턴수 > 0 이면 회피 불가, 대상 공격당 1턴씩 소모)
    const defBound = (isPlayer ? oppBoundRef.current : myBoundRef.current) > 0;
    if (isPlayer) oppBoundRef.current = Math.max(0, oppBoundRef.current - 1);
    else myBoundRef.current = Math.max(0, myBoundRef.current - 1);

    // 행운의 부적 효과 (내가 방어자일 때 상대 공격 무조건 회피, 즉시 소모)
    const forceDodge = !isPlayer && myDodgeGuaranteedRef.current;
    if (!isPlayer) myDodgeGuaranteedRef.current = false;

    // 회피 체크 (공격 전, 속박/야습 시 무조건 맞음, 행운의 부적 시 무조건 회피)
    const defEva = (defender.battle_eva ?? 8) + envEvaBonus;
    if(!defBound && !forceHit && skill.type !== "guard" && (forceDodge || checkEvasion(defEva))) {
      if(isPlayer){ setOppAnim("dodge"); } else { setMyAnim("dodge"); }
      sfx.dodge();
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
        case "quick_dodge":   sMsg="💨 재빠른 도약!"; if(isPlayer){myGuardRef.current=true;setMyGuardVis(true);}else{oppGuardRef.current=true;setOppGuardVis(true);} break;
        case "focus":        { const r=calcDmg(atkSt.atk,defSt.def,1.0*envDmgMult,100); sDmg=r.dmg; sCrit=true; sMsg="👁️ 집중! 크리티컬 확정"; break; }
        case "intimidate_sm": {
          const r=calcDmg(atkSt.atk*0.6,defSt.def,1.0,atkCrit); sDmg=r.dmg; sCrit=r.isCrit;
          if(Math.random()<0.3){ if(isPlayer){oppBoundRef.current=2;}else{myBoundRef.current=2;} sMsg="😠 견제! 2턴 속박(회피 불가)"; }
          else sMsg="😠 견제! (속박 실패)";
          break;
        }
        case "hiss":
          if(Math.random()<0.3){ setStun(2,"fear"); sMsg="😾 하악 위협! 2턴 기절"; }
          else sMsg="😾 하악... 실패";
          break;
        case "grooming":   { const heal=Math.round(ownMaxHp*0.10); if(isPlayer)setMyHp(Math.min(myMaxH,myHpRef.current+heal));else setOppHp(Math.min(oppMaxH,oppHpRef.current+heal)); sMsg=`🧼 그루밍! +${heal}HP 회복`; break; }
        case "warm_nap":   { const heal=Math.round(ownMaxHp*0.08); if(isPlayer)setMyHp(Math.min(myMaxH,myHpRef.current+heal));else setOppHp(Math.min(oppMaxH,oppHpRef.current+heal)); sMsg=`😴 따뜻한 낮잠! +${heal}HP 회복`; break; }
        case "tail_whip":  { const r=calcDmg(atkSt.atk,defSt.def*0.7,1.0*envDmgMult,atkCrit); sDmg=r.dmg; sCrit=r.isCrit; sMsg="🐈 꼬리 치기! 방어 일부 무시"; break; }
        case "claw_flurry": {
          const r1=calcDmg(atkSt.atk,defSt.def,0.6*envDmgMult,atkCrit);
          const r2=calcDmg(atkSt.atk,defSt.def,0.6*envDmgMult,atkCrit);
          sDmg=r1.dmg+r2.dmg; sCrit=r1.isCrit||r2.isCrit;
          sMsg=`🐾 발톱 연타! ${r1.dmg}+${r2.dmg}`;
          break;
        }
        case "body_slam":  { const r=calcDmg(atkSt.atk,defSt.def,1.3*envDmgMult,atkCrit); sDmg=r.dmg; sCrit=r.isCrit; sMsg="💥 몸통 박치기!"; break; }
        case "freeze":
          if(Math.random()<0.45){ setStun(2,"ice"); sMsg="❄️ 얼리기 성공! 2턴 기절"; }
          else sMsg="❄️ 얼리기... 저항!";
          break;
        case "scratch":    { const r=calcDmg(atkSt.atk,defSt.def,0.8*envDmgMult,atkCrit); sDmg=r.dmg; sCrit=r.isCrit; if(isPlayer)oppBleedRef.current=3;else myBleedRef.current=3; sMsg="🩸 할퀴기! 출혈 3턴"; break; }
        case "intimidate":
          if(Math.random()<0.55){ setStun(2,"fear"); sMsg="😱 공포의 눈빛! 2턴 기절"; }
          else sMsg="😱 공포의 눈빛... 실패";
          break;
        case "pounce":     { const r=calcDmg(atkSt.atk,5,1.1*envDmgMult,atkCrit); sDmg=r.dmg; sCrit=r.isCrit; sMsg="🦘 도약 강타! 방어 무시"; break; }
        case "ambush":     { const r=calcDmg(atkSt.atk,defSt.def,1.2*envDmgMult,100); sDmg=r.dmg; sCrit=true; sMsg="🌑 급습! 크리티컬 확정"; break; }
        case "static_shock":
          if(Math.random()<0.3){ setStun(2,"shock"); sMsg="⚡ 정전기! 2턴 기절"; }
          else sMsg="⚡ 정전기... 실패";
          break;
        case "night_prowl": { const r=calcDmg(atkSt.atk,defSt.def,1.1*envDmgMult,atkCrit); sDmg=r.dmg; sCrit=r.isCrit; sMsg="🌌 야습! 회피 불가 관통"; break; }
        case "thunderclap": {
          const r=calcDmg(atkSt.atk,defSt.def,0.6*envDmgMult,atkCrit); sDmg=r.dmg; sCrit=r.isCrit;
          if(Math.random()<0.25){ setStun(2,"shock"); sMsg="🌩️ 천둥벽력! 2턴 기절"; }
          else sMsg="🌩️ 천둥벽력!";
          break;
        }
        case "cold_glare":
          if(Math.random()<0.3){ setStun(2,"ice"); sMsg="🥶 차가운 눈초리! 2턴 기절"; }
          else sMsg="🥶 차가운 눈초리... 실패";
          break;
        case "dash_strike": { const r=calcDmg(atkSt.atk,defSt.def,1.5*envDmgMult,atkCrit); sDmg=r.dmg; sCrit=r.isCrit; sMsg="💨 돌진!"; break; }
        case "poison":     { const r=calcDmg(atkSt.atk,defSt.def,0.7*envDmgMult,atkCrit); sDmg=r.dmg; sCrit=r.isCrit; if(isPlayer)oppPoisonRef.current=4;else myPoisonRef.current=4; sMsg="☠️ 독 중독! 4턴 지속"; break; }
        case "bind":
          if(Math.random()<0.65){ if(isPlayer)oppBoundRef.current=3;else myBoundRef.current=3; sMsg="⛓️ 속박! 3턴 회피 불가"; }
          else sMsg="⛓️ 속박... 실패";
          break;
        case "slow":
          if(Math.random()<0.6){ setStun(2,"sleep"); sMsg="🐌 느리게! 2턴 스킵"; }
          else sMsg="🐌 느리게... 실패";
          break;
        case "double_strike": {
          const r1=calcDmg(atkSt.atk,defSt.def,0.8*envDmgMult,atkCrit);
          const r2=calcDmg(atkSt.atk,defSt.def,0.8*envDmgMult,atkCrit);
          sDmg=r1.dmg+r2.dmg; sCrit=r1.isCrit||r2.isCrit;
          sMsg=`⚡ 연속 공격! ${r1.dmg}+${r2.dmg}`;
          break;
        }
        case "rend":       { const r=calcDmg(atkSt.atk,5,1.0*envDmgMult,atkCrit); sDmg=r.dmg; sCrit=r.isCrit; if(isPlayer)oppBleedRef.current=3;else myBleedRef.current=3; sMsg="🗡️ 찢기! 방어 무시+출혈"; break; }
        case "howl":
          if(Math.random()<0.65){ if(isPlayer)oppBoundRef.current=3;else myBoundRef.current=3; sMsg="🐺 하울링! 3턴 속박"; }
          else sMsg="🐺 하울링... 실패";
          break;
        case "frenzy":     { const r=calcDmg(atkSt.atk,defSt.def,1.6*envDmgMult,atkCrit); sDmg=r.dmg; sCrit=r.isCrit; sMsg="🔱 맹공!"; break; }
        case "curse":      { const r=calcDmg(atkSt.atk,defSt.def,0.7*envDmgMult,atkCrit); sDmg=r.dmg; sCrit=r.isCrit; if(isPlayer)oppPoisonRef.current=5;else myPoisonRef.current=5; sMsg="👹 저주! 5턴 지속"; break; }
        case "venom_fang": { const r=calcDmg(atkSt.atk,defSt.def,1.1*envDmgMult,atkCrit); sDmg=r.dmg; sCrit=r.isCrit; if(isPlayer)oppPoisonRef.current=4;else myPoisonRef.current=4; sMsg="🦷 맹독니! 4턴 중독"; break; }
        case "shockwave":  { const r=calcDmg(atkSt.atk,defSt.def,1.7*envDmgMult,atkCrit); sDmg=r.dmg; sCrit=r.isCrit; sMsg="💥 충격파!"; break; }
        case "vampirism":  { const r=calcDmg(atkSt.atk,defSt.def,1.2*envDmgMult,atkCrit); sDmg=r.dmg; sCrit=r.isCrit; const heal=Math.round(sDmg*0.3); if(isPlayer)setMyHp(Math.min(myMaxH,myHpRef.current+heal));else setOppHp(Math.min(oppMaxH,oppHpRef.current+heal)); sMsg=`🧛 흡혈! +${heal}HP 흡수`; break; }
        case "invincible": { if(isPlayer){myGuardRef.current=true;setMyGuardVis(true);}else{oppGuardRef.current=true;setOppGuardVis(true);} sMsg="✨ 무적 발동! 다음 피해 무효"; break; }
        case "dominate":   { const r=calcDmg(atkSt.atk*1.2,5,1.0*envDmgMult,atkCrit); sDmg=r.dmg; sCrit=r.isCrit; if(isPlayer){oppBoundRef.current=3;oppPoisonRef.current=3;}else{myBoundRef.current=3;myPoisonRef.current=3;} sMsg="👑 지배! 3턴 속박+3턴 중독"; break; }
        case "regen":      { const heal=Math.round(ownMaxHp*0.12); if(isPlayer)setMyHp(Math.min(myMaxH,myHpRef.current+heal));else setOppHp(Math.min(oppMaxH,oppHpRef.current+heal)); sMsg=`💚 재생! +${heal}HP`; break; }
        case "eclipse":    { const r=calcDmg(atkSt.atk,defSt.def,1.3*envDmgMult,atkCrit); sDmg=r.dmg; sCrit=r.isCrit; const heal=Math.round(ownMaxHp*0.15); if(isPlayer)setMyHp(Math.min(myMaxH,myHpRef.current+heal));else setOppHp(Math.min(oppMaxH,oppHpRef.current+heal)); sMsg=`🌘 월식! +${heal}HP 회복`; break; }
        case "overdrive":  { const r=calcDmg(atkSt.atk,defSt.def,1.8*envDmgMult,atkCrit); sDmg=r.dmg; sCrit=r.isCrit; const recoil=Math.round(ownMaxHp*0.08); if(isPlayer)setMyHp(Math.max(0,myHpRef.current-recoil));else setOppHp(Math.max(0,oppHpRef.current-recoil)); sMsg=`💢 폭주! 반동 -${recoil}HP`; break; }
        case "meteor":     { const r=calcDmg(atkSt.atk,defSt.def,2.0*envDmgMult,atkCrit); sDmg=r.dmg; sCrit=r.isCrit; sMsg="☄️ 메테오!"; break; }
        case "judgment": {
          const r=calcDmg(atkSt.atk,defSt.def,1.2*envDmgMult,atkCrit); sDmg=r.dmg; sCrit=r.isCrit;
          if(Math.random()<0.55){
            if(isPlayer){oppBoundRef.current=2;}else{myBoundRef.current=2;}
            setStun(2,"shock");
            sMsg="⚡ 천벌! 2턴 속박+기절";
          } else sMsg="⚡ 천벌!";
          break;
        }
        case "apocalypse_strike": { const r=calcDmg(atkSt.atk,defSt.def,2.2*envDmgMult,atkCrit); sDmg=r.dmg; sCrit=r.isCrit; sMsg="🌋 종말의 일격!"; break; }
        case "cleanse": {
          const heal=Math.round(ownMaxHp*0.10);
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
        msg="🛡️ 방어 자세!";
        break;
      }
      case "special": { const r=runSpecial(usedSkillId ?? "sharp_claws"); dmg=r.dmg; isCrit=r.isCrit; msg=r.msg; break; }
    }

    // 상성 우위 표시
    if(dmg>0 && isEffective) {
      msg = msg ? `${msg} · 효과는 굉장했다!` : "효과는 굉장했다!";
    }

    // 방어막 아이템 (내가 방어자일 때 이번 피해 완전 무효화, 최우선 적용)
    if(dmg>0 && !isPlayer && myShieldRef.current) {
      dmg = 0;
      myShieldRef.current = false;
      msg = "🛡️ 방어막이 피해를 완전히 막았다!";
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

    if(myPoisonRef.current > 0) { myNewHp = Math.max(0, myNewHp - Math.round(8*dotMult)); myPoisonRef.current--; }
    if(myBleedRef.current > 0) { myNewHp = Math.max(0, myNewHp - Math.round(5*dotMult)); myBleedRef.current--; }
    if(oppPoisonRef.current > 0) { oppNewHp = Math.max(0, oppNewHp - Math.round(8*dotMult)); oppPoisonRef.current--; }
    if(oppBleedRef.current > 0) { oppNewHp = Math.max(0, oppNewHp - Math.round(5*dotMult)); oppBleedRef.current--; }

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

    if(myNewHp<=0) { endBattle("opponent"); return true; }
    if(oppNewHp<=0) { endBattle("me"); return true; }
    return false;
  }, []); // eslint-disable-line

  const pickSkill = useCallback((skillIdx: number | null, forfeitMsg?: string) => {
    if(!myStats || !oppStats || !selected || !opponent || !mounted.current) return;
    if(skillIdx !== null && mySkillCdRef.current[skillIdx] > 0) return;
    if(skillIdx === NORMAL_IDX && myNormalUsesRef.current <= 0) return;
    if(skillIdx === GUARD_IDX && myGuardUsesRef.current <= 0) return;
    clearTimer();
    setPhase("animating");

    let dmg = 0, isCrit = false, msg = "";
    let castSkillId: string | null = null;
    if(skillIdx === null) {
      // 타임오버 또는 아이템 사용: 공격 없이 턴 진행
      msg = forfeitMsg ?? "⏰ 시간 초과! 턴 패스";
      setActionMsg(msg);
    } else {
      if(SKILL_COOLDOWNS[skillIdx] > 0) {
        mySkillCdRef.current[skillIdx] = SKILL_COOLDOWNS[skillIdx];
        setMySkillCd([...mySkillCdRef.current]);
      }
      if(skillIdx === NORMAL_IDX) { myNormalUsesRef.current--; setMyNormalUses(myNormalUsesRef.current); }
      if(skillIdx === GUARD_IDX) { myGuardUsesRef.current--; setMyGuardUses(myGuardUsesRef.current); }
      const r = applySkill(skillIdx, true, myStats, oppStats, myMaxHp, oppMaxHp, selected, opponent);
      dmg = r.dmg; isCrit = r.isCrit; msg = r.msg; castSkillId = r.skillId;
      const skill = mySkills[skillIdx];
      setActionMsg(`${selected.name}의 ${skill.name}!${isCrit?" 💥 크리티컬!":""}${msg?" "+msg:""}`);
      setMyAnim("attack");
    }

    setTimeout(() => {
      if(!mounted.current) return;
      setMyAnim("idle");
      if(dmg>0) {
        setOppAnim("hit");
        triggerImpact("opp", isCrit, flavorColorForId(castSkillId));
        setDmgPopup({ target:"opp", val:dmg, isCrit, msg:msg||undefined });
        if(isCrit){ setCritFlash(true); navigator.vibrate?.([80,30,80]); }
        else navigator.vibrate?.(35);
      } else if(msg) {
        if(isSelfTargetSkill(castSkillId)) {
          setDmgPopup({ target:"me", val:0, isCrit:false, msg });
        } else {
          // 0피해라도 상대에게 걸리는 효과(빙결/속박/독 등)면 상대 쪽에 반응을 준다
          setOppAnim("hit");
          triggerImpact("opp", false, flavorColorForId(castSkillId));
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

          // AI 기술 선택
          const aiSkillIdx = oppAI(oppHpRef.current, oppMaxHp);
          const { dmg:od, isCrit:oc, msg:om, skillId:aiSkillId } = applySkill(aiSkillIdx, false, myStats, oppStats, myMaxHp, oppMaxHp, selected, opponent);
          const oppSkill = oppSkills[aiSkillIdx];
          setActionMsg(`${opponent.name}의 ${oppSkill.name}!${oc?" 💥 크리티컬!":""}${om?" "+om:""}`);
          setOppAnim("attack");

          setTimeout(() => {
            if(!mounted.current) return;
            setOppAnim("idle");
            if(od>0) {
              setMyAnim("hit");
              triggerImpact("me", oc, flavorColorForId(aiSkillId));
              setDmgPopup({ target:"me", val:od, isCrit:oc, msg:om||undefined });
              if(oc){ setCritFlash(true); navigator.vibrate?.([80,30,80]); }
              else navigator.vibrate?.(30);
            } else if(om) {
              if(isSelfTargetSkill(aiSkillId)) {
                setDmgPopup({ target:"opp", val:0, isCrit:false, msg:om });
              } else {
                setMyAnim("hit");
                triggerImpact("me", false, flavorColorForId(aiSkillId));
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

  // 워치독 — 턴 연출 중 중첩 setTimeout 체인이 아주 드물게(브라우저 타이머 스케줄링 이슈로 추정)
  // 콜백이 발화되지 않아 게임이 영원히 멈추는 경우가 있었음. 정상 진행이면 아래 6초 타이머는
  // phase가 바뀌면서 항상 정리되어 절대 발동하지 않고, 진짜로 멈췄을 때만 강제 복구한다.
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

  /* ── 아이템 사용 (내 턴 소모) ── */
  const useItem = useCallback(async (key: ShopItemKey) => {
    if (phase !== "player_choose" || !mounted.current) return;
    if ((inventory[key] ?? 0) <= 0) return;
    setItemPanelOpen(false);

    const res = await fetch("/api/shop/use-item", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ item_key: key }),
    });
    if (!res.ok || !mounted.current) return;
    setInventory(prev => ({ ...prev, [key]: Math.max(0, (prev[key] ?? 1) - 1) }));

    let msg = "";
    switch (key) {
      case "heal_potion": { const heal = Math.round(myMaxHp*0.20); setMyHp(Math.min(myMaxHp, myHpRef.current+heal)); msg = `🧪 치료 물약! +${heal}HP 회복`; break; }
      case "shield":         myShieldRef.current = true; msg = "🛡️ 방어막 전개! 다음 피해 무효화"; break;
      case "cleanse_potion": {
        myPoisonRef.current=0; myBleedRef.current=0; myBoundRef.current=0;
        myStunnedRef.current=0; setMyStunVis(false); setMyStunFlavor(null); setMyStatusBadges([]);
        msg = "💊 정화제! 모든 상태이상 해제"; break;
      }
      case "skill_recharge": mySkillCdRef.current=[0,0,0,0,0,0]; setMySkillCd([0,0,0,0,0,0]); msg = "🔋 스킬 충전! 쿨다운 초기화"; break;
      case "power_up":       myPowerBuffRef.current = true; msg = "🥫 파워업! 다음 공격 피해 +30%"; break;
      case "lucky_charm":    myDodgeGuaranteedRef.current = true; msg = "🍀 행운의 부적! 상대 다음 공격 회피"; break;
    }
    pickSkill(null, msg);
  }, [phase, inventory, myMaxHp, pickSkill]); // eslint-disable-line

  /* ── 배틀 종료 ── */
  const endBattle = useCallback(async (winner:"me"|"opponent") => {
    if(!selected || !opponent) return;
    setPhase("result");
    setActionMsg(winner==="me"?"🏆 승리!":"💔 패배...");
    if(winner==="me") sfx.win(); else sfx.lose();

    try {
      const res = await fetch("/api/cats/card-battle/record", {
        method:"POST", headers:{"content-type":"application/json"},
        body: JSON.stringify({ my_cat_id:selected.id, opp_cat_id:opponent.id, opp_caretaker_id:opponent.caretaker_id, winner, rounds:turnCount, my_hp_left:myHpRef.current, opp_hp_left:oppHpRef.current }),
      });
      const json = await res.json();
      if(mounted.current) setBattleResult({ winner, exp:json.exp_gained??0, newLevel:json.my_new_level??1, leveledUp:json.leveled_up??false });
    } catch {
      // 기록 저장 API가 실패/네트워크 오류여도 결과 화면은 항상 떠야 함 (안 그러면 빈 화면에 멈춤)
      if(mounted.current) setBattleResult({ winner, exp:0, newLevel:selected.card_level, leveledUp:false });
    }
  }, [selected, opponent, turnCount]);

  /* ── 리셋 ── */
  const reset = () => {
    clearTimer();
    if(autoTimerRef.current) clearTimeout(autoTimerRef.current);
    setPhase("select"); setSelected(null); setOpponent(null);
    setMyStats(null); setOppStats(null); setAutoResult(null);
    setBattleResult(null); setTurnCount(0); setActionMsg("");
    setMyAnim("idle"); setOppAnim("idle"); setDmgPopup(null); setCritFlash(false);
    setScreenShake(0); setImpactBurst(null);
    if(user) createClient().from("cats").select("id,name,photo_url,card_rarity,card_name,card_traits,card_stats,card_flavor,card_level,card_exp,battle_atk,battle_def,battle_eva,battle_crit,battle_special,battle_special2,battle_special3,battle_special4").eq("caretaker_id",user.id).not("card_generated_at","is",null).order("card_level",{ascending:false}).then(({data}:{data:BattleCat[]|null})=>{ if(mounted.current) setMyCats(data??[]); });
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

  const dangerTint = myDanger&&!oppDanger ? "rgba(255,40,40,0.22)" : oppDanger&&!myDanger ? "rgba(60,255,110,0.14)" : "rgba(0,0,0,0)";
  const rootBg = battleEnv
    ? `linear-gradient(180deg, ${dangerTint} 0%, transparent 30%), ${ENV_BACKGROUNDS[battleEnv]}`
    : `linear-gradient(180deg,${myDanger&&!oppDanger?"#2A0A0A":oppDanger&&!myDanger?"#0A1A0A":"#0A0A18"} 0%,#1A0A2E 100%)`;

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

      <div className="min-h-dvh flex flex-col" style={{
        background:rootBg, transition:"background 1.2s", position:"relative", zIndex:0,
        animation: screenShake===2 ? "shakeScreenBig 0.45s ease" : screenShake===1 ? "shakeScreen 0.3s ease" : undefined,
      }}>
        <EnvScene env={battleEnv} />

        {/* 헤더 */}
        <div className="flex items-center gap-3 px-4 pt-safe pt-4 pb-3 shrink-0" style={{background:"rgba(10,10,24,0.85)",backdropFilter:"blur(12px)"}}>
          <button onClick={()=>{reset();router.back();}} className="w-9 h-9 rounded-full flex items-center justify-center" style={{background:"rgba(255,255,255,0.08)"}}>
            <ArrowLeft size={18} color="white"/>
          </button>
          <h1 className="text-[17px] font-extrabold text-white flex items-center gap-2"><Swords size={18}/> 카드 배틀</h1>
          {isFightPhase && <span className="ml-auto text-[12px] text-gray-500 font-bold">{turnCount}턴</span>}
          <SfxToggle style={isFightPhase ? undefined : { marginLeft: "auto" }}/>
        </div>

        {/* ──────── 선택 화면 ──────── */}
        {(phase==="select"||phase==="loading") && (
          <div className="flex-1 overflow-y-auto px-4 pb-6">
            {/* 모드 토글 */}
            <div className="flex gap-2 mt-4 mb-4 p-1 rounded-2xl" style={{background:"rgba(255,255,255,0.05)"}}>
              {(["manual","auto"] as Mode[]).map(m=>(
                <button key={m} onClick={()=>setMode(m)}
                  className="flex-1 py-2.5 rounded-xl text-[13px] font-black transition-all"
                  style={{ background:mode===m?"linear-gradient(135deg,#8040D0,#C060FF)":"transparent", color:mode===m?"white":"rgba(255,255,255,0.4)" }}>
                  {m==="manual"?"🎮 수동 전투":"⚡ 자동 전투"}
                </button>
              ))}
            </div>
            {mode==="manual"&&<p className="text-[11px] text-gray-500 text-center mb-4">턴마다 기술을 직접 선택! 6초 안에 고르세요</p>}

            <p className="text-gray-400 text-[13px] mb-3">출전할 고양이 선택</p>
            {error&&<p className="text-red-400 text-[13px] mb-3 text-center">{error}</p>}
            <div className="grid grid-cols-2 gap-3 mb-6">
              {myCats.map(cat=>(
                <div key={cat.id} onClick={()=>phase==="select"&&setSelected(s=>s?.id===cat.id?null:cat)}
                  style={{cursor:"pointer",outline:selected?.id===cat.id?"3px solid #C080FF":"2px solid transparent",borderRadius:16,transition:"transform 0.12s",transform:selected?.id===cat.id?"scale(1.04)":"scale(1)"}}>
                  <CatCard name={cat.name} photoUrl={cat.photo_url} card={toCard(cat)} size="sm"/>
                  {selected?.id===cat.id&&<div className="text-center text-[10px] text-purple-300 font-bold mt-1">✓ 선택됨</div>}
                </div>
              ))}
            </div>
            {myCats.length===0&&<div className="text-center py-16"><p className="text-gray-500 text-[14px]">카드가 없어요. 고양이를 등록하면 카드가 생성돼요!</p></div>}
            {selected&&(
              <button onClick={startBattle} disabled={phase==="loading"}
                className="w-full py-4 rounded-2xl text-[16px] font-black text-white flex items-center justify-center gap-2"
                style={{background:"linear-gradient(135deg,#8040D0,#C060FF)",boxShadow:"0 4px 24px rgba(160,80,255,0.5)",opacity:phase==="loading"?0.6:1}}>
                {phase==="loading"?<span className="animate-pulse">상대 찾는 중...</span>:<><Swords size={18}/> 배틀 시작!</>}
              </button>
            )}
          </div>
        )}

        {/* ──────── 카운트다운 ──────── */}
        {phase==="countdown"&&(
          <div className="flex-1 flex flex-col items-center justify-center">
            <div key={countdown} style={{fontSize:countdown===0?56:92,fontWeight:900,color:countdown===0?"#FFD700":"white",textShadow:`0 0 40px ${countdown===0?"#FFD700":"#C080FF"}`,animation:"cdPop 0.55s ease forwards"}}>
              {countdown===0?"GO!":countdown}
            </div>
          </div>
        )}

        {/* ──────── 배틀 화면 ──────── */}
        {(isFightPhase||phase==="animating") && selected && opponent && (
          <div className="flex-1 flex flex-col px-4 gap-3" style={{paddingTop:12,paddingBottom:8}}>

            {/* 배틀 환경 */}
            {battleEnv && (
              <div className="text-center" style={{fontSize:11,fontWeight:800,color:"rgba(255,255,255,0.6)"}}>
                {BATTLE_ENVS[battleEnv].emoji} {BATTLE_ENVS[battleEnv].name} · {BATTLE_ENVS[battleEnv].desc}
              </div>
            )}

            {/* 수동: 자동전투 토글 + 타이머 바 */}
            {mode==="manual"&&(
              <div className="flex items-center gap-2">
                <button onClick={()=>setAutoPilot(a=>!a)}
                  style={{
                    fontSize:10, fontWeight:900, padding:"4px 9px", borderRadius:99, whiteSpace:"nowrap",
                    background: autoPilot ? "linear-gradient(135deg,#8040D0,#C060FF)" : "rgba(255,255,255,0.08)",
                    color: autoPilot ? "white" : "rgba(255,255,255,0.5)",
                    border: autoPilot ? "1px solid transparent" : "1px solid rgba(255,255,255,0.15)",
                  }}>
                  ⚡ 자동전투 {autoPilot?"ON":"OFF"}
                </button>
                {autoPilot && (
                  <button onClick={()=>setAutoUseItems(a=>!a)}
                    style={{
                      fontSize:10, fontWeight:900, padding:"4px 9px", borderRadius:99, whiteSpace:"nowrap",
                      background: autoUseItems ? "linear-gradient(135deg,#B87000,#FFA020)" : "rgba(255,255,255,0.08)",
                      color: autoUseItems ? "white" : "rgba(255,255,255,0.5)",
                      border: autoUseItems ? "1px solid transparent" : "1px solid rgba(255,255,255,0.15)",
                    }}>
                    🎒 자동아이템 {autoUseItems?"ON":"OFF"}
                  </button>
                )}
                <div style={{flex:1, height:4, borderRadius:99, background:"rgba(255,255,255,0.08)"}}>
                  {!autoPilot && (
                    <div style={{height:"100%",borderRadius:99,width:`${(timerLeft/6)*100}%`,transition:"width 0.9s linear",background:timerLeft<=2?"#FF4444":timerLeft<=4?"#FFAA22":"#44AAFF",boxShadow:timerLeft<=2?"0 0 8px #FF4444":undefined,animation:timerLeft<=2?"pulse 0.6s infinite":undefined}}/>
                  )}
                </div>
              </div>
            )}

            {/* 양쪽 카드 */}
            <div className="flex items-end justify-center gap-2" style={{minHeight:210}}>
              {/* 내 카드 */}
              <div className="flex flex-col items-center gap-1.5" style={{flex:1}}>
                <div style={{position:"relative"}}>
                  {myDanger&&<div style={{position:"absolute",top:-8,left:"50%",transform:"translateX(-50%)",zIndex:10,background:"#FF3333",color:"white",fontSize:9,fontWeight:900,padding:"2px 6px",borderRadius:99,whiteSpace:"nowrap"}}>⚠️ 위기</div>}
                  {myStunVis&&<div style={{position:"absolute",top:-8,left:"50%",transform:"translateX(-50%)",zIndex:10,background:"#8800CC",color:"white",fontSize:9,fontWeight:900,padding:"2px 6px",borderRadius:99,whiteSpace:"nowrap"}}>{(myStunFlavor && STUN_LABEL[myStunFlavor]) || "💫 기절"}</div>}
                  {myStatusBadges.length>0&&(
                    <div style={{position:"absolute",top:-8,right:-4,zIndex:10,display:"flex",flexDirection:"column",gap:2}}>
                      {myStatusBadges.map((b,i)=>(<span key={i} style={{background:"rgba(0,0,0,0.75)",color:"#FFAA88",fontSize:9,fontWeight:900,padding:"1px 5px",borderRadius:99,whiteSpace:"nowrap"}}>{b}</span>))}
                    </div>
                  )}
                  <div style={cardStyle(myAnim,"left")}><CatCard name={selected.name} photoUrl={selected.photo_url} card={toCard(selected)} size="sm"/></div>
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
                    <div key={`me${Date.now()}`} style={{position:"absolute",top:"25%",left:"50%",transform:"translateX(-50%)",fontWeight:900,color:dmgPopup.isCrit?"#FFD700":"white",fontSize:dmgPopup.msg?13:18,textShadow:"0 2px 8px rgba(0,0,0,0.9)",animation:"dPop 0.8s ease forwards",pointerEvents:"none",whiteSpace:"nowrap"}}>
                      {dmgPopup.msg||(dmgPopup.val>0?`-${dmgPopup.val}`:"")}
                    </div>
                  )}
                  {myGuardVis&&<div style={{position:"absolute",bottom:-4,left:"50%",transform:"translateX(-50%)",fontSize:9,color:"#4488FF",fontWeight:900,whiteSpace:"nowrap"}}>🛡️ 방어중</div>}
                </div>
                <span className="text-[10px] text-purple-300 font-bold">내 카드</span>
                <div style={{width:"100%",maxWidth:130}}>
                  <div className="flex justify-between text-[9px] mb-0.5">
                    <span style={{color:myDanger?"#FF6060":"#88CC88",fontWeight:700}}>HP</span>
                    <span style={{color:myDanger?"#FF6060":"rgba(255,255,255,0.55)",fontWeight:700}}>{myHp}/{myMaxHp}</span>
                  </div>
                  <HpBar current={myHp} max={myMaxHp}/>
                </div>
              </div>

              {/* 중앙 메시지 */}
              <div className="flex flex-col items-center shrink-0" style={{minWidth:48}}>
                <span style={{fontSize:18,fontWeight:900,color:"rgba(255,255,255,0.2)"}}>VS</span>
                {actionMsg&&<div key={actionMsg} style={{fontSize:9,fontWeight:800,color:"#FFD700",textAlign:"center",maxWidth:60,lineHeight:1.3,marginTop:4,animation:"msgIn 0.3s ease"}}>{actionMsg}</div>}
              </div>

              {/* 상대 카드 */}
              <div className="flex flex-col items-center gap-1.5" style={{flex:1}}>
                <div style={{position:"relative"}}>
                  {oppDanger&&<div style={{position:"absolute",top:-8,left:"50%",transform:"translateX(-50%)",zIndex:10,background:"#FF3333",color:"white",fontSize:9,fontWeight:900,padding:"2px 6px",borderRadius:99,whiteSpace:"nowrap"}}>⚠️ 위기</div>}
                  {oppStunVis&&<div style={{position:"absolute",top:-8,left:"50%",transform:"translateX(-50%)",zIndex:10,background:"#8800CC",color:"white",fontSize:9,fontWeight:900,padding:"2px 6px",borderRadius:99,whiteSpace:"nowrap"}}>{(oppStunFlavor && STUN_LABEL[oppStunFlavor]) || "💫 기절"}</div>}
                  {oppStatusBadges.length>0&&(
                    <div style={{position:"absolute",top:-8,right:-4,zIndex:10,display:"flex",flexDirection:"column",gap:2}}>
                      {oppStatusBadges.map((b,i)=>(<span key={i} style={{background:"rgba(0,0,0,0.75)",color:"#FFAA88",fontSize:9,fontWeight:900,padding:"1px 5px",borderRadius:99,whiteSpace:"nowrap"}}>{b}</span>))}
                    </div>
                  )}
                  <div style={cardStyle(oppAnim,"right")}><CatCard name={opponent.name} photoUrl={opponent.photo_url} card={toCard(opponent)} size="sm"/></div>
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
                    <div key={`op${Date.now()}`} style={{position:"absolute",top:"25%",left:"50%",transform:"translateX(-50%)",fontWeight:900,color:dmgPopup.isCrit?"#FFD700":"white",fontSize:dmgPopup.msg?13:18,textShadow:"0 2px 8px rgba(0,0,0,0.9)",animation:"dPop 0.8s ease forwards",pointerEvents:"none",whiteSpace:"nowrap"}}>
                      {dmgPopup.msg||(dmgPopup.val>0?`-${dmgPopup.val}`:"")}
                    </div>
                  )}
                  {oppGuardVis&&<div style={{position:"absolute",bottom:-4,left:"50%",transform:"translateX(-50%)",fontSize:9,color:"#4488FF",fontWeight:900,whiteSpace:"nowrap"}}>🛡️ 방어중</div>}
                </div>
                <span className="text-[10px] text-gray-400 font-bold">상대방</span>
                <div style={{width:"100%",maxWidth:130}}>
                  <div className="flex justify-between text-[9px] mb-0.5">
                    <span style={{color:oppDanger?"#FF6060":"#88CC88",fontWeight:700}}>HP</span>
                    <span style={{color:oppDanger?"#FF6060":"rgba(255,255,255,0.55)",fontWeight:700}}>{oppHp}/{oppMaxHp}</span>
                  </div>
                  <HpBar current={oppHp} max={oppMaxHp}/>
                </div>
              </div>
            </div>

            {/* 수동: 기술 버튼 (타이머 포함) */}
            {mode==="manual"&&(
              <div>
                {phase==="player_choose"&&(
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] text-gray-500">{autoPilot?"자동으로 선택 중...":"기술 선택"}</span>
                    {!autoPilot && <span className="text-[13px] font-black" style={{color:timerLeft<=2?"#FF4444":timerLeft<=4?"#FFAA22":"#88CCFF"}}>{timerLeft}s</span>}
                  </div>
                )}
                <div className="flex gap-2 mb-2">
                  {mySkills.slice(SKILL_START_IDX).map((sk,j)=>{
                    const i = SKILL_START_IDX + j;
                    return (
                      <SkillBtn key={i} skill={sk} idx={i} disabled={phase!=="player_choose"} cooldown={mySkillCd[i]} onPick={pickSkill}/>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  {mySkills.slice(0, SKILL_START_IDX).map((sk,i)=>(
                    <SkillBtn key={i} skill={sk} idx={i} disabled={phase!=="player_choose"} cooldown={mySkillCd[i]}
                      usesLeft={i===NORMAL_IDX?myNormalUses:i===GUARD_IDX?myGuardUses:undefined} onPick={pickSkill}/>
                  ))}
                </div>

                {/* 아이템 사용 */}
                {phase==="player_choose"&&(
                  <div className="mt-2">
                    <button onClick={()=>setItemPanelOpen(o=>!o)}
                      className="w-full py-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5"
                      style={{ background:"rgba(255,180,0,0.14)", color:"#FFCC66" }}>
                      🎒 아이템 사용 {itemPanelOpen?"▲":"▼"}
                    </button>
                    {itemPanelOpen && (
                      <div className="grid grid-cols-3 gap-1.5 mt-2">
                        {BATTLE_ITEM_KEYS.map(key=>{
                          const item = SHOP_ITEMS[key];
                          const qty = inventory[key] ?? 0;
                          return (
                            <button key={key} onClick={()=>qty>0&&useItem(key)} disabled={qty<=0}
                              className="rounded-xl p-2 flex flex-col items-center gap-0.5"
                              style={{ background:"rgba(255,255,255,0.06)", opacity: qty>0?1:0.35 }}>
                              <span style={{ fontSize:18 }}>{item.icon}</span>
                              <span className="text-[9px] font-bold text-white text-center leading-tight">{item.name}</span>
                              <span className="text-[8px] text-gray-500">보유 {qty}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {phase==="opp_thinking"&&(
                  <p className="text-center text-[11px] text-gray-500 mt-2 animate-pulse">{actionMsg}</p>
                )}
              </div>
            )}

            {/* 자동: 액션 메시지 */}
            {mode==="auto"&&actionMsg&&(
              <div className="rounded-2xl px-4 py-2.5 text-center" style={{background:"rgba(255,255,255,0.05)"}}>
                <p key={actionMsg} className="text-[12px] text-gray-200 font-semibold" style={{animation:"msgIn 0.25s ease"}}>{actionMsg}</p>
              </div>
            )}
          </div>
        )}

        {/* ──────── 결과 화면 ──────── */}
        {phase==="result"&&selected&&opponent&&battleResult&&(
          <div className="flex-1 flex flex-col items-center justify-center px-4 gap-4">
            <div style={{animation:"resIn 0.5s ease forwards",display:"flex",flexDirection:"column",alignItems:"center",gap:12,width:"100%",maxWidth:340}}>
              <div style={{fontSize:64}}>{battleResult.winner==="me"?"🏆":"💔"}</div>
              <p style={{fontSize:26,fontWeight:900,color:battleResult.winner==="me"?"#44FF88":"#FF6060",textShadow:`0 0 24px ${battleResult.winner==="me"?"#44FF88":"#FF6060"}`}}>
                {battleResult.winner==="me"?"승리!":"패배..."}
              </p>
              <p className="text-[13px] text-gray-400">
                {turnCount}턴 · EXP +{battleResult.exp}
                {battleResult.leveledUp&&<span style={{color:"#FFD700",fontWeight:800,marginLeft:8}}>⬆ Lv.{battleResult.newLevel}!</span>}
              </p>
              <div className="w-full rounded-2xl p-3 space-y-2" style={{background:"rgba(255,255,255,0.05)"}}>
                <div className="flex gap-3 items-center">
                  <span className="text-[11px] text-purple-300 font-bold shrink-0 w-14 truncate">{selected.name}</span>
                  <div style={{flex:1}}><HpBar current={myHp} max={myMaxHp}/></div>
                  <span className="text-[10px] text-gray-500 shrink-0">{myHp}/{myMaxHp}</span>
                </div>
                <div className="flex gap-3 items-center">
                  <span className="text-[11px] text-gray-400 font-bold shrink-0 w-14 truncate">{opponent.name}</span>
                  <div style={{flex:1}}><HpBar current={oppHp} max={oppMaxHp}/></div>
                  <span className="text-[10px] text-gray-500 shrink-0">{oppHp}/{oppMaxHp}</span>
                </div>
              </div>
              <div className="flex gap-2 w-full">
                <button onClick={reset} className="flex-1 py-3 rounded-2xl font-bold text-[14px] text-white" style={{background:"rgba(255,255,255,0.1)"}}>다시 선택</button>
                <button onClick={startBattle} className="flex-1 py-3 rounded-2xl font-bold text-[14px] text-white flex items-center justify-center gap-1" style={{background:"linear-gradient(135deg,#8040D0,#C060FF)"}}>
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
