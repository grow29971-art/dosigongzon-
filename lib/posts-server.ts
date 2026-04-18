// ══════════════════════════════════════════
// 서버 사이드 posts 조회 (RSC/OG 생성 전용)
// ══════════════════════════════════════════

import { createClient } from "@/lib/supabase/server";
import type { Post, PostCategory } from "@/lib/types";

interface PostRow {
  id: string;
  category: PostCategory;
  title: string;
  content: string;
  author_id: string | null;
  author_name: string | null;
  author_avatar_url: string | null;
  author_title: string | null;
  author_level: number | null;
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
    authorAvatarUrl: row.author_avatar_url ?? null,
    authorTitle: row.author_title ?? null,
    authorLevel: row.author_level ?? null,
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

export async function getPostByIdServer(id: string): Promise<Post | null> {
  if (!/^[0-9a-fA-F-]{32,36}$/.test(id)) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[posts-server] getPostByIdServer failed:", error);
    return null;
  }
  return data ? rowToPost(data as PostRow) : null;
}
