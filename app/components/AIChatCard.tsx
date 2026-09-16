"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Bot, Send } from "lucide-react";

// AI 집사 모달 — 버튼 누르기 전엔 다운로드 안 함
const AIChatModal = dynamic(() => import("@/app/components/AIChatModal"), { ssr: false });

// AI 집사 채팅 진입 카드. 가이드(/tips) 페이지의 AI 집사 섹션에서 사용.
// 2026-09-16 「익숙한 동네앱」 리디자인: 글로우 그림자·채움 아이콘 → 헤어라인 카드, 회색 선 아이콘.
export default function AIChatCard() {
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <>
      <div
        className="px-4 py-4"
        style={{
          background: "var(--color-surface)",
          borderRadius: "var(--radius-card)",
          border: "1px solid var(--color-border)",
        }}
      >
        <div className="flex items-center gap-3 mb-3">
          <Bot size={22} className="shrink-0" style={{ color: "var(--color-text-sub)" }} strokeWidth={1.8} />
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <p className="text-[15px] font-semibold text-text-main">
                AI 집사
              </p>
              <span className="text-[11px] font-medium text-text-light">
                BETA
              </span>
            </div>
            <p className="text-[13px] text-text-sub mt-0.5">
              길고양이 돌봄이 궁금하다면 물어보세요
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setChatOpen(true)}
            className="flex-1 h-10 px-4 text-[13px] text-text-muted text-left press"
            style={{
              borderRadius: "var(--radius-input)",
              backgroundColor: "var(--color-surface-alt)",
            }}
          >
            예: 새끼 고양이를 발견했어요...
          </button>
          <button
            onClick={() => setChatOpen(true)}
            aria-label="AI 집사에게 질문하기"
            className="w-10 h-10 flex items-center justify-center shrink-0 press-strong transition-transform"
            style={{
              borderRadius: "var(--radius-input)",
              background: "var(--color-primary)",
              color: "var(--color-surface)",
            }}
          >
            <Send size={15} />
          </button>
        </div>
      </div>

      <AIChatModal open={chatOpen} onClose={() => setChatOpen(false)} />
    </>
  );
}
