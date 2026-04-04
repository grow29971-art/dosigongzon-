"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Eye, MessageCircle, Plus, AlertTriangle, Heart, ChevronRight } from "lucide-react";
import type { Post, PostCategory } from "@/lib/types";
import { CATEGORY_MAP } from "@/lib/types";
import { getPosts, formatRelativeTime } from "@/lib/store";

const TABS: { key: "all" | PostCategory; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "emergency", label: "🚨 긴급" },
  { key: "foster", label: "🏠 임보" },
  { key: "adoption", label: "💕 입양" },
  { key: "care", label: "🌿 돌봄" },
  { key: "lost", label: "🔍 실종" },
  { key: "free", label: "💬 자유" },
];

export default function CommunityPage() {
  const [mounted, setMounted] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [filter, setFilter] = useState<"all" | PostCategory>("all");

  useEffect(() => {
    setMounted(true);
    setPosts(getPosts());
  }, []);

  if (!mounted) return null;

  const filtered = filter === "all" ? posts : posts.filter((p) => p.category === filter);

  return (
    <div className="pb-4">
      {/* ── 헤더 ── */}
      <div className="px-6 pt-14 pb-3">
        <h1 className="text-[22px] font-extrabold text-text-main tracking-tight">커뮤니티</h1>
      </div>

      {/* ── SOS 배너 ── */}
      <div className="px-4 mb-3">
        <div
          className="flex items-center justify-between rounded-[32px] py-4 px-5"
          style={{ background: "linear-gradient(135deg, #D32F2F, #E53935)", boxShadow: "0 6px 16px rgba(211,47,47,0.2)" }}
        >
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center">
              <AlertTriangle size={22} color="#fff" />
            </div>
            <div>
              <p className="text-[17px] font-extrabold text-white">🚨 긴급 SOS</p>
              <p className="text-xs text-red-200 font-medium">긴급 제보 · 구조/치료 기록</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="bg-white text-[#D32F2F] text-xs font-extrabold min-w-[24px] h-6 rounded-full flex items-center justify-center px-2">
              {posts.filter((p) => p.category === "emergency").length}
            </span>
            <ChevronRight size={20} color="#FFCCBB" />
          </div>
        </div>
      </div>

      {/* ── 카테고리 필터 ── */}
      <div className="flex gap-2 px-4 pb-3 overflow-x-auto no-scrollbar">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`shrink-0 px-4 py-2 rounded-full text-[13px] font-semibold border transition-all duration-200 ${
              filter === tab.key
                ? "bg-primary text-white border-primary"
                : "bg-white text-text-sub border-border"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── 게시글 리스트 ── */}
      <div className="px-4 space-y-2.5">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center pt-20 text-text-light">
            <MessageCircle size={48} strokeWidth={1.2} />
            <p className="text-base mt-4 text-text-sub">게시글이 없습니다</p>
            <p className="text-[13px] mt-1">첫 번째 글을 작성해보세요!</p>
          </div>
        ) : (
          filtered.map((post) => {
            const cat = CATEGORY_MAP[post.category];
            return (
              <Link key={post.id} href={`/community/${post.id}`} className="block">
                <article className="card p-5 active:scale-[0.99] transition-transform">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[11px] font-bold text-white px-2.5 py-0.5 rounded-lg" style={{ backgroundColor: cat.color }}>
                      {cat.emoji} {cat.label}
                    </span>
                    <span className="text-[11px] text-text-light">{formatRelativeTime(post.createdAt)}</span>
                  </div>
                  <h3 className="text-[16px] font-bold text-text-main leading-snug mb-1.5">{post.title}</h3>
                  <p className="text-[13px] text-text-sub leading-relaxed line-clamp-2 mb-3">{post.content}</p>
                  <div className="flex items-center gap-3 text-text-light text-xs">
                    <span className="font-medium text-text-sub">{post.authorName}</span>
                    <span className="flex items-center gap-0.5"><Eye size={13} /> {post.viewCount}</span>
                    <span className="flex items-center gap-0.5"><Heart size={13} /> {post.likeCount}</span>
                    <span className="flex items-center gap-0.5"><MessageCircle size={13} /> {post.commentCount}</span>
                  </div>
                </article>
              </Link>
            );
          })
        )}
      </div>

      {/* ── FAB ── */}
      <Link
        href="/community/write"
        className="fixed bottom-24 right-5 w-14 h-14 rounded-[20px] bg-primary flex items-center justify-center fab-shadow active:scale-90 transition-transform z-40"
      >
        <Plus size={28} color="#fff" strokeWidth={2.5} />
      </Link>
    </div>
  );
}
