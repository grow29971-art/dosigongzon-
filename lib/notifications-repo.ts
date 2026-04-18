// ══════════════════════════════════════════
// 도시공존 — 알림 센터 Repository
// 기존 테이블 조합으로 알림 피드 생성
// ══════════════════════════════════════════

import { createClient } from "@/lib/supabase/client";

export type NotificationType =
  | "comment_on_my_cat"   // 내 고양이에 댓글
  | "carelog_on_my_cat"   // 내 고양이에 돌봄 일지
  | "dm_received"         // 쪽지 수신
  | "alert_on_my_cat"     // 내 고양이에 학대 신고
  | "comment_on_my_post"  // 내 커뮤니티 글에 댓글
  | "inquiry_updated"     // 내 문의 처리됨
  | "following_activity"; // 팔로우한 유저의 돌봄·댓글

export interface NotificationItem {
  id: string;
  type: NotificationType;
  actorName: string;
  actorAvatar: string | null;
  message: string;
  targetId: string; // cat_id / post_id / dm partner_id / inquiry_id
  targetName: string; // 고양이·글 제목·상대 이름·문의 제목
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

  // 3. 내 커뮤니티 글에 달린 댓글 (내 것 제외)
  const { data: myPosts } = await supabase
    .from("posts")
    .select("id, title")
    .eq("author_id", user.id);
  const postList = (myPosts ?? []) as { id: string; title: string }[];
  const myPostIds = postList.map((p) => p.id);
  const myPostTitles = new Map<string, string>(postList.map((p) => [p.id, p.title]));

  if (myPostIds.length > 0) {
    const { data: postComments } = await supabase
      .from("post_comments")
      .select("id, post_id, author_id, author_name, author_avatar_url, body, created_at")
      .in("post_id", myPostIds)
      .neq("author_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit);

    for (const pc of (postComments ?? []) as { id: string; post_id: string; author_id: string; author_name: string | null; author_avatar_url: string | null; body: string; created_at: string }[]) {
      items.push({
        id: `post_comment_${pc.id}`,
        type: "comment_on_my_post",
        actorName: pc.author_name ?? "익명",
        actorAvatar: pc.author_avatar_url,
        message: pc.body.length > 40 ? pc.body.slice(0, 40) + "…" : pc.body,
        targetId: pc.post_id,
        targetName: myPostTitles.get(pc.post_id) ?? "내 글",
        createdAt: pc.created_at,
        isRead: false,
      });
    }
  }

  // 4. 상태 바뀐 내 문의 (답변됨 / 완료됨)
  const { data: inquiries } = await supabase
    .from("inquiries")
    .select("id, subject, status, admin_note, updated_at")
    .eq("user_id", user.id)
    .neq("status", "pending")
    .order("updated_at", { ascending: false })
    .limit(limit);

  for (const iq of (inquiries ?? []) as { id: string; subject: string; status: string; admin_note: string | null; updated_at: string }[]) {
    const statusLabel = iq.status === "replied" ? "답변이 달렸어요" : "처리 완료됐어요";
    const note = iq.admin_note?.trim();
    const message = note
      ? `${statusLabel} · ${note.length > 40 ? note.slice(0, 40) + "…" : note}`
      : statusLabel;
    items.push({
      id: `inquiry_${iq.id}`,
      type: "inquiry_updated",
      actorName: "관리자",
      actorAvatar: null,
      message,
      targetId: iq.id,
      targetName: iq.subject,
      createdAt: iq.updated_at,
      isRead: false,
    });
  }

  // 4.5. 내가 팔로우한 유저의 최근 24시간 돌봄·댓글
  const since24 = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: followingRows } = await supabase
    .from("user_follows")
    .select("following_id")
    .eq("follower_id", user.id)
    .limit(500);
  const followingIds = ((followingRows ?? []) as { following_id: string }[]).map((r) => r.following_id);
  if (followingIds.length > 0) {
    // 팔로우한 유저의 돌봄 일지
    const { data: followCare } = await supabase
      .from("care_logs")
      .select("id, cat_id, author_id, author_name, author_avatar_url, care_type, logged_at")
      .in("author_id", followingIds)
      .gte("logged_at", since24)
      .order("logged_at", { ascending: false })
      .limit(20);

    const careRows = (followCare ?? []) as { id: string; cat_id: string; author_id: string; author_name: string | null; author_avatar_url: string | null; care_type: string; logged_at: string }[];

    // 고양이 이름 일괄 조회
    const catIds = Array.from(new Set(careRows.map((c) => c.cat_id)));
    const catNameMap = new Map<string, string>();
    if (catIds.length > 0) {
      const { data: cats } = await supabase.from("cats").select("id, name").in("id", catIds);
      for (const c of (cats ?? []) as { id: string; name: string }[]) catNameMap.set(c.id, c.name);
    }

    const careTypeShort: Record<string, string> = {
      feed: "🍚 밥을 챙겼어요", water: "💧 물을 줬어요", health: "🩺 건강 체크",
      tnr: "✂️ TNR 기록", hospital: "🏥 병원 방문", shelter: "🏠 쉼터 관리",
      other: "📝 돌봄 기록",
    };

    for (const c of careRows) {
      items.push({
        id: `follow_care_${c.id}`,
        type: "following_activity",
        actorName: c.author_name ?? "익명",
        actorAvatar: c.author_avatar_url,
        message: careTypeShort[c.care_type] ?? "돌봄 기록을 남겼어요",
        targetId: c.cat_id,
        targetName: catNameMap.get(c.cat_id) ?? "고양이",
        createdAt: c.logged_at,
        isRead: false,
      });
    }
  }

  // 5. 받은 쪽지 (읽지 않은 것 우선)
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

  const h24 = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const d7  = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // 1) 읽지 않은 DM
  const { count: dmCount } = await supabase
    .from("direct_messages")
    .select("*", { count: "exact", head: true })
    .eq("receiver_id", user.id)
    .eq("is_read", false);

  // 2) 내 고양이에 달린 최근 24h 댓글/돌봄일지 (내 것 제외)
  const { data: myCats } = await supabase
    .from("cats")
    .select("id")
    .eq("caretaker_id", user.id);
  const myCatIds = (myCats ?? []).map((c: { id: string }) => c.id);
  let catActivity = 0;
  if (myCatIds.length > 0) {
    const [{ count: cc }, { count: cl }] = await Promise.all([
      supabase.from("cat_comments").select("*", { count: "exact", head: true })
        .in("cat_id", myCatIds).neq("author_id", user.id).gte("created_at", h24),
      supabase.from("care_logs").select("*", { count: "exact", head: true })
        .in("cat_id", myCatIds).neq("author_id", user.id).gte("created_at", h24),
    ]);
    catActivity = (cc ?? 0) + (cl ?? 0);
  }

  // 3) 내 커뮤니티 글에 달린 최근 24h 댓글 (내 것 제외)
  const { data: myPosts } = await supabase
    .from("posts")
    .select("id")
    .eq("author_id", user.id);
  const myPostIds = (myPosts ?? []).map((p: { id: string }) => p.id);
  let postCommentCount = 0;
  if (myPostIds.length > 0) {
    const { count: pc } = await supabase
      .from("post_comments")
      .select("*", { count: "exact", head: true })
      .in("post_id", myPostIds)
      .neq("author_id", user.id)
      .gte("created_at", h24);
    postCommentCount = pc ?? 0;
  }

  // 4) 최근 7일 내 상태 바뀐 내 문의 (pending 아닌 것)
  const { count: inqCount } = await supabase
    .from("inquiries")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .neq("status", "pending")
    .gte("updated_at", d7);

  // 5) 내가 팔로우한 유저의 최근 24h 돌봄 활동
  const { data: following } = await supabase
    .from("user_follows")
    .select("following_id")
    .eq("follower_id", user.id)
    .limit(500);
  const followingIds = ((following ?? []) as { following_id: string }[]).map((r) => r.following_id);
  let followActivity = 0;
  if (followingIds.length > 0) {
    const { count: fc } = await supabase
      .from("care_logs")
      .select("*", { count: "exact", head: true })
      .in("author_id", followingIds)
      .gte("logged_at", h24);
    followActivity = fc ?? 0;
  }

  return (dmCount ?? 0) + catActivity + postCommentCount + (inqCount ?? 0) + followActivity;
}
