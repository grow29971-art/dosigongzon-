// 공개 SEO 랜딩 페이지용 상단 헤더.
// - 서버 컴포넌트: auth 상태에 따라 CTA 분기 (SSR 직결, hydration 깜빡임 X)
// - 로그인 유저: 홈·마이페이지 버튼
// - 비로그인 유저: 로그인·시작하기 버튼 (가입 전환 유도)
// - sticky + blur 배경 — 스크롤 중에도 브랜드 노출

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
      className="sticky top-0 z-30 backdrop-blur-md"
      style={{
        background: "rgba(255, 253, 248, 0.88)",
        borderBottom: "1px solid rgba(196,126,90,0.12)",
      }}
    >
      <div className="max-w-lg mx-auto px-4 h-12 flex items-center justify-between">
        {/* 로고 + 브랜드 */}
        <Link href="/" className="flex items-center gap-1.5 active:scale-95 transition-transform">
          <div
            className="w-7 h-7 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #C47E5A 0%, #A8684A 100%)" }}
          >
            <PawPrint size={15} color="#fff" strokeWidth={2.3} />
          </div>
          <span className="text-[14.5px] font-extrabold text-text-main tracking-tight">
            도시공존
          </span>
        </Link>

        {/* 우측 CTA */}
        {isLoggedIn ? (
          <Link
            href="/mypage"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11.5px] font-bold active:scale-95 transition-transform"
            style={{ background: "rgba(196,126,90,0.12)", color: "#C47E5A" }}
            aria-label="마이페이지"
          >
            <UserIcon size={12} />
            마이
          </Link>
        ) : (
          <div className="flex items-center gap-1.5">
            <Link
              href="/login"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11.5px] font-bold active:scale-95 transition-transform"
              style={{ color: "#6B5043" }}
            >
              <LogIn size={12} />
              로그인
            </Link>
            <Link
              href="/signup"
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-[11.5px] font-extrabold active:scale-95 transition-transform text-white"
              style={{
                background: "linear-gradient(135deg, #C47E5A 0%, #A8684A 100%)",
                boxShadow: "0 2px 8px rgba(196,126,90,0.35)",
              }}
            >
              시작하기
              <ArrowRight size={11} />
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
