import Link from "next/link";
import { Flame, Eye, Heart, MessageSquare, ChevronRight } from "lucide-react";
import { getWeeklyHotPostsServer } from "@/lib/posts-server";
import { CATEGORY_MAP } from "@/lib/types";

/**
 * 이번 주 HOT 게시글 TOP 3.
 * 점수 = 조회 × 1 + 좋아요 × 3 + 댓글 × 2
 * 유저가 없거나 점수 0이면 자동 숨김.
 */
export default async function WeeklyHotPosts() {
  const posts = await getWeeklyHotPostsServer(3);
  if (posts.length === 0) return null;

  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-3 px-1">
        <div className="w-1 h-4 rounded-full" style={{ backgroundColor: "#E86B8C" }} />
        <h2 className="text-[14px] font-extrabold text-text-main tracking-tight flex items-center gap-1">
          <Flame size={14} style={{ color: "#E86B8C" }} />
          이번 주 HOT
        </h2>
        <Link
          href="/community/popular"
          className="ml-auto flex items-center gap-0.5 text-[11px] font-semibold text-primary"
        >
          전체보기 <ChevronRight size={12} />
        </Link>
      </div>

      <div className="space-y-2">
        {posts.map((post, idx) => {
          const cat = CATEGORY_MAP[post.category];
          const plain = post.content.replace(/\s+/g, " ").trim().slice(0, 60);
          return (
            <Link
              key={post.id}
              href={`/community/${post.id}`}
              className="block active:scale-[0.99] transition-transform"
            >
              <div
                className="relative rounded-2xl px-4 py-3 flex items-start gap-3"
                style={{
                  background: "#FFFFFF",
                  boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
                  border: "1px solid rgba(0,0,0,0.04)",
                }}
              >
                {/* 순위 뱃지 */}
                <div
                  className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-[14px] font-extrabold"
                  style={{
                    background:
                      idx === 0
                        ? "linear-gradient(135deg, #FFD93D 0%, #FFAA00 100%)"
                        : idx === 1
                          ? "linear-gradient(135deg, #D9D9D9 0%, #A8A8A8 100%)"
                          : "linear-gradient(135deg, #E8A87C 0%, #C4754A 100%)",
                    color: "#fff",
                    boxShadow:
                      idx === 0
                        ? "0 4px 10px rgba(255,170,0,0.3)"
                        : "0 2px 6px rgba(0,0,0,0.1)",
                  }}
                >
                  {idx + 1}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span
                      className="px-1.5 py-0.5 rounded text-[9px] font-extrabold shrink-0"
                      style={{ background: `${cat.color}20`, color: cat.color }}
                    >
                      {cat.emoji} {cat.label}
                    </span>
                    {post.region && (
                      <span className="text-[9px] text-text-light truncate">
                        · {post.region}
                      </span>
                    )}
                  </div>
                  <p className="text-[13px] font-extrabold text-text-main tracking-tight leading-tight line-clamp-1">
                    {post.title}
                  </p>
                  {plain && (
                    <p className="text-[11px] text-text-sub leading-snug mt-0.5 line-clamp-1">
                      {plain}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-1.5 text-[10px] text-text-light font-semibold">
                    {post.viewCount > 0 && (
                      <span className="flex items-center gap-0.5">
                        <Eye size={10} />
                        {post.viewCount}
                      </span>
                    )}
                    {post.likeCount > 0 && (
                      <span className="flex items-center gap-0.5" style={{ color: "#E86B8C" }}>
                        <Heart size={10} fill="currentColor" />
                        {post.likeCount}
                      </span>
                    )}
                    {post.commentCount > 0 && (
                      <span className="flex items-center gap-0.5" style={{ color: "#4A7BA8" }}>
                        <MessageSquare size={10} />
                        {post.commentCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
