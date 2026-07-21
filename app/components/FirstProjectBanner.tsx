"use client";

// 첫 구원 프로젝트 — 사용처 투표 유도 배너 (2026-07-14)
// 홈 상단 표시, 닫으면 localStorage로 dismiss. 탭하면 쇼핑(투표 카드)으로 이동.

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
        className="rounded-2xl overflow-hidden"
        style={{
          background: "linear-gradient(160deg, #000000 0%, #191F28 60%, #333D4B 100%)",
          boxShadow: "0 8px 24px rgba(25, 31, 40,0.22), 0 2px 6px rgba(25, 31, 40,0.14)",
        }}
      >
        <div className="p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5">
              <Vote size={14} color="#FFF7C4" />
              <span className="text-[10px] font-extrabold tracking-[0.18em]" style={{ color: "#FFF7C4" }}>
                NEW · 사용처 투표
              </span>
            </div>
            <button
              type="button"
              onClick={handleDismiss}
              className="shrink-0 active:scale-90 transition-transform"
              aria-label="닫기"
            >
              <X size={16} color="rgba(255,255,255,0.7)" />
            </button>
          </div>
          <p className="text-[15px] font-extrabold text-white leading-snug mb-2 tracking-tight">
            🐾 도시공존 1호 프로젝트
          </p>
          <p className="text-[12.5px] leading-[1.7]" style={{ color: "rgba(255,255,255,0.92)" }}>
            곧 시작됩니다. 모인 수익을 <b style={{ color: "#FFF7C4" }}>어디에 먼저 쓸지</b>,
            여러분의 생각을 투표해주세요.
          </p>
          <Link
            href="/shop"
            onClick={handleDismiss}
            className="mt-3 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[12.5px] font-extrabold active:scale-[0.98] transition-transform"
            style={{ background: "rgba(255,255,255,0.95)", color: "#000000" }}
          >
            <span>투표하러 가기</span>
            <ArrowRight size={13} />
          </Link>
        </div>
      </div>
    </div>
  );
}
