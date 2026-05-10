// ══════════════════════════════════════════
// 동물 YouTube shorts 자동 임포트
// (길고양이 사이트지만 모든 동물 숏츠를 폭넓게 수집해 둠 — 도시공존 컨셉)
// Vercel Cron: 매일 09:00 KST (= 0:00 UTC)
// 수동 호출: 관리자 로그인 상태에서 GET 호출 가능
// ══════════════════════════════════════════

import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { searchShorts, getVideoStats, YouTubeApiError, type YouTubeSearchItem } from "@/lib/youtube-api";

export const maxDuration = 60;

// 검색어 풀 — 매 호출마다 랜덤으로 N개 골라서 검색.
// ⚠ 한국 채널/한국어 영상만 임포트하는 게 목적이라 한국어 키워드만 사용.
//   영문 키워드는 regionCode=KR 무시되고 글로벌 결과가 자주 나와서 제외함.
//   추가 안전장치로 아래 hasKorean() 필터에서 한글 없는 영상은 컷.
const QUERY_POOL = [
  // ── 고양이 (사이트 메인 컨셉 — 비중 유지) ──
  "고양이 shorts",
  "길고양이 shorts",
  "새끼고양이 shorts",
  "아기고양이 shorts",
  "냥이 shorts",
  "야옹이 shorts",
  "냥스타그램 shorts",
  "귀여운 고양이 shorts",
  "웃긴 고양이 shorts",
  "슬픈 고양이 shorts",
  "신기한 고양이 shorts",
  "이상한 고양이 shorts",
  "재밌는 고양이 shorts",
  "고양이 밈 shorts",
  "고양이 짤 shorts",
  "치즈고양이 shorts",
  "삼색이 shorts",
  "고등어 고양이 shorts",
  "턱시도 고양이 shorts",
  "검은 고양이 shorts",
  "스코티시폴드 shorts",
  "랙돌 고양이 shorts",
  "먼치킨 shorts",
  "페르시안 shorts",

  // ── 강아지/개 ──
  "강아지 shorts",
  "댕댕이 shorts",
  "아기 강아지 shorts",
  "퍼피 shorts",
  "멍멍이 shorts",
  "귀여운 강아지 shorts",
  "웃긴 강아지 shorts",
  "슬픈 강아지 shorts",
  "신기한 강아지 shorts",
  "재밌는 강아지 shorts",
  "강아지 밈 shorts",
  "유기견 shorts",
  "포메라니안 shorts",
  "시바견 shorts",
  "말티즈 shorts",
  "리트리버 shorts",
  "푸들 shorts",

  // ── 소동물 (햄스터/토끼/고슴도치/기니피그/페럿/친칠라) ──
  "햄스터 shorts",
  "햄찌 shorts",
  "귀여운 햄스터 shorts",
  "웃긴 햄스터 shorts",
  "햄스터 밈 shorts",
  "토끼 shorts",
  "아기 토끼 shorts",
  "귀여운 토끼 shorts",
  "토끼 밈 shorts",
  "고슴도치 shorts",
  "기니피그 shorts",
  "페럿 shorts",
  "친칠라 shorts",

  // ── 야생/이국적 ──
  "다람쥐 shorts",
  "너구리 shorts",
  "라쿤 밈 shorts",
  "카피바라 shorts",
  "카피바라 밈 shorts",
  "미어캣 shorts",
  "코알라 shorts",
  "판다 shorts",
  "아기 판다 shorts",
  "레서판다 shorts",
  "수달 shorts",
  "여우 shorts",
  "늑대 shorts",
  "곰 shorts",
  "아기 곰 shorts",
  "호랑이 shorts",
  "사자 shorts",
  "코끼리 shorts",
  "기린 shorts",
  "원숭이 shorts",

  // ── 조류 ──
  "앵무새 shorts",
  "잉꼬 shorts",
  "부엉이 shorts",
  "올빼미 shorts",
  "병아리 shorts",
  "오리 shorts",
  "아기 오리 shorts",
  "펭귄 shorts",
  "아기 펭귄 shorts",

  // ── 농장/대형 ──
  "돼지 shorts",
  "아기 돼지 shorts",
  "미니피그 shorts",
  "양 shorts",
  "아기 양 shorts",
  "염소 shorts",
  "아기 염소 shorts",
  "소 shorts",
  "송아지 shorts",
  "말 shorts",
  "조랑말 shorts",
  "알파카 shorts",
  "라마 shorts",

  // ── 수생/파충류 ──
  "돌고래 shorts",
  "물범 shorts",
  "바다표범 shorts",
  "거북이 shorts",
  "악솔로틀 shorts",
  "도마뱀 shorts",
  "개구리 shorts",

  // ── 동물 일반 / 감정 / 밈 ──
  "귀여운 동물 shorts",
  "웃긴 동물 shorts",
  "슬픈 동물 shorts",
  "이상한 동물 shorts",
  "신기한 동물 shorts",
  "재밌는 동물 shorts",
  "동물 밈 shorts",
  "동물 짤 shorts",
  "동물 영상 shorts",
  "동물 모음 shorts",
  "동물 친구 shorts",
  "동물 우정 shorts",
  "아기 동물 shorts",
  "동물 구조 shorts",
  "유기동물 shorts",
  "동물농장 shorts",
  "TV 동물농장 shorts",
];

// 한글 자/모음 또는 완성형 음절 1자 이상 포함 여부.
// 결과 후처리 필터 — 제목·채널명 둘 다 한글 없으면 외국 영상으로 보고 컷.
function hasKorean(text: string): boolean {
  return /[ㄱ-ㆎ가-힣]/.test(text);
}

// 정렬 옵션 풀 — 매 호출마다 랜덤 선택. 동일 키워드라도 정렬 다르면 결과 달라짐.
const ORDER_POOL: Array<"date" | "viewCount" | "relevance"> = [
  "date",
  "viewCount",
  "relevance",
];

// 한 번 호출 시 검색할 키워드 개수 + 키워드당 가져올 개수
// search.list = 100 units/call. QUERIES_PER_CALL × 100 + (videos.list ~1) = 호출당 비용.
// 무료 쿼터 10,000/day → QUERIES_PER_CALL=3 면 ~33회/일 가능 (5면 ~20회/일).
const QUERIES_PER_CALL = 3;
const PER_QUERY_LIMIT = 30;

// 최소 조회수 기준 — 이 미만은 임포트 스킵 (퀄리티 통제)
const MIN_VIEW_COUNT = 10_000;

function pickRandom<T>(arr: readonly T[], n: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(n, copy.length));
}

async function isAuthorized(request: Request): Promise<{ ok: boolean; reason?: string }> {
  // 1) Vercel Cron 호출 — Authorization: Bearer <CRON_SECRET>
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return { ok: true };
  }
  // 2) 관리자 로그인 — 쿠키 기반
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, reason: "로그인이 필요해요." };
    const { data } = await supabase
      .from("admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) return { ok: true };
    return { ok: false, reason: "관리자만 접근할 수 있어요." };
  } catch (err) {
    console.error("[import-shorts] auth check failed:", err);
    return { ok: false, reason: "인증 확인 중 오류가 발생했어요." };
  }
}

async function handle(request: Request): Promise<Response> {
  const auth = await isAuthorized(request);
  if (!auth.ok) {
    return Response.json({ error: auth.reason ?? "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    return Response.json(
      { error: "Supabase 환경변수가 설정되지 않았습니다." },
      { status: 500 },
    );
  }

  // 서비스 롤 클라이언트 — RLS 우회로 안정적인 쓰기
  const supabase = createServiceClient(supabaseUrl, supabaseServiceKey);

  // 기존 video_id 수집 → 중복 차단
  // PostgREST 기본 limit이 1000이라 페이지네이션으로 전부 가져와야 함.
  // (안 그러면 1000번째 이후 영상이 "신규"로 판단되어 중복 insert → unique constraint 충돌)
  const existingIds = new Set<string>();
  const PAGE_SIZE = 1000;
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data: page, error: existingErr } = await supabase
      .from("shorts")
      .select("youtube_video_id")
      .not("youtube_video_id", "is", null)
      .range(from, from + PAGE_SIZE - 1);
    if (existingErr) {
      console.error("[import-shorts] existing fetch failed:", existingErr);
      return Response.json({ error: "기존 영상 조회 실패" }, { status: 500 });
    }
    if (!page || page.length === 0) break;
    for (const row of page) {
      const id = row.youtube_video_id as string | null;
      if (id) existingIds.add(id);
    }
    if (page.length < PAGE_SIZE) break;
  }

  let totalAdded = 0;
  const queryResults: {
    query: string;
    found: number;
    newAfterDedup: number;
    passedKoreanFilter: number;
    passedViewFilter: number;
    added: number;
    error?: string;
  }[] = [];

  // 이번 호출에서 사용할 검색어 + 정렬 (매번 랜덤)
  const queries = pickRandom(QUERY_POOL, QUERIES_PER_CALL);
  const order = ORDER_POOL[Math.floor(Math.random() * ORDER_POOL.length)];

  for (const query of queries) {
    try {
      const items = await searchShorts(query, PER_QUERY_LIMIT, order);

      // 1) DB 중복 제외
      const newOnes = items.filter((it) => !existingIds.has(it.videoId));

      // 2) 한국 영상만 — 제목 또는 채널명에 한글 1자 이상
      const koreanOnly = newOnes.filter(
        (it) => hasKorean(it.title) || hasKorean(it.channelTitle),
      );

      let passedViewFilter = 0;
      let qualified: YouTubeSearchItem[] = [];

      if (koreanOnly.length > 0) {
        // 3) 조회수 일괄 조회 후 MIN_VIEW_COUNT 미만 필터링
        const stats = await getVideoStats(koreanOnly.map((it) => it.videoId));
        qualified = koreanOnly.filter((it) => {
          const s = stats.get(it.videoId);
          return s && s.viewCount >= MIN_VIEW_COUNT;
        });
        passedViewFilter = qualified.length;
      }

      if (qualified.length > 0) {
        const rows = qualified.map((it: YouTubeSearchItem) => ({
          title: it.title || "(제목 없음)",
          description: it.description || null,
          video_url: null,
          youtube_url: `https://www.youtube.com/shorts/${it.videoId}`,
          youtube_video_id: it.videoId,
          youtube_channel_name: it.channelTitle || null,
          youtube_channel_url: it.channelId
            ? `https://www.youtube.com/channel/${it.channelId}`
            : null,
          thumbnail_url: it.thumbnailUrl || null,
          duration_sec: null,
          width: null,
          height: null,
          sort_order: 0,
          pinned: false,
          published: true,           // 자동 임포트는 즉시 공개. 문제 있으면 admin이 숨김 토글.
          published_at: it.publishedAt,
        }));

        const { error: insertErr } = await supabase.from("shorts").insert(rows);
        if (insertErr) {
          console.error(`[import-shorts] insert "${query}" failed:`, insertErr);
          queryResults.push({
            query,
            found: items.length,
            newAfterDedup: newOnes.length,
            passedKoreanFilter: koreanOnly.length,
            passedViewFilter,
            added: 0,
            error: insertErr.message,
          });
          continue;
        }
        rows.forEach((r) => existingIds.add(r.youtube_video_id));
        totalAdded += rows.length;
      }
      queryResults.push({
        query,
        found: items.length,
        newAfterDedup: newOnes.length,
        passedKoreanFilter: koreanOnly.length,
        passedViewFilter,
        added: qualified.length,
      });
    } catch (err) {
      const msg = err instanceof YouTubeApiError ? err.message
        : err instanceof Error ? err.message
        : "알 수 없는 오류";
      console.error(`[import-shorts] query "${query}" failed:`, err);
      queryResults.push({
        query, found: 0, newAfterDedup: 0,
        passedKoreanFilter: 0, passedViewFilter: 0, added: 0, error: msg,
      });
    }
  }

  return Response.json({
    ok: true,
    totalAdded,
    order,
    minViewCount: MIN_VIEW_COUNT,
    queryResults,
    timestamp: new Date().toISOString(),
  });
}

export async function GET(request: Request) { return handle(request); }
export async function POST(request: Request) { return handle(request); }
