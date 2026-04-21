// ══════════════════════════════════════════
// 서버 사이드 cats 조회 (RSC/라우트 핸들러 전용)
// ══════════════════════════════════════════

import { createClient } from "@/lib/supabase/server";
import { createAnonClient } from "@/lib/supabase/anon";
import type { Cat } from "@/lib/cats-repo";

export async function getCatByIdServer(id: string): Promise<Cat | null> {
  // UUID 형식이 아니면 즉시 null (400 회피)
  if (!/^[0-9a-fA-F-]{32,36}$/.test(id)) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cats")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[cats-server] getCatByIdServer failed:", error);
    return null;
  }
  return (data as Cat | null) ?? null;
}

export async function getCatCommentsCountServer(id: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("cat_comments")
    .select("*", { count: "exact", head: true })
    .eq("cat_id", id);
  return count ?? 0;
}

export async function getCatCareLogsCountServer(id: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("care_logs")
    .select("*", { count: "exact", head: true })
    .eq("cat_id", id);
  return count ?? 0;
}

export interface CatCommunityStats {
  uniqueCaretakers: number;         // 이 고양이를 돌본 unique 유저 수
  recentCaretakers: {               // 최근 돌본 이웃 프로필 (최대 3명)
    authorId: string;
    name: string;
    avatarUrl: string | null;
  }[];
  likeUserCount: number;            // 좋아요한 unique 유저 수 (사회적 증명용)
}

export async function getCatCommunityStatsServer(
  catId: string,
): Promise<CatCommunityStats> {
  const supabase = await createClient();

  // 최근 30일치 돌봄 기록의 author 정보 — 최대 100건
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const [logsRes, likeRes] = await Promise.all([
    supabase
      .from("care_logs")
      .select("author_id, author_name, author_avatar_url, logged_at")
      .eq("cat_id", catId)
      .gte("logged_at", since)
      .order("logged_at", { ascending: false })
      .limit(100),
    supabase
      .from("cat_likes")
      .select("*", { count: "exact", head: true })
      .eq("cat_id", catId),
  ]);

  const rows = (logsRes.data ?? []) as {
    author_id: string | null;
    author_name: string | null;
    author_avatar_url: string | null;
    logged_at: string;
  }[];

  // unique 유저 추출 — 같은 author가 여러 번 기록했으면 최신 1건만
  const seen = new Set<string>();
  const recent: CatCommunityStats["recentCaretakers"] = [];
  for (const r of rows) {
    if (!r.author_id || seen.has(r.author_id)) continue;
    seen.add(r.author_id);
    if (recent.length < 3) {
      recent.push({
        authorId: r.author_id,
        name: r.author_name ?? "익명",
        avatarUrl: r.author_avatar_url,
      });
    }
  }

  return {
    uniqueCaretakers: seen.size,
    recentCaretakers: recent,
    likeUserCount: likeRes.count ?? 0,
  };
}

/**
 * 특정 구/동 리스트에 해당하는 고양이를 최신순으로 조회 (SEO 랜딩용).
 * region은 자유 입력 필드라 gu 이름과 dongs를 OR 조건으로 ilike 매칭.
 */
export async function getCatsByRegionServer(
  guName: string,
  dongs: string[],
  limit = 24,
): Promise<Array<Pick<Cat, "id" | "name" | "region" | "photo_url" | "like_count" | "health_status" | "created_at" | "description">>> {
  // ISR/SSG 호환을 위해 cookie-less anon 클라이언트 사용
  const supabase = createAnonClient();
  const terms = [guName, ...dongs];
  const orClauses = terms.map((t) => `region.ilike.%${t}%`).join(",");
  const { data, error } = await supabase
    .from("cats")
    .select("id, name, region, photo_url, like_count, health_status, created_at, description")
    .or(orClauses)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[cats-server] getCatsByRegionServer failed:", error);
    return [];
  }
  return (data ?? []) as never;
}

export async function getCatCountByRegionServer(
  guName: string,
  dongs: string[],
): Promise<number> {
  const supabase = createAnonClient();
  const terms = [guName, ...dongs];
  const orClauses = terms.map((t) => `region.ilike.%${t}%`).join(",");
  const { count } = await supabase
    .from("cats")
    .select("*", { count: "exact", head: true })
    .or(orClauses);
  return count ?? 0;
}
