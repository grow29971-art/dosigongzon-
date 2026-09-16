"use client";

// 2026-05-18 패치 안내 배너 — Private Circle·안전 강화.
// 로그인 유저 홈 상단에 표시, 닫으면 localStorage로 영구 dismiss.
// 2026-09-16 「익숙한 동네앱」 리디자인: 초록 채움 배너 → 흰 면 + 헤어라인, CTA primary.

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck, X, ArrowRight } from "lucide-react";

const DISMISS_KEY = "dosigongzon_patch_518_dismissed";

export default function PatchUpdateBanner518() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(DISMISS_KEY);
      if (!dismissed) setShow(true);
    } catch {
      setShow(true);
    }
  }, []);

  const handleDismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore
    }
    setShow(false);
  };

  if (!show) return null;

  return (
    <section className="px-5 mt-3">
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
          <ShieldCheck size={14} />
          <span className="text-[11px] font-medium">NEW · 5/18 업데이트</span>
        </div>
        <p className="text-[15px] font-semibold text-text-main leading-snug mb-1 pr-7">
          우리동네 길집사 — 믿는 이웃에게만 핀 공개
        </p>
        <p className="text-[13px] leading-relaxed text-text-sub">
          걱정되는 아이는 <b className="font-semibold text-text-main">"내 서클"</b>로 등록하면 내가
          승인한 이웃에게만 보입니다. 일반 가입자에게도 외부인에게도 노출되지 않아요.
        </p>
        <p className="text-[13px] mt-2 leading-relaxed text-text-light">
          함께 강화: 좌표 ±444m 흐림 · 비로그인 외부인 도트만 · 위치 단어 자동 차단 ·
          사진 GPS 자동 제거
        </p>
        <Link
          href="/mypage/circle"
          onClick={handleDismiss}
          className="mt-3 h-10 flex items-center justify-center gap-1.5 text-[15px] font-semibold press transition-transform"
          style={{ borderRadius: "var(--radius-input)", background: "var(--color-primary)", color: "var(--color-surface)" }}
        >
          <span>내 서클 시작하기</span>
          <ArrowRight size={14} />
        </Link>
      </div>
    </section>
  );
}
