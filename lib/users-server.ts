// ══════════════════════════════════════════
// 서버 사이드 유저 프로필 조회
// ══════════════════════════════════════════

import { createClient } from "@/lib/supabase/server";
import type { Cat } from "@/lib/cats-repo";

export interface PublicUserProfile {
  id: string;
  nickname: string;
  avatar_url: string | null;
  admin_title: string | null;
  created_at: string;
}

export async function getUserProfileServer(id: string): Promise<PublicUserProfile | null> {
  if (!/^[0-9a-fA-F-]{32,36}$/.test(id)) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, nickname, email, avatar_url, admin_title, created_at")
    .eq("id", id)
    .maybeSingle();

  if (!data) return null;
  const row = data as {
    id: string;
    nickname: string | null;
    email: string | null;
    avatar_url: string | null;
    admin_title: string | null;
    created_at: string;
  };

  return {
    id: row.id,
    nickname: row.nickname ?? row.email?.split("@")[0] ?? "익명",
    avatar_url: row.avatar_url,
    admin_title: row.admin_title,
    created_at: row.created_at,
  };
}

export async function getUserFollowCountsServer(id: string): Promise<{ followers: number; following: number }> {
  const supabase = await createClient();
  const [{ count: followers }, { count: following }] = await Promise.all([
    supabase.from("user_follows").select("*", { count: "exact", head: true }).eq("following_id", id),
    supabase.from("user_follows").select("*", { count: "exact", head: true }).eq("follower_id", id),
  ]);
  return { followers: followers ?? 0, following: following ?? 0 };
}

export async function getUserCatsServer(id: string, limit = 20): Promise<Cat[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("cats")
    .select("*")
    .eq("caretaker_id", id)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as Cat[];
}

export async function getUserCareLogCountServer(id: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("care_logs")
    .select("*", { count: "exact", head: true })
    .eq("author_id", id);
  return count ?? 0;
}

// ── 공개 프로필 확장 ──

export interface PublicProfileStats {
  catCount: number;
  careLogCount: number;
  commentCount: number;
  alertCount: number;
  likesReceived: number;
  postCount: number;
  currentStreak: number;
  longestStreak: number;
}

/** 공개 프로필용 스탯 — 본인 외에 타인이 보는 숫자. */
export async function getUserPublicStatsServer(id: string): Promise<PublicProfileStats> {
  const supabase = await createClient();
  const [cats, cares, comments, alerts, likeSum, posts, careDays] = await Promise.all([
    supabase.from("cats").select("*", { count: "exact", head: true }).eq("caretaker_id", id),
    supabase.from("care_logs").select("*", { count: "exact", head: true }).eq("author_id", id),
    supabase.from("cat_comments").select("*", { count: "exact", head: true }).eq("author_id", id),
    supabase.from("cat_comments").select("*", { count: "exact", head: true }).eq("author_id", id).eq("kind", "alert"),
    supabase.from("cat_comments").select("like_count").eq("author_id", id),
    supabase.from("posts").select("*", { count: "exact", head: true }).eq("author_id", id).eq("hidden", false),
    // streak 계산용: 최근 365일 care_logs 날짜
    supabase.from("care_logs").select("logged_at").eq("author_id", id).order("logged_at", { ascending: false }).limit(1000),
  ]);

  const likesReceived = ((likeSum.data ?? []) as { like_count: number }[]).reduce(
    (sum, r) => sum + (r.like_count ?? 0),
    0,
  );

  // streak 계산 (freeze 없이 본인 공개 스탯)
  const dates = new Set<string>();
  for (const r of (careDays.data ?? []) as { logged_at: string }[]) {
    dates.add(new Date(r.logged_at).toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" }));
  }
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
  let current = 0;
  const cursor = new Date();
  if (!dates.has(today)) cursor.setDate(cursor.getDate() - 1);
  for (let i = 0; i < 366; i++) {
    const k = cursor.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
    if (dates.has(k)) {
      current += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else break;
  }
  // longest
  const sorted = Array.from(dates).sort();
  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of sorted) {
    if (prev === null) run = 1;
    else {
      const diff = Math.round(
        (new Date(d + "T00:00:00").getTime() - new Date(prev + "T00:00:00").getTime()) / 86400000,
      );
      run = diff === 1 ? run + 1 : 1;
    }
    if (run > longest) longest = run;
    prev = d;
  }

  return {
    catCount: cats.count ?? 0,
    careLogCount: cares.count ?? 0,
    commentCount: comments.count ?? 0,
    alertCount: alerts.count ?? 0,
    likesReceived,
    postCount: posts.count ?? 0,
    currentStreak: current,
    longestStreak: longest,
  };
}

export interface ActivityItem {
  kind: "care" | "comment" | "post";
  id: string;
  targetId: string;        // cat_id or post_id
  targetName: string;      // cat name or post title
  summary: string;         // 본문 요약
  createdAt: string;
}

/** 최근 활동 타임라인 — 돌봄·댓글·글 합쳐서 최신순. */
export async function getUserRecentActivityServer(
  id: string,
  limit: number = 8,
): Promise<ActivityItem[]> {
  const supabase = await createClient();
  const [logsRes, commentsRes, postsRes] = await Promise.all([
    supabase
      .from("care_logs")
      .select("id, cat_id, care_type, memo, logged_at")
      .eq("author_id", id)
      .order("logged_at", { ascending: false })
      .limit(limit),
    supabase
      .from("cat_comments")
      .select("id, cat_id, body, kind, created_at")
      .eq("author_id", id)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("posts")
      .select("id, title, created_at")
      .eq("author_id", id)
      .eq("hidden", false)
      .order("created_at", { ascending: false })
      .limit(limit),
  ]);

  // 고양이 이름 일괄 조회
  const catIds = new Set<string>();
  for (const r of (logsRes.data ?? []) as { cat_id: string }[]) catIds.add(r.cat_id);
  for (const r of (commentsRes.data ?? []) as { cat_id: string }[]) catIds.add(r.cat_id);
  const catNames = new Map<string, string>();
  if (catIds.size > 0) {
    const { data: cats } = await supabase.from("cats").select("id, name").in("id", Array.from(catIds));
    for (const c of (cats ?? []) as { id: string; name: string }[]) catNames.set(c.id, c.name);
  }

  const careTypeLabels: Record<string, string> = {
    feed: "밥을 챙겼어요",
    water: "물을 줬어요",
    health: "건강 체크를 했어요",
    tnr: "TNR 기록",
    hospital: "병원 방문",
    shelter: "쉼터 관리",
    treat: "간식을 줬어요",
    other: "돌봄 기록",
  };

  const items: ActivityItem[] = [];

  for (const r of (logsRes.data ?? []) as {
    id: string; cat_id: string; care_type: string; memo: string | null; logged_at: string;
  }[]) {
    items.push({
      kind: "care",
      id: `care_${r.id}`,
      targetId: r.cat_id,
      targetName: catNames.get(r.cat_id) ?? "고양이",
      summary: careTypeLabels[r.care_type] ?? "돌봄",
      createdAt: r.logged_at,
    });
  }

  for (const r of (commentsRes.data ?? []) as {
    id: string; cat_id: string; body: string | null; kind: string; created_at: string;
  }[]) {
    const isAlert = r.kind === "alert";
    const body = r.body?.trim() ?? "";
    items.push({
      kind: "comment",
      id: `cmt_${r.id}`,
      targetId: r.cat_id,
      targetName: catNames.get(r.cat_id) ?? "고양이",
      summary: isAlert
        ? "⚠️ 학대/위험 신고"
        : body.length > 40
          ? body.slice(0, 40) + "…"
          : body || "댓글 작성",
      createdAt: r.created_at,
    });
  }

  for (const r of (postsRes.data ?? []) as {
    id: string; title: string; created_at: string;
  }[]) {
    items.push({
      kind: "post",
      id: `post_${r.id}`,
      targetId: r.id,
      targetName: r.title,
      summary: "커뮤니티 글 작성",
      createdAt: r.created_at,
    });
  }

  return items
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
}

/** 유저의 활동 지역 (user_activity_regions). */
export async function getUserRegionsServer(
  id: string,
): Promise<{ name: string; radius_m: number; is_primary: boolean }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_activity_regions")
    .select("name, radius_m, is_primary, slot")
    .eq("user_id", id)
    .order("slot", { ascending: true });
  return (data ?? []) as { name: string; radius_m: number; is_primary: boolean }[];
}
