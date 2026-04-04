"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Send } from "lucide-react";
import type { PostCategory } from "@/lib/types";
import { CATEGORY_MAP } from "@/lib/types";
import { addPost } from "@/lib/store";

const CATEGORIES = Object.entries(CATEGORY_MAP) as [PostCategory, typeof CATEGORY_MAP[PostCategory]][];

export default function WritePage() {
  const router = useRouter();
  const [category, setCategory] = useState<PostCategory>("free");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = title.trim().length > 0 && content.trim().length > 0;

  const handleSubmit = () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);

    addPost({
      category,
      title: title.trim(),
      content: content.trim(),
      authorId: "guest",
      authorName: "게스트",
      images: [],
      isPinned: false,
    });

    router.push("/community");
  };

  return (
    <div className="pb-8">
      {/* ── 헤더 ── */}
      <div className="flex items-center justify-between px-4 pt-14 pb-3">
        <button onClick={() => router.back()} className="p-2 -ml-2 active:scale-90 transition-transform">
          <ArrowLeft size={24} className="text-text-main" />
        </button>
        <h1 className="text-lg font-bold text-text-main">글쓰기</h1>
        <button
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          className={`flex items-center gap-1 px-4 py-2 rounded-full text-sm font-bold transition-all ${
            canSubmit
              ? "bg-primary text-white active:scale-95"
              : "bg-border text-text-muted"
          }`}
        >
          <Send size={16} />
          등록
        </button>
      </div>

      <div className="px-5 space-y-5">
        {/* ── 카테고리 선택 ── */}
        <div>
          <label className="text-[13px] font-bold text-text-sub mb-2 block">카테고리</label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map(([key, info]) => (
              <button
                key={key}
                onClick={() => setCategory(key)}
                className={`px-3.5 py-2 rounded-full text-[13px] font-semibold border transition-all ${
                  category === key
                    ? "text-white border-transparent"
                    : "bg-white text-text-sub border-border"
                }`}
                style={category === key ? { backgroundColor: info.color } : {}}
              >
                {info.emoji} {info.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── 제목 ── */}
        <div>
          <label className="text-[13px] font-bold text-text-sub mb-2 block">제목</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="제목을 입력하세요"
            maxLength={50}
            className="w-full px-4 py-3.5 rounded-2xl border border-border bg-white text-[15px] text-text-main placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors"
          />
          <p className="text-[11px] text-text-muted text-right mt-1">{title.length}/50</p>
        </div>

        {/* ── 내용 ── */}
        <div>
          <label className="text-[13px] font-bold text-text-sub mb-2 block">내용</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="내용을 입력하세요. 길고양이를 위한 정보를 공유해주세요."
            maxLength={2000}
            rows={8}
            className="w-full px-4 py-3.5 rounded-2xl border border-border bg-white text-[15px] text-text-main placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors resize-none leading-relaxed"
          />
          <p className="text-[11px] text-text-muted text-right mt-1">{content.length}/2000</p>
        </div>
      </div>
    </div>
  );
}
