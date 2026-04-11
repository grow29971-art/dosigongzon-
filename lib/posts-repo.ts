// ══════════════════════════════════════════
// 도시공존 — 커뮤니티 게시글 Repository (Supabase 기반)
// ══════════════════════════════════════════

import { createClient } from "@/lib/supabase/client";
import { isSafeImageUrl } from "@/lib/url-validate";
import type { Post, PostCategory } from "@/lib/types";
import { getDisplayName } from "@/lib/cats-repo";

// DB row → Post 변환
interface PostRow {
  id: string;
  category: PostCategory;
  title: string;
  content: string;
  author_id: string | null;
  author_name: string | null;
  author_title: string | null;
  region: string | null;
  images: string[];
  is_pinned: boolean;
  view_count: number;
  like_count: number;
  dislike_count: number;
  comment_count: number;
  hidden: boolean;
  created_at: string;
}

function rowToPost(row: PostRow): Post {
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    content: row.content,
    authorId: row.author_id ?? "unknown",
    authorName: row.author_name ?? "익명",
    authorTitle: row.author_title ?? null,
    region: row.region ?? undefined,
    images: row.images ?? [],
    isPinned: row.is_pinned,
    viewCount: row.view_count ?? 0,
    likeCount: row.like_count ?? 0,
    dislikeCount: row.dislike_count ?? 0,
    commentCount: row.comment_count ?? 0,
    createdAt: row.created_at,
  };
}

// ── 읽기 ──
export async function listPosts(category?: PostCategory): Promise<Post[]> {
  const supabase = createClient();
  let query = supabase
    .from("posts")
    .select("*")
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false });

  if (category) {
    query = query.eq("category", category);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[posts-repo] listPosts failed:", error);
    return [];
  }
  return (data ?? []).map((r: PostRow) => rowToPost(r));
}

export async function getPostById(id: string): Promise<Post | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[posts-repo] getPostById failed:", error);
    return null;
  }
  return data ? rowToPost(data as PostRow) : null;
}

// ── 쓰기 ──
export interface CreatePostInput {
  category: PostCategory;
  title: string;
  content: string;
  region?: string;
  images?: string[];
}

export async function createPost(input: CreatePostInput): Promise<Post> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요해요.");

  const title = input.title.trim();
  const content = input.content.trim();
  if (!title) throw new Error("제목을 입력해주세요.");
  if (!content) throw new Error("내용을 입력해주세요.");

  // 이미지 URL 검증
  const safeImages = (input.images ?? []).filter(isSafeImageUrl);

  const equippedTitle =
    (user.user_metadata?.equipped_title as string | undefined) ?? null;

  const { data, error } = await supabase
    .from("posts")
    .insert({
      category: input.category,
      title,
      content,
      author_id: user.id,
      author_name: getDisplayName(user),
      author_title: equippedTitle,
      region: input.region?.trim() || null,
      images: safeImages,
    })
    .select()
    .single();

  if (error) {
    console.error("[posts-repo] createPost failed:", error);
    throw new Error(`게시글 작성 실패: ${error.message}`);
  }
  return rowToPost(data as PostRow);
}

// ── 카운터 ──
export async function incrementPostViewCount(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("post_view_inc", { p_id: id });
  if (error) {
    console.error("[posts-repo] incrementPostViewCount failed:", error);
  }
}

/**
 * 좋아요/싫어요 델타 갱신.
 * prev: 이전 투표 (1=좋아요, -1=싫어요, 0=없음)
 * next: 새 투표. 같은 걸 다시 누르면 취소 처리를 호출자에서 먼저 해야 함.
 */
export async function updatePostVote(
  id: string,
  deltaLike: -1 | 0 | 1,
  deltaDislike: -1 | 0 | 1,
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("post_vote_update", {
    p_id: id,
    delta_like: deltaLike,
    delta_dislike: deltaDislike,
  });
  if (error) {
    console.error("[posts-repo] updatePostVote failed:", error);
    throw new Error(`투표 실패: ${error.message}`);
  }
}

// ── 싫어요 카운트를 읽기 위한 별도 조회 ──
export async function getPostDislikeCount(id: string): Promise<number> {
  const supabase = createClient();
  const { data } = await supabase
    .from("posts")
    .select("dislike_count")
    .eq("id", id)
    .maybeSingle();
  return (data as { dislike_count: number } | null)?.dislike_count ?? 0;
}

export async function deletePost(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("posts").delete().eq("id", id);
  if (error) {
    console.error("[posts-repo] deletePost failed:", error);
    throw new Error(`게시글 삭제 실패: ${error.message}`);
  }
}

// ── 시간 표시 헬퍼 (lib/store의 formatRelativeTime 대체용) ──
export function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "방금 전";
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR");
}
