"use client";

// (main) 섹션 전용 에러 바운더리.
// 한 탭에서 에러가 나도 루트 레이아웃·BottomNav는 유지되어 다른 탭으로 이동 가능.
// 루트 app/error.tsx는 layout 자체가 깨진 치명적 케이스 대응.

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw, Home, CircleAlert } from "lucide-react";

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
    <div className="min-h-dvh flex items-center justify-center px-6 bg-surface">
      <div className="w-full max-w-sm text-center">
        <CircleAlert size={40} strokeWidth={1.6} className="mx-auto mb-4" style={{ color: "var(--color-text-light)" }} />
        <h1 className="text-[20px] font-bold text-text-main mb-2 tracking-tight">
          이 페이지에 문제가 생겼어요
        </h1>
        <p className="text-[13px] text-text-sub leading-relaxed mb-5">
          다른 탭은 정상이에요. 다시 시도하거나 홈으로 돌아가세요.
        </p>

        <div className="flex gap-2">
          <button
            onClick={reset}
            className="flex-1 flex items-center justify-center gap-1.5 h-12 text-[15px] font-semibold press transition-transform"
            style={{ background: "var(--color-primary)", color: "var(--color-surface)", borderRadius: "var(--radius-input)" }}
          >
            <RotateCcw size={14} />
            다시 시도
          </button>
          <Link
            href="/"
            className="flex-1 flex items-center justify-center gap-1.5 h-12 text-[15px] font-semibold press transition-transform"
            style={{ background: "var(--color-gray-100)", color: "var(--color-text-main)", borderRadius: "var(--radius-input)" }}
          >
            <Home size={14} />
            홈으로
          </Link>
        </div>

        {error.digest && (
          <p className="mt-4 text-[11px] font-mono text-text-light">
            ref: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
