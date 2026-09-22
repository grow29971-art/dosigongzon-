"use client";

// 비로그인 하단 가입 넛지 바. 2026-09-16 「익숙한 동네앱」 리디자인: 글로우 그림자·채움 아이콘 폐기 →
// 흰 면 + 헤어라인 + raised 그림자(떠 있는 바 — 허용 4종), 회색 선 아이콘, CTA primary.

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X, ArrowRight, PawPrint } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

const DISMISS_KEY = "dosigongzon_signup_nudge_dismissed";
const DISMISS_TTL_HOURS = 24;

// 이 경로들에서만 노출 (로그인/가입/온보딩·관리자 등 제외)
const SHOW_PATTERNS = [
  /^\/$/,
  /^\/map$/,
  /^\/cats\//,
  /^\/areas(\/|$)/,
  /^\/protection(\/|$)/,
  /^\/hospitals$/,
  /^\/shelters$/,
  /^\/about$/,
];

function isDismissedRecently(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const ts = parseInt(raw, 10);
    if (isNaN(ts)) return false;
    return Date.now() - ts < DISMISS_TTL_HOURS * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

export default function SignupNudgeBar() {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (user) { setVisible(false); return; }
    if (!pathname) return;
    if (!SHOW_PATTERNS.some((re) => re.test(pathname))) { setVisible(false); return; }
    if (isDismissedRecently()) return;
    // 살짝 지연 — 페이지 첫 인상 방해 방지
    const timer = setTimeout(() => { setVisible(true); setShown(true); }, 4000);
    return () => clearTimeout(timer);
  }, [loading, user, pathname]);

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch { /* no-op */ }
  };

  if (!visible) return null;

  const next = encodeURIComponent(pathname || "/");

  return (
    <div
      className="fixed inset-x-0 z-[60] pointer-events-none"
      style={{
        bottom: "calc(env(safe-area-inset-bottom, 0) + 8px)",
      }}
      aria-live="polite"
    >
      <div
        className={`pointer-events-auto mx-auto max-w-md px-4 py-3 flex items-center gap-3 transition-all ${shown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`}
        style={{
          background: "var(--color-surface)",
          borderRadius: "var(--radius-card)",
          boxShadow: "var(--shadow-raised)",
          border: "1px solid var(--color-border)",
          marginLeft: 12,
          marginRight: 12,
        }}
      >
        <PawPrint size={20} className="shrink-0" style={{ color: "var(--color-text-light)" }} strokeWidth={1.8} />
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-semibold text-text-main leading-snug">
            가입하면 고양이 등록·돌봄 기록 가능!
          </p>
          <p className="text-[13px] text-text-sub mt-0.5 leading-snug">
            카카오·구글로 <b className="font-semibold text-text-main">1초 가입</b> · 동네 이웃과 함께 돌봐요
          </p>
        </div>
        <Link
          href={`/signup?next=${next}`}
          className="shrink-0 h-8 px-3 flex items-center gap-1 text-[13px] font-semibold press-strong transition-transform"
          style={{
            borderRadius: "var(--radius-input)",
            background: "var(--color-primary)",
            color: "var(--color-surface)",
          }}
        >
          가입
          <ArrowRight size={12} />
        </Link>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 w-8 h-8 -mr-2 flex items-center justify-center press-strong"
          aria-label="닫기"
        >
          <X size={16} style={{ color: "var(--color-text-light)" }} />
        </button>
      </div>
    </div>
  );
}
