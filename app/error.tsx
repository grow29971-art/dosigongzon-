"use client";

import { useEffect } from "react";
import Link from "next/link";
import { CircleAlert } from "lucide-react";

/**
 * 전역 에러 바운더리.
 * 렌더링·서버 액션 에러가 상위로 전파될 때 이 페이지가 대신 표시됨.
 * 복구 버튼 (재시도 / 홈).
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 상세 에러는 Vercel 로그에 이미 기록됨. 여기선 숨김.
    if (process.env.NODE_ENV === "development") {
      console.error("[ErrorBoundary]", error);
    }
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 bg-surface">
      <div className="w-full max-w-md text-center">
        <CircleAlert size={44} strokeWidth={1.6} className="mx-auto mb-4" style={{ color: "var(--color-text-light)" }} aria-hidden />
        <h1 className="text-[24px] font-bold text-text-main tracking-tight leading-tight mb-2">
          문제가 발생했어요
        </h1>
        <p className="text-[13px] text-text-sub leading-relaxed mb-6">
          일시적인 오류예요. 잠시 후 다시 시도해주세요.
        </p>

        {error.digest && (
          <p className="text-[11px] font-mono mb-4 text-text-light">
            ref: {error.digest}
          </p>
        )}

        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => reset()}
            className="w-full h-12 text-[15px] font-semibold press transition-transform"
            style={{ background: "var(--color-primary)", color: "var(--color-surface)", borderRadius: "var(--radius-input)" }}
          >
            다시 시도
          </button>
          <Link
            href="/"
            className="w-full h-12 flex items-center justify-center text-[15px] font-semibold press"
            style={{ background: "var(--color-gray-100)", color: "var(--color-text-main)", borderRadius: "var(--radius-input)" }}
          >
            홈으로 돌아가기
          </Link>
        </div>

        <p className="text-[11px] text-text-light mt-6 leading-relaxed">
          문의는 마이페이지 → 문의하기 또는{" "}
          <a href="mailto:grow29971@gmail.com" className="underline">grow29971@gmail.com</a>
        </p>
      </div>
    </div>
  );
}
