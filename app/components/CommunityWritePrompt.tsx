"use client";

// 커뮤니티 글쓰기 유도 — '빈 페이지 공포'를 낮추는 글감 프롬프트.
// 탭하면 카테고리·제목이 프리필된 글쓰기로 이동(/community/write?category=&t=).
// 글 생산 정체(주 1건) 대응. 날짜 시드로 매일 다른 글감 3개 노출.

import Link from "next/link";
import { PenLine, ChevronRight } from "lucide-react";

interface Prompt {
  emoji: string;
  category: "free" | "adoption" | "market";
  label: string;
  title: string;
}

const PROMPTS: Prompt[] = [
  { emoji: "🐱", category: "free", label: "오늘 본 고양이 자랑", title: "오늘 우리 동네에서 본 길고양이" },
  { emoji: "🍚", category: "free", label: "밥자리 이야기", title: "우리 동네 길고양이 밥자리 이야기" },
  { emoji: "💭", category: "free", label: "돌봄 고민 나누기", title: "길고양이 돌보면서 생긴 고민이 있어요" },
  { emoji: "🥫", category: "free", label: "사료·간식 추천", title: "길고양이에게 좋은 사료·간식 추천해요" },
  { emoji: "💕", category: "adoption", label: "입양·임보 알리기", title: "새 가족을 찾는 아이를 소개해요" },
  { emoji: "🛍️", category: "market", label: "용품 나눔·중고", title: "안 쓰는 고양이 용품 나눔해요" },
  { emoji: "❄️", category: "free", label: "겨울 쉼터 노하우", title: "길고양이 겨울 쉼터 만드는 법" },
  { emoji: "🏥", category: "free", label: "병원·TNR 후기", title: "동네 동물병원·TNR 후기를 남겨요" },
];

function dayIndex(): number {
  const d = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
  let h = 0;
  for (let i = 0; i < d.length; i++) h = (h * 31 + d.charCodeAt(i)) >>> 0;
  return h % PROMPTS.length;
}

export default function CommunityWritePrompt() {
  const start = dayIndex();
  const picks = [0, 1, 2].map((i) => PROMPTS[(start + i) % PROMPTS.length]);

  return (
    <div
      className="mb-4 p-4"
      style={{
        background: "linear-gradient(135deg, #F6EEFA 0%, #EFE3F7 100%)",
        borderRadius: 18,
        border: "1px solid rgba(139,101,184,0.2)",
        boxShadow: "0 4px 14px rgba(139,101,184,0.1)",
      }}
    >
      <div className="flex items-center gap-2 mb-2.5">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, #8B65B8 0%, #6F4F96 100%)" }}>
          <PenLine size={15} color="#fff" strokeWidth={2.3} />
        </div>
        <div className="min-w-0">
          <p className="text-[13.5px] font-extrabold text-text-main leading-tight">이런 글 어때요?</p>
          <p className="text-[10.5px] text-text-sub mt-0.5">탭하면 제목이 채워져 바로 쓸 수 있어요</p>
        </div>
      </div>

      <div className="space-y-1.5">
        {picks.map((p) => (
          <Link
            key={p.title}
            href={`/community/write?category=${p.category}&t=${encodeURIComponent(p.title)}`}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white active:scale-[0.99] transition-transform"
            style={{ border: "1px solid rgba(139,101,184,0.12)" }}
          >
            <span className="text-base shrink-0">{p.emoji}</span>
            <span className="flex-1 min-w-0 text-[12.5px] font-bold text-text-main truncate">{p.label}</span>
            <ChevronRight size={14} style={{ color: "#8B65B8" }} className="shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  );
}
