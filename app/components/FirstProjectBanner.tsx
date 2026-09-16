"use client";

// 첫 구원 프로젝트 — 사용처 투표 유도 배너 (2026-07-14)
// 홈 상단 표시, 닫으면 localStorage로 dismiss. 탭하면 쇼핑(투표 카드)으로 이동.
// 2026-09-16 「익숙한 동네앱」 리디자인: 진갈색 채움 배너 → 흰 면 + 헤어라인, CTA primary.

import { useEffect, useState } from "react";
import Link from "next/link";
import { Vote, X, ArrowRight } from "lucide-react";

const DISMISS_KEY = "dosigongzon_first_project_vote_dismissed";

export default function FirstProjectBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(DISMISS_KEY)) setShow(true);
    } catch {
      setShow(true);
    }
  }, []);

  const handleDismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* ignore */ }
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="mb-4">
      <div
        className="relative p-4"
        style={{
          background: "var(--color-surface)",
          borderRadius: "var(--radius-card)",
          border: "1px solid var(--color-border)",
        }}
      >
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center press-strong"
          aria-label="닫기"
        >
          <X size={16} style={{ color: "var(--color-text-light)" }} />
        </button>
        <div className="flex items-center gap-1.5 mb-1 text-text-light">
          <Vote size={14} />
          <span className="text-[11px] font-medium">NEW · 사용처 투표</span>
        </div>
        <p className="text-[15px] font-semibold text-text-main leading-snug mb-1 pr-7">
          도시공존 1호 프로젝트
        </p>
        <p className="text-[13px] leading-relaxed text-text-sub">
          곧 시작됩니다. 모인 수익을 <b className="font-semibold text-text-main">어디에 먼저 쓸지</b>,
          여러분의 생각을 투표해주세요.
        </p>
        <Link
          href="/shop"
          onClick={handleDismiss}
          className="mt-3 h-10 flex items-center justify-center gap-1.5 text-[15px] font-semibold press transition-transform"
          style={{ borderRadius: "var(--radius-input)", background: "var(--color-primary)", color: "var(--color-surface)" }}
        >
          <span>투표하러 가기</span>
          <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
