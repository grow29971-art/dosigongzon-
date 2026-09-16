// ══════════════════════════════════════════
// 이모지 리액션 Repository
// cat_comments / post_comments 에 4종 이모지 반응
// ══════════════════════════════════════════

import { createClient } from "@/lib/supabase/client";

export type ReactionTargetType = "cat_comment" | "post_comment";
export type ReactionEmoji = "heart" | "sad" | "fire" | "thanks";

// emoji 유지 — 소비자: app/components/ReactionBar.tsx (반응 버튼 글리프)
// 2026-09-16 리디자인 후속: color 삭제(소비자 0)
export const REACTION_EMOJIS: {
  key: ReactionEmoji;
  emoji: string;
  label: string;
}[] = [
  { key: "heart",  emoji: "❤️", label: "응원" },
  { key: "sad",    emoji: "🥺", label: "안타까워" },
  { key: "fire",   emoji: "💪", label: "힘내요" },
  { key: "thanks", emoji: "🙏", label: "고마워" },
];

export interface ReactionSummary {
  /** emoji key → count */
  counts: Record<ReactionEmoji, number>;
  /** 내가 반응한 이모지 집합 */
  myReactions: Set<ReactionEmoji>;
}

export function emptyReactionSummary(): ReactionSummary {
  return {
    counts: { heart: 0, sad: 0, fire: 0, thanks: 0 },
    myReactions: new Set(),
  };
}

/**
 * 여러 타깃의 리액션 배치 조회.
 * 반환: target_id → ReactionSummary
 */
export async function listReactionsBatch(
  targetType: ReactionTargetType,
  targetIds: string[],
): Promise<Map<string, ReactionSummary>> {
  const result = new Map<string, ReactionSummary>();
  if (targetIds.length === 0) return result;

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const myUserId = user?.id ?? null;

  const { data, error } = await supabase
    .from("reactions")
    .select("target_id, user_id, emoji")
    .eq("target_type", targetType)
    .in("target_id", targetIds);

  if (error || !data) return result;

  for (const row of data as { target_id: string; user_id: string; emoji: ReactionEmoji }[]) {
    let summary = result.get(row.target_id);
    if (!summary) {
      summary = emptyReactionSummary();
      result.set(row.target_id, summary);
    }
    summary.counts[row.emoji] = (summary.counts[row.emoji] ?? 0) + 1;
    if (myUserId && row.user_id === myUserId) {
      summary.myReactions.add(row.emoji);
    }
  }

  return result;
}

/** 토글: 이미 반응했으면 삭제, 아니면 삽입 */
export async function toggleReaction(
  targetType: ReactionTargetType,
  targetId: string,
  emoji: ReactionEmoji,
): Promise<"added" | "removed"> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요해요.");

  const { data: existing } = await supabase
    .from("reactions")
    .select("id")
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .eq("user_id", user.id)
    .eq("emoji", emoji)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("reactions")
      .delete()
      .eq("id", (existing as { id: string }).id);
    if (error) throw new Error(`삭제 실패: ${error.message}`);
    return "removed";
  }

  const { error } = await supabase.from("reactions").insert({
    target_type: targetType,
    target_id: targetId,
    user_id: user.id,
    emoji,
  });
  if (error) throw new Error(`반응 실패: ${error.message}`);
  return "added";
}
