"use client";

// streak 위험 hero 알림 — 연속 N일 쌓아온 사용자가 오늘 끊길 수 있을 때 강한 회피 동기.
// 손실 회피 심리(loss aversion) 자극 — 이미 가진 것 잃지 않으려는 동기는 새 보상보다 ~2배 강함.
//
// 노출 조건 (3개 모두 만족):
//  1) streak >= 3 (작은 streak은 끊겨도 큰 손실감 없음)
//  2) hasToday = false (오늘 아직 기록 없음)
//  3) 활성 사용자 (catCount > 0)
//
// 노출 위치: HomeAuthed 최상단(RescueBanner 다음).
// 한 번 dismiss하면 오늘은 다시 안 보임(같은 KST 날짜).

import { useEffect, useState } from "react";
import Link from "next/link";
import { Flame, X, ChevronRight } from "lucide-react";

const KST_TODAY = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
const DISMISS_KEY = "streak-at-risk-dismissed";

interface Props {
  streak: number;
  hasToday: boolean;
  catCount: number;
}

export default function StreakAtRiskAlert({ streak, hasToday, catCount }: Props) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      const dis = localStorage.getItem(DISMISS_KEY);
      if (dis === KST_TODAY()) setDismissed(true);
    } catch { /* localStorage 차단 환경 — 그대로 노출 */ }
  }, []);

  if (dismissed) return null;
  if (catCount === 0) return null;
  if (hasToday) return null;
  if (streak < 3) return null;

  const handleDismiss = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try { localStorage.setItem(DISMISS_KEY, KST_TODAY()); } catch {}
    setDismissed(true);
  };

  return (
    <Link
      href="/map"
      className="block mb-3 relative overflow-hidden active:scale-[0.99] transition-transform"
      style={{
        background: "linear-gradient(135deg, #FFE6E0 0%, #FFD2C2 60%, #FFBFA8 100%)",
        borderRadius: 18,
        border: "1.5px solid rgba(216,85,85,0.30)",
        boxShadow: "0 6px 18px rgba(216,85,85,0.18)",
        animation: "streak-pulse 2.2s ease-in-out infinite",
      }}
    >
      <style jsx>{`
        @keyframes streak-pulse {
          0%, 100% { box-shadow: 0 6px 18px rgba(216,85,85,0.18); }
          50%      { box-shadow: 0 6px 26px rgba(216,85,85,0.42); }
        }
      `}</style>
      <button
        type="button"
        onClick={handleDismiss}
        className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center active:scale-90"
        style={{ background: "rgba(255,255,255,0.55)" }}
        aria-label="오늘 닫기"
      >
        <X size={13} style={{ color: "#8E3A2A" }} />
      </button>
      <div className="flex items-center gap-3 px-4 py-3.5 pr-9">
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
          style={{
            background: "linear-gradient(135deg, #E55A3C 0%, #D85555 100%)",
            boxShadow: "0 4px 12px rgba(216,85,85,0.40)",
          }}
        >
          <Flame size={20} color="#fff" strokeWidth={2.3} />
        </div>
        <div className="flex-1 min-w-0">
          <p
            className="text-[10px] font-extrabold tracking-[0.15em] mb-0.5"
            style={{ color: "#8E3A2A" }}
          >
            STREAK AT RISK · TODAY
          </p>
          <p className="text-[14px] font-extrabold leading-tight tracking-tight" style={{ color: "#5C2A1E" }}>
            🔥 <span className="tabular-nums">{streak}일</span> 연속 기록이 오늘 끊길 수 있어요
          </p>
          <p className="text-[11.5px] mt-0.5 leading-snug" style={{ color: "rgba(92,42,30,0.78)" }}>
            돌봄 한 줄이면 충분해요. 사진 한 장이면 더 좋고요.
          </p>
        </div>
        <ChevronRight size={14} style={{ color: "#8E3A2A" }} className="shrink-0" />
      </div>
    </Link>
  );
}
