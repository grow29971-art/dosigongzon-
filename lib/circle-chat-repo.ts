// Circle Messages — 서클 멤버끼리 그룹 채팅.
// owner와 accepted 멤버만 R/W 가능 (RLS).

import { createClient } from "@/lib/supabase/client";
import { findAbuseViolations, formatAbuseMessage } from "@/lib/abuse-patterns";
import { enforceUserActionLimit } from "@/lib/rate-limit";

export interface CircleMessage {
  id: string;
  circle_id: string;
  sender_id: string;
  sender_name: string | null;
  sender_avatar_url: string | null;
  body: string;
  created_at: string;
}

/** 채팅 메시지 목록 (최근 → 과거 100개). */
export async function listCircleMessages(circleId: string, limit = 100): Promise<CircleMessage[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("circle_messages")
    .select("*")
    .eq("circle_id", circleId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`채팅 불러오기 실패: ${error.message}`);
  // 표시는 시간순(오래된 것 위)으로 reverse
  return ((data ?? []) as CircleMessage[]).reverse();
}

/** 메시지 전송. RLS가 권한 검증. abuse + rate limit 적용. */
export async function sendCircleMessage(circleId: string, body: string): Promise<CircleMessage> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요해요.");

  const trimmed = body.trim();
  if (!trimmed) throw new Error("내용을 입력해주세요.");
  if (trimmed.length > 1000) throw new Error("1000자 이내로 작성해주세요.");

  // 어뷰징 검증
  const abuse = findAbuseViolations(trimmed);
  if (abuse.length > 0) throw new Error(formatAbuseMessage(abuse));

  // Rate limit — 분당 30건, 일당 300건 (단체 채팅이라 DM보다 약간 여유)
  await enforceUserActionLimit(supabase, {
    table: "circle_messages",
    userColumn: "sender_id",
    userId: user.id,
    perMinute: 30,
    perDay: 300,
    label: "서클 채팅",
  });

  // 닉네임·아바타 스냅샷 (profiles에서 조회)
  const { data: profile } = await supabase
    .from("profiles")
    .select("nickname, avatar_url")
    .eq("id", user.id)
    .maybeSingle();
  const senderName = (profile?.nickname as string | null) ?? null;
  const senderAvatar = (profile?.avatar_url as string | null) ?? null;

  const { data, error } = await supabase
    .from("circle_messages")
    .insert({
      circle_id: circleId,
      sender_id: user.id,
      sender_name: senderName,
      sender_avatar_url: senderAvatar,
      body: trimmed,
    })
    .select()
    .single();
  if (error) throw new Error(`전송 실패: ${error.message}`);
  return data as CircleMessage;
}

/** 메시지 삭제 — 본인 메시지 또는 서클 owner */
export async function deleteCircleMessage(messageId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("circle_messages").delete().eq("id", messageId);
  if (error) throw new Error(`삭제 실패: ${error.message}`);
}

/** 내가 owner이거나 accepted 멤버인 모든 서클 목록 (채팅 진입용) */
export interface JoinedCircle {
  circle_id: string;
  role: "owner" | "member";
  owner_id: string;
  owner_nickname: string | null;
  owner_avatar_url: string | null;
  member_count: number;
}

export async function listJoinedCircles(): Promise<JoinedCircle[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  // 1. 내가 owner인 서클
  const { data: ownCircles } = await supabase
    .from("caretaker_circles")
    .select("id, owner_id")
    .eq("owner_id", user.id);

  // 2. 내가 accepted 멤버인 서클
  const { data: memberRows } = await supabase
    .from("circle_members")
    .select("circle_id")
    .eq("member_id", user.id)
    .eq("status", "accepted");

  type CircleRow = { id: string; owner_id: string };
  type MemberRow = { circle_id: string };

  const ownIds = ((ownCircles ?? []) as CircleRow[]).map((c) => c.id);
  const memberCircleIds = ((memberRows ?? []) as MemberRow[]).map((r) => r.circle_id).filter((id) => !ownIds.includes(id));

  // 멤버 서클의 owner 정보 조회
  let memberCircles: CircleRow[] = [];
  if (memberCircleIds.length > 0) {
    const { data } = await supabase
      .from("caretaker_circles")
      .select("id, owner_id")
      .in("id", memberCircleIds);
    memberCircles = (data ?? []) as CircleRow[];
  }

  const allCircles = [
    ...((ownCircles ?? []) as CircleRow[]).map((c) => ({ ...c, role: "owner" as const })),
    ...memberCircles.map((c) => ({ ...c, role: "member" as const })),
  ];
  if (allCircles.length === 0) return [];

  // owner 프로필 + 멤버 카운트 일괄 조회
  const ownerIds = Array.from(new Set(allCircles.map((c) => c.owner_id)));
  const [{ data: profiles }, { data: memberCounts }] = await Promise.all([
    supabase.from("profiles").select("id, nickname, avatar_url").in("id", ownerIds),
    supabase
      .from("circle_members")
      .select("circle_id")
      .in("circle_id", allCircles.map((c) => c.id))
      .eq("status", "accepted"),
  ]);

  const profileMap = new Map<string, { nickname: string | null; avatar_url: string | null }>();
  for (const p of (profiles ?? []) as Array<{ id: string; nickname: string | null; avatar_url: string | null }>) {
    profileMap.set(p.id, { nickname: p.nickname, avatar_url: p.avatar_url });
  }

  const countMap = new Map<string, number>();
  for (const m of (memberCounts ?? []) as Array<{ circle_id: string }>) {
    countMap.set(m.circle_id, (countMap.get(m.circle_id) ?? 0) + 1);
  }

  return allCircles.map((c) => {
    const profile = profileMap.get(c.owner_id);
    return {
      circle_id: c.id,
      role: c.role,
      owner_id: c.owner_id,
      owner_nickname: profile?.nickname ?? null,
      owner_avatar_url: profile?.avatar_url ?? null,
      member_count: countMap.get(c.id) ?? 0,
    };
  });
}
