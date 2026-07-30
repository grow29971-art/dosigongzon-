// Private Circle — 사용자가 승인한 이웃에게만 핀을 노출.
// 사용자당 단일 서클(MVP). 다중 서클·세분화는 v1.2.

import { createClient } from "@/lib/supabase/client";

export type CircleMemberStatus = "pending" | "accepted" | "rejected";

export interface Circle {
  id: string;
  owner_id: string;
  name: string;
  created_at: string;
}

export interface CircleMember {
  id: string;
  circle_id: string;
  member_id: string;
  status: CircleMemberStatus;
  invited_at: string;
  accepted_at: string | null;
  // 조인 결과 (member profile)
  member_nickname?: string | null;
  member_avatar_url?: string | null;
}

export interface PendingInvitation {
  id: string;            // circle_members.id
  circle_id: string;
  status: CircleMemberStatus;
  invited_at: string;
  owner_id: string;
  owner_nickname: string | null;
  owner_avatar_url: string | null;
}

/** 내 서클 조회. 없으면 자동 생성. */
export async function getOrCreateMyCircle(): Promise<Circle> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요해요.");

  const { data: existing } = await supabase
    .from("caretaker_circles")
    .select("*")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (existing) return existing as Circle;

  const { data, error } = await supabase
    .from("caretaker_circles")
    .insert({ owner_id: user.id, name: "내 서클" })
    .select()
    .single();
  if (error) throw new Error(`서클 생성 실패: ${error.message}`);
  return data as Circle;
}

/** 내 서클의 수락 멤버 수만 빠르게 조회 (홈·마이페이지 카운트 뱃지용). 서클이 없으면 0. */
export async function countMyAcceptedCircleMembers(): Promise<number> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  // 서클 조회 (없으면 생성하지 않고 0 반환)
  const { data: circle } = await supabase
    .from("caretaker_circles")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!circle) return 0;

  const { count } = await supabase
    .from("circle_members")
    .select("*", { count: "exact", head: true })
    .eq("circle_id", (circle as { id: string }).id)
    .eq("status", "accepted");
  return count ?? 0;
}

/** 내 서클 멤버 목록 (status별). 멤버의 닉네임·아바타 포함. */
export async function listMyCircleMembers(): Promise<CircleMember[]> {
  const supabase = createClient();
  const circle = await getOrCreateMyCircle();

  const { data, error } = await supabase
    .from("circle_members")
    .select("id, circle_id, member_id, status, invited_at, accepted_at")
    .eq("circle_id", circle.id)
    .order("invited_at", { ascending: false });
  if (error) throw new Error(`멤버 조회 실패: ${error.message}`);

  const rows = (data ?? []) as CircleMember[];
  if (rows.length === 0) return [];

  // 멤버 프로필 조인 (단건 쿼리로 일괄)
  const memberIds = Array.from(new Set(rows.map((r) => r.member_id)));
  const { data: profiles } = await supabase
    .from("profiles_public")
    .select("id, nickname, avatar_url")
    .in("id", memberIds);
  const profileMap = new Map<string, { nickname: string | null; avatar_url: string | null }>();
  for (const p of (profiles ?? []) as Array<{ id: string; nickname: string | null; avatar_url: string | null }>) {
    profileMap.set(p.id, { nickname: p.nickname, avatar_url: p.avatar_url });
  }

  return rows.map((r) => {
    const p = profileMap.get(r.member_id);
    return { ...r, member_nickname: p?.nickname ?? null, member_avatar_url: p?.avatar_url ?? null };
  });
}

/** 닉네임으로 사용자 검색 (초대용). 본인·이미 초대된 사람 제외. */
export async function searchUsersByNickname(query: string): Promise<Array<{ id: string; nickname: string | null; avatar_url: string | null }>> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요해요.");
  const q = query.trim();
  if (q.length < 2) return [];

  const { data, error } = await supabase
    .from("profiles_public")
    .select("id, nickname, avatar_url")
    .ilike("nickname", `%${q}%`)
    .neq("id", user.id)
    .limit(20);
  if (error) throw new Error(`검색 실패: ${error.message}`);
  return (data ?? []) as Array<{ id: string; nickname: string | null; avatar_url: string | null }>;
}

/** 멤버 초대 (pending 상태로 생성). */
export async function inviteToCircle(memberId: string): Promise<void> {
  const supabase = createClient();
  const circle = await getOrCreateMyCircle();

  const { error } = await supabase.from("circle_members").insert({
    circle_id: circle.id,
    member_id: memberId,
    status: "pending",
  });
  if (error) {
    // unique 위반 = 이미 초대된 상태
    if (error.code === "23505") throw new Error("이미 초대한 사람이에요.");
    throw new Error(`초대 실패: ${error.message}`);
  }
}

/** 멤버 제거 (owner 권한). */
export async function removeCircleMember(memberId: string): Promise<void> {
  const supabase = createClient();
  const circle = await getOrCreateMyCircle();

  const { error } = await supabase
    .from("circle_members")
    .delete()
    .eq("circle_id", circle.id)
    .eq("member_id", memberId);
  if (error) throw new Error(`제거 실패: ${error.message}`);
}

/** 나에게 온 pending 초대 목록 — owner 프로필 조인. */
export async function listMyPendingInvitations(): Promise<PendingInvitation[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: rows, error } = await supabase
    .from("circle_members")
    .select("id, circle_id, status, invited_at")
    .eq("member_id", user.id)
    .eq("status", "pending")
    .order("invited_at", { ascending: false });
  if (error) throw new Error(`초대 조회 실패: ${error.message}`);

  const list = (rows ?? []) as Array<{ id: string; circle_id: string; status: CircleMemberStatus; invited_at: string }>;
  if (list.length === 0) return [];

  const circleIds = Array.from(new Set(list.map((r) => r.circle_id)));
  const { data: circles } = await supabase
    .from("caretaker_circles")
    .select("id, owner_id")
    .in("id", circleIds);
  const circleMap = new Map<string, string>();
  for (const c of (circles ?? []) as Array<{ id: string; owner_id: string }>) {
    circleMap.set(c.id, c.owner_id);
  }

  const ownerIds = Array.from(new Set(Array.from(circleMap.values())));
  const { data: profiles } = await supabase
    .from("profiles_public")
    .select("id, nickname, avatar_url")
    .in("id", ownerIds);
  const profileMap = new Map<string, { nickname: string | null; avatar_url: string | null }>();
  for (const p of (profiles ?? []) as Array<{ id: string; nickname: string | null; avatar_url: string | null }>) {
    profileMap.set(p.id, { nickname: p.nickname, avatar_url: p.avatar_url });
  }

  return list.map((r) => {
    const ownerId = circleMap.get(r.circle_id) ?? "";
    const profile = profileMap.get(ownerId);
    return {
      ...r,
      owner_id: ownerId,
      owner_nickname: profile?.nickname ?? null,
      owner_avatar_url: profile?.avatar_url ?? null,
    };
  });
}

/** 초대 응답 — accepted/rejected */
export async function respondToInvitation(
  invitationId: string,
  status: "accepted" | "rejected",
): Promise<void> {
  const supabase = createClient();
  const patch: Record<string, unknown> = { status };
  if (status === "accepted") patch.accepted_at = new Date().toISOString();
  const { error } = await supabase
    .from("circle_members")
    .update(patch)
    .eq("id", invitationId);
  if (error) throw new Error(`응답 실패: ${error.message}`);
}
