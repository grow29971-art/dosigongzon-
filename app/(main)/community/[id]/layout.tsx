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
      title: `${cat.emoji} ${post.title} | ${cat.label} · 도시공존`,
      description,
      url: `${SITE_URL}/community/${post.id}`,
      publishedTime: post.createdAt,
      authors: [post.authorName],
      images: [
        {
          url: `/community/${post.id}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${cat.emoji} ${post.title}`,
      description,
      images: [`/community/${post.id}/opengraph-image`],
    },
  };
}

export default function PostLayout({ children }: { children: React.ReactNode }) {
  return children;
}
