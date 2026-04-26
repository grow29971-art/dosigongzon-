// 통합 검색 API — 고양이(공개)·게시글(hidden 제외)·병원·보호지침 가이드
//
// GET /api/search?q=검색어&type=all|cats|posts|hospitals|guides
// - anon 클라이언트로 접근 → RLS가 자동으로 hidden 필터 적용
// - 유저 위치 정확한 좌표는 DB의 region 퍼징된 값으로만 노출

import { createAnonClient } from "@/lib/supabase/anon";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

type SearchType = "all" | "cats" | "posts" | "hospitals" | "guides" | "users";

// ilike 패턴용 이스케이프 (% _ 문자를 literal로)
function escapeForIlike(raw: string): string {
  return raw.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

// 하드코딩된 보호지침 가이드 — 정적 매핑
const GUIDE_ITEMS = [
  { slug: "emergency-guide", title: "길고양이 응급 구조·응급처치 완벽 가이드", keywords: ["응급", "구조", "로드킬", "출혈", "골절", "중독", "경련", "다친"] },
  { slug: "kitten-guide", title: "새끼 고양이(냥줍) 발견했을 때 완벽 가이드", keywords: ["새끼", "냥줍", "아기", "어린", "체온", "분유", "KMR"] },
  { slug: "feeding-guide", title: "길고양이 먹이 가이드 — 안전한 급식 완벽 정리", keywords: ["먹이", "사료", "급식", "물", "음식", "간식", "급여"] },
  { slug: "disease-guide", title: "길고양이가 자주 걸리는 질병 가이드", keywords: ["질병", "감기", "허피스", "칼리시", "범백", "FeLV", "FIP", "구내염", "피부병", "곰팡이", "진드기", "기생충", "신장"] },
  { slug: "shelter-guide", title: "길고양이 겨울나기·숨숨집 만들기 완벽 가이드", keywords: ["쉼터", "숨숨집", "겨울", "보온", "스티로폼", "담요", "짚"] },
  { slug: "trapping-guide", title: "길고양이 TNR 포획 방법 — 포획틀 설치부터 방사까지", keywords: ["TNR", "포획", "포획틀", "통덫", "중성화", "이어팁", "방사"] },
  { slug: "pharmacy-guide", title: "길고양이 약품·영양제 가이드", keywords: ["약품", "영양제", "구충제", "동물약국", "안약", "상처", "응급약"] },
  { slug: "legal", title: "길고양이 학대 신고·동물보호법 완벽 가이드", keywords: ["학대", "신고", "법률", "동물보호법", "처벌", "증거"] },
  { slug: "district-contacts", title: "구청 연락처 — 시·군·구별 동물보호 담당부서", keywords: ["구청", "연락처", "동물보호팀", "민원"] },
];

function searchGuides(query: string): Array<{ slug: string; title: string }> {
  const q = query.toLowerCase();
  return GUIDE_ITEMS
    .filter((g) => {
      const titleMatch = g.title.toLowerCase().includes(q);
      const keywordMatch = g.keywords.some((k) => k.toLowerCase().includes(q) || q.includes(k.toLowerCase()));
      return titleMatch || keywordMatch;
    })
    .map(({ slug, title }) => ({ slug, title }));
}

export async function GET(request: Request) {
  const ip = getClientIp(request);
  if (!rateLimit(`search:${ip}`, { max: 30, windowMs: 60_000 })) {
    return Response.json({ error: "잠시 후 다시 시도해주세요." }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const rawQuery = (searchParams.get("q") ?? "").trim();
  const type = (searchParams.get("type") ?? "all") as SearchType;

  // 2자 미만은 너무 짧아서 결과 과다 → 거절
  if (rawQuery.length < 2) {
    return Response.json({
      query: rawQuery,
      cats: [], posts: [], hospitals: [], guides: [],
      counts: { cats: 0, posts: 0, hospitals: 0, guides: 0 },
      tooShort: true,
    });
  }
  // 64자 초과는 잘라냄
  const query = rawQuery.slice(0, 64);
  const ilikePattern = `%${escapeForIlike(query)}%`;

  const supabase = createAnonClient();

  const includeCats = type === "all" || type === "cats";
  const includePosts = type === "all" || type === "posts";
  const includeHospitals = type === "all" || type === "hospitals";
  const includeGuides = type === "all" || type === "guides";
  const includeUsers = type === "all" || type === "users";

  const [catsRes, postsRes, hospitalsRes, usersRes] = await Promise.all([
    includeCats
      ? supabase
          .from("cats")
          .select("id, name, region, photo_url, health_status, like_count")
          .eq("hidden", false)
          .or(`name.ilike.${ilikePattern},description.ilike.${ilikePattern},region.ilike.${ilikePattern}`)
          .order("created_at", { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string; region: string | null; photo_url: string | null; health_status: string; like_count: number | null }>, error: null }),
    includePosts
      ? supabase
          .from("posts")
          .select("id, title, content, category, author_name, author_avatar_url, created_at, view_count, comment_count")
          .eq("hidden", false)
          .or(`title.ilike.${ilikePattern},content.ilike.${ilikePattern}`)
          .order("created_at", { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] as Array<{ id: string; title: string; content: string; category: string; author_name: string | null; author_avatar_url: string | null; created_at: string; view_count: number | null; comment_count: number | null }>, error: null }),
    includeHospitals
      ? supabase
          .from("rescue_hospitals")
          .select("id, name, address, district, phone")
          .eq("hidden", false)
          .or(`name.ilike.${ilikePattern},address.ilike.${ilikePattern},district.ilike.${ilikePattern}`)
          .order("pinned", { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string; address: string | null; district: string | null; phone: string | null }>, error: null }),
    includeUsers
      ? supabase
          .from("profiles")
          .select("id, nickname, avatar_url, admin_title")
          .eq("suspended", false)
          .ilike("nickname", ilikePattern)
          .limit(15)
      : Promise.resolve({ data: [] as Array<{ id: string; nickname: string | null; avatar_url: string | null; admin_title: string | null }>, error: null }),
  ]);

  const cats = catsRes.data ?? [];
  const posts = postsRes.data ?? [];
  const hospitals = hospitalsRes.data ?? [];
  const users = (usersRes.data ?? []).map((u) => ({
    id: u.id,
    nickname: u.nickname ?? "익명",
    avatar_url: u.avatar_url,
    admin_title: u.admin_title,
  }));
  const guides = includeGuides ? searchGuides(query) : [];

  // 게시글 본문은 일부만 반환 (성능)
  const trimmedPosts = posts.map((p) => ({
    ...p,
    content: p.content.length > 150 ? p.content.slice(0, 150) + "…" : p.content,
  }));

  return Response.json(
    {
      query,
      cats,
      posts: trimmedPosts,
      hospitals,
      users,
      guides,
      counts: {
        cats: cats.length,
        posts: posts.length,
        hospitals: hospitals.length,
        users: users.length,
        guides: guides.length,
      },
    },
    {
      headers: {
        // 같은 쿼리는 5분간 캐시. q는 query string에 들어가 자동 키.
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    },
  );
}
