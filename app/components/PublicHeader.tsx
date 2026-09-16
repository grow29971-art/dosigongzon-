// 공개 SEO 랜딩 페이지용 상단 헤더.
// - 서버 컴포넌트: auth 상태에 따라 CTA 분기 (SSR 직결, hydration 깜빡임 X)
// - 로그인 유저: 홈·마이페이지 버튼
// - 비로그인 유저: 로그인·시작하기 버튼 (가입 전환 유도)
// - sticky — 스크롤 중에도 브랜드 노출
// 2026-09-16 「익숙한 동네앱」 리디자인: 블러·필 버튼 폐기 → 흰 바 + 하단 헤어라인, 8px 버튼.

import Link from "next/link";
import { PawPrint, LogIn, ArrowRight, User as UserIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export default async function PublicHeader() {
  let isLoggedIn = false;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    isLoggedIn = !!user;
  } catch {
    isLoggedIn = false;
  }

  return (
    <header
      className="sticky top-0 z-30"
      style={{
        background: "var(--color-surface)",
        borderBottom: "1px solid var(--color-border)",
      }}
    >
      <div className="max-w-lg mx-auto px-4 h-12 flex items-center justify-between">
        {/* 로고 + 브랜드 */}
        <Link href="/" className="flex items-center gap-1.5 press-strong transition-transform">
          <div
            className="w-7 h-7 flex items-center justify-center"
            style={{ background: "var(--color-primary)", borderRadius: "var(--radius-input)", color: "var(--color-surface)" }}
          >
            <PawPrint size={15} strokeWidth={2.3} />
          </div>
          <span className="text-[15px] font-bold text-text-main">
            도시공존
          </span>
        </Link>

        {/* 우측 CTA */}
        {isLoggedIn ? (
          <Link
            href="/mypage"
            className="flex items-center gap-1 h-8 px-3 text-[13px] font-semibold press-strong transition-transform"
            style={{ borderRadius: "var(--radius-input)", background: "var(--color-gray-100)", color: "var(--color-text-main)" }}
            aria-label="마이페이지"
          >
            <UserIcon size={13} />
            마이
          </Link>
        ) : (
          <div className="flex items-center gap-1.5">
            <Link
              href="/login"
              className="flex items-center gap-1 h-8 px-2.5 text-[13px] font-semibold press-strong transition-transform"
              style={{ borderRadius: "var(--radius-input)", color: "var(--color-text-sub)" }}
            >
              <LogIn size={13} />
              로그인
            </Link>
            <Link
              href="/signup"
              className="flex items-center gap-1 h-8 px-3 text-[13px] font-semibold press-strong transition-transform"
              style={{
                borderRadius: "var(--radius-input)",
                background: "var(--color-primary)",
                color: "var(--color-surface)",
              }}
            >
              시작하기
              <ArrowRight size={12} />
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
