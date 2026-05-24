// AI 집사 페이지 — /lab/cat-style (URL 그대로 유지 — BottomNav 호환)
// 사진 변환 기능은 잠시 보류(이미지 생성 모델 호환성 이슈). AI 집사 채팅만 노출.
// 코드는 lib/cat-style-transform.ts·api/cat-style/transform에 남아있어 재도입 가능.

"use client";

import Link from "next/link";
import { ArrowLeft, Bot } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import AIChatCard from "@/app/components/AIChatCard";

export default function AICatSitterPage() {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="min-h-dvh px-5 pt-20 text-center" style={{ background: "#F7F4EE" }}>
        <p className="text-[14px] font-bold text-text-main mb-2">로그인이 필요해요</p>
        <Link href="/login?next=/lab/cat-style" className="text-[13px] font-bold text-primary">
          로그인하기 →
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-dvh pb-16" style={{ background: "#F7F4EE" }}>
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
          </h1>
          <p className="text-[10.5px] text-text-sub">길고양이 돌봄이 궁금할 땐 여기에 물어보세요</p>
        </div>
      </div>

      <div className="px-4 mt-3">
        <AIChatCard />
      </div>

      <div className="px-5 mt-6">
        <div
          className="rounded-2xl p-4"
          style={{
            background: "linear-gradient(135deg, #FBF8F3 0%, #F2EBE0 100%)",
            border: "1px solid rgba(196,126,90,0.15)",
          }}
        >
          <p className="text-[12px] font-extrabold text-primary mb-1.5">💡 이런 질문 좋아요</p>
          <ul className="text-[12.5px] text-text-main leading-relaxed space-y-1 pl-1">
            <li>· 새끼 고양이 발견했어요. 어떻게 해야 하나요?</li>
            <li>· 우리 동네 길고양이 밥 주는 게 위법인가요?</li>
            <li>· TNR 신청은 어디로 어떻게 하나요?</li>
            <li>· 겨울 쉼터 만들기 좋은 위치는?</li>
            <li>· 다친 고양이 응급처치 방법</li>
          </ul>
        </div>
      </div>

      <p className="text-center text-[10.5px] text-text-light mt-6 px-6 leading-relaxed">
        🤖 AI 응답은 참고용이에요. 위급 상황은 가이드 → 보호지침에서 정확한 매뉴얼 확인해주세요.
      </p>
    </div>
  );
}
