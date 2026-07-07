// 꿀팁게시판 상세 — /tips/[slug]
// 서버 컴포넌트, ISR + generateMetadata + JSON-LD BlogPosting.

import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Eye, Clock, ChevronRight, List as ListIcon } from "lucide-react";
import {
  getTipBySlugServer,
  getRelatedTipsServer,
  type Tip,
} from "@/lib/tips-repo";
import { sanitizeImageUrl, sanitizeHttpUrl } from "@/lib/url-validate";
import { estimateReadingMinutes, extractTextFromHtml } from "@/lib/html-sanitize";
import TipViewIncrementer from "./TipViewIncrementer";
import TipShareButtons from "./TipShareButtons";

export const revalidate = 600;

const SITE_URL = "https://dosigongzon.com";

interface Params {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const tip = await getTipBySlugServer(slug);
  if (!tip) {
    return {
      title: "꿀팁을 찾을 수 없어요",
      robots: { index: false, follow: false },
    };
  }

  const url = `${SITE_URL}/tips/${tip.slug}`;
  const description = tip.description || extractTextFromHtml(tip.body, 160);
  // 동적 OG (제목·썸네일·태그가 합성된 풍부한 미리보기). page 폴더의 opengraph-image.tsx가 이미지를 생성.
  const image = `${SITE_URL}/tips/${tip.slug}/opengraph-image`;

  return {
    title: tip.title,
    description,
    keywords: tip.tags.length > 0 ? tip.tags : undefined,
    alternates: { canonical: `/tips/${tip.slug}` },
    openGraph: {
      type: "article",
      url,
      title: tip.title,
      description,
      siteName: "도시공존",
      locale: "ko_KR",
      publishedTime: tip.published_at,
      modifiedTime: tip.updated_at,
      authors: ["도시공존"],
      tags: tip.tags,
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: tip.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: tip.title,
      description,
      images: [image],
    },
  };
}

// ── h2/h3 에서 자동 목차 추출 ──
interface TocItem {
  id: string;
  text: string;
  level: 2 | 3;
}

function extractToc(html: string): { html: string; toc: TocItem[] } {
  const toc: TocItem[] = [];
  let counter = 0;
  const augmented = html.replace(
    /<(h[23])\b([^>]*)>([\s\S]*?)<\/\1>/gi,
    (_full, tag, attrs, inner) => {
      const text = inner.replace(/<[^>]+>/g, "").trim();
      if (!text) return `<${tag}${attrs}>${inner}</${tag}>`;
      counter += 1;
      const id = `tip-h-${counter}`;
      toc.push({ id, text, level: tag.toLowerCase() === "h2" ? 2 : 3 });
      return `<${tag}${attrs} id="${id}">${inner}</${tag}>`;
    },
  );
  return { html: augmented, toc };
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  } catch {
    return "";
  }
}

export default async function TipDetailPage({ params }: Params) {
  const { slug } = await params;
  const tip = await getTipBySlugServer(slug);
  if (!tip) notFound();

  const photo = sanitizeImageUrl(tip.thumbnail_url, "");
  const sourceUrl = tip.source_url ? sanitizeHttpUrl(tip.source_url) : "";
  const description = tip.description || extractTextFromHtml(tip.body, 160);
  const reading = estimateReadingMinutes(tip.body);
  const url = `${SITE_URL}/tips/${tip.slug}`;
  const image = photo || `${SITE_URL}/opengraph-image`;

  const { html: bodyWithIds, toc } = extractToc(tip.body);

  const related = await getRelatedTipsServer(tip.slug, tip.tags, 3);

  // BlogPosting JSON-LD
  const blogPostingLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    headline: tip.title,
    description,
    image: [image],
    datePublished: tip.published_at,
    dateModified: tip.updated_at,
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
    keywords: tip.tags.join(", "),
    articleSection: "꿀팁게시판",
    inLanguage: "ko-KR",
  };

  // BreadcrumbList
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "홈", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "꿀팁게시판", item: `${SITE_URL}/tips` },
      { "@type": "ListItem", position: 3, name: tip.title, item: url },
    ],
  };

  return (
    <article className="pb-12" style={{ background: "#F7F4EE", minHeight: "100vh" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(blogPostingLd).replace(/</g, "\\u003c"),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbLd).replace(/</g, "\\u003c"),
        }}
      />
      <TipViewIncrementer slug={tip.slug} />

      {/* ── 대표 이미지 ── */}
      {photo ? (
        <div className="relative w-full aspect-[16/9] bg-[#EEE8E0]">
          <Image
            src={photo}
            alt={tip.title}
            fill
            priority
            sizes="(max-width: 720px) 100vw, 720px"
            style={{ objectFit: "cover" }}
          />
          <div
            className="absolute inset-0"
            style={{
              background: "linear-gradient(to top, rgba(0,0,0,0.45) 0%, transparent 50%)",
            }}
          />
          <Link
            href="/tips"
            className="absolute top-12 left-4 w-10 h-10 rounded-2xl bg-white/70 backdrop-blur-sm flex items-center justify-center active:scale-90 transition-transform"
            aria-label="꿀팁게시판"
          >
            <ArrowLeft size={20} className="text-text-main" />
          </Link>
        </div>
      ) : (
        <div className="px-4 pt-12">
          <Link
            href="/tips"
            className="w-9 h-9 rounded-full bg-white flex items-center justify-center active:scale-90"
            style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}
            aria-label="꿀팁게시판"
          >
            <ArrowLeft size={18} className="text-text-main" />
          </Link>
        </div>
      )}

      {/* ── 본문 ── */}
      <div className={photo ? "px-4 -mt-6 relative" : "px-4 mt-4"}>
        {/* 헤더 카드 */}
        <header
          className="bg-white rounded-2xl p-5 mb-4"
          style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}
        >
          {tip.tags.length > 0 && (
            <div className="flex gap-1.5 mb-2.5 flex-wrap">
              {tip.tags.map((tag) => (
                <Link
                  key={tag}
                  href={`/tips?tag=${encodeURIComponent(tag)}`}
                  className="text-[10.5px] font-extrabold px-2 py-0.5 rounded-md"
                  style={{ background: "#F2EBE0", color: "#8B6F4E" }}
                >
                  #{tag}
                </Link>
              ))}
            </div>
          )}
          <h1
            className="font-extrabold text-text-main"
            style={{ fontSize: "22px", lineHeight: 1.35, letterSpacing: "-0.01em" }}
          >
            {tip.title}
          </h1>
          {tip.description && (
            <p className="text-[14px] text-text-sub leading-relaxed mt-2.5">
              {tip.description}
            </p>
          )}
          <div className="flex items-center gap-2 mt-3 text-[11.5px] text-text-light">
            <span className="font-bold text-primary">도시공존</span>
            <span>·</span>
            <span>{formatDate(tip.published_at)}</span>
            <span>·</span>
            <span className="inline-flex items-center gap-0.5">
              <Clock size={12} /> {reading}분 읽기
            </span>
            <span>·</span>
            <span className="inline-flex items-center gap-0.5">
              <Eye size={12} /> {tip.view_count}
            </span>
          </div>
        </header>

        {/* 자동 목차 */}
        {toc.length >= 2 && (
          <nav
            className="bg-white rounded-2xl p-4 mb-4"
            aria-label="목차"
            style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}
          >
            <p className="text-[11.5px] font-extrabold text-text-sub mb-2 inline-flex items-center gap-1.5">
              <ListIcon size={13} />
              목차
            </p>
            <ol className="space-y-1.5">
              {toc.map((item) => (
                <li
                  key={item.id}
                  style={{ paddingLeft: item.level === 3 ? 14 : 0 }}
                >
                  <a
                    href={`#${item.id}`}
                    className="text-[12.5px] text-text-main hover:text-primary"
                  >
                    {item.level === 3 ? "· " : ""}
                    {item.text}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        )}

        {/* 본문 카드 */}
        <div
          className="bg-white rounded-2xl p-6 mb-4"
          style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}
        >
          <div
            className="tip-body text-text-main"
            dangerouslySetInnerHTML={{ __html: bodyWithIds }}
          />
        </div>

        {/* 출처 */}
        {sourceUrl && (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-4 rounded-2xl bg-white mb-4 active:scale-[0.99] transition-transform"
            style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}
          >
            <ExternalLink size={16} className="text-text-sub shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[10.5px] text-text-light font-bold">출처</p>
              <p className="text-[13px] text-text-main font-bold truncate">
                {tip.source_label || sourceUrl}
              </p>
            </div>
            <ChevronRight size={14} className="text-text-light shrink-0" />
          </a>
        )}

        {/* 공유 */}
        <div
          className="bg-white rounded-2xl p-4 mb-4"
          style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}
        >
          <p className="text-[11.5px] font-extrabold text-text-sub mb-2.5">이 글 공유하기</p>
          <TipShareButtons url={url} title={tip.title} description={description} />
        </div>

        {/* 관련 글 */}
        {related.length > 0 && (
          <section
            className="bg-white rounded-2xl p-4 mb-4"
            style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}
          >
            <p className="text-[11.5px] font-extrabold text-text-sub mb-2.5">관련 꿀팁</p>
            <div className="space-y-2">
              {related.map((r) => (
                <RelatedRow key={r.id} tip={r} />
              ))}
            </div>
          </section>
        )}

        {/* 도시공존 미니 소개 */}
        <div
          className="p-5 rounded-2xl"
          style={{
            background: "linear-gradient(135deg, #FBF8F3 0%, #F2EBE0 100%)",
            border: "1px solid rgba(92,141,238,0.15)",
          }}
        >
          <p className="text-[12px] font-extrabold text-primary mb-1.5">도시공존이란?</p>
          <p className="text-[13px] text-text-main leading-relaxed mb-3">
            우리 동네 길고양이 지도, 돌봄다이어리, TNR 신청, 동네 채팅을 한곳에서
            할 수 있는 시민 참여 플랫폼이에요. 길고양이와 시민이 함께 살아가는
            도시를 만듭니다.
          </p>
          <Link
            href="/about"
            className="inline-flex items-center gap-1 text-[12px] font-extrabold text-primary"
          >
            자세히 보기
            <ChevronRight size={13} />
          </Link>
        </div>
      </div>
    </article>
  );
}

function RelatedRow({ tip }: { tip: Tip }) {
  const photo = sanitizeImageUrl(tip.thumbnail_url, "");
  return (
    <Link
      href={`/tips/${tip.slug}`}
      className="flex gap-3 items-center active:scale-[0.99] transition-transform"
    >
      {photo ? (
        <div className="relative shrink-0 rounded-lg overflow-hidden" style={{ width: 56, height: 56 }}>
          <Image src={photo} alt={tip.title} fill sizes="56px" style={{ objectFit: "cover" }} />
        </div>
      ) : (
        <div
          className="shrink-0 rounded-lg flex items-center justify-center"
          style={{ width: 56, height: 56, background: "#F2EBE0" }}
        >
          <span className="text-primary text-[18px]">✨</span>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-bold text-text-main leading-snug line-clamp-2">
          {tip.title}
        </p>
        <p className="text-[10.5px] text-text-light mt-0.5">
          {formatDate(tip.published_at)}
        </p>
      </div>
      <ChevronRight size={14} className="text-text-light shrink-0" />
    </Link>
  );
}
