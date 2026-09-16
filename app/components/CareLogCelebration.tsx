"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Heart, Check } from "lucide-react";

type Props = {
  open: boolean;
  catName: string;
  isFirstEver: boolean;        // 역대 첫 돌봄 기록
  streak: number;              // 이번 제출로 이어진 연속 일수 (0이면 unknown)
  onClose: () => void;
};

/**
 * 돌봄 기록 직후 peak-end 연출 + commitment 마이크로 루프.
 * - 첫 돌봄은 특별한 카피
 * - "내일도 들러주실래요?" 소프트 약속 → localStorage에 약속 날짜 기록
 * 2026-09-16 리디자인: 그라디언트 헤더·반짝이·이모지 헤드라인 제거, 흰 모달 + 헤어라인.
 */
export default function CareLogCelebration({
  open,
  catName,
  isFirstEver,
  streak,
  onClose,
}: Props) {
  const [committed, setCommitted] = useState(false);

  // 모달 열릴 때마다 초기화
  useEffect(() => {
    if (open) setCommitted(false);
  }, [open]);

  if (!open) return null;

  // 헤드라인 결정
  const headline = isFirstEver
    ? "첫 돌봄 완료"
    : streak >= 30
      ? `${streak}일 연속, 놀라워요`
      : streak >= 7
        ? `${streak}일 연속이에요`
        : streak >= 2
          ? `${streak}일 연속 유지`
          : "기록 완료";

  const subline = isFirstEver
    ? `${catName}과(와) 함께하는 첫 페이지를 남겼어요`
    : streak >= 7
      ? "이 꾸준함이 아이들을 지켜요"
      : `${catName}에게 오늘도 안부를 전했어요`;

  const handleCommit = () => {
    try {
      const tomorrowKst = new Date();
      tomorrowKst.setDate(tomorrowKst.getDate() + 1);
      const day = tomorrowKst.toLocaleDateString("en-CA", {
        timeZone: "Asia/Seoul",
      });
      localStorage.setItem("care-commit-date", day);
    } catch {}
    setCommitted(true);
    // 1.5초 후 자동 닫기
    setTimeout(onClose, 1500);
  };

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center p-5"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="care-celebration-title"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm overflow-hidden relative"
        style={{
          background: "var(--color-surface)",
          borderRadius: "var(--radius-modal)",
          boxShadow: "var(--shadow-modal)",
        }}
      >
        <div className="px-6 pt-7 pb-5" style={{ borderBottom: "1px solid var(--color-border)" }}>
          <div className="flex items-center justify-center mb-3">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ background: "var(--color-primary)" }}
            >
              <Heart size={24} className="text-white" fill="currentColor" strokeWidth={0} />
            </div>
          </div>

          <h2
            id="care-celebration-title"
            className="text-[20px] font-bold text-text-main text-center tracking-tight"
          >
            {headline}
          </h2>
          <p className="text-[13px] text-text-sub text-center mt-1.5 leading-snug">
            {subline}
          </p>
        </div>

        {/* 하단 commitment */}
        <div className="px-6 pb-6 pt-4">
          {committed ? (
            <div
              className="px-4 py-3.5 text-center"
              style={{ background: "var(--color-sage-soft)", borderRadius: "var(--radius-card-sm)" }}
            >
              <p className="text-[13px] font-semibold inline-flex items-center gap-1" style={{ color: "var(--color-sage)" }}>
                <Check size={14} /> 내일 다시 뵈어요
              </p>
              <p className="text-[11px] mt-0.5 text-text-sub">
                저녁에 리마인더를 보내드릴게요
              </p>
            </div>
          ) : (
            <>
              <p className="text-[13px] font-semibold text-text-sub text-center mb-3">
                내일도 들러주실래요?
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCommit}
                  className="flex-1 h-12 text-[15px] font-semibold text-white press"
                  style={{ background: "var(--color-primary)", borderRadius: "var(--radius-input)" }}
                >
                  네, 내일도 올게요
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 h-12 text-[15px] font-semibold text-text-main press"
                  style={{ background: "var(--color-gray-100)", borderRadius: "var(--radius-input)" }}
                >
                  닫기
                </button>
              </div>
            </>
          )}

          {/* 7일+ 스트릭에게만 — 습관 형성된 유저에게 보상 프레임으로 상점 제안
              (2026-07-21 쇼핑 동선 회의. 첫 돌봄의 peak-end 순간은 오염 금지라 streak 조건 필수) */}
          {streak >= 7 && (
            <Link
              href="/shop?category=food"
              onClick={onClose}
              className="block text-center text-[13px] font-semibold mt-3 py-3 press"
              style={{ color: "var(--color-primary)" }}
            >
              {streak}일 연속 기념 — 아이들 간식 구경하고 찜해두기
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
