"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Swords, Zap, Shield, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import CatCard, { type CatCardData, type CardRarity } from "@/app/components/CatCard";

/* ──────────── 타입 ──────────── */
interface BattleCat {
  id: string; name: string; photo_url: string | null;
  card_rarity: CardRarity; card_name: string | null;
  card_traits: string[]; card_stats: CatCardData["card_stats"];
  card_flavor: string | null; card_level: number; card_exp: number;
  caretaker_id?: string;
}
interface BattleStats { hp: number; atk: number; def: number; spd: number; }
interface Skill { name: string; icon: string; type: "normal"|"heavy"|"guard"|"special"; desc: string; color: string; }
type Phase = "select"|"loading"|"countdown"|"player_choose"|"animating"|"opp_thinking"|"result";
type Mode = "manual"|"auto";
type CardAnim = "idle"|"attack"|"hit"|"dodge";

interface AutoLogEntry { turn:number; actor:string; dmg:number; aHp:number; dHp:number; isCritical:boolean; isDodge:boolean; isCounterAttack:boolean; skillName:string; }
interface AutoResult { winner:"me"|"opponent"; my_hp_left:number; opp_hp_left:number; my_max_hp:number; opp_max_hp:number; rounds:number; log:AutoLogEntry[]; exp_gained:number; my_new_level:number; leveled_up:boolean; }

/* ──────────── 헬퍼 ──────────── */
function buildSkills(traits: string[]): Skill[] {
  return [
    { name: "기본 공격",        icon:"⚔️", type:"normal",  desc:"안정적인 일격 (1.0×)",  color:"#7070AA" },
    { name: traits[0]??"강공격", icon:"💥", type:"heavy",   desc:"강력 공격 (1.5×)",      color:"#DD4422" },
    { name: traits[1]??"방어",   icon:"🛡️", type:"guard",   desc:"다음 피해 -40%",        color:"#2255CC" },
    { name: traits[2]??"비장의 수", icon:"✨", type:"special", desc:"??? 랜덤 특수기",    color:"#9933CC" },
  ];
}
function calcDmg(atk: number, def: number, mult: number) {
  const base = Math.max(5, (atk - def * 0.4) * (0.85 + Math.random() * 0.35));
  const isCrit = Math.random() < 0.08;
  return { dmg: Math.round(base * mult * (isCrit ? 1.8 : 1)), isCrit };
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
function SkillBtn({ skill, idx, disabled, onPick }: { skill:Skill; idx:number; disabled:boolean; onPick:(i:number)=>void }) {
  const icons = [<Swords key={0} size={14}/>, <Zap key={1} size={14}/>, <Shield key={2} size={14}/>, <Sparkles key={3} size={14}/>];
  return (
    <button onClick={() => !disabled && onPick(idx)} disabled={disabled}
      style={{
        flex:1, minWidth:0, display:"flex", flexDirection:"column", alignItems:"center", gap:3,
        padding:"10px 4px", borderRadius:14, border:`1.5px solid ${skill.color}44`,
        background: disabled ? "rgba(255,255,255,0.04)" : `${skill.color}22`,
        opacity: disabled ? 0.4 : 1, cursor: disabled?"default":"pointer",
        transition:"transform 0.1s, opacity 0.2s",
        WebkitTapHighlightColor:"transparent",
      }}
      onPointerDown={e => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.transform="scale(0.93)"; }}
      onPointerUp={e => { (e.currentTarget as HTMLButtonElement).style.transform="scale(1)"; }}>
      <span style={{ color:skill.color, display:"flex", alignItems:"center", gap:3, fontSize:13, fontWeight:900 }}>
        {icons[idx]} {skill.icon}
      </span>
      <span style={{ fontSize:10, fontWeight:800, color:"rgba(255,255,255,0.85)", textAlign:"center", lineHeight:1.2, maxWidth:70 }}>
        {skill.name}
      </span>
      <span style={{ fontSize:9, color:"rgba(255,255,255,0.4)", textAlign:"center" }}>{skill.desc}</span>
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

  // 상태이상
  const myGuardRef = useRef(false);
  const oppGuardRef = useRef(false);
  const myStunnedRef = useRef(false);
  const oppStunnedRef = useRef(false);
  const [myGuardVis, setMyGuardVis] = useState(false);
  const [oppGuardVis, setOppGuardVis] = useState(false);
  const [myStunVis, setMyStunVis] = useState(false);
  const [oppStunVis, setOppStunVis] = useState(false);

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
      .select("id,name,photo_url,card_rarity,card_name,card_traits,card_stats,card_flavor,card_level,card_exp")
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
        if(mounted.current) pickSkill(0); // 타임오버 → 기본 공격
      }
    }, 1000);
  }, []); // eslint-disable-line

  useEffect(() => {
    if(phase === "player_choose") startTimer();
    else clearTimer();
  }, [phase]); // eslint-disable-line

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
  const mySkills = useMemo(() => selected ? buildSkills(selected.card_traits??[]) : [], [selected]);
  const oppSkills = useMemo(() => opponent ? buildSkills(opponent.card_traits??[]) : [], [opponent]);

  const applySkill = (
    skillIdx: number, isPlayer: boolean,
    mySt: BattleStats, oppSt: BattleStats,
    myMaxH: number, oppMaxH: number,
  ) => {
    const skill = isPlayer ? mySkills[skillIdx] : oppSkills[skillIdx];
    const atk = isPlayer ? mySt : oppSt;
    const def = isPlayer ? oppSt : mySt;
    const myGuard = myGuardRef.current;
    const oppGuard = oppGuardRef.current;

    let dmg=0, isCrit=false, msg="";

    switch(skill.type) {
      case "normal": { const r=calcDmg(atk.atk,def.def,1.0); dmg=r.dmg; isCrit=r.isCrit; break; }
      case "heavy":  { const r=calcDmg(atk.atk,def.def,1.5); dmg=r.dmg; isCrit=r.isCrit; break; }
      case "guard": {
        if(isPlayer){ myGuardRef.current=true; setMyGuardVis(true); }
        else { oppGuardRef.current=true; setOppGuardVis(true); }
        msg="🛡️ 방어 자세!";
        break;
      }
      case "special": {
        const r=Math.random();
        if(r<0.33) {
          const heal=20+Math.floor(Math.random()*15);
          if(isPlayer) setMyHp(Math.min(myMaxH, myHpRef.current+heal));
          else setOppHp(Math.min(oppMaxH, oppHpRef.current+heal));
          msg=`💚 +${heal} 회복!`;
        } else if(r<0.66) {
          const res=calcDmg(atk.atk,def.def,0.75); dmg=res.dmg; isCrit=res.isCrit;
          if(isPlayer){ oppStunnedRef.current=true; setOppStunVis(true); }
          else { myStunnedRef.current=true; setMyStunVis(true); }
          msg="⚡ 기절!";
        } else {
          const res=calcDmg(atk.atk,def.def,2.2); dmg=res.dmg; isCrit=res.isCrit;
          msg="🔥 일격필살!";
        }
        break;
      }
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

    return { dmg, isCrit, msg };
  };

  const pickSkill = useCallback((skillIdx: number) => {
    if(!myStats || !oppStats || !selected || !opponent || !mounted.current) return;
    clearTimer();
    setPhase("animating");

    const { dmg, isCrit, msg } = applySkill(skillIdx, true, myStats, oppStats, myMaxHp, oppMaxHp);
    const skill = mySkills[skillIdx];
    setActionMsg(`${selected.name}의 ${skill.name}!${isCrit?" 💥 크리티컬!":""}${msg?" "+msg:""}`);
    setMyAnim("attack");

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
            if(myStunnedRef.current) { myStunnedRef.current=false; setMyStunVis(false); setActionMsg("기절해서 행동할 수 없다!"); setTimeout(()=>{ if(mounted.current){ setActionMsg("기술을 선택하세요!"); setPhase("player_choose"); }}, 1200); }
            else { setActionMsg("기술을 선택하세요!"); setPhase("player_choose"); }
            setOppStunVis(false);
            return;
          }

          // AI 기술 선택
          const aiSkillIdx = oppAI(0, oppHpRef.current, oppMaxHp);
          const { dmg:od, isCrit:oc, msg:om } = applySkill(aiSkillIdx, false, myStats, oppStats, myMaxHp, oppMaxHp);
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
    if(user) createClient().from("cats").select("id,name,photo_url,card_rarity,card_name,card_traits,card_stats,card_flavor,card_level,card_exp").eq("caretaker_id",user.id).not("card_generated_at","is",null).order("card_level",{ascending:false}).then(({data}:{data:BattleCat[]|null})=>{ if(mounted.current) setMyCats(data??[]); });
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

      <div className="min-h-dvh flex flex-col" style={{ background:`linear-gradient(180deg,${myDanger&&!oppDanger?"#2A0A0A":oppDanger&&!myDanger?"#0A1A0A":"#0A0A18"} 0%,#1A0A2E 100%)`, transition:"background 1.2s" }}>

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

            {/* 수동: 타이머 바 */}
            {mode==="manual"&&(
              <div style={{height:4,borderRadius:99,background:"rgba(255,255,255,0.08)"}}>
                <div style={{height:"100%",borderRadius:99,width:`${(timerLeft/6)*100}%`,transition:"width 0.9s linear",background:timerLeft<=2?"#FF4444":timerLeft<=4?"#FFAA22":"#44AAFF",boxShadow:timerLeft<=2?"0 0 8px #FF4444":undefined,animation:timerLeft<=2?"pulse 0.6s infinite":undefined}}/>
              </div>
            )}

            {/* 양쪽 카드 */}
            <div className="flex items-end justify-center gap-2" style={{minHeight:210}}>
              {/* 내 카드 */}
              <div className="flex flex-col items-center gap-1.5" style={{flex:1}}>
                <div style={{position:"relative"}}>
                  {myDanger&&<div style={{position:"absolute",top:-8,left:"50%",transform:"translateX(-50%)",zIndex:10,background:"#FF3333",color:"white",fontSize:9,fontWeight:900,padding:"2px 6px",borderRadius:99,whiteSpace:"nowrap"}}>⚠️ 위기</div>}
                  {myStunVis&&<div style={{position:"absolute",top:-8,left:"50%",transform:"translateX(-50%)",zIndex:10,background:"#8800CC",color:"white",fontSize:9,fontWeight:900,padding:"2px 6px",borderRadius:99,whiteSpace:"nowrap"}}>💫 기절</div>}
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
                    <span className="text-[11px] text-gray-500">기술 선택</span>
                    <span className="text-[13px] font-black" style={{color:timerLeft<=2?"#FF4444":timerLeft<=4?"#FFAA22":"#88CCFF"}}>{timerLeft}s</span>
                  </div>
                )}
                <div className="flex gap-2">
                  {mySkills.map((sk,i)=>(
                    <SkillBtn key={i} skill={sk} idx={i} disabled={phase!=="player_choose"} onPick={pickSkill}/>
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
