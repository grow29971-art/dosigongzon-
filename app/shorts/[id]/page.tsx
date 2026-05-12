// 특정 숏츠 deep-link — `/shorts/{id}`로 진입 시 그 영상부터 시작.
// 공유 버튼이 만든 URL의 도착지. (main) 밖이라 BottomNav 없이 풀스크린.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getPublishedShortServer,
  listPublishedShortsServer,
  type Short,
} from "@/lib/shorts-repo";
import ShortsFeed from "../ShortsFeed";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const target = await getPublishedShortServer(id);
  if (!target) {
    return {
      title: "영상을 찾을 수 없어요 — 도시공존",
    };
  }
  const url = `https://dosigongzon.com/shorts/${id}`;
  const description = target.description || "도시공존이 큐레이션한 동물 짧은 이야기.";
  // 동적 OG (썸네일 풀스크린 + 제목·조회수·좋아요 합성) — opengraph-image.tsx 위임
  const ogImage = `${url}/opengraph-image`;
  return {
    title: `${target.title} — 도시공존 영상`,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: target.title,
      description,
      url,
      images: [{ url: ogImage, width: 1200, height: 630, alt: target.title }],
      type: "video.other",
    },
    twitter: {
      card: "summary_large_image",
      title: target.title,
      description,
      images: [ogImage],
    },
  };
}

// Fisher-Yates 셔플 (target은 따로 빠져있는 상태에서 호출)
function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default async function ShortByIdPage({ params }: Props) {
  const { id } = await params;
  const target = await getPublishedShortServer(id);
  if (!target) notFound();

  // 나머지 영상 — target 제외, 핀고정 위 + 나머지 셔플
  const all = await listPublishedShortsServer(30);
  const rest = all.filter((s) => s.id !== id);
  const pinned = rest.filter((s) => s.pinned);
  const others = rest.filter((s) => !s.pinned);

  // target 첫 카드 + 핀고정 + 3사이클 무작위 — 무한-무작위 느낌
  const items: Short[] = [
    target,
    ...pinned,
    ...shuffleArray(others),
    ...shuffleArray([...pinned, ...others]),  // 2사이클: target 빼고 다시 섞음
    ...shuffleArray([...pinned, ...others]),  // 3사이클
  ];

  // VideoObject JSON-LD — Google 검색 결과 영상 카드(Rich Result) 노출용
  const videoJsonLd = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: target.title,
    description: target.description || `${target.title} — 도시공존 영상`,
    thumbnailUrl: target.thumbnail_url || undefined,
    uploadDate: target.published_at,
    embedUrl: target.youtube_video_id
      ? `https://www.youtube.com/embed/${target.youtube_video_id}`
      : undefined,
    contentUrl: target.youtube_video_id
      ? `https://www.youtube.com/watch?v=${target.youtube_video_id}`
      : target.video_url || undefined,
    duration: target.duration_sec ? `PT${target.duration_sec}S` : undefined,
    interactionStatistic: {
      "@type": "InteractionCounter",
      interactionType: { "@type": "https://schema.org/WatchAction" },
      userInteractionCount: target.view_count,
    },
    publisher: {
      "@type": "Organization",
      name: "도시공존",
      url: "https://dosigongzon.com",
    },
  };

  return (
    <>
      <link rel="preconnect" href="https://www.youtube.com" />
      <link rel="preconnect" href="https://i.ytimg.com" />
      <link rel="dns-prefetch" href="https://www.youtube.com" />
      <link rel="dns-prefetch" href="https://i.ytimg.com" />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(videoJsonLd) }}
      />
      <ShortsFeed initialItems={items} />
    </>
  );
}
