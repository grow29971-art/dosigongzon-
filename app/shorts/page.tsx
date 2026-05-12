// 도시공존 — 숏폼 영상 풀스크린 피드 (운영자 큐레이션)
// (main) 라우트 밖이라 BottomNav 없이 풀스크린으로 동작.

import type { Metadata } from "next";
import { listPublishedShortsServer, type Short } from "@/lib/shorts-repo";
import ShortsFeed from "./ShortsFeed";
import EmptyShorts from "./EmptyShorts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "동물숏츠 — 고양이·강아지 짧은 영상 모음 | 도시공존",
  description: "도시공존이 큐레이션한 고양이·강아지·소동물 짧은 영상 피드. 위로 스와이프하면 다음 영상이 이어져요. 무료로 즐기는 동물 쇼츠.",
  keywords: ["동물숏츠", "동물 쇼츠", "동물 영상", "고양이", "강아지", "댕댕이", "길고양이", "햄스터", "토끼", "도시공존"],
  alternates: { canonical: "/shorts" },
  openGraph: {
    title: "동물숏츠 — 고양이·강아지 짧은 영상",
    description: "고양이·강아지·동물의 짧은 순간들을 한 화면에서. 도시공존이 큐레이션.",
    url: "https://dosigongzon.com/shorts",
    type: "website",
    siteName: "도시공존",
  },
  twitter: {
    card: "summary_large_image",
    title: "동물숏츠 — 고양이·강아지 짧은 영상",
    description: "고양이·강아지·동물의 짧은 순간들을 한 화면에서.",
  },
};

// Fisher-Yates 셔플
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 첫 사이클 — 핀고정은 맨 위, 나머지 셔플
function shuffleNonPinned(items: Short[]): Short[] {
  const pinned = items.filter((s) => s.pinned);
  const rest = items.filter((s) => !s.pinned);
  return [...pinned, ...shuffle(rest)];
}

// 3사이클 무한-무작위 피드 — 끝나면 다시 다른 셔플로 이어짐.
// 사용자 입장: 30개 다 봐도 또 다른 무작위 순서로 30개 더 → 다시 또 30개.
// 같은 영상이 여러 사이클에서 반복돼도 매번 다른 위치에 등장 → 진짜 무작위 느낌.
function buildInfiniteShuffle(items: Short[], cycles = 3): Short[] {
  const result: Short[] = [];
  for (let i = 0; i < cycles; i++) {
    // 첫 사이클만 핀고정 위치 유지, 이후 사이클은 모두 셔플
    result.push(...(i === 0 ? shuffleNonPinned(items) : shuffle(items)));
  }
  return result;
}

export default async function ShortsPage() {
  const items = await listPublishedShortsServer(30);
  if (items.length === 0) return <EmptyShorts />;

  // ItemList + 각 VideoObject JSON-LD — Google에 영상 모음 페이지로 인식시키기
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "동물숏츠 — 고양이·강아지 짧은 영상",
    description: "도시공존이 큐레이션한 고양이·강아지·동물 짧은 영상 모음.",
    itemListElement: items.slice(0, 20).map((s, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      url: `https://dosigongzon.com/shorts/${s.id}`,
      item: {
        "@type": "VideoObject",
        name: s.title,
        description: s.description || s.title,
        thumbnailUrl: s.thumbnail_url || undefined,
        uploadDate: s.published_at,
        embedUrl: s.youtube_video_id
          ? `https://www.youtube.com/embed/${s.youtube_video_id}`
          : undefined,
        contentUrl: s.youtube_video_id
          ? `https://www.youtube.com/watch?v=${s.youtube_video_id}`
          : s.video_url || undefined,
      },
    })),
  };

  return (
    <>
      {/* YouTube/썸네일 도메인 미리 DNS·TLS 핸드셰이크 → 첫 영상 로드 시간 단축 */}
      <link rel="preconnect" href="https://www.youtube.com" />
      <link rel="preconnect" href="https://i.ytimg.com" />
      <link rel="dns-prefetch" href="https://www.youtube.com" />
      <link rel="dns-prefetch" href="https://i.ytimg.com" />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      <ShortsFeed initialItems={buildInfiniteShuffle(items)} />
    </>
  );
}
