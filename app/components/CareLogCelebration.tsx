"use client";

import { useEffect, useState } from "react";
import { Heart, Sparkles } from "lucide-react";

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
    ? "첫 돌봄 완료! 🎉"
    : streak >= 30
      ? `${streak}일 연속! 놀라워요 🔥`
      : streak >= 7
        ? `${streak}일 연속이에요! 🔥`
        : streak >= 2
          ? `${streak}일 연속 유지 💪`
          : "기록 완료 💛";

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
        className="w-full max-w-sm rounded-[28px] overflow-hidden relative"
        style={{
          background: "#FFFFFF",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        }}
      >
        {/* 상단 그라디언트 */}
        <div
          className="relative px-6 pt-8 pb-5 overflow-hidden"
          style={{
            background: isFirstEver
              ? "linear-gradient(135deg, #FFE9C5 0%, #FFD89B 100%)"
              : streak >= 7
                ? "linear-gradient(135deg, #FFE3D5 0%, #FFCFB5 100%)"
                : "linear-gradient(135deg, #F5E6D8 0%, #E8D5C0 100%)",
          }}
        >
          {/* 반짝이 이펙트 */}
          <div className="absolute top-3 left-5 animate-pulse">
            <Sparkles size={14} style={{ color: "#E8B040", opacity: 0.8 }} />
          </div>
          <div className="absolute top-8 right-10 animate-pulse" style={{ animationDelay: "0.3s" }}>
            <Sparkles size={10} style={{ color: "#D85555", opacity: 0.7 }} />
          </div>
          <div className="absolute bottom-4 right-5 animate-pulse" style={{ animationDelay: "0.6s" }}>
            <Sparkles size={16} style={{ color: "#C47E5A", opacity: 0.8 }} />
          </div>

          <div className="flex items-center justify-center mb-3">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, #FF9A3C 0%, #E8652A 100%)",
                boxShadow: "0 8px 24px rgba(232,101,42,0.4)",
              }}
            >
              <Heart size={28} color="#fff" fill="#fff" strokeWidth={0} />
            </div>
          </div>

          <h2
            id="care-celebration-title"
            className="text-[20px] font-extrabold text-text-main text-center tracking-tight"
          >
            {headline}
          </h2>
          <p className="text-[12.5px] font-bold text-text-sub text-center mt-1.5 leading-snug">
            {subline}
          </p>
        </div>

        {/* 하단 commitment */}
        <div className="px-6 pb-6 pt-4">
          {committed ? (
            <div
              className="rounded-2xl px-4 py-3.5 text-center"
              style={{ background: "#E8F4E8" }}
            >
              <p className="text-[13px] font-extrabold" style={{ color: "#3F5B42" }}>
                ✓ 내일 다시 뵈어요
              </p>
              <p className="text-[11px] font-semibold mt-0.5" style={{ color: "#5A7C5E" }}>
                저녁에 리마인더를 보내드릴게요
              </p>
            </div>
          ) : (
            <>
              <p className="text-[12px] font-bold text-text-sub text-center mb-3">
                내일도 들러주실래요?
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCommit}
                  className="flex-1 py-3 rounded-2xl text-[13px] font-extrabold text-white active:scale-[0.98]"
                  style={{
                    background: "linear-gradient(135deg, #C47E5A 0%, #A8684A 100%)",
                    boxShadow: "0 4px 14px rgba(196,126,90,0.45)",
                  }}
                >
                  네, 내일도 올게요
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-3 rounded-2xl text-[12px] font-bold"
                  style={{ background: "#F5F0EB", color: "#A38E7A" }}
                >
                  닫기
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
