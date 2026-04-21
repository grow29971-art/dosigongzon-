"use client";

import { useEffect, useState } from "react";
import { Users, Sparkles } from "lucide-react";

interface SocialProof {
  activeCaretakersToday: number;
  newCatsThisWeek: number;
  totalCats: number;
}

/**
 * 홈 히어로 아래 사회적 증명 배너.
 * "지금 N명이 함께 돌보는 중" — 안전·활발함 신호.
 * 데이터가 없거나 0이면 렌더링 생략.
 */
export default function SocialProofStrip() {
  const [data, setData] = useState<SocialProof | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/social-proof")
      .then((r) => r.json())
      .then((d: SocialProof) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (!data) return null;

  const { activeCaretakersToday, newCatsThisWeek, totalCats } = data;
  // 의미 있는 숫자가 하나도 없으면 숨김 (신규 서비스 초기 때 어색함 방지)
  if (activeCaretakersToday === 0 && newCatsThisWeek === 0 && totalCats < 5) {
    return null;
  }

  // 메시지 우선순위: 오늘 활동자 > 이번 주 신규 > 전체
  const primary =
    activeCaretakersToday > 0
      ? `오늘 ${activeCaretakersToday.toLocaleString()}명의 이웃이 아이들을 챙겼어요`
      : newCatsThisWeek > 0
        ? `이번 주 새 친구 ${newCatsThisWeek}마리가 등록됐어요`
        : `지금까지 ${totalCats.toLocaleString()}마리와 함께하고 있어요`;

  return (
    <div
      className="mt-4 px-4 py-3 rounded-2xl flex items-center gap-3"
      style={{
        background:
          "linear-gradient(135deg, rgba(232,141,90,0.10) 0%, rgba(72,165,158,0.08) 100%)",
        border: "1px solid rgba(196,126,90,0.18)",
      }}
    >
      <div
        className="w-9 h-9 rounded-2xl flex items-center justify-center shrink-0"
        style={{
          background: "linear-gradient(135deg, #E88D5A 0%, #C47E5A 100%)",
          boxShadow: "0 4px 12px rgba(232,141,90,0.35)",
        }}
      >
        {activeCaretakersToday > 0 ? (
          <Users size={15} color="#fff" strokeWidth={2.5} />
        ) : (
          <Sparkles size={15} color="#fff" strokeWidth={2.5} />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-extrabold text-text-main tracking-tight leading-tight">
          {primary}
        </p>
        {activeCaretakersToday > 0 && totalCats > 0 && (
          <p className="text-[10.5px] text-text-sub mt-0.5 leading-tight">
            누적 {totalCats.toLocaleString()}마리 ·{" "}
            {newCatsThisWeek > 0 && `이번 주 새 친구 ${newCatsThisWeek}마리`}
          </p>
        )}
      </div>

      {activeCaretakersToday > 0 && (
        <div
          className="flex items-center gap-1 shrink-0 px-2 py-1 rounded-xl"
          style={{ background: "rgba(255,255,255,0.7)" }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ background: "#48A59E" }}
          />
          <span className="text-[10px] font-extrabold" style={{ color: "#2E7870" }}>
            LIVE
          </span>
        </div>
      )}
    </div>
  );
}
