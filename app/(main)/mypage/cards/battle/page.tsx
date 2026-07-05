"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Swords } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import CatCard, { type CatCardData, type CardRarity } from "@/app/components/CatCard";

interface BattleCat {
  id: string;
  name: string;
  photo_url: string | null;
  card_rarity: CardRarity;
  card_name: string | null;
  card_traits: string[];
  card_stats: CatCardData["card_stats"];
  card_flavor: string | null;
  card_level: number;
  card_exp: number;
}

interface LogEntry {
  turn: number;
  actor: string;
  dmg: number;
  aHp: number;
  dHp: number;
  isCritical: boolean;
  isDodge: boolean;
  isCounterAttack: boolean;
  skillName: string;
}

interface BattleResult {
  winner: "me" | "opponent";
  my_hp_left: number;
  opp_hp_left: number;
  my_max_hp: number;
  opp_max_hp: number;
  rounds: number;
  log: LogEntry[];
  exp_gained: number;
  my_new_level: number;
  leveled_up: boolean;
}

type Phase = "select" | "loading" | "countdown" | "fighting" | "result";
type CardAnim = "idle" | "attack" | "hit" | "dodge";

const TICK_MS = 1150;

function HpBar({ current, max, danger }: { current: number; max: number; danger: boolean }) {
  const pct = Math.max(0, Math.min(100, (current / max) * 100));
  const color = danger ? "#FF4444" : pct > 50 ? "#44DD66" : "#FFCC22";
  return (
    <div style={{ width: "100%", height: 10, borderRadius: 99, background: "rgba(255,255,255,0.1)", overflow: "hidden", boxShadow: "inset 0 1px 3px rgba(0,0,0,0.5)" }}>
      <div style={{
        height: "100%", borderRadius: 99, width: `${pct}%`,
        background: `linear-gradient(90deg, ${color}CC, ${color})`,
        transition: "width 0.5s ease, background 0.5s ease",
        boxShadow: danger ? "0 0 8px #FF4444" : undefined,
      }} />
    </div>
  );
}

export default function BattlePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [myCats, setMyCats] = useState<BattleCat[]>([]);
  const [selected, setSelected] = useState<BattleCat | null>(null);
  const [phase, setPhase] = useState<Phase>("select");
  const [error, setError] = useState("");

  // 배틀 데이터
  const [opponent, setOpponent] = useState<BattleCat | null>(null);
  const [result, setResult] = useState<BattleResult | null>(null);

  // 카운트다운
  const [countdown, setCountdown] = useState(3);

  // 턴 상태
  const [myHp, setMyHp] = useState(0);
  const [oppHp, setOppHp] = useState(0);
  const [myMaxHp, setMyMaxHp] = useState(1);
  const [oppMaxHp, setOppMaxHp] = useState(1);
  const [myAnim, setMyAnim] = useState<CardAnim>("idle");
  const [oppAnim, setOppAnim] = useState<CardAnim>("idle");
  const [dmgPopup, setDmgPopup] = useState<{ target: "me" | "opp"; val: number; isCritical: boolean; isDodge: boolean } | null>(null);
  const [skillText, setSkillText] = useState<string | null>(null);
  const [critFlash, setCritFlash] = useState(false);
  const [currentLog, setCurrentLog] = useState<LogEntry | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadCats = useCallback((uid: string) => {
    createClient()
      .from("cats")
      .select("id,name,photo_url,card_rarity,card_name,card_traits,card_stats,card_flavor,card_level,card_exp")
      .eq("caretaker_id", uid)
      .not("card_generated_at", "is", null)
      .order("card_level", { ascending: false })
      .then(({ data }: { data: BattleCat[] | null }) => setMyCats(data ?? []));
  }, []);

  useEffect(() => {
    if (authLoading || !user) return;
    loadCats(user.id);
  }, [user, authLoading, loadCats]);

  const toCard = (cat: BattleCat): CatCardData => ({
    card_rarity: cat.card_rarity, card_name: cat.card_name,
    card_traits: cat.card_traits ?? [], card_stats: cat.card_stats,
    card_flavor: cat.card_flavor, card_level: cat.card_level, card_exp: cat.card_exp,
  });

  const startBattle = async () => {
    if (!selected) return;
    setPhase("loading");
    setError("");

    const res = await fetch("/api/cats/card-battle", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ my_cat_id: selected.id }),
    });
    const json = await res.json();

    if (!res.ok) {
      setError(json.error === "no_opponents"
        ? "아직 배틀할 상대가 없어요. 다른 유저가 고양이를 등록하면 도전할 수 있어요!"
        : "배틀 오류가 발생했어요.");
      setPhase("select");
      return;
    }

    const r = json.result as BattleResult;
    setOpponent(json.opponent as BattleCat);
    setResult(r);
    setMyHp(r.my_max_hp);
    setOppHp(r.opp_max_hp);
    setMyMaxHp(r.my_max_hp);
    setOppMaxHp(r.opp_max_hp);

    // 카운트다운 시작
    setPhase("countdown");
    setCountdown(3);

    const cdTick = (n: number) => {
      setCountdown(n);
      if (n > 0) {
        navigator.vibrate?.(40);
        timerRef.current = setTimeout(() => cdTick(n - 1), 700);
      } else {
        // GO! 잠깐 보여준 뒤 배틀 시작
        timerRef.current = setTimeout(() => {
          setPhase("fighting");
          replayLog(r, selected.name, json.opponent.name);
        }, 500);
      }
    };
    timerRef.current = setTimeout(() => cdTick(3), 300);
  };

  const replayLog = (r: BattleResult, myName: string, oppName: string) => {
    const log = r.log;
    let i = 0;

    const playTurn = () => {
      if (i >= log.length) {
        // 배틀 끝
        setTimeout(() => setPhase("result"), 600);
        return;
      }
      const entry = log[i];
      i++;
      const isMyTurn = entry.actor === myName;
      setCurrentLog(entry);
      setSkillText(`${entry.actor}의 ${entry.skillName}!`);

      if (entry.isCounterAttack) {
        setSkillText(`⚡ 위기 반격! ${entry.actor}의 ${entry.skillName}!`);
      }

      // 공격 카드 애니메이션
      if (isMyTurn) {
        setMyAnim("attack");
        setTimeout(() => setMyAnim("idle"), 400);
      } else {
        setOppAnim("attack");
        setTimeout(() => setOppAnim("idle"), 400);
      }

      // 400ms 뒤 피격 + 데미지 팝업
      setTimeout(() => {
        if (entry.isDodge) {
          if (isMyTurn) setOppAnim("dodge");
          else setMyAnim("dodge");
          setTimeout(() => { setMyAnim("idle"); setOppAnim("idle"); }, 400);
        } else {
          if (isMyTurn) {
            setOppAnim("hit");
            setTimeout(() => setOppAnim("idle"), 350);
            setOppHp(entry.dHp);
          } else {
            setMyAnim("hit");
            setTimeout(() => setMyAnim("idle"), 350);
            setMyHp(entry.aHp);
          }
        }

        setDmgPopup({
          target: isMyTurn ? "opp" : "me",
          val: entry.dmg,
          isCritical: entry.isCritical,
          isDodge: entry.isDodge,
        });

        if (entry.isCritical) {
          setCritFlash(true);
          navigator.vibrate?.([80, 30, 80]);
          setTimeout(() => setCritFlash(false), 300);
        } else {
          navigator.vibrate?.(30);
        }

        setTimeout(() => setDmgPopup(null), 700);
      }, 420);

      timerRef.current = setTimeout(playTurn, TICK_MS);
    };

    playTurn();
  };

  const reset = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setPhase("select");
    setSelected(null);
    setOpponent(null);
    setResult(null);
    setCurrentLog(null);
    setSkillText(null);
    setMyAnim("idle");
    setOppAnim("idle");
    if (user) loadCats(user.id);
  };

  const animStyle = (anim: CardAnim, side: "left" | "right"): React.CSSProperties => {
    const dir = side === "left" ? 1 : -1;
    if (anim === "attack") return { transform: `translateX(${dir * 22}px) scale(1.06)`, transition: "transform 0.18s ease-out", filter: "brightness(1.2)" };
    if (anim === "hit") return { animation: "battleHit 0.35s ease", filter: "brightness(1.5) saturate(0)" };
    if (anim === "dodge") return { transform: `translateY(-18px) rotate(${dir * -5}deg)`, transition: "transform 0.25s ease", opacity: 0.6 };
    return { transform: "translateX(0) scale(1)", transition: "transform 0.25s ease" };
  };

  const myDanger = myHp / myMaxHp < 0.25;
  const oppDanger = oppHp / oppMaxHp < 0.25;

  return (
    <>
      <style>{`
        @keyframes battleHit {
          0%   { transform: translateX(0) rotate(0); }
          20%  { transform: translateX(-10px) rotate(-3deg); }
          40%  { transform: translateX(10px) rotate(3deg); }
          60%  { transform: translateX(-6px) rotate(-1.5deg); }
          80%  { transform: translateX(6px) rotate(1.5deg); }
          100% { transform: translateX(0) rotate(0); }
        }
        @keyframes dmgPop {
          0%   { opacity:1; transform: translateY(0) scale(1); }
          60%  { opacity:1; transform: translateY(-28px) scale(1.2); }
          100% { opacity:0; transform: translateY(-44px) scale(0.9); }
        }
        @keyframes cdPop {
          0%   { opacity:0; transform: scale(0.3); }
          40%  { opacity:1; transform: scale(1.15); }
          70%  { transform: scale(0.95); }
          100% { transform: scale(1); }
        }
        @keyframes skillSlide {
          0%   { opacity:0; transform: translateY(6px); }
          20%  { opacity:1; transform: translateY(0); }
          80%  { opacity:1; }
          100% { opacity:0; }
        }
        @keyframes resultIn {
          0%   { opacity:0; transform: scale(0.7); }
          60%  { transform: scale(1.08); }
          100% { opacity:1; transform: scale(1); }
        }
        .skill-anim { animation: skillSlide 1.1s ease forwards; }
        .result-in { animation: resultIn 0.5s ease forwards; }
      `}</style>

      {/* 크리티컬 화면 번쩍임 */}
      {critFlash && (
        <div style={{ position: "fixed", inset: 0, zIndex: 999, background: "rgba(255,200,0,0.35)", pointerEvents: "none" }} />
      )}

      <div className="min-h-dvh flex flex-col" style={{
        background: phase === "fighting" || phase === "result"
          ? `linear-gradient(180deg, ${myDanger && !oppDanger ? "#300A0A" : oppDanger && !myDanger ? "#0A1A0A" : "#0A0A18"} 0%, #1A0A2E 100%)`
          : "linear-gradient(180deg,#0A0A18 0%,#1A0A2E 100%)",
        transition: "background 1s ease",
      }}>

        {/* 헤더 */}
        <div className="flex items-center gap-3 px-4 pt-safe pt-4 pb-3 shrink-0" style={{ background: "rgba(10,10,24,0.85)", backdropFilter: "blur(12px)" }}>
          <button onClick={() => { reset(); router.back(); }} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.08)" }}>
            <ArrowLeft size={18} color="white" />
          </button>
          <h1 className="text-[17px] font-extrabold text-white flex items-center gap-2">
            <Swords size={18} /> 카드 배틀
          </h1>
        </div>

        {/* ── 선택 화면 ── */}
        {(phase === "select" || phase === "loading") && (
          <div className="flex-1 overflow-y-auto px-4 pb-6">
            <p className="text-gray-400 text-[13px] mt-4 mb-4">출전할 고양이를 선택하세요</p>
            {error && <p className="text-red-400 text-[13px] mb-3 text-center">{error}</p>}

            <div className="grid grid-cols-2 gap-3 mb-6">
              {myCats.map(cat => (
                <div key={cat.id}
                  onClick={() => phase === "select" && setSelected(s => s?.id === cat.id ? null : cat)}
                  style={{
                    cursor: "pointer",
                    outline: selected?.id === cat.id ? "3px solid #C080FF" : "2px solid transparent",
                    borderRadius: 16,
                    transition: "transform 0.15s, outline 0.1s",
                    transform: selected?.id === cat.id ? "scale(1.04)" : "scale(1)",
                  }}>
                  <CatCard name={cat.name} photoUrl={cat.photo_url} card={toCard(cat)} size="sm" />
                  {selected?.id === cat.id && (
                    <div className="text-center text-[10px] text-purple-300 font-bold mt-1">✓ 선택됨</div>
                  )}
                </div>
              ))}
            </div>

            {myCats.length === 0 && (
              <div className="text-center py-16">
                <p className="text-gray-500 text-[14px]">카드가 없어요. 고양이를 등록하면 카드가 생성돼요!</p>
              </div>
            )}

            {selected && (
              <button onClick={startBattle} disabled={phase === "loading"}
                className="w-full py-4 rounded-2xl text-[16px] font-black text-white flex items-center justify-center gap-2"
                style={{ background: "linear-gradient(135deg,#8040D0,#C060FF)", boxShadow: "0 4px 24px rgba(160,80,255,0.5)", opacity: phase === "loading" ? 0.6 : 1 }}>
                {phase === "loading" ? (
                  <span className="animate-pulse">상대방 찾는 중...</span>
                ) : (
                  <><Swords size={18} /> 배틀 시작!</>
                )}
              </button>
            )}
          </div>
        )}

        {/* ── 카운트다운 ── */}
        {phase === "countdown" && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6">
            <div key={countdown} style={{
              fontSize: countdown === 0 ? 60 : 96,
              fontWeight: 900,
              color: countdown === 0 ? "#FFD700" : "white",
              textShadow: `0 0 40px ${countdown === 0 ? "#FFD700" : "#C080FF"}`,
              animation: "cdPop 0.55s ease forwards",
            }}>
              {countdown === 0 ? "GO!" : countdown}
            </div>
            <p className="text-gray-400 text-[14px]">배틀 시작!</p>
          </div>
        )}

        {/* ── 배틀 화면 ── */}
        {(phase === "fighting" || phase === "result") && selected && opponent && result && (
          <div className="flex-1 flex flex-col px-4 pt-4 pb-6 gap-4">

            {/* 카드 vs 카드 */}
            <div className="flex items-end justify-center gap-3" style={{ minHeight: 220 }}>

              {/* 내 카드 */}
              <div className="flex flex-col items-center gap-2" style={{ flex: 1 }}>
                <div style={{ position: "relative" }}>
                  {/* 위기 표시 */}
                  {myDanger && (
                    <div style={{ position: "absolute", top: -8, left: "50%", transform: "translateX(-50%)", zIndex: 10, background: "#FF4444", color: "white", fontSize: 9, fontWeight: 900, padding: "2px 6px", borderRadius: 99, whiteSpace: "nowrap" }}>
                      ⚠️ 위기
                    </div>
                  )}
                  <div style={animStyle(myAnim, "left")}>
                    <CatCard name={selected.name} photoUrl={selected.photo_url} card={toCard(selected)} size="sm" />
                  </div>
                  {/* 데미지 팝업 */}
                  {dmgPopup?.target === "me" && (
                    <div key={Date.now()} style={{
                      position: "absolute", top: "30%", left: "50%", transform: "translateX(-50%)",
                      fontSize: dmgPopup.isDodge ? 14 : dmgPopup.isCritical ? 22 : 18,
                      fontWeight: 900, color: dmgPopup.isDodge ? "#88CCFF" : dmgPopup.isCritical ? "#FFD700" : "white",
                      textShadow: dmgPopup.isCritical ? "0 0 12px #FFD700" : "0 2px 8px rgba(0,0,0,0.8)",
                      animation: "dmgPop 0.75s ease forwards", pointerEvents: "none", whiteSpace: "nowrap",
                    }}>
                      {dmgPopup.isDodge ? "회피!" : dmgPopup.isCritical ? `💥 ${dmgPopup.val}!` : `-${dmgPopup.val}`}
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-purple-300 font-bold">내 카드</span>
                {/* HP 바 */}
                <div style={{ width: "100%", maxWidth: 130 }}>
                  <div className="flex justify-between text-[9px] mb-0.5">
                    <span style={{ color: myDanger ? "#FF6060" : "#88CC88", fontWeight: 700 }}>HP</span>
                    <span style={{ color: myDanger ? "#FF6060" : "rgba(255,255,255,0.6)", fontWeight: 700 }}>{myHp}/{myMaxHp}</span>
                  </div>
                  <HpBar current={myHp} max={myMaxHp} danger={myDanger} />
                </div>
              </div>

              {/* VS + 스킬 텍스트 */}
              <div className="flex flex-col items-center gap-1 shrink-0" style={{ minWidth: 50 }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: "rgba(255,255,255,0.3)" }}>VS</div>
                {skillText && phase === "fighting" && (
                  <div key={skillText + Date.now()} className="skill-anim" style={{
                    fontSize: 9, fontWeight: 800, color: "#FFD700",
                    textAlign: "center", maxWidth: 60, lineHeight: 1.3,
                  }}>
                    {skillText}
                  </div>
                )}
              </div>

              {/* 상대 카드 */}
              <div className="flex flex-col items-center gap-2" style={{ flex: 1 }}>
                <div style={{ position: "relative" }}>
                  {oppDanger && (
                    <div style={{ position: "absolute", top: -8, left: "50%", transform: "translateX(-50%)", zIndex: 10, background: "#FF4444", color: "white", fontSize: 9, fontWeight: 900, padding: "2px 6px", borderRadius: 99, whiteSpace: "nowrap" }}>
                      ⚠️ 위기
                    </div>
                  )}
                  <div style={animStyle(oppAnim, "right")}>
                    <CatCard name={opponent.name} photoUrl={opponent.photo_url} card={toCard(opponent)} size="sm" />
                  </div>
                  {dmgPopup?.target === "opp" && (
                    <div key={Date.now()} style={{
                      position: "absolute", top: "30%", left: "50%", transform: "translateX(-50%)",
                      fontSize: dmgPopup.isDodge ? 14 : dmgPopup.isCritical ? 22 : 18,
                      fontWeight: 900, color: dmgPopup.isDodge ? "#88CCFF" : dmgPopup.isCritical ? "#FFD700" : "white",
                      textShadow: dmgPopup.isCritical ? "0 0 12px #FFD700" : "0 2px 8px rgba(0,0,0,0.8)",
                      animation: "dmgPop 0.75s ease forwards", pointerEvents: "none", whiteSpace: "nowrap",
                    }}>
                      {dmgPopup.isDodge ? "회피!" : dmgPopup.isCritical ? `💥 ${dmgPopup.val}!` : `-${dmgPopup.val}`}
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-gray-400 font-bold">상대방</span>
                <div style={{ width: "100%", maxWidth: 130 }}>
                  <div className="flex justify-between text-[9px] mb-0.5">
                    <span style={{ color: oppDanger ? "#FF6060" : "#88CC88", fontWeight: 700 }}>HP</span>
                    <span style={{ color: oppDanger ? "#FF6060" : "rgba(255,255,255,0.6)", fontWeight: 700 }}>{oppHp}/{oppMaxHp}</span>
                  </div>
                  <HpBar current={oppHp} max={oppMaxHp} danger={oppDanger} />
                </div>
              </div>
            </div>

            {/* 턴 로그 */}
            {phase === "fighting" && currentLog && (
              <div className="rounded-2xl px-4 py-3 text-center" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <p className="text-[12px] text-gray-300">
                  <span style={{ fontWeight: 800, color: currentLog.actor === selected.name ? "#C090FF" : "#FF9060" }}>
                    {currentLog.actor}
                  </span>
                  {" "}의{" "}
                  <span style={{ fontWeight: 700, color: currentLog.isCritical ? "#FFD700" : "white" }}>
                    {currentLog.skillName}
                  </span>
                  {currentLog.isCritical && <span style={{ color: "#FFD700", fontWeight: 900 }}> 💥 크리티컬!</span>}
                  {currentLog.isDodge && <span style={{ color: "#88CCFF" }}> (회피당함!)</span>}
                  {currentLog.isCounterAttack && <span style={{ color: "#FF8844" }}> ⚡ 위기반격!</span>}
                  {!currentLog.isDodge && <span style={{ color: "rgba(255,255,255,0.5)" }}> — {currentLog.dmg} 데미지</span>}
                </p>
                <p className="text-[10px] text-gray-600 mt-0.5">{currentLog.turn}턴</p>
              </div>
            )}

            {/* 결과 화면 */}
            {phase === "result" && (
              <div className="result-in flex flex-col items-center gap-3 mt-2">
                <div style={{ fontSize: 64, lineHeight: 1 }}>
                  {result.winner === "me" ? "🏆" : "💔"}
                </div>
                <p style={{ fontSize: 28, fontWeight: 900, color: result.winner === "me" ? "#44FF88" : "#FF6060", textShadow: `0 0 24px ${result.winner === "me" ? "#44FF88" : "#FF6060"}` }}>
                  {result.winner === "me" ? "승리!" : "패배..."}
                </p>
                <p className="text-[13px] text-gray-400">
                  {result.rounds}턴 · EXP +{result.exp_gained}
                  {result.leveled_up && (
                    <span style={{ color: "#FFD700", fontWeight: 800, marginLeft: 8 }}>⬆ 레벨 {result.my_new_level}!</span>
                  )}
                </p>

                {/* 결과 HP 바 */}
                <div className="w-full rounded-2xl p-3" style={{ background: "rgba(255,255,255,0.05)" }}>
                  <div className="flex gap-3 items-center">
                    <span className="text-[11px] text-purple-300 font-bold shrink-0">{selected.name}</span>
                    <div style={{ flex: 1 }}><HpBar current={result.my_hp_left} max={result.my_max_hp} danger={result.my_hp_left === 0} /></div>
                    <span className="text-[10px] text-gray-500 shrink-0">{result.my_hp_left}</span>
                  </div>
                  <div className="flex gap-3 items-center mt-2">
                    <span className="text-[11px] text-gray-400 font-bold shrink-0">{opponent.name}</span>
                    <div style={{ flex: 1 }}><HpBar current={result.opp_hp_left} max={result.opp_max_hp} danger={result.opp_hp_left === 0} /></div>
                    <span className="text-[10px] text-gray-500 shrink-0">{result.opp_hp_left}</span>
                  </div>
                </div>

                <div className="flex gap-2 w-full">
                  <button onClick={reset}
                    className="flex-1 py-3 rounded-2xl font-bold text-[14px] text-white"
                    style={{ background: "rgba(255,255,255,0.1)" }}>
                    다시 선택
                  </button>
                  <button onClick={startBattle}
                    className="flex-1 py-3 rounded-2xl font-bold text-[14px] text-white flex items-center justify-center gap-1"
                    style={{ background: "linear-gradient(135deg,#8040D0,#C060FF)" }}>
                    <Swords size={14} /> 재도전
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
