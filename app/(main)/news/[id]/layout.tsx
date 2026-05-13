import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import type { NewsItem } from "@/lib/news-repo";

const SITE_URL = "https://dosigongzon.com";

type Params = Promise<{ id: string }>;

async function fetchNewsServer(id: string): Promise<NewsItem | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("news").select("*").eq("id", id).maybeSingle();
  return (data ?? null) as NewsItem | null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const news = await fetchNewsServer(id);
  if (!news) {
    return { title: "소식을 찾을 수 없어요", robots: { index: false, follow: false } };
  }
  const description = (news.description ?? news.body ?? "").replace(/\s+/g, " ").trim().slice(0, 150);
  return {
    title: `${news.title} | 도시공존 소식`,
    description,
    alternates: { canonical: `/news/${news.id}` },
    openGraph: {
      type: "article",
      title: news.title,
      description,
      url: `${SITE_URL}/news/${news.id}`,
      publishedTime: news.created_at,
      // 동적 OG (헤드라인·이미지·뱃지가 합성된 풍부한 미리보기) — opengraph-image.tsx 위임
      images: [
        {
          url: `${SITE_URL}/news/${news.id}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: news.title,
        },
      ],
    },
  };
}

export default async function NewsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Params;
}) {
  const { id } = await params;
  const news = await fetchNewsServer(id);
  if (!news) return children;

  const description = (news.description ?? news.body ?? "").replace(/\s+/g, " ").trim().slice(0, 200);

  // NewsArticle — 네이버 뉴스/구글 뉴스 색인 후보로 인식
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    "@id": `${SITE_URL}/news/${news.id}`,
    headline: news.title,
    description,
    datePublished: news.created_at,
    dateModified: news.updated_at,
    inLanguage: "ko-KR",
    url: `${SITE_URL}/news/${news.id}`,
    ...(news.image_url ? { image: [news.image_url] } : { image: [`${SITE_URL}/icons/icon-512.png`] }),
    author: {
      "@type": "Organization",
      name: "도시공존",
      url: SITE_URL,
    },
    publisher: {
      "@type": "Organization",
      name: "도시공존",
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/icons/icon-512.png`,
      },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE_URL}/news/${news.id}` },
    ...(news.body ? { articleBody: news.body.slice(0, 5000) } : {}),
  };

  // BreadcrumbList — 홈 > 소식 > 제목
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "홈", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "소식", item: `${SITE_URL}/news` },
      { "@type": "ListItem", position: 3, name: news.title, item: `${SITE_URL}/news/${news.id}` },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd).replace(/</g, "\\u003c") }}
      />
      {children}
    </>
  );
}
