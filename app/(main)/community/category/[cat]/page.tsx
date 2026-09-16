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
  HandHeart,
  FileText,
  ShoppingBag,
  MessagesSquare,
  ThumbsUp,
  Pin,
  Megaphone,
} from "lucide-react";
import type { Post, PostCategory } from "@/lib/types";
import { listPosts, formatRelativeTime, updatePostVote } from "@/lib/posts-repo";
import { isCurrentUserAdmin } from "@/lib/news-repo";
import {
  getMyPostVotes,
  setMyPostVote,
  type PostVote,
} from "@/lib/store";
import { useAuth } from "@/lib/auth-context";
import LoginRequired from "@/app/components/LoginRequired";

// 2026-09-16 「익숙한 동네앱」 리디자인: 카테고리별 색·글로우 폐지 — 회색 선 아이콘, 긴급만 error.
const CATEGORY_META: Record<
  PostCategory,
  { title: string; subtitle: string; Icon: typeof Siren }
> = {
  emergency: { title: "긴급", subtitle: "학대 · 실종 · 응급 구조 제보", Icon: Siren },
  sitter: { title: "돌봄 부탁", subtitle: "입원 · 여행 때 밥자리 대타 요청", Icon: HandHeart },
  foster: { title: "임보", subtitle: "임시보호 요청 · 제안", Icon: Home },
  adoption: { title: "입양", subtitle: "새 가족을 찾아요", Icon: Heart },
  market: { title: "중고마켓", subtitle: "용품 거래 · 무료 나눔", Icon: ShoppingBag },
  free: { title: "자유게시판", subtitle: "일상 · 정보 · 수다", Icon: MessagesSquare },
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
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!user) return;
    listPosts(cat).then(setPosts);
    setMyVotes(getMyPostVotes());
    isCurrentUserAdmin().then(setIsAdmin);
  }, [cat, user]);

  // 비로그인 가드
  if (mounted && !authLoading && !user) {
    return <LoginRequired from={`/community/category/${cat}`} />;
  }

  const handleVote = async (postId: string, next: PostVote, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // 관리자: 토글 없이 매 클릭마다 +1 누적
    if (isAdmin) {
      const dLike: -1 | 0 | 1 = next === 1 ? 1 : 0;
      const dDislike: -1 | 0 | 1 = next === -1 ? 1 : 0;
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
      try {
        await updatePostVote(postId, dLike, dDislike);
      } catch {
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
      }
      return;
    }

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

  const accent = cat === "emergency" ? "var(--color-error)" : "var(--color-text-sub)";

  return (
    <div className="pb-24">
      {/* ── 헤더 ── */}
      <div className="px-4 pt-14 pb-3">
        <button
          onClick={() => router.push("/community")}
          className="flex items-center gap-1 text-[13px] font-semibold text-text-sub mb-4 press-strong transition-transform"
        >
          <ArrowLeft size={14} />
          커뮤니티
        </button>

        <div className="flex items-center gap-3">
          <meta.Icon size={24} strokeWidth={1.8} style={{ color: accent }} className="shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <h1 className="text-[24px] font-bold text-text-main tracking-tight">{meta.title}</h1>
              <span className="text-[13px] font-semibold tabular-nums text-text-light">{posts.length}</span>
            </div>
            <p className="text-[13px] text-text-sub mt-0.5">{meta.subtitle}</p>
          </div>
        </div>
      </div>

      {/* 긴급 카테고리 — 확인서 연결 배너 (2026-08-29 PMF 개편: 기록을 신고 증빙으로) */}
      {cat === "emergency" && (
        <div className="px-4 mb-3">
          <Link
            href="/mypage/report"
            className="flex items-center gap-3 px-4 py-3 press transition-transform"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-card)",
            }}
          >
            <FileText size={20} strokeWidth={1.8} className="shrink-0 text-text-sub" />
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-semibold text-text-main leading-tight">
                신고할 땐 돌봄 활동 확인서를 함께
              </p>
              <p className="text-[13px] text-text-sub mt-0.5 leading-snug">
                쌓인 돌봄 기록이 신고·민원 대응의 근거가 돼요
              </p>
            </div>
          </Link>
        </div>
      )}

      {/* 돌봄 부탁 카테고리 — 안전 안내 (2026-08-29): 밥자리 정확 위치는 공개글 금지 */}
      {cat === "sitter" && (
        <div className="px-4 mb-3">
          <div
            className="px-4 py-3"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-card)",
            }}
          >
            <p className="text-[15px] font-semibold text-text-main leading-tight">
              입원·여행 때 밥자리를 이웃에게 부탁하는 곳이에요
            </p>
            <p className="text-[13px] text-text-sub mt-1 leading-relaxed">
              글에는 동네(동 단위)·기간·마릿수만 적어주세요.
              <b> 정확한 밥자리 위치는 공개글이 아니라 쪽지로만</b> 주고받아야 아이들이 안전해요.
            </p>
          </div>
        </div>
      )}

      {/* ── 공지사항 (pinned) ── */}
      {(() => {
        const pinned = posts.filter((p) => p.isPinned);
        if (pinned.length === 0) return null;
        return (
          <div className="px-4 mb-3">
            <div className="flex items-center gap-1.5 mb-1 px-1">
              <Megaphone size={13} className="text-text-sub" />
              <span className="text-[13px] font-semibold text-text-sub">공지사항</span>
            </div>
            <div>
              {pinned.map((post) => (
                <Link
                  key={post.id}
                  href={`/community/${post.id}`}
                  className="flex items-center gap-3 px-1 py-3 press border-b border-divider last:border-b-0"
                  style={{ minHeight: 48 }}
                >
                  <Pin size={12} className="shrink-0 text-text-light" />
                  <p className="text-[15px] font-semibold text-text-main truncate flex-1">{post.title}</p>
                  <span className="text-[11px] text-text-light shrink-0">{formatRelativeTime(post.createdAt)}</span>
                </Link>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ── 글 목록 (구분선 리스트) ── */}
      <div className="px-4" style={{ borderTop: "1px solid var(--color-divider)" }}>
        {posts.filter((p) => !p.isPinned).length === 0 && posts.filter((p) => p.isPinned).length === 0 ? (
          <div className="flex flex-col items-center py-16 text-text-light">
            <meta.Icon size={40} strokeWidth={1.2} />
            <p className="text-[15px] mt-4 text-text-sub font-semibold">아직 글이 없어요</p>
            <p className="text-[13px] mt-1">첫 번째 글을 남겨보세요</p>
          </div>
        ) : (
          posts.filter((p) => !p.isPinned).map((post) => (
            <Link
              key={post.id}
              href={`/community/${post.id}`}
              className="flex items-center gap-3 py-3 press border-b border-divider last:border-b-0"
              style={{ minHeight: 64 }}
            >
              {/* 썸네일 (이미지 있을 때만) — 8px 둥근 사각 */}
              {post.images.length > 0 ? (
                <div className="relative shrink-0 overflow-hidden" style={{ width: 56, height: 56, borderRadius: "var(--radius-card-sm)" }}>
                  <Image src={post.images[0]} alt={post.title} fill sizes="56px" style={{ objectFit: "cover" }} />
                  {post.images.length > 1 && (
                    <span
                      className="absolute bottom-0.5 right-0.5 text-[9px] font-semibold px-1 z-10"
                      style={{ backgroundColor: "rgba(0,0,0,0.6)", color: "var(--color-surface)", borderRadius: "var(--radius-square)" }}
                    >
                      +{post.images.length - 1}
                    </span>
                  )}
                </div>
              ) : null}

              {/* 본문 */}
              <div className="flex-1 min-w-0">
                <h3 className="text-[15px] font-semibold text-text-main leading-snug truncate">
                  {post.title}
                </h3>
                <p className="text-[13px] text-text-sub truncate mt-0.5">
                  {post.content}
                </p>
                <div className="flex items-center gap-2 mt-1.5">
                  {/* 아바타 */}
                  {post.authorAvatarUrl ? (
                    <Image src={post.authorAvatarUrl} alt="" width={16} height={16} className="rounded-full object-cover" style={{ width: 16, height: 16 }} />
                  ) : (
                    <div className="w-4 h-4 rounded-full flex items-center justify-center" style={{ backgroundColor: "var(--color-gray-200)" }}>
                      <span className="text-[9px] font-semibold text-text-sub">{post.authorName.charAt(0)}</span>
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
                  <span className="text-[11px] text-text-light ml-auto shrink-0">{formatRelativeTime(post.createdAt)}</span>
                </div>
                {/* 통계 */}
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
          ))
        )}
      </div>

      {/* ── FAB ── */}
      <Link
        href={`/community/write?category=${cat}`}
        className="fixed bottom-24 right-5 w-14 h-14 rounded-full bg-primary flex items-center justify-center fab-shadow press-strong transition-transform z-40"
        aria-label="글쓰기"
      >
        <Plus size={28} color="var(--color-surface)" strokeWidth={2.5} />
      </Link>
    </div>
  );
}
