"use client";

// 커뮤니티 글쓰기 유도 — '빈 페이지 공포'를 낮추는 글감 프롬프트.
// 탭하면 카테고리·제목이 프리필된 글쓰기로 이동(/community/write?category=&t=).
// 글 생산 정체(주 1건) 대응. 날짜 시드로 매일 다른 글감 3개 노출.
// 2026-09-16 「익숙한 동네앱」 리디자인: 보라 틴트 카드·이모지 폐지 → 흰 면 + 헤어라인 + 구분선 리스트.

import Link from "next/link";
import { PenLine, ChevronRight } from "lucide-react";

interface Prompt {
  category: "free" | "adoption" | "market";
  label: string;
  title: string;
}

const PROMPTS: Prompt[] = [
  { category: "free", label: "오늘 본 고양이 자랑", title: "오늘 우리 동네에서 본 길고양이" },
  { category: "free", label: "밥자리 이야기", title: "우리 동네 길고양이 밥자리 이야기" },
  { category: "free", label: "돌봄 고민 나누기", title: "길고양이 돌보면서 생긴 고민이 있어요" },
  { category: "free", label: "사료·간식 추천", title: "길고양이에게 좋은 사료·간식 추천해요" },
  { category: "adoption", label: "입양·임보 알리기", title: "새 가족을 찾는 아이를 소개해요" },
  { category: "market", label: "용품 나눔·중고", title: "안 쓰는 고양이 용품 나눔해요" },
  { category: "free", label: "겨울 쉼터 노하우", title: "길고양이 겨울 쉼터 만드는 법" },
  { category: "free", label: "병원·TNR 후기", title: "동네 동물병원·TNR 후기를 남겨요" },
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
      className="mb-4 px-4 pt-4 pb-1"
      style={{
        background: "var(--color-surface)",
        borderRadius: "var(--radius-card)",
        border: "1px solid var(--color-border)",
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <PenLine size={16} strokeWidth={1.8} className="text-text-sub shrink-0" />
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-text-main leading-tight">이런 글 어때요?</p>
          <p className="text-[13px] text-text-sub mt-0.5">탭하면 제목이 채워져요</p>
        </div>
      </div>

      <div>
        {picks.map((p) => (
          <Link
            key={p.title}
            href={`/community/write?category=${p.category}&t=${encodeURIComponent(p.title)}`}
            className="flex items-center gap-2.5 py-3 press transition-transform border-b border-divider last:border-b-0"
            style={{ minHeight: 48 }}
          >
            <span className="flex-1 min-w-0 text-[15px] font-medium text-text-main truncate">{p.label}</span>
            <ChevronRight size={16} className="shrink-0" style={{ color: "var(--color-text-muted)" }} />
          </Link>
        ))}
      </div>
    </div>
  );
}
