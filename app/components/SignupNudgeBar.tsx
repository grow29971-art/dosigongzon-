"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X, Sparkles, ArrowRight } from "lucide-react";
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
        className={`pointer-events-auto mx-auto mx-4 max-w-md rounded-2xl px-4 py-3 flex items-center gap-3 transition-all ${shown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`}
        style={{
          background: "linear-gradient(135deg, #FFFFFF 0%, #FFF9F0 100%)",
          boxShadow: "0 12px 36px rgba(196,126,90,0.28), 0 2px 6px rgba(0,0,0,0.08)",
          border: "1px solid rgba(196,126,90,0.25)",
          marginLeft: 12,
          marginRight: 12,
        }}
      >
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{
            background: "linear-gradient(135deg, #C47E5A 0%, #A8684A 100%)",
            boxShadow: "0 3px 8px rgba(196,126,90,0.35)",
          }}
        >
          <Sparkles size={16} color="#fff" strokeWidth={2.3} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12.5px] font-extrabold text-text-main leading-tight tracking-tight">
            가입하면 고양이 등록·돌봄 기록 가능!
          </p>
          <p className="text-[10.5px] text-text-sub mt-0.5 leading-tight">
            구글로 <b>10초 가입</b> · 동네 이웃과 함께 돌봐요
          </p>
        </div>
        <Link
          href={`/signup?next=${next}`}
          className="shrink-0 flex items-center gap-1 px-3 py-2 rounded-xl text-white text-[12px] font-extrabold active:scale-95 transition-transform"
          style={{
            background: "linear-gradient(135deg, #C47E5A 0%, #A8684A 100%)",
            boxShadow: "0 3px 8px rgba(196,126,90,0.35)",
          }}
        >
          가입
          <ArrowRight size={12} />
        </Link>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center active:scale-90"
          style={{ background: "rgba(0,0,0,0.05)" }}
          aria-label="닫기"
        >
          <X size={11} className="text-text-sub" />
        </button>
      </div>
    </div>
  );
}
