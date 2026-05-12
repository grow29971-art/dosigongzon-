// RSS 2.0 피드 — 외부 reader, IFTTT 자동화, 다른 사이트 임베드용
// 도시공존 전체 콘텐츠(뉴스 + 꿀팁 + 동물숏츠) 최신순 합본.
// 카테고리별 RSS는 /news/feed.xml, /tips/feed.xml, /shorts/feed.xml 별도.

import { createClient } from "@/lib/supabase/server";
import { listPublishedTipsServer } from "@/lib/tips-repo";

const SITE_URL = "https://dosigongzon.com";

// 10분 캐시 — 신규 뉴스 자동 임포트(매일 새벽) 반영. 부하 방지.
export const revalidate = 600;

interface FeedItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  guid: string;
  category: string;
  imageUrl?: string;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toRfc822(iso: string): string {
  return new Date(iso).toUTCString();
}

async function fetchAllItems(): Promise<FeedItem[]> {
  const items: FeedItem[] = [];

  // 1) 뉴스
  try {
    const supabase = await createClient();
    const { data: news } = await supabase
      .from("news")
      .select("id, title, description, body, image_url, created_at, updated_at, badge_type")
      .order("created_at", { ascending: false })
      .limit(30);

    for (const n of (news ?? []) as Array<{
      id: string;
      title: string;
      description: string | null;
      body: string | null;
      image_url: string | null;
      created_at: string;
      updated_at: string;
      badge_type: string;
    }>) {
      items.push({
        title: n.title,
        link: `${SITE_URL}/news/${n.id}`,
        description:
          (n.description ?? stripHtml(n.body ?? "")).slice(0, 280) ||
          "도시공존이 전하는 길고양이·동물보호 소식",
        pubDate: toRfc822(n.created_at),
        guid: `${SITE_URL}/news/${n.id}`,
        category: `소식 / ${n.badge_type}`,
        imageUrl: n.image_url ?? undefined,
      });
    }
  } catch {
    // 뉴스 fetch 실패해도 다른 카테고리는 보냄
  }

  // 2) 꿀팁
  try {
    const tips = await listPublishedTipsServer(20);
    for (const t of tips) {
      items.push({
        title: t.title,
        link: `${SITE_URL}/tips/${t.slug}`,
        description:
          (t.description ?? stripHtml(t.body)).slice(0, 280) ||
          "길고양이 돌봄 실전 꿀팁",
        pubDate: toRfc822(t.published_at || t.created_at),
        guid: `${SITE_URL}/tips/${t.slug}`,
        category: "꿀팁",
        imageUrl: t.thumbnail_url ?? undefined,
      });
    }
  } catch {
    // skip
  }

  // 3) 동물숏츠 (최근 20개)
  try {
    const supabase = await createClient();
    const { data: shorts } = await supabase
      .from("shorts")
      .select("id, title, description, thumbnail_url, youtube_video_id, published_at, created_at")
      .eq("published", true)
      .order("published_at", { ascending: false })
      .limit(20);

    for (const s of (shorts ?? []) as Array<{
      id: string;
      title: string;
      description: string | null;
      thumbnail_url: string | null;
      youtube_video_id: string | null;
      published_at: string;
      created_at: string;
    }>) {
      const thumb =
        s.thumbnail_url ??
        (s.youtube_video_id
          ? `https://i.ytimg.com/vi/${s.youtube_video_id}/hqdefault.jpg`
          : undefined);
      items.push({
        title: s.title,
        link: `${SITE_URL}/shorts/${s.id}`,
        description:
          (s.description ?? "").slice(0, 280) ||
          "도시공존이 큐레이션한 고양이·강아지·동물 짧은 영상",
        pubDate: toRfc822(s.published_at || s.created_at),
        guid: `${SITE_URL}/shorts/${s.id}`,
        category: "동물숏츠",
        imageUrl: thumb,
      });
    }
  } catch {
    // skip
  }

  // 최신순 정렬
  items.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
  return items.slice(0, 50);
}

function buildXml(items: FeedItem[]): string {
  const buildDate = new Date().toUTCString();
  const itemsXml = items
    .map((it) => {
      const enclosure = it.imageUrl
        ? `\n      <enclosure url="${escapeXml(it.imageUrl)}" type="image/jpeg" />`
        : "";
      return `    <item>
      <title>${escapeXml(it.title)}</title>
      <link>${escapeXml(it.link)}</link>
      <description>${escapeXml(it.description)}</description>
      <pubDate>${it.pubDate}</pubDate>
      <guid isPermaLink="true">${escapeXml(it.guid)}</guid>
      <category>${escapeXml(it.category)}</category>${enclosure}
    </item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>도시공존 — 길고양이 돌봄 시민 참여 플랫폼</title>
    <link>${SITE_URL}</link>
    <description>우리 동네 길고양이를 기록하고 돌보는 시민 참여 플랫폼. 소식·꿀팁·동물숏츠를 한 곳에서.</description>
    <language>ko-KR</language>
    <lastBuildDate>${buildDate}</lastBuildDate>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml" />
    <image>
      <url>${SITE_URL}/icons/icon-512.png</url>
      <title>도시공존</title>
      <link>${SITE_URL}</link>
    </image>
${itemsXml}
  </channel>
</rss>
`;
}

export async function GET() {
  const items = await fetchAllItems();
  const xml = buildXml(items);
  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600",
    },
  });
}
