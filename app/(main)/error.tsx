"use client";

// (main) 섹션 전용 에러 바운더리.
// 한 탭에서 에러가 나도 루트 레이아웃·BottomNav는 유지되어 다른 탭으로 이동 가능.
// 루트 app/error.tsx는 layout 자체가 깨진 치명적 케이스 대응.

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw, Home } from "lucide-react";

export default function MainError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[main/error]", error);
  }, [error]);

  return (
    <div
      className="min-h-dvh flex items-center justify-center px-6"
      style={{ background: "#F7F4EE" }}
    >
      <div
        className="w-full max-w-sm rounded-3xl bg-white p-7 text-center"
        style={{ boxShadow: "0 12px 36px rgba(0,0,0,0.08)" }}
      >
        <div
          className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
          style={{ background: "rgba(216,85,85,0.12)" }}
        >
          <span className="text-[28px]">😿</span>
        </div>
        <p className="text-[11px] font-extrabold tracking-[0.12em] mb-2" style={{ color: "#D85555" }}>
          OOPS
        </p>
        <h1 className="text-[18px] font-extrabold text-text-main mb-2 tracking-tight">
          이 페이지에 문제가 생겼어요
        </h1>
        <p className="text-[13px] text-text-sub leading-relaxed mb-5">
          다른 탭은 정상 동작하니 걱정 말고
          <br />
          아래 버튼으로 재시도하거나 홈으로 돌아가세요.
        </p>

        <div className="flex gap-2">
          <button
            onClick={reset}
            className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-2xl text-white text-[13px] font-extrabold active:scale-[0.98] transition-transform"
            style={{
              background: "linear-gradient(135deg, #C47E5A 0%, #A8684A 100%)",
              boxShadow: "0 4px 14px rgba(196,126,90,0.35)",
            }}
          >
            <RotateCcw size={14} />
            다시 시도
          </button>
          <Link
            href="/"
            className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-2xl text-[13px] font-extrabold active:scale-[0.98] transition-transform"
            style={{
              backgroundColor: "#FFF",
              color: "#C47E5A",
              border: "1.5px solid #E8D4BD",
            }}
          >
            <Home size={14} />
            홈으로
          </Link>
        </div>

        {error.digest && (
          <p className="mt-4 text-[10px] font-mono" style={{ color: "#9A8A7A" }}>
            ref: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
