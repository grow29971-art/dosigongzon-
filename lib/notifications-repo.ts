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
  | "following_activity"  // 팔로우한 유저의 돌봄·댓글
  | "invite_accepted"     // 내 초대 코드로 친구가 가입
  | "cat_moved"           // 좋아요한 고양이가 다른 동으로 이사
  | "urgent_in_area";     // 내 동네에 위급 상태 + 돌봄 부재 고양이 (cron 푸시와 짝)

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

// 독립 블록 8개(내 고양이·내 글·문의·팔로우·초대·이사·위급·쪽지)를 Promise.all로 병렬 실행.
// 예전엔 최대 14개 쿼리를 전부 순차 await 해서 홈 진입 왕복만 1초+ 걸렸다.
// 블록 내부의 의존 체인(목록 조회 → 상세 조회)은 그대로 — 최종적으로 시간순 정렬하므로
// 블록 간 실행 순서는 결과에 영향 없다.
export async function getNotifications(limit = 30): Promise<NotificationItem[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // 1·2. 내 고양이에 달린 댓글 + 돌봄 일지 (내가 쓴 건 제외)
  const myCatActivity = async (): Promise<NotificationItem[]> => {
    const out: NotificationItem[] = [];
    const { data: myCats } = await supabase
      .from("cats")
      .select("id, name")
      .eq("caretaker_id", user.id);

    const catList = (myCats ?? []) as { id: string; name: string }[];
    const myCatIds = catList.map((c) => c.id);
    const myCatNames = new Map<string, string>(catList.map((c) => [c.id, c.name]));
    if (myCatIds.length === 0) return out;

    const [{ data: comments }, { data: careLogs }] = await Promise.all([
      supabase
        .from("cat_comments")
        .select("id, cat_id, author_id, author_name, author_avatar_url, body, kind, created_at")
        .in("cat_id", myCatIds)
        .neq("author_id", user.id)
        .order("created_at", { ascending: false })
        .limit(limit),
      supabase
        .from("care_logs")
        .select("id, cat_id, author_id, author_name, author_avatar_url, care_type, memo, logged_at")
        .in("cat_id", myCatIds)
        .neq("author_id", user.id)
        .order("logged_at", { ascending: false })
        .limit(limit),
    ]);

    for (const c of (comments ?? []) as { id: string; cat_id: string; author_id: string; author_name: string | null; author_avatar_url: string | null; body: string | null; kind: string; created_at: string }[]) {
      const isAlert = c.kind === "alert";
      out.push({
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

    const careTypeLabels: Record<string, string> = {
      feed: "밥을 줬어요", water: "물을 줬어요", health: "건강 체크를 했어요",
      tnr: "TNR 기록을 남겼어요", hospital: "병원 방문을 기록했어요",
      shelter: "쉼터 관리를 했어요", other: "돌봄 기록을 남겼어요",
    };

    for (const cl of (careLogs ?? []) as { id: string; cat_id: string; author_id: string; author_name: string | null; author_avatar_url: string | null; care_type: string; memo: string | null; logged_at: string }[]) {
      out.push({
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
    return out;
  };

  // 3. 내 커뮤니티 글에 달린 댓글 (내 것 제외)
  const myPostComments = async (): Promise<NotificationItem[]> => {
    const out: NotificationItem[] = [];
    const { data: myPosts } = await supabase
      .from("posts")
      .select("id, title")
      .eq("author_id", user.id);
    const postList = (myPosts ?? []) as { id: string; title: string }[];
    const myPostIds = postList.map((p) => p.id);
    const myPostTitles = new Map<string, string>(postList.map((p) => [p.id, p.title]));
    if (myPostIds.length === 0) return out;

    const { data: postComments } = await supabase
      .from("post_comments")
      .select("id, post_id, author_id, author_name, author_avatar_url, body, created_at")
      .in("post_id", myPostIds)
      .neq("author_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit);

    for (const pc of (postComments ?? []) as { id: string; post_id: string; author_id: string; author_name: string | null; author_avatar_url: string | null; body: string; created_at: string }[]) {
      out.push({
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
    return out;
  };

  // 4. 상태 바뀐 내 문의 (답변됨 / 완료됨)
  const myInquiries = async (): Promise<NotificationItem[]> => {
    const out: NotificationItem[] = [];
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
      out.push({
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
    return out;
  };

  // 4.5. 내가 팔로우한 유저의 최근 24시간 돌봄·댓글
  const followingActivity = async (): Promise<NotificationItem[]> => {
    const out: NotificationItem[] = [];
    const since24 = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: followingRows } = await supabase
      .from("user_follows")
      .select("following_id")
      .eq("follower_id", user.id)
      .limit(500);
    const followingIds = ((followingRows ?? []) as { following_id: string }[]).map((r) => r.following_id);
    if (followingIds.length === 0) return out;

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
      out.push({
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
    return out;
  };

  // 4.6. 내 초대 코드로 가입한 친구 (최근 이벤트)
  const inviteAccepted = async (): Promise<NotificationItem[]> => {
    const out: NotificationItem[] = [];
    const { data: invites } = await supabase
      .from("invite_events")
      .select("id, invitee_id, invite_code, created_at")
      .eq("inviter_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit);

    const inviteRows = (invites ?? []) as { id: string; invitee_id: string; invite_code: string | null; created_at: string }[];
    if (inviteRows.length === 0) return out;

    const inviteeIds = inviteRows.map((r) => r.invitee_id);
    const { data: invitees } = await supabase
      .from("profiles_public")
      .select("id, nickname, avatar_url")
      .in("id", inviteeIds);
    const inviteeMap = new Map(
      ((invitees ?? []) as { id: string; nickname: string | null; avatar_url: string | null }[])
        .map((p) => [p.id, p]),
    );

    for (const r of inviteRows) {
      const prof = inviteeMap.get(r.invitee_id);
      out.push({
        id: `invite_${r.id}`,
        type: "invite_accepted",
        actorName: prof?.nickname ?? "새 이웃",
        actorAvatar: prof?.avatar_url ?? null,
        message: "🎉 초대 코드로 가입했어요. 동네에서 반갑게 맞아주세요!",
        targetId: r.invitee_id,
        targetName: prof?.nickname ?? "새 이웃",
        createdAt: r.created_at,
        isRead: false,
      });
    }
    return out;
  };

  // 4.7. 좋아요한 고양이의 동 이동 (최근 30일)
  const likedCatMoves = async (): Promise<NotificationItem[]> => {
    const out: NotificationItem[] = [];
    const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: myLikes } = await supabase
      .from("cat_likes")
      .select("cat_id")
      .eq("user_id", user.id)
      .limit(500);
    const likedCatIds = ((myLikes ?? []) as { cat_id: string }[]).map(
      (r) => r.cat_id,
    );
    if (likedCatIds.length === 0) return out;

    const { data: moves } = await supabase
      .from("cat_location_history")
      .select(
        "id, cat_id, changed_by, changed_by_name, old_region, new_region, created_at",
      )
      .in("cat_id", likedCatIds)
      .neq("changed_by", user.id)
      .gte("created_at", since30)
      .order("created_at", { ascending: false })
      .limit(limit);

    const moveRows = (moves ?? []) as {
      id: string;
      cat_id: string;
      changed_by: string | null;
      changed_by_name: string | null;
      old_region: string | null;
      new_region: string | null;
      created_at: string;
    }[];

    // 동이 실제로 바뀐 것만
    const regionChanges = moveRows.filter(
      (m) => (m.old_region ?? "") !== (m.new_region ?? ""),
    );
    if (regionChanges.length === 0) return out;

    const moveCatIds = Array.from(new Set(regionChanges.map((m) => m.cat_id)));
    const { data: movedCats } = await supabase
      .from("cats")
      .select("id, name, photo_url")
      .in("id", moveCatIds);
    const movedCatMap = new Map(
      ((movedCats ?? []) as { id: string; name: string; photo_url: string | null }[])
        .map((c) => [c.id, c]),
    );

    for (const m of regionChanges) {
      const cat = movedCatMap.get(m.cat_id);
      if (!cat) continue;
      out.push({
        id: `cat_moved_${m.id}`,
        type: "cat_moved",
        actorName: m.changed_by_name ?? "길집사",
        actorAvatar: cat.photo_url,
        message: `📍 ${m.old_region ?? "?"} → ${m.new_region ?? "?"}로 옮겨졌어요`,
        targetId: m.cat_id,
        targetName: cat.name,
        createdAt: m.created_at,
        isRead: false,
      });
    }
    return out;
  };

  // 4.8. 내 활동 지역의 위급 + 돌봄 부재 고양이 (health-alert-push cron과 짝)
  const urgentInArea = async (): Promise<NotificationItem[]> => {
    const out: NotificationItem[] = [];
    const STALE_DAYS = 3;
    const staleAt = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { data: myRegions } = await supabase
      .from("user_activity_regions")
      .select("name")
      .eq("user_id", user.id);
    const myRegionNames = Array.from(new Set(((myRegions ?? []) as { name: string }[]).map((r) => r.name).filter(Boolean)));
    if (myRegionNames.length === 0) return out;

    const { data: urgentCats } = await supabase
      .from("cats")
      .select("id, name, region, photo_url, health_status, caretaker_id, created_at")
      .in("health_status", ["caution", "danger"])
      .in("region", myRegionNames)
      .neq("caretaker_id", user.id) // 내 고양이는 위 1·2번에서 처리
      .order("created_at", { ascending: false })
      .limit(20);

    const urgentRows = (urgentCats ?? []) as {
      id: string; name: string; region: string | null; photo_url: string | null;
      health_status: string; caretaker_id: string | null; created_at: string;
    }[];
    if (urgentRows.length === 0) return out;

    // 각 고양이의 마지막 돌봄 조회
    const urgentIds = urgentRows.map((c) => c.id);
    const { data: lastCares } = await supabase
      .from("care_logs")
      .select("cat_id, logged_at")
      .in("cat_id", urgentIds)
      .order("logged_at", { ascending: false });
    const lastCareMap = new Map<string, string>();
    for (const r of (lastCares ?? []) as { cat_id: string; logged_at: string }[]) {
      if (!lastCareMap.has(r.cat_id)) lastCareMap.set(r.cat_id, r.logged_at);
    }

    for (const c of urgentRows) {
      const last = lastCareMap.get(c.id);
      // 최근 3일 내 돌봄 있으면 스킵 (이미 누가 챙김)
      if (last && last >= staleAt) continue;
      const severity = c.health_status === "danger" ? "위험" : "주의";
      // createdAt을 "위급 진입 시점"으로 고정 → 매일 알림이 새 항목으로 뜨지 않음.
      // last_care + 3일 = 위급으로 진입한 시각. 돌봄 없으면 cat.created_at + 3일.
      const baseTs = last ? new Date(last).getTime() : new Date(c.created_at).getTime();
      const urgentSinceIso = new Date(baseTs + STALE_DAYS * 24 * 60 * 60 * 1000).toISOString();
      out.push({
        id: `urgent_${c.id}`,
        type: "urgent_in_area",
        actorName: c.region ?? "동네",
        actorAvatar: c.photo_url,
        message: last
          ? `🚨 ${severity} 상태 — ${Math.floor((Date.now() - new Date(last).getTime()) / 86400000)}일째 안부 없어요`
          : `🚨 ${severity} 상태인데 아직 돌봄 기록이 없어요`,
        targetId: c.id,
        targetName: c.name,
        createdAt: urgentSinceIso,
        isRead: false,
      });
    }
    return out;
  };

  // 5. 받은 쪽지 (읽지 않은 것 우선)
  const receivedDms = async (): Promise<NotificationItem[]> => {
    const out: NotificationItem[] = [];
    const { data: dms } = await supabase
      .from("direct_messages")
      .select("id, sender_id, sender_name, sender_avatar_url, body, is_read, created_at")
      .eq("receiver_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit);

    for (const dm of (dms ?? []) as { id: string; sender_id: string; sender_name: string | null; sender_avatar_url: string | null; body: string; is_read: boolean; created_at: string }[]) {
      out.push({
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
    return out;
  };

  const blocks = await Promise.all([
    myCatActivity(),
    myPostComments(),
    myInquiries(),
    followingActivity(),
    inviteAccepted(),
    likedCatMoves(),
    urgentInArea(),
    receivedDms(),
  ]);
  const items = blocks.flat();

  // 시간순 정렬 (최신 먼저)
  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return items.slice(0, limit);
}

// getNotifications와 동일한 이유로 독립 카운트 8종을 병렬 실행.
export async function getUnreadNotificationCount(): Promise<number> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const h24 = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const d7  = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const counts = await Promise.all([
    // 1) 읽지 않은 DM
    (async () => {
      const { count: dmCount } = await supabase
        .from("direct_messages")
        .select("*", { count: "exact", head: true })
        .eq("receiver_id", user.id)
        .eq("is_read", false);
      return dmCount ?? 0;
    })(),

    // 2) 내 고양이에 달린 최근 24h 댓글/돌봄일지 (내 것 제외)
    (async () => {
      const { data: myCats } = await supabase
        .from("cats")
        .select("id")
        .eq("caretaker_id", user.id);
      const myCatIds = (myCats ?? []).map((c: { id: string }) => c.id);
      if (myCatIds.length === 0) return 0;
      const [{ count: cc }, { count: cl }] = await Promise.all([
        supabase.from("cat_comments").select("*", { count: "exact", head: true })
          .in("cat_id", myCatIds).neq("author_id", user.id).gte("created_at", h24),
        supabase.from("care_logs").select("*", { count: "exact", head: true })
          .in("cat_id", myCatIds).neq("author_id", user.id).gte("created_at", h24),
      ]);
      return (cc ?? 0) + (cl ?? 0);
    })(),

    // 3) 내 커뮤니티 글에 달린 최근 24h 댓글 (내 것 제외)
    (async () => {
      const { data: myPosts } = await supabase
        .from("posts")
        .select("id")
        .eq("author_id", user.id);
      const myPostIds = (myPosts ?? []).map((p: { id: string }) => p.id);
      if (myPostIds.length === 0) return 0;
      const { count: pc } = await supabase
        .from("post_comments")
        .select("*", { count: "exact", head: true })
        .in("post_id", myPostIds)
        .neq("author_id", user.id)
        .gte("created_at", h24);
      return pc ?? 0;
    })(),

    // 4) 최근 7일 내 상태 바뀐 내 문의 (pending 아닌 것)
    (async () => {
      const { count: inqCount } = await supabase
        .from("inquiries")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .neq("status", "pending")
        .gte("updated_at", d7);
      return inqCount ?? 0;
    })(),

    // 5) 내가 팔로우한 유저의 최근 24h 돌봄 활동
    (async () => {
      const { data: following } = await supabase
        .from("user_follows")
        .select("following_id")
        .eq("follower_id", user.id)
        .limit(500);
      const followingIds = ((following ?? []) as { following_id: string }[]).map((r) => r.following_id);
      if (followingIds.length === 0) return 0;
      const { count: fc } = await supabase
        .from("care_logs")
        .select("*", { count: "exact", head: true })
        .in("author_id", followingIds)
        .gte("logged_at", h24);
      return fc ?? 0;
    })(),

    // 6) 최근 7일 내 내 초대 코드로 가입한 친구
    (async () => {
      const { count: inviteCount } = await supabase
        .from("invite_events")
        .select("*", { count: "exact", head: true })
        .eq("inviter_id", user.id)
        .gte("created_at", d7);
      return inviteCount ?? 0;
    })(),

    // 7) 좋아요한 고양이의 동 이동 (최근 24h, 본인 변경 제외)
    (async () => {
      const { data: myLikes2 } = await supabase
        .from("cat_likes")
        .select("cat_id")
        .eq("user_id", user.id)
        .limit(500);
      const likedIds2 = ((myLikes2 ?? []) as { cat_id: string }[]).map((r) => r.cat_id);
      if (likedIds2.length === 0) return 0;
      const { data: recentMoves } = await supabase
        .from("cat_location_history")
        .select("old_region, new_region, changed_by")
        .in("cat_id", likedIds2)
        .neq("changed_by", user.id)
        .gte("created_at", h24);
      return ((recentMoves ?? []) as {
        old_region: string | null;
        new_region: string | null;
        changed_by: string | null;
      }[]).filter((m) => (m.old_region ?? "") !== (m.new_region ?? "")).length;
    })(),

    // 8) 내 활동 지역의 위급 + 돌봄 부재 고양이
    (async () => {
      const { data: regionsForCount } = await supabase
        .from("user_activity_regions")
        .select("name")
        .eq("user_id", user.id);
      const regionNamesForCount = Array.from(new Set(((regionsForCount ?? []) as { name: string }[]).map((r) => r.name).filter(Boolean)));
      if (regionNamesForCount.length === 0) return 0;
      const STALE = 3 * 24 * 60 * 60 * 1000;
      const staleAtIso = new Date(Date.now() - STALE).toISOString();
      const { data: urgentInArea } = await supabase
        .from("cats")
        .select("id, caretaker_id")
        .in("health_status", ["caution", "danger"])
        .in("region", regionNamesForCount)
        .neq("caretaker_id", user.id)
        .limit(50);
      const urgentInAreaIds = ((urgentInArea ?? []) as { id: string; caretaker_id: string | null }[]).map((c) => c.id);
      if (urgentInAreaIds.length === 0) return 0;
      const { data: recentCares } = await supabase
        .from("care_logs")
        .select("cat_id")
        .in("cat_id", urgentInAreaIds)
        .gte("logged_at", staleAtIso);
      const recentlyCared = new Set(((recentCares ?? []) as { cat_id: string }[]).map((r) => r.cat_id));
      return urgentInAreaIds.filter((id) => !recentlyCared.has(id)).length;
    })(),
  ]);

  return counts.reduce((sum, n) => sum + n, 0);
}
