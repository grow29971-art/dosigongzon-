// ══════════════════════════════════════════
// 길고양이 YouTube shorts 자동 임포트
// Vercel Cron: 매일 09:00 KST (= 0:00 UTC)
// 수동 호출: 관리자 로그인 상태에서 GET 호출 가능
// ══════════════════════════════════════════

import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { searchShorts, getVideoStats, YouTubeApiError, type YouTubeSearchItem } from "@/lib/youtube-api";

export const maxDuration = 60;

// 검색어 풀 — 매 호출마다 랜덤으로 N개 골라서 검색.
// 같은 키워드를 반복하지 않아 매번 다른 결과가 나오게 함.
// 카테고리: 한국어 일반 / 행동 / 품종·외모 / 감정 / 영어 일반 / 영어 변형
const QUERY_POOL = [
  // ── 한국어 일반 ──
  "고양이 shorts",
  "길고양이 shorts",
  "냥이 shorts",
  "야옹이 shorts",
  "아기고양이 shorts",
  "새끼고양이 shorts",
  "고양이 영상 shorts",
  "고양이 일상 shorts",
  "냥스타그램 shorts",

  // ── 한국어 행동/상황 ──
  "고양이 박스 shorts",
  "고양이 꾹꾹이 shorts",
  "고양이 식빵 shorts",
  "고양이 츄르 shorts",
  "고양이 골골송 shorts",
  "고양이 우다다 shorts",
  "고양이 잠자는 shorts",
  "고양이 놀이 shorts",
  "고양이 점프 shorts",
  "고양이 사냥 shorts",
  "고양이 그루밍 shorts",
  "고양이 캣타워 shorts",

  // ── 한국어 품종/외모 ──
  "코리안숏헤어 shorts",
  "치즈고양이 shorts",
  "삼색이 shorts",
  "고등어 고양이 shorts",
  "검은 고양이 shorts",
  "턱시도 고양이 shorts",
  "노랑이 shorts",
  "스코티시폴드 shorts",
  "랙돌 고양이 shorts",
  "먼치킨 shorts",
  "페르시안 shorts",

  // ── 한국어 감정 ──
  "고양이 귀여운 shorts",
  "고양이 웃긴 shorts",
  "고양이 화난 shorts",
  "고양이 사랑스러운 shorts",
  "고양이 똑똑한 shorts",
  "고양이 신기한 shorts",
  "고양이 짤 shorts",

  // ── 영어 일반 ──
  "cat shorts",
  "kitten shorts",
  "kitty shorts",
  "cats shorts",

  // ── 영어 행동/감정 ──
  "cute cat shorts",
  "funny cat shorts",
  "silly cat shorts",
  "sleeping cat shorts",
  "playful kitten shorts",
  "smart cat shorts",
  "purring cat shorts",
  "meowing cat shorts",

  // ── 영어 상황 ──
  "stray cat shorts",
  "rescue cat shorts",
  "adopted kitten shorts",
  "cat reaction shorts",
  "cat fail shorts",

  // ── 영어 품종 ──
  "orange cat shorts",
  "black cat shorts",
  "scottish fold shorts",
  "ragdoll cat shorts",
  "munchkin cat shorts",
  "maine coon shorts",
];

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
  const { data: existing, error: existingErr } = await supabase
    .from("shorts")
    .select("youtube_video_id")
    .not("youtube_video_id", "is", null);
  if (existingErr) {
    console.error("[import-shorts] existing fetch failed:", existingErr);
    return Response.json({ error: "기존 영상 조회 실패" }, { status: 500 });
  }
  const existingIds = new Set(
    (existing ?? [])
      .map((s) => s.youtube_video_id as string | null)
      .filter((id): id is string => !!id),
  );

  let totalAdded = 0;
  const queryResults: {
    query: string;
    found: number;
    newAfterDedup: number;
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

      let passedViewFilter = 0;
      let qualified: YouTubeSearchItem[] = [];

      if (newOnes.length > 0) {
        // 2) 조회수 일괄 조회 후 MIN_VIEW_COUNT 미만 필터링
        const stats = await getVideoStats(newOnes.map((it) => it.videoId));
        qualified = newOnes.filter((it) => {
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
        passedViewFilter,
        added: qualified.length,
      });
    } catch (err) {
      const msg = err instanceof YouTubeApiError ? err.message
        : err instanceof Error ? err.message
        : "알 수 없는 오류";
      console.error(`[import-shorts] query "${query}" failed:`, err);
      queryResults.push({
        query, found: 0, newAfterDedup: 0, passedViewFilter: 0, added: 0, error: msg,
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
