"use client";

import { PawPrint } from "lucide-react";

/**
 * 앱 초기 진입 / auth 체크 중 표시되는 브랜드 로딩 스크린.
 */
export default function SplashLoading() {
  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center z-[90]"
      style={{
        background: "linear-gradient(180deg, #F5F3EE 0%, #EEEAE2 100%)",
      }}
    >
      {/* 로고 */}
      <div
        className="relative w-[88px] h-[88px] rounded-[28px] flex items-center justify-center mb-5"
        style={{
          background: "linear-gradient(135deg, #C47E5A 0%, #A8684A 100%)",
          boxShadow:
            "0 16px 40px rgba(196,126,90,0.35), inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -3px 6px rgba(0,0,0,0.1)",
          animation: "splash-pulse 1.8s ease-in-out infinite",
        }}
      >
        <PawPrint size={44} color="#fff" strokeWidth={1.8} />
      </div>

      {/* 타이틀 */}
      <h1 className="text-[24px] font-black tracking-[-0.04em] leading-none mb-2">
        <span className="text-text-main">도시</span>
        <span className="text-primary">공존</span>
      </h1>

      {/* 서브 */}
      <div className="flex items-center gap-2">
        <div
          className="w-5 h-[2px] rounded-full"
          style={{ backgroundColor: "#C47E5A", opacity: 0.5 }}
        />
        <p className="text-[11.5px] font-bold text-text-sub tracking-[-0.01em]">
          길 위의 아이들
        </p>
      </div>

      {/* 로딩 점 */}
      <div className="flex items-center gap-1.5 mt-8">
        <span
          className="w-1.5 h-1.5 rounded-full animate-bounce"
          style={{ backgroundColor: "#C47E5A", animationDelay: "0ms" }}
        />
        <span
          className="w-1.5 h-1.5 rounded-full animate-bounce"
          style={{ backgroundColor: "#C47E5A", animationDelay: "150ms" }}
        />
        <span
          className="w-1.5 h-1.5 rounded-full animate-bounce"
          style={{ backgroundColor: "#C47E5A", animationDelay: "300ms" }}
        />
      </div>

      <style jsx>{`
        @keyframes splash-pulse {
          0%,
          100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.06);
          }
        }
      `}</style>
    </div>
  );
}
