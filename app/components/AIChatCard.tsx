"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Bot, Send } from "lucide-react";

// AI 집사 모달 — 버튼 누르기 전엔 다운로드 안 함
const AIChatModal = dynamic(() => import("@/app/components/AIChatModal"), { ssr: false });

// AI 집사 채팅 진입 카드. 현재는 /lab/cat-style(AI 변환) 페이지 하단에 배치 — AI 기능 모음.
export default function AIChatCard() {
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <>
      <div
        className="px-5 py-4"
        style={{
          background: "#FFFFFF",
          borderRadius: 22,
          boxShadow: "0 6px 20px rgba(76,130,188,0.10), 0 1px 3px rgba(0,0,0,0.03)",
          border: "1px solid rgba(0,0,0,0.04)",
        }}
      >
        <div className="flex items-center gap-3.5 mb-3.5">
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
            style={{
              background: "linear-gradient(135deg, #4C82BC 0%, #3E6FA8 100%)",
              boxShadow: "0 5px 12px rgba(76,130,188,0.35), inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -2px 4px rgba(0,0,0,0.08)",
            }}
          >
            <Bot size={20} color="#fff" strokeWidth={2.3} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <p className="text-[15px] font-extrabold text-text-main tracking-tight">
                AI 집사
              </p>
              <span className="text-[9px] font-bold tracking-[0.15em]" style={{ color: "#4C82BC", opacity: 0.5 }}>
                BETA
              </span>
            </div>
            <p className="text-[11.5px] text-text-sub mt-0.5">
              길고양이 돌봄이 궁금하다면 물어보세요
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setChatOpen(true)}
            className="flex-1 rounded-xl px-4 py-2.5 text-[12.5px] text-text-muted text-left transition-all active:scale-[0.98]"
            style={{
              backgroundColor: "#F6F1EA",
              border: "1px solid #E3DCD3",
            }}
          >
            예: 새끼 고양이를 발견했어요...
          </button>
          <button
            onClick={() => setChatOpen(true)}
            aria-label="AI 집사에게 질문하기"
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 active:scale-90 transition-transform"
            style={{
              background: "linear-gradient(135deg, #4C82BC 0%, #3E6FA8 100%)",
              boxShadow: "0 4px 10px rgba(76,130,188,0.35), inset 0 1px 0 rgba(255,255,255,0.3)",
            }}
          >
            <Send size={15} color="white" />
          </button>
        </div>
      </div>

      <AIChatModal open={chatOpen} onClose={() => setChatOpen(false)} />
    </>
  );
}
