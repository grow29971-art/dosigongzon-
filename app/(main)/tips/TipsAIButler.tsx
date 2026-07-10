"use client";

// 가이드 페이지 내 AI 집사 섹션 — /lab/cat-style 페이지를 가이드로 병합 (2026-07-10)
// 채팅 카드 + 자주 묻는 질문. 비로그인 시 로그인 유도 카드.

import Link from "next/link";
import { Bot, Sparkles } from "lucide-react";
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

export default function TipsAIButler() {
  const { user } = useAuth();

  return (
    <section className="px-4 mb-5">
      {!user ? (
        <Link
          href="/login?next=/tips"
          className="flex items-center gap-3.5 px-5 py-4 active:scale-[0.99] transition-transform"
          style={{
            background: "#FFFFFF",
            borderRadius: 22,
            boxShadow: "0 6px 20px rgba(49,130,246,0.10), 0 1px 3px rgba(0,0,0,0.03)",
            border: "1px solid rgba(0,0,0,0.04)",
          }}
        >
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
            style={{
              background: "linear-gradient(135deg, #3182F6 0%, #1B64DA 100%)",
              boxShadow: "0 5px 12px rgba(49,130,246,0.35)",
            }}
          >
            <Bot size={20} color="#fff" strokeWidth={2.3} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-extrabold text-text-main tracking-tight">
              AI 집사 <span className="text-[9px] font-bold tracking-[0.15em]" style={{ color: "#3182F6", opacity: 0.5 }}>BETA</span>
            </p>
            <p className="text-[11.5px] text-text-sub mt-0.5">로그인하면 길고양이 돌봄, 뭐든 물어볼 수 있어요</p>
          </div>
        </Link>
      ) : (
        <>
          <AIChatCard />

          <div className="flex items-center gap-1.5 mt-4 mb-2 px-1">
            <Sparkles size={13} className="text-primary" />
            <h2 className="text-[13px] font-extrabold text-text-main tracking-tight">AI 집사에게 자주 묻는 질문</h2>
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
            🤖 AI 응답은 참고용이에요. 위급 상황은 매뉴얼 또는 가까운 동물병원에 직접 연락해주세요.
          </p>
        </>
      )}
    </section>
  );
}
