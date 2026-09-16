import type { Metadata } from "next";
import { getPostByIdServer } from "@/lib/posts-server";
import { CATEGORY_MAP } from "@/lib/types";

const SITE_URL = "https://dosigongzon.com";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const post = await getPostByIdServer(id);
  if (!post) {
    return {
      title: "게시글을 찾을 수 없어요",
      robots: { index: false, follow: false },
    };
  }

  const cat = CATEGORY_MAP[post.category];
  const title = post.title;
  const plain = post.content.replace(/\s+/g, " ").trim().slice(0, 120);
  const description = post.region
    ? `[${cat.label}] ${post.region} · ${plain}`
    : `[${cat.label}] ${plain}`;

  return {
    title,
    description,
    alternates: { canonical: `/community/${post.id}` },
    openGraph: {
      type: "article",
      title: `${post.title} | ${cat.label} · 도시공존`,
      description,
      url: `${SITE_URL}/community/${post.id}`,
      publishedTime: post.createdAt,
      authors: [post.authorName],
      // images 는 같은 폴더의 opengraph-image.tsx(파일 컨벤션)가 해시 주소로 자동 주입한다.
      // 손 조립 `/community/{id}/opengraph-image` 는 (main) 그룹에서 404 — 덮어쓰지 말 것.
    },
    twitter: {
      card: "summary_large_image",
      title: `${post.title} | ${cat.label}`,
      description,
    },
  };
}

export default async function PostLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Params;
}) {
  const { id } = await params;
  const post = await getPostByIdServer(id);

  // 글 없으면 JSON-LD 생략
  if (!post) return children;

  const cat = CATEGORY_MAP[post.category];
  const plain = post.content.replace(/\s+/g, " ").trim().slice(0, 200);

  // DiscussionForumPosting — 커뮤니티 글 검색 결과 풍부화 + 별개 색인
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "DiscussionForumPosting",
    "@id": `${SITE_URL}/community/${post.id}`,
    headline: post.title,
    articleSection: cat.label,
    text: plain,
    datePublished: post.createdAt,
    inLanguage: "ko-KR",
    url: `${SITE_URL}/community/${post.id}`,
    author: {
      "@type": "Person",
      name: post.authorName,
      ...(post.authorAvatarUrl ? { image: post.authorAvatarUrl } : {}),
    },
    publisher: {
      "@type": "Organization",
      name: "도시공존",
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/icons/icon-512.png`,
      },
    },
    interactionStatistic: [
      {
        "@type": "InteractionCounter",
        interactionType: "https://schema.org/LikeAction",
        userInteractionCount: post.likeCount ?? 0,
      },
      {
        "@type": "InteractionCounter",
        interactionType: "https://schema.org/CommentAction",
        userInteractionCount: post.commentCount ?? 0,
      },
      {
        "@type": "InteractionCounter",
        interactionType: "https://schema.org/ViewAction",
        userInteractionCount: post.viewCount ?? 0,
      },
    ],
    ...(post.images && post.images.length > 0
      ? { image: post.images.filter((u) => typeof u === "string" && /^https?:\/\//.test(u)).slice(0, 5) }
      : {}),
    ...(post.region ? { contentLocation: { "@type": "Place", name: post.region } } : {}),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      {children}
    </>
  );
}
