"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Eye,
  Heart,
  MessageCircle,
  Plus,
  MapPin,
  ImageIcon,
  Siren,
  Home,
  ShoppingBag,
  MessagesSquare,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import type { Post, PostCategory } from "@/lib/types";
import { CATEGORY_MAP } from "@/lib/types";
import { listPosts, formatRelativeTime, updatePostVote } from "@/lib/posts-repo";
import TitleBadge from "@/app/components/TitleBadge";
import {
  getMyPostVotes,
  setMyPostVote,
  type PostVote,
} from "@/lib/store";

const CATEGORY_META: Record<
  PostCategory,
  { title: string; subtitle: string; Icon: typeof Siren; color: string; glow: string }
> = {
  emergency: {
    title: "긴급",
    subtitle: "학대 · 실종 · 응급 구조 제보",
    Icon: Siren,
    color: "#D85555",
    glow: "216,85,85",
  },
  foster: {
    title: "임보",
    subtitle: "임시보호 요청 · 제안",
    Icon: Home,
    color: "#E88D5A",
    glow: "232,141,90",
  },
  adoption: {
    title: "입양",
    subtitle: "새 가족을 찾아요",
    Icon: Heart,
    color: "#E86B8C",
    glow: "232,107,140",
  },
  market: {
    title: "중고마켓",
    subtitle: "용품 거래 · 무료 나눔",
    Icon: ShoppingBag,
    color: "#48A59E",
    glow: "72,165,158",
  },
  free: {
    title: "자유게시판",
    subtitle: "일상 · 정보 · 수다",
    Icon: MessagesSquare,
    color: "#8B65B8",
    glow: "139,101,184",
  },
};

export default function CategoryPage() {
  const params = useParams<{ cat: string }>();
  const router = useRouter();
  const cat = params.cat as PostCategory;
  const meta = CATEGORY_META[cat];

  const [mounted, setMounted] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [myVotes, setMyVotes] = useState<Record<string, PostVote>>({});

  useEffect(() => {
    setMounted(true);
    listPosts(cat).then(setPosts);
    setMyVotes(getMyPostVotes());
  }, [cat]);

  const handleVote = async (postId: string, next: PostVote, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const prev = myVotes[postId] ?? 0;
    // 같은 걸 다시 누르면 취소, 반대면 전환
    const newVote: PostVote | 0 = prev === next ? 0 : next;

    // delta 계산 (like, dislike)
    let dLike: -1 | 0 | 1 = 0;
    let dDislike: -1 | 0 | 1 = 0;
    if (prev === 1) dLike = -1;
    if (prev === -1) dDislike = -1;
    if (newVote === 1) dLike = (dLike + 1) as -1 | 0 | 1;
    if (newVote === -1) dDislike = (dDislike + 1) as -1 | 0 | 1;

    // 낙관적 UI 업데이트
    setPosts((prevPosts) =>
      prevPosts.map((p) =>
        p.id === postId
          ? {
              ...p,
              likeCount: Math.max(0, p.likeCount + dLike),
              dislikeCount: Math.max(0, p.dislikeCount + dDislike),
            }
          : p,
      ),
    );
    setMyPostVote(postId, newVote);
    setMyVotes(getMyPostVotes());

    // 서버 반영
    try {
      await updatePostVote(postId, dLike, dDislike);
    } catch {
      // 실패 시 롤백
      setPosts((prevPosts) =>
        prevPosts.map((p) =>
          p.id === postId
            ? {
                ...p,
                likeCount: Math.max(0, p.likeCount - dLike),
                dislikeCount: Math.max(0, p.dislikeCount - dDislike),
              }
            : p,
        ),
      );
      setMyPostVote(postId, prev);
      setMyVotes(getMyPostVotes());
    }
  };

  if (!mounted) return null;
  if (!meta) {
    return (
      <div className="px-5 pt-20 text-center">
        <p className="text-text-sub">존재하지 않는 카테고리예요.</p>
        <Link href="/community" className="text-primary text-[13px] mt-2 inline-block">
          커뮤니티로 돌아가기
        </Link>
      </div>
    );
  }

  return (
    <div className="pb-24">
      {/* ── 헤더 ── */}
      <div className="px-4 pt-14 pb-4">
        <button
          onClick={() => router.push("/community")}
          className="flex items-center gap-1 text-[12px] font-semibold text-text-sub mb-4 active:scale-95 transition-transform"
        >
          <ArrowLeft size={14} />
          커뮤니티
        </button>

        <div
          className="relative overflow-hidden px-5 py-5"
          style={{
            background: "#FFFFFF",
            borderRadius: 24,
            boxShadow: `0 8px 28px rgba(${meta.glow},0.14), 0 2px 6px rgba(0,0,0,0.03)`,
            border: `1.5px solid rgba(${meta.glow},0.20)`,
          }}
        >
          <div className="flex items-center gap-4">
            <div
              className="w-[58px] h-[58px] rounded-2xl flex items-center justify-center shrink-0"
              style={{
                background: `linear-gradient(135deg, ${meta.color} 0%, ${meta.color}DD 100%)`,
                boxShadow: `0 8px 18px rgba(${meta.glow},0.40), inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -2px 4px rgba(0,0,0,0.08)`,
              }}
            >
              <meta.Icon size={28} color="#FFFFFF" strokeWidth={2.3} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <h1 className="text-[22px] font-extrabold text-text-main tracking-tight">
                  {meta.title}
                </h1>
                <span className="text-[12px] font-bold tabular-nums" style={{ color: meta.color }}>
                  {posts.length}
                </span>
              </div>
              <p className="text-[12px] text-text-sub mt-0.5">{meta.subtitle}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── 글 목록 ── */}
      <div className="px-4 space-y-3">
        {posts.length === 0 ? (
          <div className="flex flex-col items-center pt-16 text-text-light">
            <meta.Icon size={48} strokeWidth={1.2} style={{ color: meta.color, opacity: 0.3 }} />
            <p className="text-[14px] mt-4 text-text-sub font-semibold">아직 글이 없어요</p>
            <p className="text-[12px] mt-1">첫 번째 글을 작성해보세요</p>
          </div>
        ) : (
          posts.map((post) => {
            const catInfo = CATEGORY_MAP[post.category];
            return (
              <Link
                key={post.id}
                href={`/community/${post.id}`}
                className="block active:scale-[0.99] transition-transform"
              >
                <article
                  className="overflow-hidden"
                  style={{
                    background: "#FFFFFF",
                    borderRadius: 20,
                    boxShadow: "0 4px 16px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.03)",
                    border: "1px solid rgba(0,0,0,0.04)",
                  }}
                >
                  {/* 사진 */}
                  {post.images.length === 0 ? (
                    <div
                      className="h-36 flex items-center justify-center relative"
                      style={{
                        background: `linear-gradient(135deg, ${meta.color}18 0%, ${meta.color}08 100%)`,
                      }}
                    >
                      <ImageIcon size={28} strokeWidth={1.5} style={{ color: meta.color, opacity: 0.4 }} />
                    </div>
                  ) : (
                    <div className="h-36 relative overflow-hidden bg-surface-alt">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={post.images[0]}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                      {post.images.length > 1 && (
                        <span
                          className="absolute bottom-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: "rgba(0,0,0,0.6)", color: "#fff" }}
                        >
                          +{post.images.length - 1}
                        </span>
                      )}
                    </div>
                  )}

                  {/* 콘텐츠 */}
                  <div className="p-4">
                    <h3 className="text-[15px] font-extrabold text-text-main leading-snug mb-1">
                      {post.title}
                    </h3>
                    <p className="text-[12.5px] text-text-sub leading-relaxed line-clamp-2 mb-3">
                      {post.content}
                    </p>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: `${meta.color}1A` }}
                        >
                          <span
                            className="text-[10px] font-extrabold"
                            style={{ color: meta.color }}
                          >
                            {post.authorName.charAt(0)}
                          </span>
                        </div>
                        <span className="text-[12px] font-semibold text-text-main">
                          {post.authorName}
                        </span>
                        <TitleBadge titleId={post.authorTitle} />
                        {post.region && (
                          <span className="text-[10px] text-text-light flex items-center gap-0.5">
                            <MapPin size={9} />
                            {post.region}
                          </span>
                        )}
                      </div>
                      <span className="text-[10.5px] text-text-light">
                        {formatRelativeTime(post.createdAt)}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 mt-2.5 pt-2.5 border-t border-divider">
                      <span className="flex items-center gap-1 text-text-light text-[11px]">
                        <Eye size={12} /> {post.viewCount}
                      </span>
                      <span className="flex items-center gap-1 text-text-light text-[11px]">
                        <MessageCircle size={12} /> {post.commentCount}
                      </span>
                      {/* 좋아요 */}
                      {(() => {
                        const myVote = myVotes[post.id] ?? 0;
                        const liked = myVote === 1;
                        const disliked = myVote === -1;
                        return (
                          <div
                            className="flex items-center gap-1.5 ml-auto"
                            onClick={(e) => {
                              // 버튼 영역 클릭이 카드 Link로 전파되지 않도록 강제 차단
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            onPointerDown={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={(e) => handleVote(post.id, 1, e)}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg active:scale-95 transition-all"
                              style={{
                                backgroundColor: liked ? meta.color : "#FFFFFF",
                                border: `1px solid ${liked ? meta.color : "#E3DCD3"}`,
                                color: liked ? "#FFFFFF" : meta.color,
                              }}
                            >
                              <ThumbsUp size={11} strokeWidth={2.2} fill={liked ? "#FFFFFF" : "none"} />
                              <span className="text-[10px] font-bold tabular-nums">
                                {post.likeCount}
                              </span>
                            </button>
                            <button
                              onClick={(e) => handleVote(post.id, -1, e)}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg active:scale-95 transition-all"
                              style={{
                                backgroundColor: disliked ? "#A38E7A" : "#FFFFFF",
                                border: `1px solid ${disliked ? "#A38E7A" : "#E3DCD3"}`,
                                color: disliked ? "#FFFFFF" : "#A38E7A",
                              }}
                            >
                              <ThumbsDown size={11} strokeWidth={2.2} fill={disliked ? "#FFFFFF" : "none"} />
                              <span className="text-[10px] font-bold tabular-nums">
                                {post.dislikeCount}
                              </span>
                            </button>
                          </div>
                        );
                      })()}
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
        href={`/community/write?category=${cat}`}
        className="fixed bottom-24 right-5 w-14 h-14 rounded-[20px] flex items-center justify-center active:scale-90 transition-transform z-40"
        style={{
          background: `linear-gradient(135deg, ${meta.color} 0%, ${meta.color}DD 100%)`,
          boxShadow: `0 10px 24px rgba(${meta.glow},0.40), inset 0 1px 0 rgba(255,255,255,0.3)`,
        }}
      >
        <Plus size={28} color="#fff" strokeWidth={2.5} />
      </Link>
    </div>
  );
}
