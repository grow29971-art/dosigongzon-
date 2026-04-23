"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Eye,
  Heart,
  MessageCircle,
  Plus,
  Siren,
  Home,
  ShoppingBag,
  MessagesSquare,
  ThumbsUp,
  Pin,
  Megaphone,
} from "lucide-react";
import type { Post, PostCategory } from "@/lib/types";
import { listPosts, formatRelativeTime, updatePostVote } from "@/lib/posts-repo";
import { getLevelColor } from "@/lib/cats-repo";
import {
  getMyPostVotes,
  setMyPostVote,
  type PostVote,
} from "@/lib/store";
import { useAuth } from "@/lib/auth-context";
import LoginRequired from "@/app/components/LoginRequired";

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
  const { user, loading: authLoading } = useAuth();

  const [mounted, setMounted] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [myVotes, setMyVotes] = useState<Record<string, PostVote>>({});

  useEffect(() => {
    setMounted(true);
    if (!user) return;
    listPosts(cat).then(setPosts);
    setMyVotes(getMyPostVotes());
  }, [cat, user]);

  // 비로그인 가드
  if (mounted && !authLoading && !user) {
    return <LoginRequired from={`/community/category/${cat}`} />;
  }

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

      {/* ── 공지사항 (pinned) ── */}
      {(() => {
        const pinned = posts.filter((p) => p.isPinned);
        if (pinned.length === 0) return null;
        return (
          <div className="px-4 mb-3">
            <div className="flex items-center gap-1.5 mb-2 px-1">
              <Megaphone size={13} style={{ color: meta.color }} />
              <span className="text-[12px] font-extrabold" style={{ color: meta.color }}>
                공지사항
              </span>
            </div>
            <div
              className="overflow-hidden"
              style={{
                borderRadius: 16,
                border: `1.5px solid ${meta.color}33`,
                background: `linear-gradient(135deg, ${meta.color}08 0%, ${meta.color}03 100%)`,
              }}
            >
              {pinned.map((post, i) => (
                <Link
                  key={post.id}
                  href={`/community/${post.id}`}
                  className="flex items-center gap-3 px-4 py-3 active:bg-black/[0.02] transition-colors"
                  style={i < pinned.length - 1 ? { borderBottom: `1px solid ${meta.color}15` } : {}}
                >
                  <Pin size={12} style={{ color: meta.color }} className="shrink-0" />
                  <p className="text-[13px] font-bold text-text-main truncate flex-1">
                    {post.title}
                  </p>
                  <span className="text-[10px] text-text-light shrink-0">
                    {formatRelativeTime(post.createdAt)}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ── 글 목록 (간결 리스트) ── */}
      <div
        className="mx-4 overflow-hidden"
        style={{
          background: "#FFFFFF",
          borderRadius: 20,
          boxShadow: "0 4px 16px rgba(0,0,0,0.04)",
          border: "1px solid rgba(0,0,0,0.04)",
        }}
      >
        {posts.filter((p) => !p.isPinned).length === 0 && posts.filter((p) => p.isPinned).length === 0 ? (
          <div className="flex flex-col items-center py-16 text-text-light">
            <meta.Icon size={48} strokeWidth={1.2} style={{ color: meta.color, opacity: 0.3 }} />
            <p className="text-[14px] mt-4 text-text-sub font-semibold">아직 글이 없어요</p>
            <p className="text-[12px] mt-1">첫 번째 글을 작성해보세요</p>
          </div>
        ) : (
          posts.filter((p) => !p.isPinned).map((post, idx, arr) => (
            <Link
              key={post.id}
              href={`/community/${post.id}`}
              className="flex items-center gap-3 px-4 py-3 active:bg-black/[0.02] transition-colors"
              style={idx < arr.length - 1 ? { borderBottom: "1px solid rgba(0,0,0,0.04)" } : {}}
            >
              {/* 썸네일 (이미지 있을 때만) */}
              {post.images.length > 0 ? (
                <div className="relative shrink-0 rounded-xl overflow-hidden" style={{ width: 56, height: 56 }}>
                  <Image src={post.images[0]} alt="" fill sizes="56px" style={{ objectFit: "cover" }} />
                  {post.images.length > 1 && (
                    <span className="absolute bottom-0.5 right-0.5 text-[8px] font-bold px-1 rounded-md z-10" style={{ backgroundColor: "rgba(0,0,0,0.6)", color: "#fff" }}>
                      +{post.images.length - 1}
                    </span>
                  )}
                </div>
              ) : null}

              {/* 본문 */}
              <div className="flex-1 min-w-0">
                <h3 className="text-[14px] font-bold text-text-main leading-snug truncate">
                  {post.title}
                </h3>
                <p className="text-[11.5px] text-text-sub truncate mt-0.5">
                  {post.content}
                </p>
                <div className="flex items-center gap-2 mt-1.5">
                  {/* 아바타 */}
                  {post.authorAvatarUrl ? (
                    <Image src={post.authorAvatarUrl} alt="" width={16} height={16} className="rounded-full object-cover" style={{ width: 16, height: 16 }} />
                  ) : (
                    <div className="w-4 h-4 rounded-full flex items-center justify-center" style={{ backgroundColor: `${meta.color}1A` }}>
                      <span className="text-[7px] font-bold" style={{ color: meta.color }}>{post.authorName.charAt(0)}</span>
                    </div>
                  )}
                  <span className="text-[10.5px] text-text-sub font-semibold">{post.authorName}</span>
                  {post.authorLevel && (
                    <span className="text-[8px] font-extrabold px-1 py-[0.5px] rounded" style={{ backgroundColor: getLevelColor(post.authorLevel), color: "#fff" }}>
                      Lv.{post.authorLevel}
                    </span>
                  )}
                  <span className="text-[10px] text-text-light ml-auto shrink-0">{formatRelativeTime(post.createdAt)}</span>
                </div>
                {/* 통계 */}
                <div className="flex items-center gap-3 mt-1 text-text-light text-[10px]">
                  <span className="flex items-center gap-0.5">
                    <Eye size={10} /> {post.viewCount}
                  </span>
                  <span className="flex items-center gap-0.5" style={{ color: post.likeCount > 0 ? meta.color : undefined }}>
                    <ThumbsUp size={10} /> {post.likeCount}
                  </span>
                  <span className="flex items-center gap-0.5">
                    <MessageCircle size={10} /> {post.commentCount}
                  </span>
                </div>
              </div>
            </Link>
          ))
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
