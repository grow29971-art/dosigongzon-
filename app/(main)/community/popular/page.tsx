// 인기게시물 가상 카테고리 — /community/popular
// 최근 30일 글 중 점수(view + like×3 + comment×2) 상위 30개.
// 진짜 PostCategory 추가 X (DB 변경 없음). SSR로 SEO·LCP 이득.
// 2026-09-16 「익숙한 동네앱」 리디자인: 카드·메달·불꽃색 폐지 → 구분선 리스트, 순위는 숫자, 카테고리는 회색 태그.

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  Eye,
  MessageCircle,
  ThumbsUp,
  Flame,
  Plus,
  Siren,
  HandHeart,
  Home,
  Heart,
  ShoppingBag,
  MessagesSquare,
  type LucideIcon,
} from "lucide-react";
import { getPopularPostsServer } from "@/lib/posts-server";
import { CATEGORY_MAP, type PostCategory } from "@/lib/types";
import { formatRelativeTime } from "@/lib/posts-repo";

export const revalidate = 600; // 10분 ISR — 인기 변동 반영

// CATEGORY_MAP[...].emoji 대신 lucide 선 아이콘 (리디자인 2026-09-16)
const CATEGORY_ICON: Record<PostCategory, LucideIcon> = {
  emergency: Siren,
  sitter: HandHeart,
  foster: Home,
  adoption: Heart,
  market: ShoppingBag,
  free: MessagesSquare,
};

export const metadata: Metadata = {
  title: "인기 게시물 — 도시공존 커뮤니티",
  description:
    "도시공존 커뮤니티 최근 30일 인기 게시물 모음. 가장 많이 본·반응한 글들.",
  alternates: { canonical: "/community/popular" },
  openGraph: {
    title: "인기 게시물 | 도시공존 커뮤니티",
    description: "최근 30일 인기글 — 조회·좋아요·댓글 종합 점수 정렬.",
    url: "https://dosigongzon.com/community/popular",
  },
};

export default async function PopularPostsPage() {
  const posts = await getPopularPostsServer(30);

  return (
    <div className="pb-24" style={{ background: "var(--color-surface)", minHeight: "100vh" }}>
      {/* 헤더 */}
      <div className="px-4 pt-12 pb-3 flex items-center gap-3">
        <Link
          href="/community"
          className="w-9 h-9 -ml-2 flex items-center justify-center press-strong"
          aria-label="커뮤니티"
        >
          <ArrowLeft size={20} className="text-text-main" />
        </Link>
        <div>
          <h1 className="text-[20px] font-bold text-text-main tracking-tight">인기 게시물</h1>
          <p className="text-[11px] text-text-sub">최근 30일 · 조회·좋아요·댓글 종합 정렬</p>
        </div>
      </div>

      {/* 글 목록 (구분선 리스트) */}
      <div className="px-4" style={{ borderTop: "1px solid var(--color-divider)" }}>
        {posts.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-text-light">
            <Flame size={40} strokeWidth={1.2} />
            <p className="text-[15px] mt-4 text-text-sub font-semibold">아직 인기글이 없어요</p>
            <p className="text-[13px] mt-1">조회·좋아요·댓글이 쌓이면 여기 떠요</p>
          </div>
        ) : (
          posts.map((post, idx) => {
            const cat = CATEGORY_MAP[post.category];
            const CatIcon = CATEGORY_ICON[post.category];
            const isEmergency = post.category === "emergency";
            return (
              <Link
                key={post.id}
                href={`/community/${post.id}`}
                className="flex items-center gap-3 py-3 press border-b border-divider last:border-b-0"
                style={{ minHeight: 64 }}
              >
                {/* 순위 */}
                <span
                  className="shrink-0 w-6 text-center text-[13px] font-semibold tabular-nums"
                  style={{ color: idx < 3 ? "var(--color-primary)" : "var(--color-text-light)" }}
                >
                  {idx + 1}
                </span>

                {/* 썸네일 — 8px 둥근 사각 */}
                {post.images.length > 0 ? (
                  <div
                    className="relative shrink-0 overflow-hidden"
                    style={{ width: 56, height: 56, borderRadius: "var(--radius-card-sm)" }}
                  >
                    <Image src={post.images[0]} alt={post.title} fill sizes="56px" style={{ objectFit: "cover" }} />
                    {post.images.length > 1 && (
                      <span
                        className="absolute bottom-0.5 right-0.5 text-[9px] font-semibold px-1 z-10"
                        style={{
                          backgroundColor: "rgba(0,0,0,0.6)",
                          color: "var(--color-surface)",
                          borderRadius: "var(--radius-square)",
                        }}
                      >
                        +{post.images.length - 1}
                      </span>
                    )}
                  </div>
                ) : null}

                {/* 본문 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span
                      className="inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 shrink-0"
                      style={{
                        border: "1px solid var(--color-border)",
                        borderRadius: "var(--radius-square)",
                        color: isEmergency ? "var(--color-error)" : "var(--color-text-sub)",
                      }}
                    >
                      <CatIcon size={11} strokeWidth={2} />
                      {cat.label}
                    </span>
                  </div>
                  <h3 className="text-[15px] font-semibold text-text-main leading-snug truncate">
                    {post.title}
                  </h3>
                  <p className="text-[13px] text-text-sub truncate mt-0.5">{post.content}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    {post.authorAvatarUrl ? (
                      <Image
                        src={post.authorAvatarUrl}
                        alt=""
                        width={16}
                        height={16}
                        className="rounded-full object-cover"
                        style={{ width: 16, height: 16 }}
                      />
                    ) : (
                      <div
                        className="w-4 h-4 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: "var(--color-gray-200)" }}
                      >
                        <span className="text-[9px] font-semibold text-text-sub">
                          {post.authorName.charAt(0)}
                        </span>
                      </div>
                    )}
                    <span className="text-[11px] text-text-sub font-semibold">{post.authorName}</span>
                    {post.authorLevel && (
                      <span
                        className="text-[9px] font-semibold px-1 py-[0.5px] text-text-sub"
                        style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-square)" }}
                      >
                        Lv.{post.authorLevel}
                      </span>
                    )}
                    <span className="text-[11px] text-text-light ml-auto shrink-0">
                      {formatRelativeTime(post.createdAt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-text-light text-[11px]">
                    <span className="flex items-center gap-0.5">
                      <Eye size={10} /> {post.viewCount}
                    </span>
                    <span className="flex items-center gap-0.5">
                      <ThumbsUp size={10} /> {post.likeCount}
                    </span>
                    <span className="flex items-center gap-0.5">
                      <MessageCircle size={10} /> {post.commentCount}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>

      {/* FAB */}
      <Link
        href="/community/write"
        className="fixed bottom-24 right-5 w-14 h-14 rounded-full bg-primary flex items-center justify-center fab-shadow press-strong transition-transform z-40"
        aria-label="새 글 쓰기"
      >
        <Plus size={28} color="var(--color-surface)" strokeWidth={2.5} />
      </Link>
    </div>
  );
}
