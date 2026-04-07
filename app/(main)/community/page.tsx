"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Eye,
  MessageCircle,
  Plus,
  Heart,
  ChevronRight,
  MapPin,
  ImageIcon,
  TrendingUp,
} from "lucide-react";
import type { Post, PostCategory } from "@/lib/types";
import { CATEGORY_MAP } from "@/lib/types";
import { getPosts, formatRelativeTime } from "@/lib/store";

const TABS: { key: "all" | PostCategory; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "emergency", label: "긴급" },
  { key: "foster", label: "임보" },
  { key: "adoption", label: "입양" },
  { key: "care", label: "돌봄" },
  { key: "lost", label: "실종" },
  { key: "free", label: "자유" },
];

/* ═══ 포토 플레이스홀더 (이미지 대신 그라데이션 + 아이콘) ═══ */
const PHOTO_GRADIENTS = [
  "linear-gradient(135deg, #FECACA 0%, #FDE68A 100%)",
  "linear-gradient(135deg, #DBEAFE 0%, #C7D2FE 100%)",
  "linear-gradient(135deg, #CCFBF1 0%, #A7F3D0 100%)",
  "linear-gradient(135deg, #FEE2E2 0%, #FECDD3 100%)",
  "linear-gradient(135deg, #EDE9FE 0%, #DDD6FE 100%)",
  "linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)",
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
      <div className="px-5 pt-14 pb-2 flex items-center justify-between">
        <h1 className="text-[22px] font-extrabold text-text-main tracking-tight">
          커뮤니티
        </h1>
        <Link
          href="/neighborhood"
          className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-primary/10 active:scale-95 transition-transform"
        >
          <MapPin size={13} className="text-primary" />
          <span className="text-[12px] font-semibold text-primary">동네 소식</span>
        </Link>
      </div>

      {/* ── 트렌딩 배너 ── */}
      <div className="px-5 py-3">
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#FEF3C7] flex items-center justify-center shrink-0">
            <TrendingUp size={20} color="#EAB308" strokeWidth={1.8} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-text-main">지금 뜨는 주제</p>
            <p className="text-[12px] text-text-sub truncate">
              봄철 길고양이 중성화 · 새끼 발견 급증
            </p>
          </div>
        </div>
      </div>

      {/* ── 카테고리 필터 ── */}
      <div className="flex gap-2 px-5 pb-3 overflow-x-auto no-scrollbar">
        {TABS.map((tab) => {
          const active = filter === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`shrink-0 px-4 py-2 rounded-full text-[13px] font-semibold transition-all ${
                active
                  ? "bg-text-main text-white"
                  : "bg-white text-text-sub border border-border"
              }`}
            >
              {tab.key !== "all" && (
                <span className="mr-1">{CATEGORY_MAP[tab.key].emoji}</span>
              )}
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── 피드 ── */}
      <div className="px-4 space-y-4">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center pt-20 text-text-light">
            <MessageCircle size={48} strokeWidth={1.2} />
            <p className="text-base mt-4 text-text-sub">게시글이 없습니다</p>
            <p className="text-[13px] mt-1">첫 번째 글을 작성해보세요!</p>
          </div>
        ) : (
          filtered.map((post, idx) => {
            const cat = CATEGORY_MAP[post.category];
            const gradient = PHOTO_GRADIENTS[idx % PHOTO_GRADIENTS.length];

            return (
              <Link key={post.id} href={`/community/${post.id}`} className="block">
                <article className="card overflow-hidden active:scale-[0.99] transition-transform">
                  {/* 사진 영역 (플레이스홀더) */}
                  <div
                    className="h-40 flex items-center justify-center relative"
                    style={{ background: gradient }}
                  >
                    <ImageIcon size={32} className="text-white/50" strokeWidth={1.5} />
                    {/* 카테고리 뱃지 */}
                    <span
                      className="absolute top-3 left-3 text-[11px] font-bold text-white px-2.5 py-1 rounded-xl"
                      style={{ backgroundColor: cat.color }}
                    >
                      {cat.emoji} {cat.label}
                    </span>
                  </div>

                  {/* 콘텐츠 */}
                  <div className="p-4">
                    <h3 className="text-[16px] font-bold text-text-main leading-snug mb-1.5">
                      {post.title}
                    </h3>
                    <p className="text-[13px] text-text-sub leading-relaxed line-clamp-2 mb-3">
                      {post.content}
                    </p>

                    {/* 작성자 + 지역 뱃지 */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {/* 아바타 */}
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-[11px] font-bold text-primary">
                            {post.authorName.charAt(0)}
                          </span>
                        </div>
                        <span className="text-[13px] font-semibold text-text-main">
                          {post.authorName}
                        </span>
                        {/* 지역 뱃지 */}
                        {post.region && (
                          <span className="tag" style={{ color: "#3B82F6", backgroundColor: "#DBEAFE" }}>
                            <MapPin size={9} className="mr-0.5" />
                            {post.region}
                          </span>
                        )}
                      </div>

                      <span className="text-[11px] text-text-light">
                        {formatRelativeTime(post.createdAt)}
                      </span>
                    </div>

                    {/* 상호작용 */}
                    <div className="flex items-center gap-4 mt-3 pt-3 border-t border-divider text-text-light text-[12px]">
                      <span className="flex items-center gap-1">
                        <Eye size={14} /> {post.viewCount}
                      </span>
                      <span className="flex items-center gap-1">
                        <Heart size={14} /> {post.likeCount}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle size={14} /> {post.commentCount}
                      </span>
                    </div>
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
