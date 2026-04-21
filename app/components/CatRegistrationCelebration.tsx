"use client";

import { Sparkles, PawPrint, Heart } from "lucide-react";

type Props = {
  open: boolean;
  catName: string;
  isFirstEver: boolean;
  onClose: () => void;
};

/**
 * 고양이 등록 직후 peak-end 축하.
 * - 첫 등록은 특별한 메시지 (서비스 합류의 순간)
 * - 일반 등록은 짧은 확인
 */
export default function CatRegistrationCelebration({
  open,
  catName,
  isFirstEver,
  onClose,
}: Props) {
  if (!open) return null;

  const headline = isFirstEver
    ? `${catName}이(가) 지도에 올라왔어요! 🎉`
    : `${catName} 등록 완료`;

  const subline = isFirstEver
    ? "이 아이의 첫 기록자가 되어주셨어요"
    : "이웃들이 함께 돌볼 수 있도록 공유됐어요";

  return (
    <div
      className="fixed inset-0 z-[160] flex items-center justify-center p-5"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="cat-register-celebration-title"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-[28px] overflow-hidden relative"
        style={{ background: "#FFFFFF", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}
      >
        <div
          className="relative px-6 pt-8 pb-5 overflow-hidden"
          style={{
            background: isFirstEver
              ? "linear-gradient(135deg, #FFE3D5 0%, #FFCFB5 100%)"
              : "linear-gradient(135deg, #F5E6D8 0%, #E8D5C0 100%)",
          }}
        >
          <div className="absolute top-3 left-5 animate-pulse">
            <Sparkles size={14} style={{ color: "#E8B040", opacity: 0.8 }} />
          </div>
          <div className="absolute top-10 right-8 animate-pulse" style={{ animationDelay: "0.3s" }}>
            <PawPrint size={12} style={{ color: "#C47E5A", opacity: 0.5 }} />
          </div>
          <div className="absolute bottom-4 right-6 animate-pulse" style={{ animationDelay: "0.6s" }}>
            <Sparkles size={16} style={{ color: "#C47E5A", opacity: 0.8 }} />
          </div>

          <div className="flex items-center justify-center mb-3">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, #C47E5A 0%, #A8684A 100%)",
                boxShadow: "0 8px 24px rgba(196,126,90,0.4)",
              }}
            >
              {isFirstEver ? (
                <Heart size={26} color="#fff" fill="#fff" strokeWidth={0} />
              ) : (
                <PawPrint size={26} color="#fff" strokeWidth={2.5} />
              )}
            </div>
          </div>

          <h2
            id="cat-register-celebration-title"
            className="text-[18px] font-extrabold text-text-main text-center tracking-tight leading-tight px-2"
          >
            {headline}
          </h2>
          <p className="text-[12.5px] font-bold text-text-sub text-center mt-1.5 leading-snug">
            {subline}
          </p>
        </div>

        <div className="px-6 pb-6 pt-4">
          {isFirstEver && (
            <div
              className="rounded-2xl px-4 py-3 mb-3 text-[11.5px] leading-snug"
              style={{ background: "#FFF9EF", color: "#7A5F3F" }}
            >
              <p className="font-extrabold mb-1" style={{ color: "#C47E5A" }}>
                💡 다음 단계 힌트
              </p>
              <p>
                돌봄 일지 한 줄을 남기면 레벨·업적이 시작돼요. 근처 이웃에게
                알림도 함께 전달됩니다.
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 rounded-2xl text-[13px] font-extrabold text-white active:scale-[0.98]"
            style={{
              background: "linear-gradient(135deg, #C47E5A 0%, #A8684A 100%)",
              boxShadow: "0 4px 14px rgba(196,126,90,0.45)",
            }}
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
