"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Swords, Loader2, Trophy, Shield } from "lucide-react";
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

type Phase = "select" | "battling" | "result";

interface LogEntry { turn: number; actor: string; dmg: number; aHp: number; dHp: number }

interface BattleResult {
  winner: "me" | "opponent";
  my_hp_left: number;
  opp_hp_left: number;
  rounds: number;
  log: LogEntry[];
  exp_gained: number;
  my_new_level: number;
  leveled_up: boolean;
}

export default function BattlePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [myCats, setMyCats] = useState<BattleCat[]>([]);
  const [selected, setSelected] = useState<BattleCat | null>(null);
  const [phase, setPhase] = useState<Phase>("select");
  const [opponent, setOpponent] = useState<BattleCat | null>(null);
  const [result, setResult] = useState<BattleResult | null>(null);
  const [logIdx, setLogIdx] = useState(0);
  const [error, setError] = useState("");
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (authLoading || !user) return;
    createClient()
      .from("cats")
      .select("id,name,photo_url,card_rarity,card_name,card_traits,card_stats,card_flavor,card_level,card_exp")
      .eq("caretaker_id", user.id)
      .not("card_generated_at", "is", null)
      .order("card_level", { ascending: false })
      .then(({ data }: { data: BattleCat[] | null }) => setMyCats(data ?? []));
  }, [user, authLoading]);

  const startBattle = async () => {
    if (!selected) return;
    setPhase("battling");
    setLogIdx(0);
    setError("");

    const res = await fetch("/api/cats/card-battle", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ my_cat_id: selected.id }),
    });
    const json = await res.json();

    if (!res.ok) {
      if (json.error === "no_opponents") setError("아직 배틀할 상대가 없어요. 다른 유저들이 고양이를 등록하면 도전할 수 있어요!");
      else setError("배틀 오류가 발생했어요.");
      setPhase("select");
      return;
    }

    setOpponent(json.opponent as BattleCat);
    setResult(json.result as BattleResult);

    // 로그 애니메이션
    let i = 0;
    const tick = () => {
      i++;
      setLogIdx(i);
      logRef.current?.scrollTo({ top: 9999, behavior: "smooth" });
      if (i < (json.result.log?.length ?? 0)) {
        setTimeout(tick, 500);
      } else {
        setTimeout(() => setPhase("result"), 800);
      }
    };
    setTimeout(tick, 600);
  };

  const reset = () => {
    setPhase("select");
    setSelected(null);
    setOpponent(null);
    setResult(null);
    setLogIdx(0);
    // 레벨업 반영을 위해 목록 재조회
    if (user) {
      createClient()
        .from("cats")
        .select("id,name,photo_url,card_rarity,card_name,card_traits,card_stats,card_flavor,card_level,card_exp")
        .eq("caretaker_id", user.id)
        .not("card_generated_at", "is", null)
        .order("card_level", { ascending: false })
        .then(({ data }: { data: BattleCat[] | null }) => setMyCats(data ?? []));
    }
  };

  const toCard = (cat: BattleCat): CatCardData => ({
    card_rarity: cat.card_rarity, card_name: cat.card_name,
    card_traits: cat.card_traits ?? [], card_stats: cat.card_stats,
    card_flavor: cat.card_flavor, card_level: cat.card_level, card_exp: cat.card_exp,
  });

  const displayedLog = result?.log?.slice(0, logIdx) ?? [];
  const myInitHp = result ? (result.my_hp_left + displayedLog.filter(l => l.actor !== selected?.name && phase !== "result").reduce((s, l) => s + l.dmg, 0)) : 0;

  return (
    <div className="min-h-dvh pb-24" style={{ background: "linear-gradient(180deg,#0A0A18 0%,#1A0A2E 100%)" }}>
      {/* 헤더 */}
      <div className="sticky top-0 z-10 flex items-center gap-3 px-4 pt-safe pt-4 pb-3" style={{ background: "rgba(10,10,24,0.9)", backdropFilter: "blur(12px)" }}>
        <button onClick={() => router.back()} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.08)" }}>
          <ArrowLeft size={18} color="white" />
        </button>
        <h1 className="text-[17px] font-extrabold text-white flex items-center gap-2">
          <Swords size={18} /> 카드 배틀
        </h1>
      </div>

      <div className="px-4">

        {/* ── 카드 선택 ── */}
        {phase === "select" && (
          <>
            <p className="text-gray-400 text-[13px] mb-4">출전할 고양이를 선택하세요</p>
            {error && <p className="text-red-400 text-[13px] mb-3 text-center">{error}</p>}

            <div className="grid grid-cols-2 gap-3 mb-6">
              {myCats.map(cat => (
                <div key={cat.id}
                  onClick={() => setSelected(s => s?.id === cat.id ? null : cat)}
                  style={{
                    cursor: "pointer",
                    outline: selected?.id === cat.id ? "3px solid #A070D0" : "none",
                    borderRadius: 16,
                    transition: "transform 0.15s",
                    transform: selected?.id === cat.id ? "scale(1.04)" : "scale(1)",
                  }}>
                  <CatCard name={cat.name} photoUrl={cat.photo_url} card={toCard(cat)} size="sm" />
                </div>
              ))}
            </div>

            {myCats.length === 0 && (
              <div className="text-center py-16">
                <p className="text-gray-500 text-[14px]">카드가 없어요. 고양이를 등록하면 카드가 생성돼요!</p>
              </div>
            )}

            {selected && (
              <button
                onClick={startBattle}
                className="w-full py-4 rounded-2xl text-[16px] font-black text-white flex items-center justify-center gap-2"
                style={{ background: "linear-gradient(135deg,#8040D0,#C060FF)", boxShadow: "0 4px 20px rgba(160,80,255,0.4)" }}>
                <Swords size={18} /> 배틀 시작!
              </button>
            )}
          </>
        )}

        {/* ── 배틀 중 ── */}
        {(phase === "battling" || phase === "result") && selected && opponent && result && (
          <>
            {/* 두 카드 */}
            <div className="flex items-center justify-center gap-4 mb-5 mt-2">
              <div className="flex flex-col items-center gap-1">
                <CatCard name={selected.name} photoUrl={selected.photo_url} card={toCard(selected)} size="sm" />
                <span className="text-[10px] text-purple-300 font-bold">내 카드</span>
                {/* HP 바 */}
                <div className="w-full h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.1)", width: 120 }}>
                  <div className="h-full rounded-full transition-all" style={{
                    width: `${Math.max(0, (result.my_hp_left / ((selected.card_level ?? 1) * 10 + 80)) * 100)}%`,
                    background: result.winner === "me" ? "#44FF88" : "#FF4444",
                  }} />
                </div>
              </div>

              <div className="flex flex-col items-center">
                <span className="text-white text-[22px] font-black">VS</span>
                {phase === "battling" && <Loader2 size={16} color="#A070D0" className="animate-spin mt-1" />}
                {phase === "result" && (
                  <span className="text-[11px] font-bold mt-1" style={{ color: result.winner === "me" ? "#44FF88" : "#FF5555" }}>
                    {result.winner === "me" ? "승리!" : "패배"}
                  </span>
                )}
              </div>

              <div className="flex flex-col items-center gap-1">
                <CatCard name={opponent.name} photoUrl={opponent.photo_url} card={toCard(opponent)} size="sm" />
                <span className="text-[10px] text-gray-400 font-bold">상대방</span>
                <div className="w-full h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.1)", width: 120 }}>
                  <div className="h-full rounded-full transition-all" style={{
                    width: `${Math.max(0, (result.opp_hp_left / ((opponent.card_level ?? 1) * 10 + 80)) * 100)}%`,
                    background: result.winner === "opponent" ? "#44FF88" : "#FF4444",
                  }} />
                </div>
              </div>
            </div>

            {/* 배틀 로그 */}
            <div ref={logRef}
              className="rounded-2xl p-3 space-y-1.5 overflow-y-auto mb-4"
              style={{ background: "rgba(255,255,255,0.05)", maxHeight: 200 }}>
              {displayedLog.map((entry, i) => (
                <div key={i} className="flex items-center gap-2 text-[12px]">
                  <span className="font-bold" style={{ color: entry.actor === selected.name ? "#C090FF" : "#FF9060" }}>
                    {entry.actor}
                  </span>
                  <span className="text-gray-400">의 공격!</span>
                  <span className="font-black text-white ml-auto">-{entry.dmg} HP</span>
                </div>
              ))}
              {phase === "battling" && (
                <div className="text-center text-gray-500 text-[11px] animate-pulse">배틀 중...</div>
              )}
            </div>

            {/* 결과 */}
            {phase === "result" && (
              <div className="rounded-2xl p-4 text-center mb-4"
                style={{ background: result.winner === "me" ? "rgba(68,255,136,0.1)" : "rgba(255,68,68,0.1)", border: `1px solid ${result.winner === "me" ? "rgba(68,255,136,0.3)" : "rgba(255,68,68,0.3)"}` }}>
                <div className="text-[32px] mb-1">{result.winner === "me" ? "🏆" : "💔"}</div>
                <p className="text-[18px] font-black text-white">
                  {result.winner === "me" ? "승리!" : "패배..."}
                </p>
                <p className="text-[13px] text-gray-400 mt-1">
                  {result.rounds}턴 · EXP +{result.exp_gained}
                  {result.leveled_up && <span className="text-yellow-300 font-bold ml-2">⬆️ 레벨업!</span>}
                </p>
              </div>
            )}

            {phase === "result" && (
              <div className="flex gap-2">
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
            )}
          </>
        )}
      </div>
    </div>
  );
}
