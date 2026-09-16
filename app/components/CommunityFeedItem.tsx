"use client";

// 커뮤니티 피드 아이템 (2026-09-16) — 카드 없는 전폭 피드.
// 아바타·닉네임·카테고리 / 본문 전문 / 하트·댓글·공유 / 좋아요 수 / 첫 댓글 / 상대시간.
// 좋아요 상태는 기존 post_vote_update RPC + localStorage(getMyPostVotes) 관례를 그대로 쓴다.

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, MessageCircle, Share2, MoreHorizontal, MessageSquare, Pin } from "lucide-react";
import type { Post } from "@/lib/types";
import { CATEGORY_MAP } from "@/lib/types";
import { formatRelativeTime } from "@/lib/posts-repo";
import type { PostComment } from "@/lib/post-comments-repo";
import { sanitizeImageUrl } from "@/lib/url-validate";
import TitleBadge from "@/app/components/TitleBadge";

interface Props {
  post: Post;
  liked: boolean;
  firstComment?: PostComment;
  onLike: (postId: string) => void;
}

const CONTENT_CLAMP = 8;

export default function CommunityFeedItem({ post, liked, firstComment, onLike }: Props) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const cat = CATEGORY_MAP[post.category];
  const detailHref = `/community/${post.id}`;
  const avatar = sanitizeImageUrl(post.authorAvatarUrl);
  const firstImage = post.images.length > 0 ? sanitizeImageUrl(post.images[0]) : "";
  const lineCount = post.content.split("\n").length;
  const isLong = lineCount > CONTENT_CLAMP || post.content.length > 400;

  const copyLink = async () => {
    try {
      await navigator.clipboard?.writeText(`${window.location.origin}${detailHref}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* 무시 */
    }
  };

  const handleShare = async () => {
    const url = `${window.location.origin}${detailHref}`;
    const nav = navigator as Navigator;
    if (typeof nav.share === "function") {
      try {
        await nav.share({ title: post.title, text: post.content.slice(0, 80), url });
      } catch {
        /* 취소 */
      }
      return;
    }
    await copyLink();
  };

  return (
    <article className="px-4 pt-4 pb-3 bg-white">
      {/* ── 작성자 행 ── */}
      <div className="flex items-start gap-3">
        <Link href={detailHref} className="shrink-0">
          {avatar ? (
            <Image
              src={avatar}
              alt=""
              width={44}
              height={44}
              className="rounded-full object-cover"
              style={{ width: 44, height: 44 }}
            />
          ) : (
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center"
              style={{ background: "var(--color-primary-soft)" }}
            >
              <span className="text-[16px] font-bold text-primary">{post.authorName.charAt(0)}</span>
            </div>
          )}
        </Link>
        <div className="flex-1 min-w-0">
          <p className="flex items-center gap-1.5 min-w-0">
            <span className="text-[15px] font-bold text-text-main leading-tight truncate">{post.authorName}</span>
            <TitleBadge titleId={post.authorTitle} />
          </p>
          <p className="flex items-center gap-1 text-[12px] text-text-sub mt-1">
            <MessageSquare size={12} />
            <span>{cat.label}</span>
            {post.region && <span className="text-text-light">· {post.region}</span>}
            {post.isPinned && (
              <span className="flex items-center gap-0.5 text-primary font-semibold ml-1">
                <Pin size={11} /> 공지
              </span>
            )}
          </p>
        </div>
        <div className="relative shrink-0">
          <button
            type="button"
            aria-label="더보기"
            onClick={() => setMenuOpen((v) => !v)}
            className="w-9 h-9 -mr-2 flex items-center justify-center text-text-sub press"
          >
            <MoreHorizontal size={20} />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
              <div
                className="absolute right-0 top-9 z-40 min-w-[140px] py-1 bg-white"
                style={{
                  borderRadius: "var(--radius-card-sm)",
                  border: "1px solid var(--color-border)",
                  boxShadow: "var(--shadow-raised)",
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    void copyLink();
                  }}
                  className="w-full text-left px-4 py-2.5 text-[14px] text-text-main press"
                >
                  링크 복사
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    router.push(detailHref);
                  }}
                  className="w-full text-left px-4 py-2.5 text-[14px] text-text-main press"
                >
                  글 열기 · 신고
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── 본문 ── */}
      <Link href={detailHref} className="block mt-3">
        {post.title && (
          <h3 className="text-[16px] font-bold text-text-main leading-snug mb-1.5">{post.title}</h3>
        )}
        <p
          className="text-[16px] text-text-main leading-relaxed whitespace-pre-line break-words"
          style={
            isLong
              ? { display: "-webkit-box", WebkitLineClamp: CONTENT_CLAMP, WebkitBoxOrient: "vertical", overflow: "hidden" }
              : undefined
          }
        >
          {post.content}
        </p>
        {isLong && <span className="text-[14px] text-text-light mt-1 inline-block">더 보기</span>}
        {firstImage && (
          <div
            className="relative mt-3 overflow-hidden"
            style={{ aspectRatio: "4 / 3", borderRadius: "var(--radius-card-sm)" }}
          >
            <Image
              src={firstImage}
              alt={post.title}
              fill
              sizes="(max-width: 512px) 100vw, 512px"
              style={{ objectFit: "cover" }}
            />
            {post.images.length > 1 && (
              <span
                className="absolute bottom-2 right-2 text-[11px] font-bold px-2 py-0.5 rounded-md"
                style={{ backgroundColor: "rgba(0,0,0,0.6)", color: "#fff" }}
              >
                +{post.images.length - 1}
              </span>
            )}
          </div>
        )}
      </Link>

      {/* ── 액션 행 ── */}
      <div className="flex items-center gap-1 mt-3 -ml-2">
        <button
          type="button"
          aria-label={liked ? "좋아요 취소" : "좋아요"}
          onClick={() => onLike(post.id)}
          className="w-11 h-11 flex items-center justify-center press-strong transition-transform"
          style={{ color: liked ? "var(--color-like)" : "var(--color-text-main)" }}
        >
          <Heart size={26} strokeWidth={1.8} fill={liked ? "var(--color-like)" : "none"} />
        </button>
        <Link
          href={`${detailHref}#comments`}
          aria-label="댓글"
          className="w-11 h-11 flex items-center justify-center text-text-main press-strong transition-transform"
        >
          <MessageCircle size={26} strokeWidth={1.8} />
        </Link>
        <button
          type="button"
          aria-label="공유"
          onClick={handleShare}
          className="w-11 h-11 flex items-center justify-center text-text-main press-strong transition-transform"
        >
          <Share2 size={24} strokeWidth={1.8} />
        </button>
        {copied && <span className="text-[12px] text-text-light ml-1">링크를 복사했어요</span>}
      </div>

      {/* ── 좋아요 · 댓글 · 시간 ── */}
      <p className="text-[15px] font-bold text-text-main mt-1">좋아요 {post.likeCount}개</p>
      {post.commentCount > 0 && (
        <Link href={`${detailHref}#comments`} className="block text-[14px] text-text-light mt-1.5">
          댓글 {post.commentCount}개 모두 보기
        </Link>
      )}
      {firstComment && (
        <p className="text-[15px] text-text-main mt-1.5 truncate">
          <span className="font-bold mr-1.5">{firstComment.author_name ?? "익명"}</span>
          <span className="mr-2 align-middle"><TitleBadge titleId={firstComment.author_title} /></span>
          {firstComment.body}
        </p>
      )}
      <p className="text-[12px] text-text-light mt-2">{formatRelativeTime(post.createdAt)}</p>
    </article>
  );
}
