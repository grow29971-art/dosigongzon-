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
  description = "커뮤니티 글은 이웃 캣맘들의 소중한 정보라 로그인 후 확인할 수 있어요.",
  from,
}: Props) {
  const loginHref = from ? `/login?next=${encodeURIComponent(from)}` : "/login";
  return (
    <div className="px-5 pt-20 pb-24 flex flex-col items-center text-center">
      <div
        className="w-16 h-16 rounded-3xl flex items-center justify-center mb-4"
        style={{
          background: "linear-gradient(135deg, #C47E5A 0%, #A8684A 100%)",
          boxShadow: "0 10px 28px rgba(196,126,90,0.35)",
        }}
      >
        <MessagesSquare size={28} color="#fff" strokeWidth={2.2} />
      </div>
      <h1 className="text-[20px] font-extrabold text-text-main tracking-tight mb-2">
        {title}
      </h1>
      <p className="text-[13px] text-text-sub max-w-[320px] leading-relaxed mb-6">
        {description}
      </p>
      <div className="flex flex-col gap-2 w-full max-w-[280px]">
        <Link
          href={loginHref}
          className="flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-primary text-white text-[14px] font-extrabold active:scale-[0.98] transition-transform"
          style={{ boxShadow: "0 6px 20px rgba(196,126,90,0.3)" }}
        >
          <LogIn size={16} strokeWidth={2.5} />
          카카오 · 구글로 시작하기
        </Link>
      </div>
      <p className="text-[11px] text-text-light mt-5">
        가입과 로그인이 같아요 · 1초 가입 · 광고 없음
      </p>
    </div>
  );
}
