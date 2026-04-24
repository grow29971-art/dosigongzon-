// Sentry 통합 검증 페이지.
// 버튼 클릭 → 의도적 에러 발생 → Sentry Issues에 뜨는지 확인.
// 검증 후 삭제해도 OK.

"use client";

import { useState } from "react";
import Link from "next/link";

export default function SentryTestPage() {
  const [sent, setSent] = useState(false);

  const throwClientError = () => {
    throw new Error("[Sentry 테스트] 클라이언트 의도적 에러 — " + new Date().toISOString());
  };

  const throwServerError = async () => {
    const res = await fetch("/api/sentry-test");
    await res.json();
    setSent(true);
  };

  return (
    <div className="min-h-dvh flex items-center justify-center px-6" style={{ background: "#F7F4EE" }}>
      <div className="w-full max-w-sm bg-white rounded-3xl p-6" style={{ boxShadow: "0 12px 36px rgba(0,0,0,0.08)" }}>
        <p className="text-[11px] font-bold tracking-[0.12em] mb-2" style={{ color: "#C47E5A" }}>
          SENTRY TEST
        </p>
        <h1 className="text-[20px] font-extrabold text-text-main mb-4">에러 수집 테스트</h1>

        <div className="space-y-2.5">
          <button
            onClick={throwClientError}
            className="w-full py-3 rounded-2xl text-white text-[13px] font-extrabold active:scale-[0.98]"
            style={{ background: "#D85555" }}
          >
            클라이언트 에러 발생시키기
          </button>
          <button
            onClick={throwServerError}
            className="w-full py-3 rounded-2xl text-white text-[13px] font-extrabold active:scale-[0.98]"
            style={{ background: "#4A7BA8" }}
          >
            서버 에러 발생시키기
          </button>
        </div>

        {sent && (
          <p className="text-[11.5px] text-text-sub mt-3 leading-relaxed">
            서버 에러 요청 전송됨. Sentry Issues에서 확인해보세요.
          </p>
        )}

        <p className="text-[10.5px] text-text-light mt-4 leading-relaxed">
          배포 환경(production)에서만 Sentry로 전송됩니다. dev에서는 콘솔에만 찍힘.
        </p>

        <Link href="/" className="block text-center text-[12px] font-bold text-primary mt-5">
          홈으로
        </Link>
      </div>
    </div>
  );
}
