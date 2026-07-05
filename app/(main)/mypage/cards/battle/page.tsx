"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Swords, Zap, Shield, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import CatCard, { type CatCardData, type CardRarity } from "@/app/components/CatCard";
import { SPECIAL_SKILLS } from "@/lib/battle-config";

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

// 스킬별 쿨다운 턴수 [normal, heavy, guard, special]
const SKILL_COOLDOWNS = [0, 2, 1, 2];

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
}
interface BattleStats { hp: number; atk: number; def: number; spd: number; }
interface Skill { name: string; icon: string; type: "normal"|"heavy"|"guard"|"special"; desc: string; color: string; }
type Phase = "select"|"loading"|"countdown"|"player_choose"|"animating"|"opp_thinking"|"result";
type Mode = "manual"|"auto";
type CardAnim = "idle"|"attack"|"hit"|"dodge";

interface AutoLogEntry { turn:number; actor:string; dmg:number; aHp:number; dHp:number; isCritical:boolean; isDodge:boolean; isCounterAttack:boolean; skillName:string; }
interface AutoResult { winner:"me"|"opponent"; my_hp_left:number; opp_hp_left:number; my_max_hp:number; opp_max_hp:number; rounds:number; log:AutoLogEntry[]; exp_gained:number; my_new_level:number; leveled_up:boolean; }

/* ──────────── 헬퍼 ──────────── */
function buildSkills(cat: BattleCat): Skill[] {
  const specialId  = cat.battle_special  ?? "sharp_claws";
  const special2Id = cat.battle_special2 ?? "scratch";
  const special  = SPECIAL_SKILLS[specialId  as keyof typeof SPECIAL_SKILLS] ?? SPECIAL_SKILLS.sharp_claws;
  const special2 = SPECIAL_SKILLS[special2Id as keyof typeof SPECIAL_SKILLS] ?? SPECIAL_SKILLS.scratch;
  return [
    { name: "기본 공격", icon:"⚔️", type:"normal",  desc:`공격 (ATK ${cat.battle_atk??40})`, color:"#7070AA" },
    { name: special2.name, icon:special2.icon, type:"heavy",   desc:special2.desc, color:"#DD4422" },
    { name: "방어 자세", icon:"🛡️", type:"guard",   desc:`방어 (DEF ${cat.battle_def??25})`, color:"#2255CC" },
    { name: special.name,  icon:special.icon,  type:"special", desc:special.desc,  color:"#9933CC" },
  ];
}
function calcDmg(atk: number, def: number, mult: number, critChance: number) {
  const base = Math.max(5, (atk - def * 0.4) * (0.85 + Math.random() * 0.35));
  const isCrit = Math.random() * 100 < critChance;
  return { dmg: Math.round(base * mult * (isCrit ? 1.8 : 1)), isCrit };
}
function checkEvasion(evaChance: number): boolean {
  return Math.random() * 100 < evaChance;
}
function oppAI(skill: number, hp: number, maxHp: number): number {
  const ratio = hp / maxHp;
  if (ratio < 0.25) return Math.random() < 0.55 ? 3 : 1; // 특수기 or 강공격
  if (ratio < 0.55) return [1,1,0,2][Math.floor(Math.random()*4)];
  return Math.floor(Math.random() * 4);
}
function toCard(cat: BattleCat): CatCardData {
  return { card_rarity:cat.card_rarity, card_name:cat.card_name, card_traits:cat.card_traits??[], card_stats:cat.card_stats, card_flavor:cat.card_flavor, card_level:cat.card_level, card_exp:cat.card_exp };
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

/* ──────────── 기술 버튼 ──────────── */
function SkillBtn({ skill, idx, disabled, cooldown=0, onPick }: { skill:Skill; idx:number; disabled:boolean; cooldown?:number; onPick:(i:number)=>void }) {
  const icons = [<Swords key={0} size={14}/>, <Zap key={1} size={14}/>, <Shield key={2} size={14}/>, <Sparkles key={3} size={14}/>];
  const isCd = cooldown > 0;
  const isOff = disabled || isCd;
  return (
    <button onClick={() => !isOff && onPick(idx)} disabled={isOff}
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
      {isCd && (
        <div style={{ position:"absolute", inset:0, borderRadius:14, background:"rgba(0,0,0,0.65)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:1 }}>
          <span style={{ fontSize:18, fontWeight:900, color:"#FF8888" }}>{cooldown}</span>
          <span style={{ fontSize:8, color:"rgba(255,180,180,0.8)" }}>쿨다운</span>
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
  const myStunnedRef = useRef(false);
  const oppStunnedRef = useRef(false);
  const [myGuardVis, setMyGuardVis] = useState(false);
  const [oppGuardVis, setOppGuardVis] = useState(false);
  const [myStunVis, setMyStunVis] = useState(false);
  const [oppStunVis, setOppStunVis] = useState(false);

  // 지속 상태이상 DoT/속박
  const myPoisonRef  = useRef(0);   // 남은 독 턴수
  const oppPoisonRef = useRef(0);
  const myBleedRef   = useRef(0);   // 남은 출혈 턴수
  const oppBleedRef  = useRef(0);
  const myBoundRef   = useRef(false);  // 속박(회피 불가)
  const oppBoundRef  = useRef(false);
  const [myStatusBadges,  setMyStatusBadges]  = useState<string[]>([]);
  const [oppStatusBadges, setOppStatusBadges] = useState<string[]>([]);

  // 스킬 쿨다운 [normal, heavy, guard, special]
  const mySkillCdRef = useRef([0,0,0,0]);
  const [mySkillCd,  setMySkillCd]  = useState([0,0,0,0]);

  // 애니메이션
  const [myAnim, setMyAnim] = useState<CardAnim>("idle");
  const [oppAnim, setOppAnim] = useState<CardAnim>("idle");
  const [critFlash, setCritFlash] = useState(false);
  const [dmgPopup, setDmgPopup] = useState<{target:"me"|"opp"; val:number; isCrit:boolean; msg?:string}|null>(null);
  const [actionMsg, setActionMsg] = useState("");
  const [turnCount, setTurnCount] = useState(0);

  // 타이머
  const [timerLeft, setTimerLeft] = useState(6);
  const timerRef = useRef<ReturnType<typeof setInterval>|null>(null);

  // 결과
  const [battleResult, setBattleResult] = useState<{winner:"me"|"opponent"; exp:number; newLevel:number; leveledUp:boolean}|null>(null);

  // 자동 전투용
  const [autoResult, setAutoResult] = useState<AutoResult|null>(null);
  const [autoLogIdx, setAutoLogIdx] = useState(0);
  const autoTimerRef = useRef<ReturnType<typeof setTimeout>|null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; clearTimer(); if(autoTimerRef.current) clearTimeout(autoTimerRef.current); };
  }, []);

  useEffect(() => {
    if (authLoading || !user) return;
    createClient().from("cats")
      .select("id,name,photo_url,card_rarity,card_name,card_traits,card_stats,card_flavor,card_level,card_exp,battle_atk,battle_def,battle_eva,battle_crit,battle_special,battle_special2")
      .eq("caretaker_id", user.id).not("card_generated_at","is",null)
      .order("card_level",{ascending:false})
      .then(({ data }:{ data:BattleCat[]|null }) => { if(mounted.current) setMyCats(data??[]); });
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
        if(mounted.current) pickSkill(null); // 타임오버 → 턴 패스 (상대에게 넘어감)
      }
    }, 1000);
  }, []); // eslint-disable-line

  useEffect(() => {
    if(phase !== "player_choose") { clearTimer(); return; }
    if(autoPilot) {
      clearTimer();
      const t = setTimeout(() => { if(mounted.current) pickSkill(oppAI(0, myHpRef.current, myMaxHp)); }, 500);
      return () => clearTimeout(t);
    }
    startTimer();
  }, [phase, autoPilot]); // eslint-disable-line

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
      myStunnedRef.current=false; oppStunnedRef.current=false;
      setMyGuardVis(false); setOppGuardVis(false);
      setMyStunVis(false); setOppStunVis(false);
      myPoisonRef.current=0; oppPoisonRef.current=0;
      myBleedRef.current=0; oppBleedRef.current=0;
      myBoundRef.current=false; oppBoundRef.current=false;
      setMyStatusBadges([]); setOppStatusBadges([]);
      mySkillCdRef.current=[0,0,0,0]; setMySkillCd([0,0,0,0]);
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

    // 환경 보정
    const env = battleEnvRef.current ? BATTLE_ENVS[battleEnvRef.current] : null;
    const envEvaBonus  = env?.evaBonus  ?? 0;
    const envCritBonus = env?.critBonus ?? 0;

    // 상성 보정 (카드 등급 = 타입, 카드에 표시된 "약점" 그대로 적용)
    const atkType = RARITY_TYPE[attacker.card_rarity] ?? "grass";
    const defType = RARITY_TYPE[defender.card_rarity] ?? "grass";
    const isEffective = WEAK_TO[defType] === atkType;
    const envDmgMult = (env?.dmgMult ?? 1.0) * (isEffective ? 2.0 : 1.0);

    // 이번에 사용할 스킬 ID 미리 확인 (야습의 회피 무시 판정에 필요)
    const usedSkillId = skill.type === "special" ? (attacker.battle_special ?? "sharp_claws")
                      : skill.type === "heavy"   ? (attacker.battle_special2 ?? "scratch")
                      : null;
    const forceHit = usedSkillId === "night_prowl";

    // 속박 체크 (속박 상태면 회피 불가)
    const defBound = isPlayer ? oppBoundRef.current : myBoundRef.current;
    if (isPlayer) oppBoundRef.current = false; else myBoundRef.current = false;

    // 회피 체크 (공격 전, 속박/야습 시 무조건 맞음)
    const defEva = (defender.battle_eva ?? 8) + envEvaBonus;
    if(!defBound && !forceHit && skill.type !== "guard" && checkEvasion(defEva)) {
      if(isPlayer){ setOppAnim("dodge"); } else { setMyAnim("dodge"); }
      setTimeout(()=>{ setMyAnim("idle"); setOppAnim("idle"); }, 350);
      return { dmg:0, isCrit:false, msg:"💨 회피!", dodged:true };
    }

    const atkCrit = (attacker.battle_crit ?? 8) + envCritBonus;
    const ownMaxHp = isPlayer ? myMaxH : oppMaxH;
    let dmg=0, isCrit=false, msg="";

    // 카드 고유 특수 스킬 실행 (강공격/특수기 슬롯 공용)
    const runSpecial = (skillId: string): { dmg:number; isCrit:boolean; msg:string } => {
      let sDmg=0, sCrit=false, sMsg="";
      switch(skillId) {
        case "sharp_claws": { const r=calcDmg(atkSt.atk,defSt.def,1.4*envDmgMult,atkCrit); sDmg=r.dmg; sCrit=r.isCrit; sMsg="🐾 날카로운 발톱!"; break; }
        case "quick_dodge":   sMsg="💨 재빠른 도약!"; if(isPlayer){myGuardRef.current=true;setMyGuardVis(true);}else{oppGuardRef.current=true;setOppGuardVis(true);} break;
        case "focus":        { const r=calcDmg(atkSt.atk,defSt.def,1.0*envDmgMult,100); sDmg=r.dmg; sCrit=true; sMsg="👁️ 집중! 크리티컬 확정"; break; }
        case "intimidate_sm": { const r=calcDmg(atkSt.atk*0.6,defSt.def,1.0,atkCrit); sDmg=r.dmg; sCrit=r.isCrit; if(isPlayer){oppBoundRef.current=true;}else{myBoundRef.current=true;} sMsg="😠 견제! 다음 공격 회피 불가"; break; }
        case "hiss":
          if(Math.random()<0.4){ if(isPlayer){oppStunnedRef.current=true;setOppStunVis(true);}else{myStunnedRef.current=true;setMyStunVis(true);} sMsg="😾 하악 위협! 기절"; }
          else sMsg="😾 하악... 실패";
          break;
        case "grooming":   { const heal=Math.round(ownMaxHp*0.10); if(isPlayer)setMyHp(Math.min(myMaxH,myHpRef.current+heal));else setOppHp(Math.min(oppMaxH,oppHpRef.current+heal)); sMsg=`🧼 그루밍! +${heal}HP 회복`; break; }
        case "warm_nap":   { const heal=Math.round(ownMaxHp*0.08); if(isPlayer)setMyHp(Math.min(myMaxH,myHpRef.current+heal));else setOppHp(Math.min(oppMaxH,oppHpRef.current+heal)); sMsg=`😴 따뜻한 낮잠! +${heal}HP 회복`; break; }
        case "tail_whip":  { const r=calcDmg(atkSt.atk,defSt.def*0.7,1.0*envDmgMult,atkCrit); sDmg=r.dmg; sCrit=r.isCrit; sMsg="🐈 꼬리 치기! 방어 일부 무시"; break; }
        case "freeze":
          if(Math.random()<0.6){ if(isPlayer){oppStunnedRef.current=true;setOppStunVis(true);}else{myStunnedRef.current=true;setMyStunVis(true);} sMsg="❄️ 얼리기 성공! 기절"; }
          else sMsg="❄️ 얼리기... 저항!";
          break;
        case "scratch":    { const r=calcDmg(atkSt.atk,defSt.def,0.8*envDmgMult,atkCrit); sDmg=r.dmg; sCrit=r.isCrit; if(isPlayer)oppBleedRef.current=2;else myBleedRef.current=2; sMsg="🩸 할퀴기! 출혈 2턴"; break; }
        case "intimidate":  { if(isPlayer){oppStunnedRef.current=true;setOppStunVis(true);}else{myStunnedRef.current=true;setMyStunVis(true);} sMsg="😱 공포의 눈빛! 기절"; break; }
        case "pounce":     { const r=calcDmg(atkSt.atk,5,1.1*envDmgMult,atkCrit); sDmg=r.dmg; sCrit=r.isCrit; sMsg="🦘 도약 강타! 방어 무시"; break; }
        case "ambush":     { const r=calcDmg(atkSt.atk,defSt.def,1.2*envDmgMult,100); sDmg=r.dmg; sCrit=true; sMsg="🌑 급습! 크리티컬 확정"; break; }
        case "static_shock":
          if(Math.random()<0.4){ if(isPlayer){oppStunnedRef.current=true;setOppStunVis(true);}else{myStunnedRef.current=true;setMyStunVis(true);} sMsg="⚡ 정전기! 기절"; }
          else sMsg="⚡ 정전기... 실패";
          break;
        case "night_prowl": { const r=calcDmg(atkSt.atk,defSt.def,1.1*envDmgMult,atkCrit); sDmg=r.dmg; sCrit=r.isCrit; sMsg="🌌 야습! 회피 불가 관통"; break; }
        case "thunderclap": {
          const r=calcDmg(atkSt.atk,defSt.def,0.6*envDmgMult,atkCrit); sDmg=r.dmg; sCrit=r.isCrit;
          if(Math.random()<0.35){ if(isPlayer){oppStunnedRef.current=true;setOppStunVis(true);}else{myStunnedRef.current=true;setMyStunVis(true);} sMsg="🌩️ 천둥벽력! 기절"; }
          else sMsg="🌩️ 천둥벽력!";
          break;
        }
        case "poison":     { const r=calcDmg(atkSt.atk,defSt.def,0.7*envDmgMult,atkCrit); sDmg=r.dmg; sCrit=r.isCrit; if(isPlayer)oppPoisonRef.current=3;else myPoisonRef.current=3; sMsg="☠️ 독 중독! 3턴 지속"; break; }
        case "bind":       { if(isPlayer)oppBoundRef.current=true;else myBoundRef.current=true; sMsg="⛓️ 속박! 다음 공격 회피 불가"; break; }
        case "slow":       { if(isPlayer){oppStunnedRef.current=true;setOppStunVis(true);}else{myStunnedRef.current=true;setMyStunVis(true);} sMsg="🐌 느리게! 1턴 스킵"; break; }
        case "double_strike": {
          const r1=calcDmg(atkSt.atk,defSt.def,0.8*envDmgMult,atkCrit);
          const r2=calcDmg(atkSt.atk,defSt.def,0.8*envDmgMult,atkCrit);
          sDmg=r1.dmg+r2.dmg; sCrit=r1.isCrit||r2.isCrit;
          sMsg=`⚡ 연속 공격! ${r1.dmg}+${r2.dmg}`;
          break;
        }
        case "rend":       { const r=calcDmg(atkSt.atk,5,1.0*envDmgMult,atkCrit); sDmg=r.dmg; sCrit=r.isCrit; if(isPlayer)oppBleedRef.current=2;else myBleedRef.current=2; sMsg="🗡️ 찢기! 방어 무시+출혈"; break; }
        case "howl":       { if(isPlayer)oppBoundRef.current=true;else myBoundRef.current=true; sMsg="🐺 하울링! 속박"; break; }
        case "frenzy":     { const r=calcDmg(atkSt.atk,defSt.def,1.6*envDmgMult,atkCrit); sDmg=r.dmg; sCrit=r.isCrit; sMsg="🔱 맹공!"; break; }
        case "curse":      { const r=calcDmg(atkSt.atk,defSt.def,0.7*envDmgMult,atkCrit); sDmg=r.dmg; sCrit=r.isCrit; if(isPlayer)oppPoisonRef.current=4;else myPoisonRef.current=4; sMsg="👹 저주! 4턴 지속"; break; }
        case "vampirism":  { const r=calcDmg(atkSt.atk,defSt.def,1.2*envDmgMult,atkCrit); sDmg=r.dmg; sCrit=r.isCrit; const heal=Math.round(sDmg*0.3); if(isPlayer)setMyHp(Math.min(myMaxH,myHpRef.current+heal));else setOppHp(Math.min(oppMaxH,oppHpRef.current+heal)); sMsg=`🧛 흡혈! +${heal}HP 흡수`; break; }
        case "invincible": { if(isPlayer){myGuardRef.current=true;setMyGuardVis(true);}else{oppGuardRef.current=true;setOppGuardVis(true);} sMsg="✨ 무적 발동! 다음 피해 무효"; break; }
        case "dominate":   { const r=calcDmg(atkSt.atk*1.2,5,1.0*envDmgMult,atkCrit); sDmg=r.dmg; sCrit=r.isCrit; if(isPlayer){oppBoundRef.current=true;oppPoisonRef.current=2;}else{myBoundRef.current=true;myPoisonRef.current=2;} sMsg="👑 지배! 속박+독"; break; }
        case "regen":      { const heal=Math.round(ownMaxHp*0.12); if(isPlayer)setMyHp(Math.min(myMaxH,myHpRef.current+heal));else setOppHp(Math.min(oppMaxH,oppHpRef.current+heal)); sMsg=`💚 재생! +${heal}HP`; break; }
        case "eclipse":    { const r=calcDmg(atkSt.atk,defSt.def,1.3*envDmgMult,atkCrit); sDmg=r.dmg; sCrit=r.isCrit; const heal=Math.round(ownMaxHp*0.15); if(isPlayer)setMyHp(Math.min(myMaxH,myHpRef.current+heal));else setOppHp(Math.min(oppMaxH,oppHpRef.current+heal)); sMsg=`🌘 월식! +${heal}HP 회복`; break; }
        case "overdrive":  { const r=calcDmg(atkSt.atk,defSt.def,1.8*envDmgMult,atkCrit); sDmg=r.dmg; sCrit=r.isCrit; const recoil=Math.round(ownMaxHp*0.08); if(isPlayer)setMyHp(Math.max(0,myHpRef.current-recoil));else setOppHp(Math.max(0,oppHpRef.current-recoil)); sMsg=`💢 폭주! 반동 -${recoil}HP`; break; }
        case "meteor":     { const r=calcDmg(atkSt.atk,defSt.def,2.0*envDmgMult,atkCrit); sDmg=r.dmg; sCrit=r.isCrit; sMsg="☄️ 메테오!"; break; }
        case "cleanse": {
          const heal=Math.round(ownMaxHp*0.10);
          if(isPlayer){
            myPoisonRef.current=0; myBleedRef.current=0; myBoundRef.current=false;
            myStunnedRef.current=false; setMyStunVis(false); setMyStatusBadges([]);
            setMyHp(Math.min(myMaxH,myHpRef.current+heal));
          } else {
            oppPoisonRef.current=0; oppBleedRef.current=0; oppBoundRef.current=false;
            oppStunnedRef.current=false; setOppStunVis(false); setOppStatusBadges([]);
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
      case "heavy":  { const r=runSpecial(attacker.battle_special2 ?? "scratch"); dmg=r.dmg; isCrit=r.isCrit; msg=r.msg; break; }
      case "guard": {
        if(isPlayer){ myGuardRef.current=true; setMyGuardVis(true); }
        else { oppGuardRef.current=true; setOppGuardVis(true); }
        msg="🛡️ 방어 자세!";
        break;
      }
      case "special": { const r=runSpecial(attacker.battle_special ?? "sharp_claws"); dmg=r.dmg; isCrit=r.isCrit; msg=r.msg; break; }
    }

    // 상성 우위 표시
    if(dmg>0 && isEffective) {
      msg = msg ? `${msg} · 효과는 굉장했다!` : "효과는 굉장했다!";
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

    return { dmg, isCrit, msg, dodged:false };
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
    if(oppPoisonRef.current>0) oppBadges.push(`☠️${oppPoisonRef.current}`);
    if(oppBleedRef.current>0) oppBadges.push(`🩸${oppBleedRef.current}`);
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

  const pickSkill = useCallback((skillIdx: number | null) => {
    if(!myStats || !oppStats || !selected || !opponent || !mounted.current) return;
    if(skillIdx !== null && mySkillCdRef.current[skillIdx] > 0) return;
    clearTimer();
    setPhase("animating");

    let dmg = 0, isCrit = false, msg = "";
    if(skillIdx === null) {
      // 타임오버: 아무 행동 없이 턴 패스
      msg = "⏰ 시간 초과! 턴 패스";
      setActionMsg(msg);
    } else {
      if(SKILL_COOLDOWNS[skillIdx] > 0) {
        mySkillCdRef.current[skillIdx] = SKILL_COOLDOWNS[skillIdx];
        setMySkillCd([...mySkillCdRef.current]);
      }
      const r = applySkill(skillIdx, true, myStats, oppStats, myMaxHp, oppMaxHp, selected, opponent);
      dmg = r.dmg; isCrit = r.isCrit; msg = r.msg;
      const skill = mySkills[skillIdx];
      setActionMsg(`${selected.name}의 ${skill.name}!${isCrit?" 💥 크리티컬!":""}${msg?" "+msg:""}`);
      setMyAnim("attack");
    }

    setTimeout(() => {
      if(!mounted.current) return;
      setMyAnim("idle");
      if(dmg>0) {
        setOppAnim("hit");
        setDmgPopup({ target:"opp", val:dmg, isCrit, msg:msg||undefined });
        if(isCrit){ setCritFlash(true); navigator.vibrate?.([80,30,80]); }
        else navigator.vibrate?.(35);
      } else if(msg) {
        setDmgPopup({ target:"me", val:0, isCrit:false, msg });
      }

      setTimeout(() => {
        if(!mounted.current) return;
        setOppAnim("idle"); setDmgPopup(null); setCritFlash(false);

        if(oppHpRef.current<=0) { endBattle("me"); return; }

        // 상대 턴
        setPhase("opp_thinking");
        const isStunned = oppStunnedRef.current;
        setActionMsg(isStunned ? `${opponent.name}는 기절해서 움직일 수 없다!` : `${opponent.name}가 기술을 선택 중...`);
        if(isStunned) oppStunnedRef.current=false;

        setTimeout(() => {
          if(!mounted.current) return;
          if(isStunned) {
            setTurnCount(t=>t+1);
            setOppStunVis(false);
            if(applyDotTick()) return;
            if(myStunnedRef.current) { myStunnedRef.current=false; setMyStunVis(false); setActionMsg("기절해서 행동할 수 없다!"); setTimeout(()=>{ if(mounted.current){ setActionMsg("기술을 선택하세요!"); setPhase("player_choose"); }}, 1200); }
            else { setActionMsg("기술을 선택하세요!"); setPhase("player_choose"); }
            return;
          }

          // AI 기술 선택
          const aiSkillIdx = oppAI(0, oppHpRef.current, oppMaxHp);
          const { dmg:od, isCrit:oc, msg:om } = applySkill(aiSkillIdx, false, myStats, oppStats, myMaxHp, oppMaxHp, selected, opponent);
          const oppSkill = oppSkills[aiSkillIdx];
          setActionMsg(`${opponent.name}의 ${oppSkill.name}!${oc?" 💥 크리티컬!":""}${om?" "+om:""}`);
          setOppAnim("attack");

          setTimeout(() => {
            if(!mounted.current) return;
            setOppAnim("idle");
            if(od>0) {
              setMyAnim("hit");
              setDmgPopup({ target:"me", val:od, isCrit:oc, msg:om||undefined });
              if(oc){ setCritFlash(true); navigator.vibrate?.([80,30,80]); }
              else navigator.vibrate?.(30);
            } else if(om) {
              setDmgPopup({ target:"opp", val:0, isCrit:false, msg:om });
            }

            setTimeout(() => {
              if(!mounted.current) return;
              setMyAnim("idle"); setDmgPopup(null); setCritFlash(false);

              if(myHpRef.current<=0) { endBattle("opponent"); return; }

              setTurnCount(t=>t+1);
              if(applyDotTick()) return;
              if(myStunnedRef.current) {
                myStunnedRef.current=false; setMyStunVis(false);
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

  /* ── 배틀 종료 ── */
  const endBattle = useCallback(async (winner:"me"|"opponent") => {
    if(!selected || !opponent) return;
    setPhase("result");
    setActionMsg(winner==="me"?"🏆 승리!":"💔 패배...");

    const res = await fetch("/api/cats/card-battle/record", {
      method:"POST", headers:{"content-type":"application/json"},
      body: JSON.stringify({ my_cat_id:selected.id, opp_cat_id:opponent.id, opp_caretaker_id:opponent.caretaker_id, winner, rounds:turnCount, my_hp_left:myHpRef.current, opp_hp_left:oppHpRef.current }),
    });
    const json = await res.json();
    if(mounted.current) setBattleResult({ winner, exp:json.exp_gained??0, newLevel:json.my_new_level??1, leveledUp:json.leveled_up??false });
  }, [selected, opponent, turnCount]);

  /* ── 리셋 ── */
  const reset = () => {
    clearTimer();
    if(autoTimerRef.current) clearTimeout(autoTimerRef.current);
    setPhase("select"); setSelected(null); setOpponent(null);
    setMyStats(null); setOppStats(null); setAutoResult(null);
    setBattleResult(null); setTurnCount(0); setActionMsg("");
    setMyAnim("idle"); setOppAnim("idle"); setDmgPopup(null); setCritFlash(false);
    if(user) createClient().from("cats").select("id,name,photo_url,card_rarity,card_name,card_traits,card_stats,card_flavor,card_level,card_exp,battle_atk,battle_def,battle_eva,battle_crit,battle_special,battle_special2").eq("caretaker_id",user.id).not("card_generated_at","is",null).order("card_level",{ascending:false}).then(({data}:{data:BattleCat[]|null})=>{ if(mounted.current) setMyCats(data??[]); });
  };

  /* ── 카드 애니 스타일 ── */
  const cardStyle = (anim:CardAnim, side:"left"|"right"): React.CSSProperties => {
    const d = side==="left"?1:-1;
    if(anim==="attack") return { transform:`translateX(${d*20}px) scale(1.07)`, transition:"transform 0.18s ease-out", filter:"brightness(1.25)" };
    if(anim==="hit") return { animation:"bHit 0.35s ease" };
    if(anim==="dodge") return { transform:`translateY(-16px) rotate(${d*-6}deg)`, transition:"transform 0.22s", opacity:0.55 };
    return { transform:"translateX(0) scale(1)", transition:"transform 0.22s" };
  };

  const myDanger = myHp/Math.max(1,myMaxHp)<0.25;
  const oppDanger = oppHp/Math.max(1,oppMaxHp)<0.25;
  const isFightPhase = ["player_choose","animating","opp_thinking"].includes(phase);

  const dangerTint = myDanger&&!oppDanger ? "rgba(255,40,40,0.22)" : oppDanger&&!myDanger ? "rgba(60,255,110,0.14)" : "rgba(0,0,0,0)";
  const rootBg = battleEnv
    ? `linear-gradient(180deg, ${dangerTint} 0%, transparent 30%), ${ENV_BACKGROUNDS[battleEnv]}`
    : `linear-gradient(180deg,${myDanger&&!oppDanger?"#2A0A0A":oppDanger&&!myDanger?"#0A1A0A":"#0A0A18"} 0%,#1A0A2E 100%)`;

  return (
    <>
      <style>{`
        @keyframes bHit { 0%{transform:translateX(0)}20%{transform:translateX(-10px) rotate(-3deg)}50%{transform:translateX(9px) rotate(2.5deg)}75%{transform:translateX(-5px)}100%{transform:translateX(0)} }
        @keyframes dPop { 0%{opacity:1;transform:translateY(0)scale(1)}60%{opacity:1;transform:translateY(-26px)scale(1.25)}100%{opacity:0;transform:translateY(-42px)scale(0.9)} }
        @keyframes cdPop { 0%{opacity:0;transform:scale(0.3)}45%{opacity:1;transform:scale(1.18)}70%{transform:scale(0.94)}100%{transform:scale(1)} }
        @keyframes msgIn { 0%{opacity:0;transform:translateY(5px)}100%{opacity:1;transform:translateY(0)} }
        @keyframes resIn { 0%{opacity:0;transform:scale(0.6)}65%{transform:scale(1.1)}100%{opacity:1;transform:scale(1)} }
        @keyframes pulse { 0%,100%{box-shadow:0 0 0 0 rgba(255,50,50,0.5)}50%{box-shadow:0 0 0 6px rgba(255,50,50,0)} }
      `}</style>

      {critFlash && <div style={{position:"fixed",inset:0,zIndex:999,background:"rgba(255,200,0,0.3)",pointerEvents:"none"}}/>}

      <div className="min-h-dvh flex flex-col" style={{ background:rootBg, transition:"background 1.2s" }}>

        {/* 헤더 */}
        <div className="flex items-center gap-3 px-4 pt-safe pt-4 pb-3 shrink-0" style={{background:"rgba(10,10,24,0.85)",backdropFilter:"blur(12px)"}}>
          <button onClick={()=>{reset();router.back();}} className="w-9 h-9 rounded-full flex items-center justify-center" style={{background:"rgba(255,255,255,0.08)"}}>
            <ArrowLeft size={18} color="white"/>
          </button>
          <h1 className="text-[17px] font-extrabold text-white flex items-center gap-2"><Swords size={18}/> 카드 배틀</h1>
          {isFightPhase && <span className="ml-auto text-[12px] text-gray-500 font-bold">{turnCount}턴</span>}
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
                  {myStunVis&&<div style={{position:"absolute",top:-8,left:"50%",transform:"translateX(-50%)",zIndex:10,background:"#8800CC",color:"white",fontSize:9,fontWeight:900,padding:"2px 6px",borderRadius:99,whiteSpace:"nowrap"}}>💫 기절</div>}
                  {myStatusBadges.length>0&&(
                    <div style={{position:"absolute",top:-8,right:-4,zIndex:10,display:"flex",flexDirection:"column",gap:2}}>
                      {myStatusBadges.map((b,i)=>(<span key={i} style={{background:"rgba(0,0,0,0.75)",color:"#FFAA88",fontSize:9,fontWeight:900,padding:"1px 5px",borderRadius:99,whiteSpace:"nowrap"}}>{b}</span>))}
                    </div>
                  )}
                  <div style={cardStyle(myAnim,"left")}><CatCard name={selected.name} photoUrl={selected.photo_url} card={toCard(selected)} size="sm"/></div>
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
                  {oppStunVis&&<div style={{position:"absolute",top:-8,left:"50%",transform:"translateX(-50%)",zIndex:10,background:"#8800CC",color:"white",fontSize:9,fontWeight:900,padding:"2px 6px",borderRadius:99,whiteSpace:"nowrap"}}>💫 기절</div>}
                  {oppStatusBadges.length>0&&(
                    <div style={{position:"absolute",top:-8,right:-4,zIndex:10,display:"flex",flexDirection:"column",gap:2}}>
                      {oppStatusBadges.map((b,i)=>(<span key={i} style={{background:"rgba(0,0,0,0.75)",color:"#FFAA88",fontSize:9,fontWeight:900,padding:"1px 5px",borderRadius:99,whiteSpace:"nowrap"}}>{b}</span>))}
                    </div>
                  )}
                  <div style={cardStyle(oppAnim,"right")}><CatCard name={opponent.name} photoUrl={opponent.photo_url} card={toCard(opponent)} size="sm"/></div>
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
                <div className="flex gap-2">
                  {mySkills.map((sk,i)=>(
                    <SkillBtn key={i} skill={sk} idx={i} disabled={phase!=="player_choose"} cooldown={mySkillCd[i]} onPick={pickSkill}/>
                  ))}
                </div>
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
