"use client";

// 🏆 주간 배틀 랭킹 (/catch/ranking) — 냥줍 app/(main)/ranking/page.tsx 이식 (2026-08-04 P4).
// 냥줍 대비 변경: useAuth 인증, 테마→lib/catch/arcade-theme, 자체 PageHeader/BottomNav
// 제거(city (main) 레이아웃이 감쌈), 보상 상수→lib/catch/ranking.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Flag, Swords, UserPlus, Trophy, ChevronLeft } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { WEEKLY_RANK_REWARDS } from "@/lib/catch/ranking";
import { UI, SQUIRCLE, pageBgStyle, iconBadgeStyle, ctaStyle } from "@/lib/catch/arcade-theme";
import { CATCH_BATTLE_ENABLED } from "@/lib/catch/features";

const RANK_MEDAL = ["🥇", "🥈", "🥉"];

interface BattleRank {
  isMe: boolean;
  name: string;
  score: number;
  wins: number;
  losses: number;
}

export default function CatchRankingPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [ranks, setRanks] = useState<BattleRank[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 배틀 미노출 중엔 랭킹 페이지 자체를 진입 차단 — 지도 화면으로 돌려보낸다.
    if (!CATCH_BATTLE_ENABLED) { router.replace("/catch"); return; }
    if (authLoading) return;
    if (!user) { router.replace("/login"); return; }
    (async () => {
      const res = await fetch("/api/catch/battle/ranking");
      const json: { ranks?: BattleRank[] } = await res.json().catch(() => ({}));
      setRanks(json.ranks ?? []);
      setLoading(false);
    })();
  }, [router, user, authLoading]);

  return (
    <div className="min-h-dvh px-4 pt-4 pb-8" style={{ ...pageBgStyle(), color: UI.textMain, maxWidth: 520, margin: "0 auto" }}>
      {/* 헤더 — city (main) 레이아웃 안의 간단 헤더 */}
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => router.push("/catch/battle")} aria-label="배틀로 돌아가기"
          className="w-9 h-9 flex items-center justify-center"
          style={{ borderRadius: SQUIRCLE, background: UI.panel, boxShadow: `inset 0 0 0 1px ${UI.panelBorderStrong}` }}>
          <ChevronLeft size={18} color={UI.textSub} strokeWidth={2.6} />
        </button>
        <Trophy size={18} color="#F5A623" strokeWidth={2.4} />
        <h1 className="text-[16px] font-black">주간 배틀 랭킹</h1>
      </div>

      {/* 콜드스타트 카피 전환 — 참가자 3명 미만이면 "빈자리 선점" 프레임으로 */}
      {!loading && ranks.length < 3 ? (
        <div className="rounded-2xl p-4 mb-4"
          style={{ background: UI.panel, boxShadow: `inset 0 0 0 1px ${UI.panelBorder}` }}>
          <div className="flex items-center gap-2.5 mb-2">
            <span style={iconBadgeStyle("#F5A623", 32)}><Flag size={16} color="#F5A623" /></span>
            <p className="text-[13.5px] font-extrabold" style={{ color: UI.textMain }}>이번 주 개척자를 찾아요</p>
          </div>
          <p className="text-[12px] leading-snug" style={{ color: UI.textSub }}>
            아직 자리가 비어 있어요 — 지금 참가하면 <span style={{ color: "#F5A623", fontWeight: 700 }}>TOP 10 확정!</span>
            <br />PVP 한 판만 해도 점수가 쌓이고(승리 3점 + 패배 1점), 월요일 정산 때 TOP 10은 코인을 받아요.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl p-3 mb-4 text-[12px] leading-snug"
          style={{ background: UI.panel, boxShadow: `inset 0 0 0 1px ${UI.panelBorder}`, color: UI.textSub }}>
          매주 월요일에 초기화돼요. 이번 주 TOP 10은 <span style={{ color: "#F5A623", fontWeight: 700 }}>코인</span>을 받아요!
          <br />점수 = 승리 3점 + 패배 1점 (PVP 참가만 해도 쌓여요)
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin" style={{ color: UI.textMuted }} /></div>
      ) : ranks.length === 0 ? (
        <div className="text-center py-14 px-2">
          <div className="mx-auto" style={iconBadgeStyle(UI.accent.blue, 56)}>
            <Swords size={26} color={UI.accent.blue} />
          </div>
          <p className="text-[15px] font-extrabold mt-4" style={{ color: UI.textMain }}>1위 자리가 비어 있어요</p>
          <p className="text-[12px] mt-1.5 leading-relaxed" style={{ color: UI.textSub }}>
            아직 아무도 이름을 올리지 않았어요.
            <br />지금 배틀 한 판이면 이번 주 1위로 시작해요!
          </p>
          <button onClick={() => router.push("/catch/battle")} className="mt-5 flex items-center justify-center gap-2"
            style={ctaStyle()}>
            <Swords size={16} /> 첫 배틀 하러 가기
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {ranks.map((r, i) => {
            const isMe = r.isMe;
            const reward = WEEKLY_RANK_REWARDS[i];
            return (
              <div key={i}
                className="flex items-center gap-3 rounded-2xl p-3"
                style={{
                  background: isMe ? `${UI.accent.blue}1F` : UI.panel,
                  boxShadow: isMe ? `inset 0 0 0 1.5px ${UI.accent.blue}` : `inset 0 0 0 1px ${UI.panelBorder}`,
                }}>
                <span className="w-7 text-center text-[15px] font-black shrink-0"
                  style={{ color: i < 3 ? "#F5A623" : UI.textSub }}>
                  {RANK_MEDAL[i] ?? i + 1}
                </span>
                <div className="w-9 h-9 shrink-0 flex items-center justify-center"
                  style={{ borderRadius: SQUIRCLE, background: "rgba(2,32,71,0.05)" }}>🐱</div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold truncate">
                    {r.name}{isMe && <span className="text-[10px] ml-1" style={{ color: UI.accent.blue }}>(나)</span>}
                  </p>
                  <p className="text-[10px]" style={{ color: UI.textMuted }}>{r.wins}승 {r.losses}패</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[14px] font-black" style={{ color: UI.textMain }}>{r.score}점</p>
                  {reward && <p className="text-[10px] font-bold" style={{ color: "#F5A623" }}>+{reward} 코인</p>}
                </div>
              </div>
            );
          })}
          {/* 개척자 프레임 — 참가자가 1~2명뿐이면 바로 다음 순위가 "내 자리"임을 보여준다 */}
          {ranks.length < 3 && !ranks.some((r) => r.isMe) && (
            <button onClick={() => router.push("/catch/battle")}
              className="flex items-center gap-3 rounded-2xl p-3 text-left"
              style={{ background: UI.panel, boxShadow: `inset 0 0 0 1.5px ${UI.accent.blue}55` }}>
              <span className="w-7 text-center text-[15px] font-black shrink-0" style={{ color: UI.accent.blue }}>
                {ranks.length + 1}
              </span>
              <div className="w-9 h-9 shrink-0 flex items-center justify-center" style={iconBadgeStyle(UI.accent.blue, 36)}>
                <UserPlus size={17} color={UI.accent.blue} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold" style={{ color: UI.textMain }}>이 자리, 아직 비어 있어요</p>
                <p className="text-[10px]" style={{ color: UI.textMuted }}>배틀 한 판이면 바로 여기 이름이 올라가요</p>
              </div>
              <Swords size={16} color={UI.accent.blue} className="shrink-0" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
