// ══════════════════════════════════════════
// 캣맘 팔로우 Repository
// user_follows 테이블 CRUD + 카운트 집계
// ══════════════════════════════════════════

import { createClient } from "@/lib/supabase/client";

export interface FollowCounts {
  followers: number;
  following: number;
}

// ── 팔로우 ──
export async function followUser(targetUserId: string): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요해요.");
  if (user.id === targetUserId) throw new Error("자신은 팔로우할 수 없어요.");

  const { error } = await supabase
    .from("user_follows")
    .insert({ follower_id: user.id, following_id: targetUserId });
  if (error) {
    // 중복 팔로우는 조용히 무시
    if (error.code === "23505") return;
    throw new Error(`팔로우 실패: ${error.message}`);
  }
}

// ── 언팔로우 ──
export async function unfollowUser(targetUserId: string): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요해요.");

  const { error } = await supabase
    .from("user_follows")
    .delete()
    .eq("follower_id", user.id)
    .eq("following_id", targetUserId);
  if (error) throw new Error(`언팔로우 실패: ${error.message}`);
}

// ── 현재 내가 팔로우 중인지 ──
export async function isFollowing(targetUserId: string): Promise<boolean> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  if (user.id === targetUserId) return false;

  const { data } = await supabase
    .from("user_follows")
    .select("follower_id")
    .eq("follower_id", user.id)
    .eq("following_id", targetUserId)
    .maybeSingle();
  return !!data;
}

// ── 특정 유저의 팔로워·팔로잉 수 ──
export async function getFollowCounts(userId: string): Promise<FollowCounts> {
  const supabase = createClient();
  const [{ count: followers }, { count: following }] = await Promise.all([
    supabase.from("user_follows").select("*", { count: "exact", head: true })
      .eq("following_id", userId),
    supabase.from("user_follows").select("*", { count: "exact", head: true })
      .eq("follower_id", userId),
  ]);
  return { followers: followers ?? 0, following: following ?? 0 };
}

// ── 내가 팔로우 중인 유저 ID 목록 ──
export async function listMyFollowingIds(): Promise<string[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("user_follows")
    .select("following_id")
    .eq("follower_id", user.id);
  if (error) return [];
  return ((data ?? []) as { following_id: string }[]).map((r) => r.following_id);
}

// ── 나를 팔로우한 유저 ID 목록 ──
export async function listMyFollowerIds(): Promise<string[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("user_follows")
    .select("follower_id")
    .eq("following_id", user.id);
  if (error) return [];
  return ((data ?? []) as { follower_id: string }[]).map((r) => r.follower_id);
}
