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
  CornerDownRight,
  Share2,
  Check,
} from "lucide-react";
import type { Post } from "@/lib/types";
import { CATEGORY_MAP } from "@/lib/types";
import { getPostById, formatRelativeTime, incrementPostViewCount, updatePostVote } from "@/lib/posts-repo";
import { shareToKakao } from "@/lib/kakao-share";
import ReactionBar from "@/app/components/ReactionBar";
import { listReactionsBatch, type ReactionSummary } from "@/lib/reactions-repo";
import { getLevelColor } from "@/lib/cats-repo";
import { getMyPostVotes, setMyPostVote, type PostVote } from "@/lib/store";
import { isCurrentUserAdmin } from "@/lib/news-repo";
import { createClient } from "@/lib/supabase/client";
import {
  listPostComments,
  createPostComment,
  type PostComment,
} from "@/lib/post-comments-repo";
import { useAuth } from "@/lib/auth-context";
import ReportModal from "@/app/components/ReportModal";
import TitleBadge from "@/app/components/TitleBadge";
import SendDMButton from "@/app/components/SendDMButton";
import LoginRequired from "@/app/components/LoginRequired";

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
    const imageUrl = `${window.location.origin}/community/${post.id}/opengraph-image`;
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
    setCommentsLoading(true);
    listPostComments(id)
      .then(async (list) => {
        setComments(list);
        if (list.length > 0) {
          const reactions = await listReactionsBatch("post_comment", list.map((c) => c.id));
          setReactionMap(reactions);
        }
      })
      .finally(() => setCommentsLoading(false));
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
      const created = await createPostComment(id, commentText, replyTo?.id);
      setComments((prev) => [...prev, created]);
      setCommentText("");
      setReplyTo(null);
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
        <MessageCircle size={48} strokeWidth={1.2} />
        <p className="text-base mt-4 text-text-sub">게시글을 찾을 수 없습니다</p>
        <button
          onClick={() => router.push("/community")}
          className="mt-4 px-4 py-2 rounded-full bg-primary text-white text-sm font-bold"
        >
          목록으로
        </button>
      </div>
    );
  }

  const cat = CATEGORY_MAP[post.category];

  return (
    <div className="pb-24 overflow-x-hidden">
      {/* ── 헤더 ── */}
      <div className="flex items-center px-4 pt-14 pb-3 gap-3">
        <button
          onClick={() => router.back()}
          className="p-2 -ml-2 active:scale-90 transition-transform"
        >
          <ArrowLeft size={24} className="text-text-main" />
        </button>
        <span
          className="text-[12px] font-bold text-white px-2.5 py-1 rounded-lg"
          style={{ backgroundColor: cat.color }}
        >
          {cat.emoji} {cat.label}
        </span>

        {post.isPinned && (
          <span
            className="text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1"
            style={{ backgroundColor: "#C9A96120", color: "#C9A961" }}
          >
            <Pin size={10} /> 공지
          </span>
        )}

        {isAdmin && (
          <div className="ml-auto flex items-center gap-1.5">
            <button
              className="text-[11px] font-bold px-3 py-1.5 rounded-lg active:scale-95 transition-transform flex items-center gap-1"
              style={{
                backgroundColor: post.isPinned ? "#FBEAEA" : "#EEE8E0",
                color: post.isPinned ? "#D85555" : "#A38E7A",
              }}
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
              className="text-[11px] font-bold px-3 py-1.5 rounded-lg active:scale-95 transition-transform flex items-center gap-1"
              style={{ backgroundColor: "#FBEAEA", color: "#D85555" }}
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
        <h1 className="text-xl font-extrabold text-text-main leading-snug">
          {post.title}
        </h1>

        {/* 작성자 정보 */}
        <div className="flex items-center gap-2 mt-3 mb-5">
          {post.authorAvatarUrl ? (
            <Image src={post.authorAvatarUrl} alt="" width={32} height={32} className="rounded-full object-cover shrink-0" style={{ width: 32, height: 32 }} />
          ) : (
            <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center">
              <User size={16} className="text-primary" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-[13px] font-semibold text-text-main">
                {post.authorName}
              </p>
              {post.authorLevel && (
                <span
                  className="text-[9px] font-extrabold px-1.5 py-[1px] rounded-md tabular-nums"
                  style={{
                    backgroundColor: getLevelColor(post.authorLevel),
                    color: "#FFFFFF",
                    boxShadow: `0 1px 3px ${getLevelColor(post.authorLevel)}55`,
                  }}
                >
                  Lv.{post.authorLevel}
                </span>
              )}
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
        <div className="card p-5">
          <p className="text-[15px] text-text-main leading-relaxed whitespace-pre-wrap">
            {post.content}
          </p>

          {post.images.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              {post.images.map((url) => (
                <div
                  key={url}
                  className="relative w-full aspect-square rounded-xl overflow-hidden"
                  style={{ border: "1px solid #E3DCD3" }}
                >
                  <Image
                    src={url}
                    alt=""
                    fill
                    sizes="(max-width: 720px) 50vw, 360px"
                    style={{ objectFit: "cover" }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 반응 바 — 좁은 화면 대비 2줄로 분리 */}
        <div className="mt-4 px-1 flex flex-wrap items-center justify-between gap-y-2">
          {/* 왼쪽: 좋아요 · 싫어요 · 조회수 · 댓글수 */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => handleVote(1)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[13px] font-bold active:scale-95 transition-all"
              style={{
                backgroundColor: myVote === 1 ? cat.color : "#FFFFFF",
                border: `1.5px solid ${myVote === 1 ? cat.color : "#E3DCD3"}`,
                color: myVote === 1 ? "#FFFFFF" : cat.color,
              }}
            >
              <ThumbsUp size={15} strokeWidth={2.2} fill={myVote === 1 ? "#FFFFFF" : "none"} />
              {post.likeCount}
            </button>
            <button
              onClick={() => handleVote(-1)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[13px] font-bold active:scale-95 transition-all"
              style={{
                backgroundColor: myVote === -1 ? "#A38E7A" : "#FFFFFF",
                border: `1.5px solid ${myVote === -1 ? "#A38E7A" : "#E3DCD3"}`,
                color: myVote === -1 ? "#FFFFFF" : "#A38E7A",
              }}
            >
              <ThumbsDown size={15} strokeWidth={2.2} fill={myVote === -1 ? "#FFFFFF" : "none"} />
              {post.dislikeCount}
            </button>
            <span className="flex items-center gap-1 text-text-light text-[12.5px] px-1">
              <Eye size={14} /> {post.viewCount}
            </span>
            <span className="flex items-center gap-1 text-text-light text-[12.5px] px-1">
              <MessageCircle size={14} /> {comments.length}
            </span>
          </div>

          {/* 오른쪽: 카톡 · 공유 · 신고 */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={handleShareKakao}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[12px] font-extrabold active:scale-95 transition-transform"
              style={{
                backgroundColor: "#FEE500",
                color: "#3C1E1E",
                boxShadow: "0 2px 6px rgba(254,229,0,0.45)",
              }}
              aria-label="카카오톡으로 공유"
            >
              <span style={{ fontSize: 12 }}>💬</span>
              카톡
            </button>
            <button
              type="button"
              onClick={handleShare}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[12px] font-bold active:scale-95 transition-transform"
              style={{
                backgroundColor: shareStatus === "copied" ? "#6B8E6F" : "#FFFFFF",
                border: `1px solid ${shareStatus === "copied" ? "#6B8E6F" : "#E3DCD3"}`,
                color: shareStatus === "copied" ? "#FFFFFF" : cat.color,
              }}
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
                })
              }
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[12px] active:scale-95 transition-transform"
              style={{ backgroundColor: "#FFFFFF", border: "1px solid #E3DCD3", color: "#A38E7A" }}
            >
              <Flag size={12} strokeWidth={2.2} />
              신고
            </button>
          </div>
        </div>

        {/* ── 구분선 ── */}
        <div className="h-px bg-divider my-5" />

        {/* ── 댓글 ── */}
        <h2 className="text-[15px] font-bold text-text-main mb-3">
          댓글 {comments.length}
        </h2>

        {commentsLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 size={18} className="animate-spin text-primary" />
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-6 text-[12px] text-text-light">
            첫 번째 댓글을 남겨보세요
          </div>
        ) : (
          <div className="space-y-3">
            {/* 루트 댓글 */}
            {comments.filter((c) => !c.parent_id).map((c) => {
              const replies = comments.filter((r) => r.parent_id === c.id);
              return (
                <div key={c.id}>
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
                    onReport={() => setReportTarget({ type: "post_comment", id: c.id, snapshot: c.body.slice(0, 150) })}
                  />
                  {/* 대댓글 */}
                  {replies.map((r) => (
                    <div key={r.id} className="ml-6 mt-1.5">
                      <div className="flex items-center gap-1 mb-1 pl-2">
                        <CornerDownRight size={12} className="text-text-light" />
                      </div>
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
                        onReport={() => setReportTarget({ type: "post_comment", id: r.id, snapshot: r.body.slice(0, 150) })}
                        isReply
                      />
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
      />

      {/* ── 댓글 입력 (하단 고정, BottomNav 위) ── */}
      <div
        className="fixed left-0 right-0 bg-white border-t border-border px-4 py-3 z-40"
        style={{
          bottom: "calc(5rem + env(safe-area-inset-bottom))",
        }}
      >
        <div className="mx-auto max-w-lg">
          {replyTo && (
            <div className="flex items-center gap-2 mb-1.5 px-2">
              <Reply size={12} className="text-primary" />
              <span className="text-[11px] text-primary font-bold">{replyTo.name}</span>
              <span className="text-[11px] text-text-light">에게 답글</span>
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                className="ml-auto w-5 h-5 rounded-full bg-surface-alt flex items-center justify-center active:scale-90"
              >
                <X size={10} className="text-text-sub" />
              </button>
            </div>
          )}
          {commentError && (
            <p
              className="text-[11px] mb-1 px-2"
              style={{ color: "#B84545" }}
            >
              {commentError}
            </p>
          )}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmitComment();
              }}
              placeholder={
                replyTo ? `${replyTo.name}에게 답글...` : user ? "댓글을 입력하세요..." : "로그인 후 댓글을 작성할 수 있어요"
              }
              disabled={!user || submitting}
              className="flex-1 px-4 py-2.5 rounded-full border border-border bg-surface-alt text-[14px] text-text-main placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors disabled:opacity-50"
            />
            <button
              onClick={handleSubmitComment}
              disabled={!commentText.trim() || submitting || !user}
              className="w-10 h-10 rounded-full flex items-center justify-center transition-all disabled:opacity-40"
              style={{
                backgroundColor: commentText.trim() && user ? "#C47E5A" : "#E3DCD3",
              }}
            >
              {submitting ? (
                <Loader2 size={16} className="animate-spin text-white" />
              ) : (
                <Send
                  size={18}
                  color={commentText.trim() && user ? "#fff" : "#BFB9B0"}
                />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══ 댓글 아이템 ═══ */
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
    <div
      className={`card-sm ${isReply ? "p-3" : "p-4"}`}
      style={isReply ? { backgroundColor: "#FAFAF7" } : undefined}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          {c.author_avatar_url ? (
            <Image src={c.author_avatar_url} alt="" width={24} height={24} className="rounded-full object-cover" style={{ width: 24, height: 24 }} />
          ) : (
            <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center">
              <span className="text-[10px] font-extrabold text-primary">
                {c.author_name?.charAt(0) ?? "?"}
              </span>
            </div>
          )}
          <span className="text-[13px] font-semibold text-text-main">
            {c.author_name ?? "익명"}
          </span>
          {c.author_level && (
            <span
              className="text-[9px] font-extrabold px-1.5 py-[1px] rounded-md tabular-nums"
              style={{
                backgroundColor: getLevelColor(c.author_level),
                color: "#FFFFFF",
                boxShadow: `0 1px 3px ${getLevelColor(c.author_level)}55`,
              }}
            >
              Lv.{c.author_level}
            </span>
          )}
          <TitleBadge titleId={c.author_title} />
          <SendDMButton userId={c.author_id} userName={c.author_name} currentUserId={user?.id} />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-text-light">
            {formatRelativeTime(c.created_at)}
          </span>
          <button
            type="button"
            onClick={onReport}
            className="w-5 h-5 rounded-md flex items-center justify-center active:scale-90"
            style={{ backgroundColor: "#F6F1EA" }}
            aria-label="댓글 신고"
          >
            <Flag size={9} style={{ color: "#A38E7A" }} strokeWidth={2.5} />
          </button>
        </div>
      </div>
      <p className="text-[13px] text-text-sub leading-relaxed pl-8 whitespace-pre-wrap">
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
          className="flex items-center gap-1 ml-8 mt-1.5 text-[11px] font-semibold active:scale-95 transition-transform"
          style={{ color: "#A38E7A" }}
        >
          <Reply size={11} />
          답글
        </button>
      )}
    </div>
  );
}
