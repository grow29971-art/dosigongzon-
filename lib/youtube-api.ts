// ══════════════════════════════════════════
// YouTube Data API v3 — 길고양이 shorts 검색 (자동 임포트용)
// 환경변수: YOUTUBE_API_KEY (Google Cloud Console에서 발급)
// 무료 쿼터: 10,000 units/day. search.list = 100 units/요청.
// ══════════════════════════════════════════

const API_BASE = "https://www.googleapis.com/youtube/v3";

export interface YouTubeSearchItem {
  videoId: string;
  title: string;
  description: string;
  channelTitle: string;
  channelId: string;
  thumbnailUrl: string;
  publishedAt: string;
}

export class YouTubeApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "YouTubeApiError";
    this.status = status;
  }
}

/**
 * YouTube에서 짧은 영상(< 4분, 임베드 가능, 한국어) 검색.
 * @param query 검색어 (예: "고양이 shorts")
 * @param maxResults 1~50 (기본 25)
 * @param order "date"(최신) | "viewCount" | "relevance" (기본 date)
 */
export async function searchShorts(
  query: string,
  maxResults = 25,
  order: "date" | "viewCount" | "relevance" = "date",
): Promise<YouTubeSearchItem[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) throw new YouTubeApiError("YOUTUBE_API_KEY 환경변수가 설정되지 않았어요.", 500);

  const params = new URLSearchParams({
    key: apiKey,
    part: "snippet",
    q: query,
    type: "video",
    videoDuration: "short",      // 4분 이내
    videoEmbeddable: "true",     // 외부 임베드 허용된 영상만
    relevanceLanguage: "ko",
    regionCode: "KR",
    maxResults: String(Math.min(50, Math.max(1, maxResults))),
    order,
    safeSearch: "moderate",      // 부적절 콘텐츠 차단
  });

  const res = await fetch(`${API_BASE}/search?${params.toString()}`, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new YouTubeApiError(
      `YouTube 검색 실패 (${res.status}): ${body.slice(0, 200)}`,
      res.status,
    );
  }
  const data = await res.json();

  type RawItem = {
    id?: { videoId?: string };
    snippet?: {
      title?: string;
      description?: string;
      channelTitle?: string;
      channelId?: string;
      thumbnails?: {
        high?: { url?: string };
        medium?: { url?: string };
        default?: { url?: string };
      };
      publishedAt?: string;
    };
  };

  const items = (data.items as RawItem[] | undefined) ?? [];
  return items
    .filter((item) => item.id?.videoId && item.snippet)
    .map((item) => {
      const s = item.snippet!;
      const thumb =
        s.thumbnails?.high?.url
        ?? s.thumbnails?.medium?.url
        ?? s.thumbnails?.default?.url
        ?? "";
      return {
        videoId: item.id!.videoId!,
        title: (s.title ?? "").slice(0, 200),
        description: (s.description ?? "").slice(0, 2000),
        channelTitle: (s.channelTitle ?? "").slice(0, 100),
        channelId: s.channelId ?? "",
        thumbnailUrl: thumb,
        publishedAt: s.publishedAt ?? new Date().toISOString(),
      };
    });
}

/**
 * 영상 ID 목록의 통계(조회수 등) 일괄 조회.
 * videos.list = 1 unit/호출 (최대 50개씩 한 번에 처리).
 * @returns Map<videoId, { viewCount, likeCount }>
 */
export async function getVideoStats(
  videoIds: string[],
): Promise<Map<string, { viewCount: number; likeCount: number }>> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) throw new YouTubeApiError("YOUTUBE_API_KEY 환경변수가 설정되지 않았어요.", 500);
  if (videoIds.length === 0) return new Map();

  const result = new Map<string, { viewCount: number; likeCount: number }>();

  // 50개씩 청크로 분할
  for (let i = 0; i < videoIds.length; i += 50) {
    const chunk = videoIds.slice(i, i + 50);
    const params = new URLSearchParams({
      key: apiKey,
      part: "statistics",
      id: chunk.join(","),
    });

    const res = await fetch(`${API_BASE}/videos?${params.toString()}`, { cache: "no-store" });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new YouTubeApiError(
        `YouTube 통계 조회 실패 (${res.status}): ${body.slice(0, 200)}`,
        res.status,
      );
    }
    const data = await res.json();

    type RawStats = {
      id?: string;
      statistics?: {
        viewCount?: string;
        likeCount?: string;
      };
    };
    const items = (data.items as RawStats[] | undefined) ?? [];
    for (const item of items) {
      if (!item.id || !item.statistics) continue;
      result.set(item.id, {
        viewCount: parseInt(item.statistics.viewCount ?? "0", 10) || 0,
        likeCount: parseInt(item.statistics.likeCount ?? "0", 10) || 0,
      });
    }
  }
  return result;
}
