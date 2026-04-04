"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, Heart, MessageCircle, Send, Clock, User } from "lucide-react";
import type { Post } from "@/lib/types";
import { CATEGORY_MAP } from "@/lib/types";
import { getPostById, formatRelativeTime } from "@/lib/store";

// 더미 댓글
const DUMMY_COMMENTS = [
  { id: "c1", author: "냥집사01", content: "정보 감사합니다! 근처 주민인데 확인해볼게요.", time: "1시간 전" },
  { id: "c2", author: "동네고양이", content: "저도 그 근처에서 본 적 있어요. 조심해서 접근해야 할 것 같아요.", time: "30분 전" },
];

export default function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [post, setPost] = useState<Post | null>(null);
  const [comment, setComment] = useState("");

  useEffect(() => {
    setMounted(true);
    const found = getPostById(id);
    if (found) setPost(found);
  }, [id]);

  if (!mounted) return null;

  if (!post) {
    return (
      <div className="flex flex-col items-center justify-center pt-32 text-text-light">
        <MessageCircle size={48} strokeWidth={1.2} />
        <p className="text-base mt-4 text-text-sub">게시글을 찾을 수 없습니다</p>
        <button onClick={() => router.push("/community")} className="mt-4 px-4 py-2 rounded-full bg-primary text-white text-sm font-bold">
          목록으로
        </button>
      </div>
    );
  }

  const cat = CATEGORY_MAP[post.category];

  return (
    <div className="pb-24">
      {/* ── 헤더 ── */}
      <div className="flex items-center px-4 pt-14 pb-3 gap-3">
        <button onClick={() => router.back()} className="p-2 -ml-2 active:scale-90 transition-transform">
          <ArrowLeft size={24} className="text-text-main" />
        </button>
        <span className="text-[12px] font-bold text-white px-2.5 py-1 rounded-lg" style={{ backgroundColor: cat.color }}>
          {cat.emoji} {cat.label}
        </span>
      </div>

      {/* ── 게시글 본문 ── */}
      <div className="px-5">
        <h1 className="text-xl font-extrabold text-text-main leading-snug">{post.title}</h1>

        {/* 작성자 정보 */}
        <div className="flex items-center gap-2 mt-3 mb-5">
          <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center">
            <User size={16} className="text-primary" />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-text-main">{post.authorName}</p>
            <div className="flex items-center gap-1.5 text-[11px] text-text-light">
              <Clock size={11} />
              <span>{formatRelativeTime(post.createdAt)}</span>
            </div>
          </div>
        </div>

        {/* 본문 내용 */}
        <div className="card p-5">
          <p className="text-[15px] text-text-main leading-relaxed whitespace-pre-wrap">{post.content}</p>
        </div>

        {/* 반응 바 */}
        <div className="flex items-center gap-4 mt-4 px-1 text-text-light">
          <button className="flex items-center gap-1.5 text-[13px] active:scale-95 transition-transform">
            <Heart size={18} /> <span>{post.likeCount}</span>
          </button>
          <span className="flex items-center gap-1.5 text-[13px]">
            <Eye size={18} /> <span>{post.viewCount}</span>
          </span>
          <span className="flex items-center gap-1.5 text-[13px]">
            <MessageCircle size={18} /> <span>{post.commentCount}</span>
          </span>
        </div>

        {/* ── 구분선 ── */}
        <div className="h-px bg-divider my-5" />

        {/* ── 댓글 ── */}
        <h2 className="text-[15px] font-bold text-text-main mb-3">댓글 {DUMMY_COMMENTS.length}</h2>

        <div className="space-y-3">
          {DUMMY_COMMENTS.map((c) => (
            <div key={c.id} className="card-sm p-4">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-coral/30 flex items-center justify-center">
                    <User size={12} className="text-primary-dark" />
                  </div>
                  <span className="text-[13px] font-semibold text-text-main">{c.author}</span>
                </div>
                <span className="text-[11px] text-text-light">{c.time}</span>
              </div>
              <p className="text-[13px] text-text-sub leading-relaxed pl-8">{c.content}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── 댓글 입력 (하단 고정) ── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-border px-4 py-3 z-50">
        <div className="mx-auto max-w-lg flex items-center gap-2">
          <input
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="댓글을 입력하세요..."
            className="flex-1 px-4 py-2.5 rounded-full border border-border bg-surface-alt text-[14px] text-text-main placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors"
          />
          <button
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
              comment.trim() ? "bg-primary active:scale-90" : "bg-border"
            }`}
          >
            <Send size={18} color={comment.trim() ? "#fff" : "#C5C0BA"} />
          </button>
        </div>
      </div>
    </div>
  );
}
