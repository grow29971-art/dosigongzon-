// ══════════════════════════════════════════
// 도시공존 — 커뮤니티 게시글 댓글 Repository
// Supabase public.post_comments
// ══════════════════════════════════════════

import { createClient } from "@/lib/supabase/client";
import { getDisplayName, getMyActivitySummary, computeScore, computeLevel } from "@/lib/cats-repo";
import { findAbuseViolations, formatAbuseMessage } from "@/lib/abuse-patterns";

export interface PostComment {
  id: string;
  post_id: string;
  parent_id: string | null;
  author_id: string | null;
  author_name: string | null;
  author_avatar_url: string | null;
  author_title: string | null;
  author_level: number | null;
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
  parentId?: string | null,
): Promise<PostComment> {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요해요.");

  const trimmed = body.trim();
  if (!trimmed) throw new Error("내용을 입력해주세요.");

  // 어뷰징 검증
  const abuse = findAbuseViolations(trimmed);
  if (abuse.length > 0) throw new Error(formatAbuseMessage(abuse));

  const equippedTitle =
    (user.user_metadata?.equipped_title as string | undefined) ?? null;

  let authorLevel: number | null = null;
  try {
    const summary = await getMyActivitySummary();
    authorLevel = computeLevel(computeScore(summary)).level;
  } catch {
    authorLevel = null;
  }

  const { data, error } = await supabase
    .from("post_comments")
    .insert({
      post_id: postId,
      parent_id: parentId ?? null,
      author_id: user.id,
      author_name: getDisplayName(user),
      author_avatar_url: user.user_metadata?.avatar_url ?? null,
      author_title: equippedTitle,
      author_level: authorLevel,
      body: trimmed,
    })
    .select()
    .single();

  if (error) {
    console.error("[post-comments-repo] createPostComment failed:", error);
    throw new Error(`댓글 작성 실패: ${error.message}`);
  }

  // 알림 발송 (실패해도 댓글 작성은 성공)
  void notifyOnComment({
    postId,
    parentId: parentId ?? null,
    senderId: user.id,
    senderName: getDisplayName(user),
    body: trimmed,
  });

  return data as PostComment;
}

// 댓글 작성 시 푸시 알림.
// - 글 작성자에게 항상 (자기 자신 글/익명 글이면 스킵)
// - 답글이면 부모 댓글 작성자에게도 (글 작성자와 중복이면 한 번만, 자기 자신이면 스킵)
async function notifyOnComment(args: {
  postId: string;
  parentId: string | null;
  senderId: string;
  senderName: string;
  body: string;
}): Promise<void> {
  const { postId, parentId, senderId, senderName, body } = args;
  try {
    const supabase = createClient();

    const { data: post } = await supabase
      .from("posts")
      .select("author_id")
      .eq("id", postId)
      .maybeSingle();
    const postAuthorId =
      (post as { author_id: string | null } | null)?.author_id ?? null;

    let parentAuthorId: string | null = null;
    if (parentId) {
      const { data: parent } = await supabase
        .from("post_comments")
        .select("author_id")
        .eq("id", parentId)
        .maybeSingle();
      parentAuthorId =
        (parent as { author_id: string | null } | null)?.author_id ?? null;
    }

    // 보낼 대상 모음 (중복/자기 자신 제거)
    const recipients = new Set<string>();
    if (postAuthorId && postAuthorId !== senderId) recipients.add(postAuthorId);
    if (parentAuthorId && parentAuthorId !== senderId) {
      recipients.add(parentAuthorId);
    }
    if (recipients.size === 0) return;

    const { data: { session } } = await supabase.auth.getSession();
    const accessToken = session?.access_token;
    if (!accessToken) return;

    const preview = body.length > 80 ? `${body.slice(0, 80)}…` : body;
    const url = `/community/${postId}`;

    await Promise.all(
      Array.from(recipients).map((userId) => {
        const isReplyToParent = userId === parentAuthorId;
        const title = isReplyToParent
          ? `${senderName}님이 답글을 달았어요`
          : `${senderName}님이 댓글을 남겼어요`;
        return fetch("/api/push/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ userId, title, body: preview, url }),
        }).catch(() => {});
      }),
    );
  } catch {
    // 푸시 실패는 무시
  }
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
