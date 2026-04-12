"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Eye,
  Heart,
  MessageCircle,
  Send,
  Clock,
  User,
  Flag,
  Loader2,
  Pin,
} from "lucide-react";
import type { Post } from "@/lib/types";
import { CATEGORY_MAP } from "@/lib/types";
import { getPostById, formatRelativeTime, incrementPostViewCount } from "@/lib/posts-repo";
import { getLevelColor } from "@/lib/cats-repo";
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

export default function PostDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [post, setPost] = useState<Post | null>(null);

  // 댓글 상태
  const [comments, setComments] = useState<PostComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [commentError, setCommentError] = useState("");

  // admin 여부
  const [isAdmin, setIsAdmin] = useState(false);

  // 신고 모달
  const [reportTarget, setReportTarget] = useState<{
    type: "post" | "post_comment";
    id: string;
    snapshot: string;
  } | null>(null);

  useEffect(() => {
    setMounted(true);
    getPostById(id).then((found) => {
      if (found) {
        setPost({ ...found, viewCount: found.viewCount + 1 });
        incrementPostViewCount(id).catch(() => {});
      }
    });
    isCurrentUserAdmin().then(setIsAdmin);

    // 댓글 로드
    setCommentsLoading(true);
    listPostComments(id)
      .then(setComments)
      .finally(() => setCommentsLoading(false));
  }, [id]);

  const handleSubmitComment = async () => {
    if (!user) {
      setCommentError("로그인이 필요해요.");
      return;
    }
    if (!commentText.trim() || submitting) return;
    setSubmitting(true);
    setCommentError("");
    try {
      const created = await createPostComment(id, commentText);
      setComments((prev) => [...prev, created]);
      setCommentText("");
    } catch (err) {
      setCommentError(err instanceof Error ? err.message : "작성 실패");
    } finally {
      setSubmitting(false);
    }
  };

  if (!mounted) return null;

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
    <div className="pb-24">
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
          <button
            className="ml-auto text-[11px] font-bold px-3 py-1.5 rounded-lg active:scale-95 transition-transform flex items-center gap-1"
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
        )}
      </div>

      {/* ── 게시글 본문 ── */}
      <div className="px-5">
        <h1 className="text-xl font-extrabold text-text-main leading-snug">
          {post.title}
        </h1>

        {/* 작성자 정보 */}
        <div className="flex items-center gap-2 mt-3 mb-5">
          <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center">
            <User size={16} className="text-primary" />
          </div>
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
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={url}
                  src={url}
                  alt=""
                  className="w-full aspect-square object-cover rounded-xl"
                  style={{ border: "1px solid #E3DCD3" }}
                />
              ))}
            </div>
          )}
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
            <MessageCircle size={18} /> <span>{comments.length}</span>
          </span>
          <button
            type="button"
            onClick={() =>
              setReportTarget({
                type: "post",
                id: post.id,
                snapshot: `${post.title} — ${post.content.slice(0, 150)}`,
              })
            }
            className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-lg text-[12px] active:scale-95 transition-transform"
            style={{
              backgroundColor: "#FFFFFF",
              border: "1px solid #E3DCD3",
              color: "#A38E7A",
            }}
            aria-label="게시글 신고"
          >
            <Flag size={12} strokeWidth={2.2} />
            신고
          </button>
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
            {comments.map((c) => (
              <div key={c.id} className="card-sm p-4">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    {c.author_avatar_url ? (
                      <img
                        src={c.author_avatar_url}
                        alt=""
                        className="w-6 h-6 rounded-full object-cover"
                      />
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
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-text-light">
                      {formatRelativeTime(c.created_at)}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setReportTarget({
                          type: "post_comment",
                          id: c.id,
                          snapshot: c.body.slice(0, 150),
                        })
                      }
                      className="w-5 h-5 rounded-md flex items-center justify-center active:scale-90"
                      style={{ backgroundColor: "#F6F1EA" }}
                      aria-label="댓글 신고"
                      title="신고하기"
                    >
                      <Flag size={9} style={{ color: "#A38E7A" }} strokeWidth={2.5} />
                    </button>
                  </div>
                </div>
                <p className="text-[13px] text-text-sub leading-relaxed pl-8 whitespace-pre-wrap">
                  {c.body}
                </p>
              </div>
            ))}
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
                user ? "댓글을 입력하세요..." : "로그인 후 댓글을 작성할 수 있어요"
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
