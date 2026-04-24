// 인기게시물 가상 카테고리 — /community/popular
// 최근 30일 글 중 점수(view + like×3 + comment×2) 상위 30개.
// 진짜 PostCategory 추가 X (DB 변경 없음). SSR로 SEO·LCP 이득.

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Eye, MessageCircle, ThumbsUp, Flame, Plus } from "lucide-react";
import { getPopularPostsServer } from "@/lib/posts-server";
import { CATEGORY_MAP } from "@/lib/types";
import { formatRelativeTime } from "@/lib/posts-repo";
import { getLevelColor } from "@/lib/cats-repo";

export const revalidate = 600; // 10분 ISR — 인기 변동 반영

const ACCENT = "#E55A3C"; // 불꽃 톤
const GLOW = "229,90,60";

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
    <div className="pb-24" style={{ background: "#F7F4EE", minHeight: "100vh" }}>
      {/* 헤더 */}
      <div className="px-4 pt-12 pb-4 flex items-center gap-3">
        <Link
          href="/community"
          className="w-9 h-9 rounded-full bg-white flex items-center justify-center active:scale-90"
          style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}
          aria-label="커뮤니티"
        >
          <ArrowLeft size={18} className="text-text-main" />
        </Link>
        <div>
          <h1 className="text-[20px] font-extrabold text-text-main tracking-tight flex items-center gap-1.5">
            <Flame size={18} style={{ color: ACCENT }} />
            인기 게시물
          </h1>
          <p className="text-[11px] text-text-sub">최근 30일 · 조회·좋아요·댓글 종합 정렬</p>
        </div>
      </div>

      {/* 글 목록 */}
      <div
        className="mx-4 overflow-hidden"
        style={{
          background: "#FFFFFF",
          borderRadius: 20,
          boxShadow: "0 4px 16px rgba(0,0,0,0.04)",
          border: "1px solid rgba(0,0,0,0.04)",
        }}
      >
        {posts.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-text-light">
            <Flame size={48} strokeWidth={1.2} style={{ color: ACCENT, opacity: 0.3 }} />
            <p className="text-[14px] mt-4 text-text-sub font-semibold">아직 인기글이 없어요</p>
            <p className="text-[12px] mt-1">조회·좋아요·댓글이 쌓이면 여기 떠요</p>
          </div>
        ) : (
          posts.map((post, idx, arr) => {
            const cat = CATEGORY_MAP[post.category];
            return (
              <Link
                key={post.id}
                href={`/community/${post.id}`}
                className="flex items-center gap-3 px-4 py-3 active:bg-black/[0.02] transition-colors"
                style={idx < arr.length - 1 ? { borderBottom: "1px solid rgba(0,0,0,0.04)" } : {}}
              >
                {/* 순위 배지 (TOP 3은 메달, 그 외는 숫자) */}
                <div
                  className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-extrabold"
                  style={
                    idx === 0
                      ? { background: "linear-gradient(135deg, #FFD700, #E8B040)", color: "#fff" }
                      : idx === 1
                      ? { background: "linear-gradient(135deg, #C0C0C0, #999)", color: "#fff" }
                      : idx === 2
                      ? { background: "linear-gradient(135deg, #CD7F32, #A0522D)", color: "#fff" }
                      : { background: "#F7F4EE", color: "#A38E7A" }
                  }
                >
                  {idx + 1}
                </div>

                {/* 썸네일 */}
                {post.images.length > 0 ? (
                  <div className="relative shrink-0 rounded-xl overflow-hidden" style={{ width: 56, height: 56 }}>
                    <Image src={post.images[0]} alt="" fill sizes="56px" style={{ objectFit: "cover" }} />
                    {post.images.length > 1 && (
                      <span
                        className="absolute bottom-0.5 right-0.5 text-[8px] font-bold px-1 rounded-md z-10"
                        style={{ backgroundColor: "rgba(0,0,0,0.6)", color: "#fff" }}
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
                      className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-md shrink-0"
                      style={{ backgroundColor: `${cat.color}18`, color: cat.color }}
                    >
                      {cat.emoji} {cat.label}
                    </span>
                  </div>
                  <h3 className="text-[14px] font-bold text-text-main leading-snug truncate">
                    {post.title}
                  </h3>
                  <p className="text-[11.5px] text-text-sub truncate mt-0.5">{post.content}</p>
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
                      <div className="w-4 h-4 rounded-full flex items-center justify-center" style={{ backgroundColor: "#EEE8E0" }}>
                        <span className="text-[7px] font-bold" style={{ color: "#A38E7A" }}>
                          {post.authorName.charAt(0)}
                        </span>
                      </div>
                    )}
                    <span className="text-[10.5px] text-text-sub font-semibold">{post.authorName}</span>
                    {post.authorLevel && (
                      <span
                        className="text-[8px] font-extrabold px-1 py-[0.5px] rounded"
                        style={{ backgroundColor: getLevelColor(post.authorLevel), color: "#fff" }}
                      >
                        Lv.{post.authorLevel}
                      </span>
                    )}
                    <span className="text-[10px] text-text-light ml-auto shrink-0">
                      {formatRelativeTime(post.createdAt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-text-light text-[10px]">
                    <span className="flex items-center gap-0.5">
                      <Eye size={10} /> {post.viewCount}
                    </span>
                    <span
                      className="flex items-center gap-0.5"
                      style={{ color: post.likeCount > 0 ? ACCENT : undefined }}
                    >
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
        className="fixed bottom-24 right-5 w-14 h-14 rounded-[20px] flex items-center justify-center active:scale-90 transition-transform z-40"
        style={{
          background: `linear-gradient(135deg, ${ACCENT} 0%, ${ACCENT}DD 100%)`,
          boxShadow: `0 10px 24px rgba(${GLOW},0.40), inset 0 1px 0 rgba(255,255,255,0.3)`,
        }}
        aria-label="새 글 쓰기"
      >
        <Plus size={28} color="#fff" strokeWidth={2.5} />
      </Link>
    </div>
  );
}
