// ══════════════════════════════════════════
// 주간 리더보드 — 돌봄 왕 / 인기 고양이
// KST(Asia/Seoul) 기준 주(월~일)
// ══════════════════════════════════════════

import { createClient } from "@/lib/supabase/client";

export interface CaretakerRank {
  userId: string;
  name: string;
  avatarUrl: string | null;
  careCount: number;
  level: number | null;
}

export interface PopularCat {
  id: string;
  name: string;
  region: string | null;
  photo_url: string | null;
  like_count: number;
  comment_count: number; // 이번 주 댓글 수
  score: number;         // 가중 점수
}

// 이번 주 월요일 0시(KST)의 UTC ISO
function thisMondayKstISO(): string {
  const now = new Date();
  const kstNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const day = kstNow.getDay();
  const daysSinceMonday = (day + 6) % 7;
  const kstMon = new Date(kstNow);
  kstMon.setHours(0, 0, 0, 0);
  kstMon.setDate(kstMon.getDate() - daysSinceMonday);
  const offsetMinutes = new Date().getTimezoneOffset() - (-540);
  const utcMs = kstMon.getTime() - offsetMinutes * 60 * 1000;
  return new Date(utcMs).toISOString();
}

// ══════════════════════════════════════════
// 1. 돌봄 왕 TOP N — care_logs 이번 주 작성자별
// ══════════════════════════════════════════
export async function getWeeklyCaretakerRanking(limit = 3): Promise<CaretakerRank[]> {
  const supabase = createClient();
  const since = thisMondayKstISO();

  const { data, error } = await supabase
    .from("care_logs")
    .select("author_id, author_name, author_avatar_url")
    .gte("logged_at", since)
    .not("author_id", "is", null)
    .limit(1000);

  if (error || !data) return [];

  // author_id별 집계
  const map = new Map<string, CaretakerRank>();
  for (const row of data as { author_id: string; author_name: string | null; author_avatar_url: string | null }[]) {
    const existing = map.get(row.author_id);
    if (existing) {
      existing.careCount += 1;
    } else {
      map.set(row.author_id, {
        userId: row.author_id,
        name: row.author_name ?? "익명",
        avatarUrl: row.author_avatar_url,
        careCount: 1,
        level: null,
      });
    }
  }

  const sorted = Array.from(map.values()).sort((a, b) => b.careCount - a.careCount).slice(0, limit);
  return sorted;
}

// ══════════════════════════════════════════
// 2. 인기 고양이 TOP N — like_count + 이번 주 댓글수
// ══════════════════════════════════════════
export async function getWeeklyPopularCats(limit = 5): Promise<PopularCat[]> {
  const supabase = createClient();
  const since = thisMondayKstISO();

  // 이번 주 댓글 수집 → cat_id별 count
  const { data: comments } = await supabase
    .from("cat_comments")
    .select("cat_id")
    .gte("created_at", since)
    .limit(2000);

  const commentCountMap = new Map<string, number>();
  for (const c of (comments ?? []) as { cat_id: string }[]) {
    commentCountMap.set(c.cat_id, (commentCountMap.get(c.cat_id) ?? 0) + 1);
  }

  // 전체 고양이 중 like_count 또는 주간 댓글이 있는 것만 관심
  const { data: cats } = await supabase
    .from("cats")
    .select("id, name, region, photo_url, like_count")
    .order("like_count", { ascending: false })
    .limit(50);

  const ranked: PopularCat[] = ((cats ?? []) as { id: string; name: string; region: string | null; photo_url: string | null; like_count: number }[]).map((c) => {
    const commentCount = commentCountMap.get(c.id) ?? 0;
    const score = (c.like_count ?? 0) * 3 + commentCount * 2;
    return {
      id: c.id,
      name: c.name,
      region: c.region,
      photo_url: c.photo_url,
      like_count: c.like_count ?? 0,
      comment_count: commentCount,
      score,
    };
  });

  // score > 0 만 랭킹
  return ranked.filter((r) => r.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
}
