// ══════════════════════════════════════════
// 도시공존 — 커뮤니티 게시글 댓글 Repository
// Supabase public.post_comments
// ══════════════════════════════════════════

import { createClient } from "@/lib/supabase/client";
import { getDisplayName } from "@/lib/cats-repo";

export interface PostComment {
  id: string;
  post_id: string;
  author_id: string | null;
  author_name: string | null;
  author_avatar_url: string | null;
  author_title: string | null;
  body: string;
  created_at: string;
}

// ── 특정 게시글 댓글 조회 (시간순) ──
export async function listPostComments(postId: string): Promise<PostComment[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("post_comments")
    .select("*")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[post-comments-repo] listPostComments failed:", error);
    return [];
  }
  return (data ?? []) as PostComment[];
}

// ── 댓글 작성 (인증 필요, 정지 체크는 RLS) ──
export async function createPostComment(
  postId: string,
  body: string,
): Promise<PostComment> {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요해요.");

  const trimmed = body.trim();
  if (!trimmed) throw new Error("내용을 입력해주세요.");

  const equippedTitle =
    (user.user_metadata?.equipped_title as string | undefined) ?? null;

  const { data, error } = await supabase
    .from("post_comments")
    .insert({
      post_id: postId,
      author_id: user.id,
      author_name: getDisplayName(user),
      author_avatar_url: user.user_metadata?.avatar_url ?? null,
      author_title: equippedTitle,
      body: trimmed,
    })
    .select()
    .single();

  if (error) {
    console.error("[post-comments-repo] createPostComment failed:", error);
    throw new Error(`댓글 작성 실패: ${error.message}`);
  }

  return data as PostComment;
}

// ── 본인 댓글 삭제 ──
export async function deletePostComment(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("post_comments").delete().eq("id", id);
  if (error) {
    console.error("[post-comments-repo] deletePostComment failed:", error);
    throw new Error(`삭제 실패: ${error.message}`);
  }
}
