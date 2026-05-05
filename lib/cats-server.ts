// ══════════════════════════════════════════
// 서버 사이드 cats 조회 (RSC/라우트 핸들러 전용)
// ══════════════════════════════════════════

import { createClient } from "@/lib/supabase/server";
import { createAnonClient } from "@/lib/supabase/anon";
import type { Cat } from "@/lib/cats-repo";
import { isSafeImageUrl } from "@/lib/url-validate";

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

// ── 고양이 다이어리: 사진이 첨부된 cat_comments를 시간순으로 모음 ──
export interface DiaryEntry {
  id: string;
  photo_url: string;
  body: string;
  author_name: string | null;
  author_avatar_url: string | null;
  created_at: string;
}

export interface CatDiary {
  entries: DiaryEntry[];
  totalPhotos: number;     // 사진이 달린 댓글 총 수 (limit 무관 전체 카운트)
  uniqueDays: number;      // 사진이 올라온 고유 날짜 수 (KST)
}

export async function getCatDiaryServer(catId: string, limit = 60): Promise<CatDiary> {
  if (!/^[0-9a-fA-F-]{32,36}$/.test(catId)) {
    return { entries: [], totalPhotos: 0, uniqueDays: 0 };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("cat_comments")
    .select("id, photo_url, body, author_name, author_avatar_url, created_at")
    .eq("cat_id", catId)
    .not("photo_url", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[cats-server] getCatDiaryServer failed:", error);
    return { entries: [], totalPhotos: 0, uniqueDays: 0 };
  }

  // 안전한 URL만 통과 — 카운트와 그리드가 일치하도록 같은 필터 적용
  const entries = ((data ?? []) as DiaryEntry[]).filter((e) => isSafeImageUrl(e.photo_url));

  // 고유 날짜 수 (KST 기준)
  const dayKeys = new Set(
    entries.map((e) =>
      new Date(e.created_at).toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" }),
    ),
  );

  return {
    entries,
    totalPhotos: entries.length,
    uniqueDays: dayKeys.size,
  };
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

/**
 * 긴급 구조 피드 — health_status='danger' 고양이만.
 * /rescue 페이지용.
 */
export async function getRescueCatsServer(limit: number = 50): Promise<Cat[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cats")
    .select("*")
    .eq("health_status", "danger")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[cats-server] getRescueCatsServer failed:", error);
    return [];
  }
  return (data ?? []) as Cat[];
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
 * region은 자유 입력 필드라 gu/dong을 ilike 매칭하되,
 * 서울 외 지역의 동명이 substring으로 잡히는 false positive 방지를 위해
 * "서울" 포함을 AND 조건으로 강제 (예: '구로구 궁동' vs '수원 행궁동').
 *
 * 단, 사용자가 region에 구 이름만 정확히 적은 경우(예: "구로구")는
 * "서울" 단어가 없어도 잡히도록 gu 이름 매치는 OR로 별도 추가.
 */
export async function getCatsByRegionServer(
  guName: string,
  dongs: string[],
  limit = 24,
): Promise<Array<Pick<Cat, "id" | "name" | "region" | "photo_url" | "like_count" | "health_status" | "created_at" | "description">>> {
  const supabase = createAnonClient();
  // 구 이름은 서울 25개 구가 모두 unique → context 없이도 단독 매치 안전.
  // 동 이름은 substring 충돌이 흔해 "서울"과 AND 조건으로만 매치.
  const dongClauses = dongs.map((d) => `and(region.ilike.%서울%,region.ilike.%${d}%)`);
  const orClauses = [`region.ilike.%${guName}%`, ...dongClauses].join(",");
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
  const dongClauses = dongs.map((d) => `and(region.ilike.%서울%,region.ilike.%${d}%)`);
  const orClauses = [`region.ilike.%${guName}%`, ...dongClauses].join(",");
  const { count } = await supabase
    .from("cats")
    .select("*", { count: "exact", head: true })
    .or(orClauses);
  return count ?? 0;
}
