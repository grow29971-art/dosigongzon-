"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * 전역 에러 바운더리.
 * 렌더링·서버 액션 에러가 상위로 전파될 때 이 페이지가 대신 표시됨.
 * 브랜드 톤 + 복구 버튼 (재시도 / 홈).
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
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 py-12"
      style={{
        background: "linear-gradient(135deg, #F6EFE3 0%, #EADFCB 60%, #DAC4A3 100%)",
      }}
    >
      <div
        className="w-full max-w-md rounded-[32px] text-center relative overflow-hidden"
        style={{
          background: "#FFFFFF",
          boxShadow: "0 20px 60px rgba(0,0,0,0.08)",
          padding: "48px 32px 36px",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -60,
            right: -40,
            width: 180,
            height: 180,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(216,85,85,0.12) 0%, rgba(216,85,85,0) 70%)",
          }}
        />

        <div className="relative">
          <div className="text-[80px] leading-none mb-2" aria-hidden>
            😿
          </div>
          <p
            className="text-[12px] font-extrabold tracking-[0.3em] mb-3"
            style={{ color: "#D85555" }}
          >
            OOPS
          </p>
          <h1 className="text-[22px] font-extrabold text-text-main tracking-tight leading-tight mb-2">
            문제가 발생했어요
          </h1>
          <p className="text-[13px] text-text-sub leading-relaxed mb-6">
            일시적인 오류예요. 잠시 후 다시 시도해주세요.<br />
            계속되면 홈으로 이동해주세요.
          </p>

          {error.digest && (
            <p
              className="text-[10px] font-mono mb-4 px-3 py-1.5 rounded-lg inline-block"
              style={{ background: "#F7F4EE", color: "#A38E7A" }}
            >
              ref: {error.digest}
            </p>
          )}

          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => reset()}
              className="w-full py-3 rounded-2xl text-[14px] font-extrabold text-white active:scale-[0.98] transition-transform"
              style={{
                background: "linear-gradient(135deg, #C47E5A 0%, #A8684A 100%)",
                boxShadow: "0 4px 14px rgba(196,126,90,0.4)",
              }}
            >
              🔄 다시 시도
            </button>
            <Link
              href="/"
              className="w-full py-3 rounded-2xl text-[13px] font-bold active:scale-[0.98]"
              style={{
                background: "#F7F4EE",
                color: "#A38E7A",
                border: "1px solid rgba(0,0,0,0.05)",
              }}
            >
              🏠 홈으로 돌아가기
            </Link>
          </div>

          <p className="text-[11px] text-text-light mt-6 leading-relaxed">
            문의는 마이페이지 → 문의하기 또는<br />
            <a href="mailto:grow29971@gmail.com" className="underline">grow29971@gmail.com</a>
          </p>
        </div>
      </div>
    </div>
  );
}
