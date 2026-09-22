"use client";

import Link from "next/link";
import { LogIn, MessagesSquare } from "lucide-react";

interface Props {
  title?: string;
  description?: string;
  from?: string; // 리다이렉트 후 돌아올 경로
}

export default function LoginRequired({
  title = "로그인이 필요해요",
  description = "커뮤니티 글은 로그인 후 볼 수 있어요.",
  from,
}: Props) {
  const loginHref = from ? `/login?next=${encodeURIComponent(from)}` : "/login";
  return (
    <div className="px-5 pt-20 pb-24 flex flex-col items-center text-center">
      <MessagesSquare size={40} strokeWidth={1.6} className="mb-4" style={{ color: "var(--color-text-light)" }} />
      <h1 className="text-[20px] font-bold text-text-main tracking-tight mb-2">
        {title}
      </h1>
      <p className="text-[13px] text-text-sub max-w-[320px] leading-relaxed mb-6">
        {description}
      </p>
      <div className="flex flex-col gap-2 w-full max-w-[280px]">
        <Link
          href={loginHref}
          className="flex items-center justify-center gap-2 h-12 text-[15px] font-semibold press transition-transform"
          style={{ background: "var(--color-primary)", color: "var(--color-surface)", borderRadius: "var(--radius-input)" }}
        >
          <LogIn size={16} strokeWidth={2} />
          카카오 · 구글로 시작하기
        </Link>
      </div>
      <p className="text-[11px] text-text-light mt-5">
        가입과 로그인이 같아요 · 1초 가입 · 광고 없음
      </p>
    </div>
  );
}
