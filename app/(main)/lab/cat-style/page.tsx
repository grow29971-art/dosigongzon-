// AI 집사 페이지 — /lab/cat-style
// 사진 변환 기능 완전 제거됨. AI 집사 채팅만.

"use client";

import Link from "next/link";
import { ArrowLeft, Bot, Sparkles, BookOpen, Siren, Baby, Stethoscope, Snowflake, Pill } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import AIChatCard from "@/app/components/AIChatCard";

const QUICK_QUESTIONS: Array<{ emoji: string; question: string }> = [
  { emoji: "🍼", question: "새끼 고양이 발견했어요" },
  { emoji: "🩺", question: "TNR 신청은 어떻게 하나요" },
  { emoji: "🚨", question: "다친 고양이 응급처치 방법" },
  { emoji: "❄️", question: "겨울 쉼터 만드는 법" },
  { emoji: "⚖️", question: "동네 길고양이 밥 주는 게 위법인가요" },
  { emoji: "🥣", question: "사료는 어떤 게 좋아요" },
];

const GUIDE_LINKS: Array<{ href: string; label: string; Icon: typeof Siren; color: string }> = [
  { href: "/protection/emergency-guide", label: "응급처치", Icon: Siren, color: "#D85555" },
  { href: "/protection/kitten-guide", label: "새끼 발견", Icon: Baby, color: "#E88D5A" },
  { href: "/protection/trapping-guide", label: "TNR·포획", Icon: Stethoscope, color: "#8B65B8" },
  { href: "/protection/shelter-guide", label: "겨울 쉼터", Icon: Snowflake, color: "#5A8AC4" },
  { href: "/protection/pharmacy-guide", label: "약품", Icon: Pill, color: "#6B8E6F" },
  { href: "/tips", label: "전체 가이드", Icon: BookOpen, color: "#1B64DA" },
];

export default function AICatSitterPage() {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="min-h-dvh px-5 pt-20 text-center" style={{ background: "#F7F4EE" }}>
        <Bot size={40} className="mx-auto text-text-light mb-3" strokeWidth={1.5} />
        <p className="text-[14px] font-bold text-text-main mb-1">AI 집사는 로그인 후 이용 가능해요</p>
        <Link
          href="/login?next=/lab/cat-style"
          className="inline-block mt-3 px-5 py-2.5 rounded-2xl text-white text-[13px] font-extrabold"
          style={{
            background: "linear-gradient(135deg, #3182F6 0%, #1B64DA 100%)",
            boxShadow: "0 4px 14px rgba(49,130,246,0.35)",
          }}
        >
          로그인하기
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-dvh pb-20" style={{ background: "#F7F4EE" }}>
      <div className="px-4 pt-12 pb-3 flex items-center gap-2">
        <Link
          href="/"
          className="w-9 h-9 rounded-full bg-white flex items-center justify-center active:scale-90"
          style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}
        >
          <ArrowLeft size={18} className="text-text-main" />
        </Link>
        <div>
          <h1 className="text-[20px] font-extrabold text-text-main flex items-center gap-1.5">
            <Bot size={18} className="text-primary" />
            AI 집사
            <span className="text-[9px] font-bold tracking-[0.15em] ml-0.5" style={{ color: "#3182F6", opacity: 0.55 }}>BETA</span>
          </h1>
          <p className="text-[10.5px] text-text-sub">길고양이 돌봄, 뭐든 물어보세요</p>
        </div>
      </div>

      <div className="px-4 mt-2">
        <AIChatCard />
      </div>

      <section className="px-4 mt-5">
        <div className="flex items-center gap-1.5 mb-2 px-1">
          <Sparkles size={13} className="text-primary" />
          <h2 className="text-[13px] font-extrabold text-text-main tracking-tight">자주 묻는 질문</h2>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {QUICK_QUESTIONS.map((q) => (
            <div
              key={q.question}
              className="px-3 py-2.5 rounded-2xl flex items-center gap-2"
              style={{
                background: "#FFFFFF",
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                border: "1px solid rgba(0,0,0,0.04)",
              }}
            >
              <span className="text-[16px] shrink-0">{q.emoji}</span>
              <p className="text-[11.5px] font-bold text-text-main leading-tight">{q.question}</p>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-text-light mt-1.5 px-1 leading-snug">
          위 채팅창에 자유롭게 입력하시거나, 위 예시를 참고하세요
        </p>
      </section>

      <section className="px-4 mt-6">
        <div className="flex items-center gap-1.5 mb-2 px-1">
          <BookOpen size={13} className="text-primary" />
          <h2 className="text-[13px] font-extrabold text-text-main tracking-tight">정확한 매뉴얼이 필요할 땐</h2>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {GUIDE_LINKS.map((g) => (
            <Link
              key={g.href}
              href={g.href}
              className="rounded-2xl px-2 py-2.5 flex flex-col items-center gap-1 active:scale-[0.96] transition-transform"
              style={{
                background: "#FFFFFF",
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                border: "1px solid rgba(0,0,0,0.04)",
              }}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: `${g.color}15` }}
              >
                <g.Icon size={15} style={{ color: g.color }} strokeWidth={2.3} />
              </div>
              <span className="text-[11px] font-extrabold text-text-main">{g.label}</span>
            </Link>
          ))}
        </div>
      </section>

      <p className="text-center text-[10.5px] text-text-light mt-6 px-6 leading-relaxed">
        🤖 AI 응답은 참고용이에요. 위급 상황은 위의 매뉴얼 또는<br />
        가까운 동물병원에 직접 연락해주세요.
      </p>
    </div>
  );
}
