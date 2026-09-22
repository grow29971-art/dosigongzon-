"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Eye,
  MessageCircle,
  Send,
  Clock,
  User,
  Flag,
  Loader2,
  Pin,
  ThumbsUp,
  ThumbsDown,
  Reply,
  X,
  Lock,
  Unlock,
  CornerDownRight,
  Share2,
  Check,
  Siren,
  HandHeart,
  Home,
  Heart,
  ShoppingBag,
  MessagesSquare,
  type LucideIcon,
} from "lucide-react";
import type { Post, PostCategory } from "@/lib/types";
import { CATEGORY_MAP } from "@/lib/types";
import { getPostById, formatRelativeTime, incrementPostViewCount, updatePostVote } from "@/lib/posts-repo";
import { shareToKakao } from "@/lib/kakao-share";
import { getPageOgImageUrl } from "@/lib/og-image-url";
import ReactionBar from "@/app/components/ReactionBar";
import { listReactionsBatch, type ReactionSummary } from "@/lib/reactions-repo";
import { getMyPostVotes, setMyPostVote, type PostVote } from "@/lib/store";
import { isCurrentUserAdmin } from "@/lib/news-repo";
import { createClient } from "@/lib/supabase/client";
import {
  listPostComments,
  createPostComment,
  type PostComment,
} from "@/lib/post-comments-repo";
import { useAuth } from "@/lib/auth-context";
import { getMyBlockedIdSet } from "@/lib/blocks-repo";
import dynamic from "next/dynamic";
const ReportModal = dynamic(() => import("@/app/components/ReportModal"), { ssr: false });
import TitleBadge from "@/app/components/TitleBadge";
import SendDMButton from "@/app/components/SendDMButton";
import LoginRequired from "@/app/components/LoginRequired";

// CATEGORY_MAP[...].emoji 대신 lucide 선 아이콘 (2026-09-16 「익숙한 동네앱」 리디자인)
const CATEGORY_ICON: Record<PostCategory, LucideIcon> = {
  emergency: Siren,
  sitter: HandHeart,
  foster: Home,
  adoption: Heart,
  market: ShoppingBag,
  free: MessagesSquare,
};

// 헤어라인 버튼(투표·공유·신고 공통) — 흰 면 + 1px 테두리, 활성 시 채움
const HAIRLINE_BTN = "flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-semibold press-strong transition-all";
const hairlineStyle = (active: boolean, fill = "var(--color-text-main)"): React.CSSProperties => ({
  backgroundColor: active ? fill : "var(--color-surface)",
  border: `1px solid ${active ? fill : "var(--color-border)"}`,
  color: active ? "var(--color-surface)" : "var(--color-text-sub)",
  borderRadius: "var(--radius-input)",
});

// 레벨 배지 — 회색 태그 (레벨 색 폐지)
function LevelTag({ level }: { level: number }) {
  return (
    <span
      className="text-[11px] font-semibold px-1.5 py-[1px] tabular-nums text-text-sub"
      style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-square)" }}
    >
      Lv.{level}
    </span>
  );
}

export default function PostDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [post, setPost] = useState<Post | null>(null);

  // 댓글 상태
  const [comments, setComments] = useState<PostComment[]>([]);
  const [reactionMap, setReactionMap] = useState<Map<string, ReactionSummary>>(new Map());
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [commentError, setCommentError] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const [secretComment, setSecretComment] = useState(false);

  // admin 여부
  const [isAdmin, setIsAdmin] = useState(false);

  // 좋아요/싫어요
  const [myVote, setMyVote] = useState<PostVote | 0>(0);

  useEffect(() => {
    const votes = getMyPostVotes();
    setMyVote(votes[id] ?? 0);
  }, [id]);

  const handleVote = async (next: PostVote) => {
    if (!post) return;

    // 관리자: 토글 없이 매 클릭마다 +1 누적
    if (isAdmin) {
      const dLike: -1 | 0 | 1 = next === 1 ? 1 : 0;
      const dDislike: -1 | 0 | 1 = next === -1 ? 1 : 0;
      setPost({
        ...post,
        likeCount: Math.max(0, post.likeCount + dLike),
        dislikeCount: Math.max(0, post.dislikeCount + dDislike),
      });
      try {
        await updatePostVote(id, dLike, dDislike);
      } catch {
        setPost((p) =>
          p
            ? {
                ...p,
                likeCount: Math.max(0, p.likeCount - dLike),
                dislikeCount: Math.max(0, p.dislikeCount - dDislike),
              }
            : p,
        );
      }
      return;
    }

    const prev = myVote;
    const newVote: PostVote | 0 = prev === next ? 0 : next;

    let dLike: -1 | 0 | 1 = 0;
    let dDislike: -1 | 0 | 1 = 0;
    if (prev === 1) dLike = -1;
    if (prev === -1) dDislike = -1;
    if (newVote === 1) dLike = (dLike + 1) as -1 | 0 | 1;
    if (newVote === -1) dDislike = (dDislike + 1) as -1 | 0 | 1;

    setPost({
      ...post,
      likeCount: Math.max(0, post.likeCount + dLike),
      dislikeCount: Math.max(0, post.dislikeCount + dDislike),
    });
    setMyVote(newVote);
    setMyPostVote(id, newVote);

    try {
      await updatePostVote(id, dLike, dDislike);
    } catch {
      setPost({
        ...post,
        likeCount: Math.max(0, post.likeCount - dLike),
        dislikeCount: Math.max(0, post.dislikeCount - dDislike),
      });
      setMyVote(prev);
      setMyPostVote(id, prev);
    }
  };

  // 신고 모달
  const [shareStatus, setShareStatus] = useState<"idle" | "copied">("idle");

  const handleShareKakao = async () => {
    if (!post) return;
    const url = `${window.location.origin}/community/${post.id}`;
    const title = post.title;
    const description = post.content.replace(/\s+/g, " ").trim().slice(0, 120) || "도시공존 커뮤니티";
    // 글 상세의 og:image(파일 컨벤션 해시 주소) 사용 — 손 조립 주소는 (main) 그룹에서 404
    const imageUrl = getPageOgImageUrl(`${window.location.origin}/opengraph-image`);
    const ok = await shareToKakao({ title, description, imageUrl, url });
    if (!ok) {
      try {
        await navigator.clipboard?.writeText(url);
        setShareStatus("copied");
        setTimeout(() => setShareStatus("idle"), 2000);
      } catch {
        window.prompt("아래 링크를 복사해서 공유하세요:", url);
      }
    }
  };

  const handleShare = async () => {
    if (!post) return;
    const url = `${window.location.origin}/community/${post.id}`;
    const title = `${post.title} | 도시공존`;
    const text = post.content.replace(/\s+/g, " ").trim().slice(0, 120);
    const nav = typeof navigator !== "undefined" ? (navigator as Navigator) : null;
    if (nav && typeof nav.share === "function") {
      try { await nav.share({ title, text, url }); } catch { /* 취소 무시 */ }
      return;
    }
    try {
      await nav?.clipboard?.writeText(url);
      setShareStatus("copied");
      setTimeout(() => setShareStatus("idle"), 2000);
    } catch {
      window.prompt("아래 링크를 복사해서 공유하세요:", url);
    }
  };

  const [reportTarget, setReportTarget] = useState<{
    type: "post" | "post_comment";
    id: string;
    snapshot: string;
    authorUserId?: string | null;
    authorName?: string | null;
  } | null>(null);

  useEffect(() => {
    setMounted(true);
    if (!user) return; // 비로그인은 fetch 안 함
    getPostById(id).then((found) => {
      if (found) {
        setPost({ ...found, viewCount: found.viewCount + 1 });
        incrementPostViewCount(id).catch(() => {});
      }
    });
    isCurrentUserAdmin().then(setIsAdmin);

    // 댓글 로드 + 이모지 리액션 배치 조회
    let cancelled = false;
    setCommentsLoading(true);
    const reload = async () => {
      try {
        const [list, blocked] = await Promise.all([
          listPostComments(id),
          getMyBlockedIdSet(),
        ]);
        if (cancelled) return;
        // 차단한 유저의 댓글은 가림
        const filtered = blocked.size === 0
          ? list
          : list.filter((c) => !c.author_id || !blocked.has(c.author_id));
        setComments(filtered);
        if (filtered.length > 0) {
          const reactions = await listReactionsBatch("post_comment", filtered.map((c) => c.id));
          if (!cancelled) setReactionMap(reactions);
        }
      } finally {
        if (!cancelled) setCommentsLoading(false);
      }
    };
    reload();

    // Realtime — post_comments INSERT/UPDATE/DELETE 감지
    const sb = createClient();
    const channel = sb
      .channel(`post-comments-${id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "post_comments",
          filter: `post_id=eq.${id}`,
        },
        () => { if (!cancelled) reload(); },
      )
      .subscribe();

    return () => {
      cancelled = true;
      sb.removeChannel(channel);
    };
  }, [id, user]);

  const handleSubmitComment = async () => {
    if (!user) {
      setCommentError("로그인이 필요해요.");
      return;
    }
    if (!commentText.trim() || submitting) return;
    setSubmitting(true);
    setCommentError("");
    try {
      const created = await createPostComment(id, commentText, replyTo?.id, secretComment);
      setComments((prev) => [...prev, created]);
      setCommentText("");
      setReplyTo(null);
      setSecretComment(false);
    } catch (err) {
      setCommentError(err instanceof Error ? err.message : "작성 실패");
    } finally {
      setSubmitting(false);
    }
  };

  if (!mounted) return null;

  // 비로그인 가드
  if (!authLoading && !user) {
    return <LoginRequired from={`/community/${id}`} />;
  }

  if (!post) {
    return (
      <div className="flex flex-col items-center justify-center pt-32 text-text-light">
        <MessageCircle size={40} strokeWidth={1.2} />
        <p className="text-[15px] mt-4 text-text-sub">게시글을 찾을 수 없어요</p>
        <button
          onClick={() => router.push("/community")}
          className="mt-4 px-4 py-2 bg-primary text-surface text-[13px] font-semibold press"
          style={{ borderRadius: "var(--radius-input)" }}
        >
          목록으로
        </button>
      </div>
    );
  }

  const cat = CATEGORY_MAP[post.category];
  const CatIcon = CATEGORY_ICON[post.category];
  const isEmergency = post.category === "emergency";

  return (
    <div className="pb-24 overflow-x-hidden">
      {/* ── 헤더 ── */}
      <div className="flex items-center px-4 pt-14 pb-3 gap-2">
        <button
          onClick={() => router.back()}
          className="p-2 -ml-2 press-strong transition-transform"
          aria-label="뒤로"
        >
          <ArrowLeft size={24} className="text-text-main" />
        </button>
        <span
          className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1"
          style={{
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-square)",
            color: isEmergency ? "var(--color-error)" : "var(--color-text-sub)",
          }}
        >
          <CatIcon size={11} strokeWidth={2} />
          {cat.label}
        </span>

        {post.isPinned && (
          <span
            className="text-[11px] font-semibold px-2 py-1 flex items-center gap-1 text-text-sub"
            style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-square)" }}
          >
            <Pin size={10} /> 공지
          </span>
        )}

        {isAdmin && (
          <div className="ml-auto flex items-center gap-1.5">
            <button
              className={HAIRLINE_BTN}
              style={{ ...hairlineStyle(false), fontSize: 11 }}
              onClick={async () => {
                const supabase = createClient();
                const next = !post.isPinned;
                const { error } = await supabase
                  .from("posts")
                  .update({ is_pinned: next })
                  .eq("id", post.id);
                if (!error) {
                  setPost({ ...post, isPinned: next });
                }
              }}
            >
              <Pin size={11} />
              {post.isPinned ? "공지 해제" : "공지 고정"}
            </button>
            <button
              className={HAIRLINE_BTN}
              style={{ ...hairlineStyle(false), fontSize: 11, color: "var(--color-error)" }}
              onClick={async () => {
                if (!confirm(`"${post.title}" 글을 삭제할까요?`)) return;
                const supabase = createClient();
                const { error } = await supabase.from("posts").delete().eq("id", post.id);
                if (error) {
                  alert("삭제 실패: " + error.message);
                } else {
                  router.push("/community");
                }
              }}
            >
              <Flag size={11} />
              삭제
            </button>
          </div>
        )}
      </div>

      {/* ── 게시글 본문 ── */}
      <div className="px-5">
        <h1 className="text-[20px] font-bold text-text-main leading-snug">
          {post.title}
        </h1>

        {/* 작성자 정보 */}
        <div className="flex items-center gap-2 mt-3 pb-4" style={{ borderBottom: "1px solid var(--color-divider)" }}>
          {post.authorAvatarUrl ? (
            <Image src={post.authorAvatarUrl} alt="" width={32} height={32} className="rounded-full object-cover shrink-0" style={{ width: 32, height: 32 }} />
          ) : (
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: "var(--color-gray-200)" }}>
              <User size={16} className="text-text-sub" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-[13px] font-semibold text-text-main">
                {post.authorName}
              </p>
              {post.authorLevel && <LevelTag level={post.authorLevel} />}
              <TitleBadge titleId={post.authorTitle} size="sm" />
              <SendDMButton userId={post.authorId} userName={post.authorName} currentUserId={user?.id} size="sm" />
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-text-light">
              <Clock size={11} />
              <span>{formatRelativeTime(post.createdAt)}</span>
            </div>
          </div>
        </div>

        {/* 본문 내용 */}
        <div className="pt-4">
          <p className="text-[15px] text-text-main leading-relaxed whitespace-pre-wrap">
            {post.content}
          </p>

          {post.images.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              {post.images.map((url, i) => (
                <div
                  key={url}
                  className="relative w-full aspect-square overflow-hidden"
                  style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-card-sm)" }}
                >
                  <Image
                    src={url}
                    alt=""
                    fill
                    sizes="(max-width: 720px) 50vw, 360px"
                    style={{ objectFit: "cover" }}
                    priority={i === 0}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 반응 바 — 좁은 화면 대비 2줄로 분리 */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-y-2">
          {/* 왼쪽: 좋아요 · 싫어요 · 조회수 · 댓글수 */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => handleVote(1)}
              className={HAIRLINE_BTN}
              style={hairlineStyle(myVote === 1)}
              aria-pressed={myVote === 1}
            >
              <ThumbsUp size={15} strokeWidth={2} />
              {post.likeCount}
            </button>
            <button
              onClick={() => handleVote(-1)}
              className={HAIRLINE_BTN}
              style={hairlineStyle(myVote === -1)}
              aria-pressed={myVote === -1}
            >
              <ThumbsDown size={15} strokeWidth={2} />
              {post.dislikeCount}
            </button>
            <span className="flex items-center gap-1 text-text-light text-[13px] px-1">
              <Eye size={14} /> {post.viewCount}
            </span>
            <span className="flex items-center gap-1 text-text-light text-[13px] px-1">
              <MessageCircle size={14} /> {comments.length}
            </span>
          </div>

          {/* 오른쪽: 카톡 · 공유 · 신고 */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={handleShareKakao}
              className={HAIRLINE_BTN}
              style={{
                backgroundColor: "#FEE500",
                border: "1px solid #FEE500",
                color: "var(--color-text-main)",
                borderRadius: "var(--radius-input)",
              }}
              aria-label="카카오톡으로 공유"
            >
              <MessageCircle size={13} strokeWidth={2.2} />
              카톡
            </button>
            <button
              type="button"
              onClick={handleShare}
              className={HAIRLINE_BTN}
              style={hairlineStyle(shareStatus === "copied", "var(--color-sage)")}
              aria-label="공유"
            >
              {shareStatus === "copied" ? (
                <>
                  <Check size={12} strokeWidth={2.5} />
                  복사됨
                </>
              ) : (
                <>
                  <Share2 size={12} strokeWidth={2.2} />
                  공유
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() =>
                setReportTarget({
                  type: "post",
                  id: post.id,
                  snapshot: `${post.title} — ${post.content.slice(0, 150)}`,
                  authorUserId: post.authorId ?? null,
                  authorName: post.authorName ?? null,
                })
              }
              className={HAIRLINE_BTN}
              style={{ ...hairlineStyle(false), fontWeight: 500 }}
            >
              <Flag size={12} strokeWidth={2.2} />
              신고
            </button>
          </div>
        </div>

        {/* ── 구분선 ── */}
        <div className="h-px bg-divider my-5" />

        {/* ── 댓글 ── */}
        <h2 id="comments" className="text-[15px] font-bold text-text-main mb-1 scroll-mt-16">
          댓글 {comments.length}
        </h2>

        {commentsLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 size={18} className="animate-spin text-text-light" />
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-6 text-[13px] text-text-light">
            첫 번째 댓글을 남겨보세요
          </div>
        ) : (
          <div>
            {/* 루트 댓글 */}
            {comments.filter((c) => !c.parent_id).map((c) => {
              const replies = comments.filter((r) => r.parent_id === c.id);
              return (
                <div key={c.id} className="border-b border-divider last:border-b-0">
                  {/* 댓글 */}
                  <CommentItem
                    c={c}
                    user={user}
                    reactionSummary={reactionMap.get(c.id)}
                    onReactionChange={(id, next) =>
                      setReactionMap((prev) => {
                        const m = new Map(prev);
                        m.set(id, next);
                        return m;
                      })
                    }
                    onReply={() => setReplyTo({ id: c.id, name: c.author_name ?? "익명" })}
                    onReport={() => setReportTarget({ type: "post_comment", id: c.id, snapshot: c.body.slice(0, 150), authorUserId: c.author_id ?? null, authorName: c.author_name ?? null })}
                  />
                  {/* 대댓글 */}
                  {replies.map((r) => (
                    <div key={r.id} className="ml-6 flex gap-1.5">
                      <CornerDownRight size={12} className="text-text-light shrink-0 mt-4" />
                      <div className="flex-1 min-w-0">
                        <CommentItem
                          c={r}
                          user={user}
                          reactionSummary={reactionMap.get(r.id)}
                          onReactionChange={(id, next) =>
                            setReactionMap((prev) => {
                              const m = new Map(prev);
                              m.set(id, next);
                              return m;
                            })
                          }
                          onReply={() => setReplyTo({ id: c.id, name: r.author_name ?? "익명" })}
                          onReport={() => setReportTarget({ type: "post_comment", id: r.id, snapshot: r.body.slice(0, 150), authorUserId: r.author_id ?? null, authorName: r.author_name ?? null })}
                          isReply
                        />
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 신고 모달 ── */}
      <ReportModal
        open={!!reportTarget}
        onClose={() => setReportTarget(null)}
        targetType={reportTarget?.type ?? "post"}
        targetId={reportTarget?.id ?? ""}
        targetSnapshot={reportTarget?.snapshot}
        authorUserId={reportTarget?.authorUserId ?? null}
        authorName={reportTarget?.authorName ?? null}
      />

      {/* ── 댓글 입력 (하단 고정, BottomNav 위) ── */}
      <div
        className="fixed left-0 right-0 border-t border-border px-4 py-3 z-40"
        style={{
          bottom: "calc(5rem + env(safe-area-inset-bottom))",
          background: "var(--color-surface)",
        }}
      >
        <div className="mx-auto max-w-lg">
          {replyTo && (
            <div className="flex items-center gap-2 mb-1.5 px-2">
              <Reply size={12} className="text-primary" />
              <span className="text-[11px] text-primary font-semibold">{replyTo.name}</span>
              <span className="text-[11px] text-text-light">에게 답글</span>
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                className="ml-auto w-5 h-5 rounded-full bg-surface-alt flex items-center justify-center press-strong"
                aria-label="답글 취소"
              >
                <X size={10} className="text-text-sub" />
              </button>
            </div>
          )}
          {commentError && (
            <p
              className="text-[11px] mb-1 px-2"
              style={{ color: "var(--color-error)" }}
            >
              {commentError}
            </p>
          )}
          {/* 비밀 댓글 토글 — 켜면 글쓴이와 나만 볼 수 있음 */}
          <button
            type="button"
            onClick={() => setSecretComment((v) => !v)}
            className="flex items-center gap-1.5 mb-1.5 px-2 py-1 press-strong transition-transform"
            aria-pressed={secretComment}
          >
            {secretComment
              ? <Lock size={12} style={{ color: "var(--color-primary)" }} />
              : <Unlock size={12} className="text-text-light" />}
            <span className="text-[11px] font-semibold" style={{ color: secretComment ? "var(--color-primary)" : "var(--color-text-light)" }}>
              {secretComment ? "비밀 댓글 — 글쓴이와 나만 볼 수 있어요" : "비밀 댓글"}
            </span>
          </button>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) handleSubmitComment();
              }}
              placeholder={
                replyTo ? `${replyTo.name}에게 답글...` : user ? "댓글을 입력하세요..." : "로그인 후 댓글을 작성할 수 있어요"
              }
              disabled={!user || submitting}
              className="flex-1 px-4 py-2.5 border border-border bg-surface-alt text-[15px] text-text-main placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors disabled:opacity-50"
              style={{ borderRadius: "var(--radius-input)" }}
            />
            <button
              onClick={handleSubmitComment}
              disabled={!commentText.trim() || submitting || !user}
              className="w-10 h-10 rounded-full flex items-center justify-center transition-all disabled:opacity-40"
              style={{
                backgroundColor: commentText.trim() && user ? "var(--color-primary)" : "var(--color-gray-200)",
              }}
              aria-label="댓글 등록"
            >
              {submitting ? (
                <Loader2 size={16} className="animate-spin text-surface" />
              ) : (
                <Send
                  size={18}
                  color={commentText.trim() && user ? "var(--color-surface)" : "var(--color-text-muted)"}
                />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══ 댓글 아이템 — 카드 없이 구분선 행 (2026-09-16 리디자인) ═══ */
function CommentItem({
  c,
  user,
  reactionSummary,
  onReactionChange,
  onReply,
  onReport,
  isReply,
}: {
  c: PostComment;
  user: { id: string } | null;
  reactionSummary: ReactionSummary | undefined;
  onReactionChange: (id: string, next: ReactionSummary) => void;
  onReply: () => void;
  onReport: () => void;
  isReply?: boolean;
}) {
  return (
    <div className={isReply ? "py-3" : "py-4"}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          {c.author_avatar_url ? (
            <Image src={c.author_avatar_url} alt="" width={24} height={24} className="rounded-full object-cover" style={{ width: 24, height: 24 }} />
          ) : (
            <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "var(--color-gray-200)" }}>
              <span className="text-[11px] font-semibold text-text-sub">
                {c.author_name?.charAt(0) ?? "?"}
              </span>
            </div>
          )}
          <span className="text-[13px] font-semibold text-text-main">
            {c.author_name ?? "익명"}
          </span>
          {c.is_secret && (
            <span
              className="inline-flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-[1px] text-text-sub"
              style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-square)" }}
            >
              <Lock size={9} /> 비밀
            </span>
          )}
          {c.author_level && <LevelTag level={c.author_level} />}
          <TitleBadge titleId={c.author_title} />
          <SendDMButton userId={c.author_id} userName={c.author_name} currentUserId={user?.id} />
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[11px] text-text-light">
            {formatRelativeTime(c.created_at)}
          </span>
          <button
            type="button"
            onClick={onReport}
            className="w-6 h-6 flex items-center justify-center press-strong text-text-light"
            aria-label="댓글 신고"
          >
            <Flag size={11} strokeWidth={2} />
          </button>
        </div>
      </div>
      <p className="text-[15px] text-text-main leading-relaxed pl-8 whitespace-pre-wrap">
        {c.body}
      </p>

      {/* 이모지 리액션 */}
      <div className="pl-8 mt-2">
        <ReactionBar
          targetType="post_comment"
          targetId={c.id}
          summary={reactionSummary}
          isLoggedIn={!!user}
          onChange={onReactionChange}
          onRequireLogin={() => {
            if (confirm("로그인하면 반응을 남길 수 있어요. 로그인할까요?")) {
              window.location.href = "/login";
            }
          }}
        />
      </div>

      {/* 답글 버튼 */}
      {user && !isReply && (
        <button
          type="button"
          onClick={onReply}
          className="flex items-center gap-1 ml-8 mt-1.5 text-[11px] font-semibold text-text-light press-strong transition-transform"
        >
          <Reply size={11} />
          답글
        </button>
      )}
    </div>
  );
}
