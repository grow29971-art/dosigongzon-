import Link from "next/link";
import { Eye, Heart, MessageSquare, ChevronRight } from "lucide-react";
import { getWeeklyHotPostsServer } from "@/lib/posts-server";
import { CATEGORY_MAP } from "@/lib/types";

/**
 * 이번 주 HOT 게시글 TOP 3.
 * 점수 = 조회 × 1 + 좋아요 × 3 + 댓글 × 2
 * 유저가 없거나 점수 0이면 자동 숨김.
 * 2026-09-16 「익숙한 동네앱」 리디자인: 메달 그라디언트·카테고리 색 폐기 → 순위 숫자 + 회색 칩,
 * 헤어라인 컨테이너 안 구분선 리스트.
 */
export default async function WeeklyHotPosts() {
  const posts = await getWeeklyHotPostsServer(3);
  if (posts.length === 0) return null;

  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-2 px-1">
        <h2 className="text-[17px] font-bold text-text-main">
          이번 주 HOT
        </h2>
        <Link
          href="/community/popular"
          className="flex items-center gap-0.5 text-[13px] font-medium text-text-light"
        >
          전체보기 <ChevronRight size={13} />
        </Link>
      </div>

      <div
        className="overflow-hidden"
        style={{
          background: "var(--color-surface)",
          borderRadius: "var(--radius-card)",
          border: "1px solid var(--color-border)",
        }}
      >
        {posts.map((post, idx) => {
          const cat = CATEGORY_MAP[post.category];
          const plain = post.content.replace(/\s+/g, " ").trim().slice(0, 60);
          return (
            <Link
              key={post.id}
              href={`/community/${post.id}`}
              className="flex items-start gap-3 px-4 py-3 press"
              style={{ borderTop: idx > 0 ? "1px solid var(--color-divider)" : "none" }}
            >
              {/* 순위 */}
              <span
                className="shrink-0 w-6 text-[15px] font-bold tabular-nums leading-snug"
                style={{ color: idx === 0 ? "var(--color-primary)" : "var(--color-text-light)" }}
              >
                {idx + 1}
              </span>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <span
                    className="px-1.5 py-0.5 text-[11px] font-medium shrink-0 text-text-sub"
                    style={{ borderRadius: "var(--radius-square)", border: "1px solid var(--color-border)" }}
                  >
                    {cat.label}
                  </span>
                  {post.region && (
                    <span className="text-[11px] text-text-light truncate">
                      {post.region}
                    </span>
                  )}
                </div>
                <p className="text-[15px] font-semibold text-text-main leading-snug line-clamp-1">
                  {post.title}
                </p>
                {plain && (
                  <p className="text-[13px] text-text-sub leading-snug mt-0.5 line-clamp-1">
                    {plain}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-1.5 text-[11px] text-text-light">
                  {post.viewCount > 0 && (
                    <span className="flex items-center gap-0.5">
                      <Eye size={11} />
                      {post.viewCount}
                    </span>
                  )}
                  {post.likeCount > 0 && (
                    <span className="flex items-center gap-0.5">
                      <Heart size={11} />
                      {post.likeCount}
                    </span>
                  )}
                  {post.commentCount > 0 && (
                    <span className="flex items-center gap-0.5">
                      <MessageSquare size={11} />
                      {post.commentCount}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
