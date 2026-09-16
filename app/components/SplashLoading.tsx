"use client";

import { PawPrint } from "lucide-react";

/**
 * 앱 초기 진입 / auth 체크 중 표시되는 브랜드 로딩 스크린.
 * 2026-09-16 「익숙한 동네앱」 리디자인: 순백 바탕, 로고 라운드 12px·그림자 없음, 제목 700.
 */
export default function SplashLoading() {
  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center z-[90]"
      style={{
        background: "var(--color-surface)",
      }}
    >
      {/* 로고 */}
      <div
        className="relative w-[72px] h-[72px] flex items-center justify-center mb-5"
        style={{
          background: "var(--color-primary)",
          borderRadius: "var(--radius-card)",
          color: "var(--color-surface)",
          animation: "splash-pulse 1.8s ease-in-out infinite",
        }}
      >
        <PawPrint size={36} strokeWidth={1.8} />
      </div>

      {/* 타이틀 */}
      <h1 className="text-[24px] font-bold tracking-tight leading-none mb-2">
        <span className="text-text-main">도시</span>
        <span className="text-primary">공존</span>
      </h1>

      {/* 서브 */}
      <p className="text-[13px] text-text-sub">
        길 위의 아이들
      </p>

      {/* 로딩 점 */}
      <div className="flex items-center gap-1.5 mt-8">
        <span
          className="w-1.5 h-1.5 rounded-full animate-bounce"
          style={{ backgroundColor: "var(--color-gray-300)", animationDelay: "0ms" }}
        />
        <span
          className="w-1.5 h-1.5 rounded-full animate-bounce"
          style={{ backgroundColor: "var(--color-gray-300)", animationDelay: "150ms" }}
        />
        <span
          className="w-1.5 h-1.5 rounded-full animate-bounce"
          style={{ backgroundColor: "var(--color-gray-300)", animationDelay: "300ms" }}
        />
      </div>

      <style jsx>{`
        @keyframes splash-pulse {
          0%,
          100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.04);
          }
        }
      `}</style>
    </div>
  );
}
