// ══════════════════════════════════════════
// 실시간 동네 피드 — 최근 돌봄·댓글 통합
// 주 활동 지역 설정되어 있으면 반경 내 고양이만 필터
// ══════════════════════════════════════════

import { createClient } from "@/lib/supabase/client";
import { distanceMeters, type ActivityRegion } from "@/lib/activity-regions-repo";

export type FeedType = "care" | "comment";

export interface FeedItem {
  id: string;
  type: FeedType;
  subType: string; // care_type 또는 comment kind
  actorName: string;
  actorAvatar: string | null;
  catId: string;
  catName: string;
  catRegion: string | null;
  catPhoto: string | null;
  message: string;
  createdAt: string;
}

const CARE_LABELS: Record<string, string> = {
  feed: "밥을 줬어요 🍚",
  water: "물을 줬어요 💧",
  health: "건강 체크를 했어요 🩺",
  tnr: "TNR 기록을 남겼어요 ✂️",
  hospital: "병원 방문을 기록했어요 🏥",
  shelter: "쉼터를 관리했어요 🏠",
  other: "돌봄 기록을 남겼어요 📝",
};

interface Options {
  limit?: number;
  hours?: number;
  region?: ActivityRegion | null; // 주 활동 지역으로 필터 (옵션)
}

export async function getRecentFeed(opts: Options = {}): Promise<FeedItem[]> {
  const supabase = createClient();
  const hours = opts.hours ?? 24;
  const limit = opts.limit ?? 20;
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  // 고양이 맵 먼저 조회 — 필터용 좌표 + 이미지·이름·지역
  // care_logs + cat_comments 가져온 뒤 cat_id로 조인
  const [careRes, commentRes] = await Promise.all([
    supabase
      .from("care_logs")
      .select("id, cat_id, author_id, author_name, author_avatar_url, care_type, memo, logged_at")
      .gte("logged_at", since)
      .order("logged_at", { ascending: false })
      .limit(60),
    supabase
      .from("cat_comments")
      .select("id, cat_id, author_id, author_name, author_avatar_url, body, kind, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(60),
  ]);

  const careRows = (careRes.data ?? []) as {
    id: string; cat_id: string; author_id: string | null; author_name: string | null;
    author_avatar_url: string | null; care_type: string; memo: string | null; logged_at: string;
  }[];
  const commentRows = (commentRes.data ?? []) as {
    id: string; cat_id: string; author_id: string | null; author_name: string | null;
    author_avatar_url: string | null; body: string | null; kind: string; created_at: string;
  }[];

  // 관련 고양이 id 수집
  const catIds = new Set<string>();
  careRows.forEach((r) => catIds.add(r.cat_id));
  commentRows.forEach((r) => catIds.add(r.cat_id));
  if (catIds.size === 0) return [];

  const { data: catRows } = await supabase
    .from("cats")
    .select("id, name, region, photo_url, lat, lng")
    .in("id", Array.from(catIds));

  type CatRow = { id: string; name: string; region: string | null; photo_url: string | null; lat: number; lng: number };
  const catMap = new Map<string, CatRow>();
  for (const c of (catRows ?? []) as CatRow[]) {
    catMap.set(c.id, c);
  }

  const inRegion = (catId: string): boolean => {
    if (!opts.region) return true;
    const cat = catMap.get(catId);
    if (!cat) return false;
    return distanceMeters(
      { lat: cat.lat, lng: cat.lng },
      { lat: opts.region.lat, lng: opts.region.lng },
    ) <= opts.region.radius_m;
  };

  const items: FeedItem[] = [];

  for (const r of careRows) {
    if (!inRegion(r.cat_id)) continue;
    const cat = catMap.get(r.cat_id);
    if (!cat) continue;
    items.push({
      id: `care_${r.id}`,
      type: "care",
      subType: r.care_type,
      actorName: r.author_name ?? "익명",
      actorAvatar: r.author_avatar_url,
      catId: r.cat_id,
      catName: cat.name,
      catRegion: cat.region,
      catPhoto: cat.photo_url,
      message: CARE_LABELS[r.care_type] ?? "돌봄 기록을 남겼어요",
      createdAt: r.logged_at,
    });
  }

  for (const r of commentRows) {
    if (!inRegion(r.cat_id)) continue;
    const cat = catMap.get(r.cat_id);
    if (!cat) continue;
    const isAlert = r.kind === "alert";
    const preview = (r.body ?? "").replace(/\s+/g, " ").trim().slice(0, 30);
    items.push({
      id: `comment_${r.id}`,
      type: "comment",
      subType: r.kind,
      actorName: r.author_name ?? "익명",
      actorAvatar: r.author_avatar_url,
      catId: r.cat_id,
      catName: cat.name,
      catRegion: cat.region,
      catPhoto: cat.photo_url,
      message: isAlert
        ? "⚠️ 학대/위험 신고를 남겼어요"
        : preview
          ? `💬 "${preview}${r.body && r.body.length > 30 ? "…" : ""}"`
          : "💬 댓글을 남겼어요",
      createdAt: r.created_at,
    });
  }

  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return items.slice(0, limit);
}
