// ══════════════════════════════════════════
// 도시공존 — 알림 센터 Repository
// 기존 테이블 조합으로 알림 피드 생성
// ══════════════════════════════════════════

import { createClient } from "@/lib/supabase/client";

export type NotificationType =
  | "comment_on_my_cat"   // 내 고양이에 댓글
  | "carelog_on_my_cat"   // 내 고양이에 돌봄 일지
  | "dm_received"         // 쪽지 수신
  | "alert_on_my_cat";    // 내 고양이에 학대 신고

export interface NotificationItem {
  id: string;
  type: NotificationType;
  actorName: string;
  actorAvatar: string | null;
  message: string;
  targetId: string; // cat_id or dm partner_id
  targetName: string; // 고양이 이름 or 대화 상대
  createdAt: string;
  isRead: boolean;
}

export async function getNotifications(limit = 30): Promise<NotificationItem[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const items: NotificationItem[] = [];

  // 1. 내 고양이에 달린 댓글 (내가 쓴 건 제외)
  const { data: myCats } = await supabase
    .from("cats")
    .select("id, name")
    .eq("caretaker_id", user.id);

  const catList = (myCats ?? []) as { id: string; name: string }[];
  const myCatIds = catList.map((c) => c.id);
  const myCatNames = new Map<string, string>(catList.map((c) => [c.id, c.name]));

  if (myCatIds.length > 0) {
    const { data: comments } = await supabase
      .from("cat_comments")
      .select("id, cat_id, author_id, author_name, author_avatar_url, body, kind, created_at")
      .in("cat_id", myCatIds)
      .neq("author_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit);

    for (const c of (comments ?? []) as { id: string; cat_id: string; author_id: string; author_name: string | null; author_avatar_url: string | null; body: string | null; kind: string; created_at: string }[]) {
      const isAlert = c.kind === "alert";
      items.push({
        id: `comment_${c.id}`,
        type: isAlert ? "alert_on_my_cat" : "comment_on_my_cat",
        actorName: c.author_name ?? "익명",
        actorAvatar: c.author_avatar_url,
        message: isAlert
          ? "학대/위험 신고를 남겼어요"
          : c.body ? (c.body.length > 40 ? c.body.slice(0, 40) + "…" : c.body) : "댓글을 남겼어요",
        targetId: c.cat_id,
        targetName: myCatNames.get(String(c.cat_id)) ?? "고양이",
        createdAt: c.created_at,
        isRead: false,
      });
    }

    // 2. 내 고양이에 달린 돌봄 일지 (내가 쓴 건 제외)
    const { data: careLogs } = await supabase
      .from("care_logs")
      .select("id, cat_id, author_id, author_name, author_avatar_url, care_type, memo, logged_at")
      .in("cat_id", myCatIds)
      .neq("author_id", user.id)
      .order("logged_at", { ascending: false })
      .limit(limit);

    const careTypeLabels: Record<string, string> = {
      feed: "밥을 줬어요", water: "물을 줬어요", health: "건강 체크를 했어요",
      tnr: "TNR 기록을 남겼어요", hospital: "병원 방문을 기록했어요",
      shelter: "쉼터 관리를 했어요", other: "돌봄 기록을 남겼어요",
    };

    for (const cl of (careLogs ?? []) as { id: string; cat_id: string; author_id: string; author_name: string | null; author_avatar_url: string | null; care_type: string; memo: string | null; logged_at: string }[]) {
      items.push({
        id: `carelog_${cl.id}`,
        type: "carelog_on_my_cat",
        actorName: cl.author_name ?? "익명",
        actorAvatar: cl.author_avatar_url,
        message: careTypeLabels[cl.care_type] ?? "돌봄 기록을 남겼어요",
        targetId: cl.cat_id,
        targetName: myCatNames.get(cl.cat_id) ?? "고양이",
        createdAt: cl.logged_at,
        isRead: false,
      });
    }
  }

  // 3. 받은 쪽지 (읽지 않은 것 우선)
  const { data: dms } = await supabase
    .from("direct_messages")
    .select("id, sender_id, sender_name, sender_avatar_url, body, is_read, created_at")
    .eq("receiver_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  for (const dm of (dms ?? []) as { id: string; sender_id: string; sender_name: string | null; sender_avatar_url: string | null; body: string; is_read: boolean; created_at: string }[]) {
    items.push({
      id: `dm_${dm.id}`,
      type: "dm_received",
      actorName: dm.sender_name ?? "익명",
      actorAvatar: dm.sender_avatar_url,
      message: dm.body.length > 40 ? dm.body.slice(0, 40) + "…" : dm.body,
      targetId: dm.sender_id,
      targetName: dm.sender_name ?? "익명",
      createdAt: dm.created_at,
      isRead: dm.is_read,
    });
  }

  // 시간순 정렬 (최신 먼저)
  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return items.slice(0, limit);
}

export async function getUnreadNotificationCount(): Promise<number> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  // 읽지 않은 DM 수
  const { count: dmCount } = await supabase
    .from("direct_messages")
    .select("*", { count: "exact", head: true })
    .eq("receiver_id", user.id)
    .eq("is_read", false);

  // 내 고양이 목록
  const { data: myCats } = await supabase
    .from("cats")
    .select("id")
    .eq("caretaker_id", user.id);

  const myCatIds = (myCats ?? []).map((c: { id: string }) => c.id);
  let recentActivityCount = 0;

  if (myCatIds.length > 0) {
    // 최근 24시간 내 내 고양이에 달린 댓글/돌봄 (내 것 제외)
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { count: commentCount } = await supabase
      .from("cat_comments")
      .select("*", { count: "exact", head: true })
      .in("cat_id", myCatIds)
      .neq("author_id", user.id)
      .gte("created_at", since);

    const { count: careLogCount } = await supabase
      .from("care_logs")
      .select("*", { count: "exact", head: true })
      .in("cat_id", myCatIds)
      .neq("author_id", user.id)
      .gte("created_at", since);

    recentActivityCount = (commentCount ?? 0) + (careLogCount ?? 0);
  }

  return (dmCount ?? 0) + recentActivityCount;
}
