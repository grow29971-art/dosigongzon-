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
 * 2026-09-16 「익숙한 동네앱」 리디자인: 그라디언트·채움 아이콘 → 흰 면 + 헤어라인, 회색 선 아이콘.
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
      className="mt-4 px-4 py-3 flex items-center gap-3"
      style={{
        background: "var(--color-surface)",
        borderRadius: "var(--radius-card)",
        border: "1px solid var(--color-border)",
      }}
    >
      {activeCaretakersToday > 0 ? (
        <Users size={20} className="shrink-0" style={{ color: "var(--color-text-light)" }} strokeWidth={1.8} />
      ) : (
        <Sparkles size={20} className="shrink-0" style={{ color: "var(--color-text-light)" }} strokeWidth={1.8} />
      )}

      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-semibold text-text-main leading-snug">
          {primary}
        </p>
        {activeCaretakersToday > 0 && totalCats > 0 && (
          <p className="text-[13px] text-text-sub mt-0.5 leading-snug">
            누적 {totalCats.toLocaleString()}마리
            {newCatsThisWeek > 0 && ` · 이번 주 새 친구 ${newCatsThisWeek}마리`}
          </p>
        )}
      </div>

      {activeCaretakersToday > 0 && (
        <div className="flex items-center gap-1 shrink-0">
          <span
            className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ background: "var(--color-sage)" }}
          />
          <span className="text-[11px] font-semibold" style={{ color: "var(--color-sage)" }}>
            LIVE
          </span>
        </div>
      )}
    </div>
  );
}
