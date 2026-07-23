// ─────────────────────────────────────────────────────────────
// 사용자 차단 (user_blocks) 클라이언트 사이드 repo
// ─────────────────────────────────────────────────────────────
//
// 모델: blocker가 blocked를 차단. 양방향 의도가 아니라 단방향 신호.
// 다만 DM은 양쪽 차단 어느 쪽이든 막힌다 (트리거에서 처리).
// 댓글/게시글 가시성은 클라이언트에서 본인이 차단한 ID는 가린다.
//
// SQL: box/supabase_user_blocks_migration.sql

import { createClient } from "@/lib/supabase/client";

export interface BlockedUser {
  id: string;             // blocked_id
  nickname: string | null;
  avatar_url: string | null;
  created_at: string;     // 차단한 시각
}

// ── 차단 등록 ──
export async function blockUser(targetUserId: string): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요해요.");
  if (user.id === targetUserId) throw new Error("자기 자신은 차단할 수 없어요.");

  const { error } = await supabase
    .from("user_blocks")
    .insert({ blocker_id: user.id, blocked_id: targetUserId });

  // 이미 차단된 경우는 무시 (멱등 처리)
  if (error && error.code !== "23505") {
    throw new Error(`차단에 실패했어요: ${error.message}`);
  }
  invalidateBlockedSetCache();
}

// ── 차단 해제 ──
export async function unblockUser(targetUserId: string): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요해요.");

  const { error } = await supabase
    .from("user_blocks")
    .delete()
    .eq("blocker_id", user.id)
    .eq("blocked_id", targetUserId);

  if (error) throw new Error(`해제에 실패했어요: ${error.message}`);
  invalidateBlockedSetCache();
}

// ── 내가 차단한 사용자 목록 (마이페이지용) ──
export async function listMyBlockedUsers(): Promise<BlockedUser[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // user_blocks → profiles 조인으로 닉네임/아바타까지 한 번에
  const { data, error } = await supabase
    .from("user_blocks")
    .select("blocked_id, created_at, profiles!user_blocks_blocked_id_fkey(nickname, avatar_url)")
    .eq("blocker_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    // 외래키명 명시 조인이 실패할 수 있음 — fallback (별도 쿼리 두 번)
    return await listMyBlockedUsersFallback(user.id);
  }

  type Row = {
    blocked_id: string;
    created_at: string;
    profiles: { nickname: string | null; avatar_url: string | null } | null;
  };
  return (data as unknown as Row[]).map((r) => ({
    id: r.blocked_id,
    nickname: r.profiles?.nickname ?? null,
    avatar_url: r.profiles?.avatar_url ?? null,
    created_at: r.created_at,
  }));
}

// 외래키 조인 실패 시 폴백
async function listMyBlockedUsersFallback(userId: string): Promise<BlockedUser[]> {
  const supabase = createClient();
  const { data: blocks } = await supabase
    .from("user_blocks")
    .select("blocked_id, created_at")
    .eq("blocker_id", userId)
    .order("created_at", { ascending: false });

  const ids = (blocks ?? []).map((b: { blocked_id: string }) => b.blocked_id);
  if (ids.length === 0) return [];

  const { data: profiles } = await supabase
    .from("profiles_public")
    .select("id, nickname, avatar_url")
    .in("id", ids);

  type ProfileRow = { id: string; nickname: string | null; avatar_url: string | null };
  const profileMap = new Map<string, ProfileRow>();
  (profiles ?? []).forEach((p: ProfileRow) => profileMap.set(p.id, p));

  return (blocks ?? []).map((b: { blocked_id: string; created_at: string }) => ({
    id: b.blocked_id,
    nickname: profileMap.get(b.blocked_id)?.nickname ?? null,
    avatar_url: profileMap.get(b.blocked_id)?.avatar_url ?? null,
    created_at: b.created_at,
  }));
}

// ── 내 차단 ID Set (캐시) — 댓글·게시글 필터링에서 동기 호출 ──
let cachedBlockedSet: Set<string> | null = null;
let cachedBlockedSetAt = 0;
const BLOCKED_SET_TTL_MS = 60 * 1000; // 1분

export function invalidateBlockedSetCache(): void {
  cachedBlockedSet = null;
  cachedBlockedSetAt = 0;
}

export async function getMyBlockedIdSet(): Promise<Set<string>> {
  if (cachedBlockedSet && Date.now() - cachedBlockedSetAt < BLOCKED_SET_TTL_MS) {
    return cachedBlockedSet;
  }
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Set();

  const { data } = await supabase
    .from("user_blocks")
    .select("blocked_id")
    .eq("blocker_id", user.id);

  const set = new Set<string>((data ?? []).map((r: { blocked_id: string }) => r.blocked_id));
  cachedBlockedSet = set;
  cachedBlockedSetAt = Date.now();
  return set;
}

// ── 단건 조회 (현재 보고 있는 유저가 내가 차단한 사람인지) ──
export async function isBlockedByMe(targetUserId: string): Promise<boolean> {
  const set = await getMyBlockedIdSet();
  return set.has(targetUserId);
}
