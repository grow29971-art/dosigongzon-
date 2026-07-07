"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Trophy } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { WEEKLY_RANK_REWARDS } from "@/lib/shop-config";
import StickerIcon from "@/app/components/StickerIcon";

const RANK_MEDAL = ["🥇", "🥈", "🥉"];

interface BattleRank {
  userId: string;
  name: string;
  avatarUrl: string | null;
  score: number;
  wins: number;
  losses: number;
}

export default function BattleRankingPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [ranks, setRanks] = useState<BattleRank[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !user) return;
    fetch("/api/cats/battle-ranking")
      .then(r => r.json())
      .then((json: { ranks?: BattleRank[] }) => {
        setRanks(json.ranks ?? []);
        setLoading(false);
      });
  }, [user, authLoading]);

  return (
    <div className="min-h-dvh" style={{ background: "#0F0F1A" }}>
      <div className="sticky top-0 z-10 px-4 pt-safe pt-4 pb-3 flex items-center gap-3" style={{ background: "#0F0F1A" }}>
        <button onClick={() => router.back()} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.08)" }}>
          <ArrowLeft size={18} className="text-white" />
        </button>
        <h1 className="text-[17px] font-extrabold text-white flex items-center gap-2"><StickerIcon icon={Trophy} color="#E8B040" size={30} /> 주간 배틀 랭킹</h1>
      </div>

      <div className="px-4 pb-10">
        <div className="rounded-2xl p-3 mb-4 text-[12px] text-gray-400 leading-snug" style={{ background: "rgba(255,255,255,0.05)" }}>
          매주 월요일에 초기화돼요. 이번 주 TOP 10은 <span style={{ color: "#FFCC44", fontWeight: 700 }}>상점 코인</span>을 받아요!
          <br />점수 = 승리 3점 + 패배 1점 (참가만 해도 쌓여요)
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-gray-500" /></div>
        ) : ranks.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-[32px] mb-3">⚔️</p>
            <p className="text-gray-500 text-[14px]">이번 주 배틀 기록이 아직 없어요</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {ranks.map((r, i) => {
              const isMe = r.userId === user?.id;
              const reward = WEEKLY_RANK_REWARDS[i];
              return (
                <div key={r.userId}
                  className="flex items-center gap-3 rounded-2xl p-3"
                  style={{
                    background: isMe ? "rgba(160,80,255,0.16)" : "rgba(255,255,255,0.05)",
                    border: isMe ? "1px solid rgba(160,80,255,0.5)" : "1px solid transparent",
                  }}>
                  <span className="w-7 text-center text-[15px] font-black shrink-0" style={{ color: i < 3 ? "#FFD700" : "rgba(255,255,255,0.5)" }}>
                    {RANK_MEDAL[i] ?? i + 1}
                  </span>
                  {r.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.avatarUrl} alt={r.name} className="w-9 h-9 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center" style={{ background: "rgba(255,255,255,0.1)" }}>🐱</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-white truncate">{r.name}{isMe && <span className="text-[10px] text-purple-300 ml-1">(나)</span>}</p>
                    <p className="text-[10px] text-gray-500">{r.wins}승 {r.losses}패</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[14px] font-black" style={{ color: "#C090FF" }}>{r.score}점</p>
                    {reward && <p className="text-[10px] font-bold" style={{ color: "#FFCC44" }}>+{reward} 코인</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
