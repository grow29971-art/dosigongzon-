// 고양이 사회 소식·일정 인덱스 — /news
// 홈 "고양이 사회 소식" 섹션 "전체보기" 진입점.
// 서버 컴포넌트, 10분 ISR.

import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Newspaper, ExternalLink, ChevronRight } from "lucide-react";
import { createAnonClient } from "@/lib/supabase/anon";
import { BADGE_PRESETS, computeDday, type NewsItem } from "@/lib/news-repo";
import { sanitizeImageUrl } from "@/lib/url-validate";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "고양이 사회 소식 — 도시공존",
  description:
    "길고양이 보호 행사·TNR·법령·공지 등 도시공존이 큐레이션한 고양이 사회 소식과 일정.",
  alternates: { canonical: "/news" },
  openGraph: {
    title: "고양이 사회 소식 | 도시공존",
    description: "행사·TNR·법령·공지 모음.",
    url: "https://dosigongzon.com/news",
  },
};

async function fetchNews(): Promise<NewsItem[]> {
  try {
    const supabase = createAnonClient();
    const { data } = await supabase
      .from("news")
      .select("*")
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50);
    return (data ?? []) as NewsItem[];
  } catch (err) {
    console.error("[news/index] fetchNews failed:", err);
    return [];
  }
}

export default async function NewsIndexPage() {
  const items = await fetchNews();

  return (
    <div className="pb-24" style={{ background: "#F7F4EE", minHeight: "100vh" }}>
      <div className="px-4 pt-12 pb-4 flex items-center gap-3">
        <Link
          href="/"
          className="w-9 h-9 rounded-full bg-white flex items-center justify-center active:scale-90"
          style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}
          aria-label="홈"
        >
          <ArrowLeft size={18} className="text-text-main" />
        </Link>
        <div>
          <h1 className="text-[20px] font-extrabold text-text-main tracking-tight flex items-center gap-1.5">
            <Newspaper size={18} className="text-primary" />
            고양이 사회 소식
          </h1>
          <p className="text-[11px] text-text-sub">행사·TNR·법령·공지 모음</p>
        </div>
      </div>

      <div className="px-4 space-y-3">
        {items.length === 0 ? (
          <div
            className="text-center py-16 rounded-2xl bg-white"
            style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}
          >
            <Newspaper size={36} strokeWidth={1.2} className="mx-auto mb-3 text-text-light opacity-30" />
            <p className="text-[13px] text-text-sub font-semibold">아직 등록된 소식이 없어요</p>
            <p className="text-[11px] text-text-light mt-1">관리자가 행사·법령·TNR 일정을 곧 올려드릴게요</p>
          </div>
        ) : (
          items.map((item) => {
            const badge = BADGE_PRESETS[item.badge_type];
            const dday = computeDday(item.event_date) ?? item.dday;
            const photo = sanitizeImageUrl(item.image_url, "");
            const hasInternalBody = !!(item.body && item.body.trim().length > 0);
            const targetHref = hasInternalBody
              ? `/news/${item.id}`
              : item.external_url
              ? item.external_url
              : `/news/${item.id}`;
            const isExternal = !hasInternalBody && !!item.external_url;

            const cardInner = (
              <div
                className="flex gap-3 p-3.5 rounded-2xl bg-white active:scale-[0.99] transition-transform"
                style={{
                  boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
                  border: item.pinned ? `1.5px solid ${badge.color}40` : "1px solid rgba(0,0,0,0.04)",
                }}
              >
                {photo && (
                  <div className="relative shrink-0 rounded-xl overflow-hidden" style={{ width: 72, height: 72 }}>
                    <Image src={photo} alt="" fill sizes="72px" style={{ objectFit: "cover" }} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                    <span
                      className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md"
                      style={{ background: badge.bg, color: badge.color }}
                    >
                      {badge.label}
                    </span>
                    {dday && (
                      <span
                        className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md"
                        style={{ background: "#F7F4EE", color: "#6B5043" }}
                      >
                        {dday}
                      </span>
                    )}
                    {item.pinned && (
                      <span className="text-[9px] font-bold" style={{ color: badge.color }}>
                        📌 고정
                      </span>
                    )}
                  </div>
                  <p className="text-[13.5px] font-extrabold text-text-main leading-snug line-clamp-2">
                    {item.title}
                  </p>
                  {item.description && (
                    <p className="text-[11.5px] text-text-sub line-clamp-2 mt-1 leading-snug">
                      {item.description}
                    </p>
                  )}
                  {item.date_label && (
                    <p className="text-[10px] text-text-light mt-1">{item.date_label}</p>
                  )}
                </div>
                <div className="shrink-0 self-center">
                  {isExternal ? (
                    <ExternalLink size={14} className="text-text-light" />
                  ) : (
                    <ChevronRight size={14} className="text-text-light" />
                  )}
                </div>
              </div>
            );

            if (isExternal) {
              return (
                <a key={item.id} href={targetHref} target="_blank" rel="noopener noreferrer" className="block">
                  {cardInner}
                </a>
              );
            }
            return (
              <Link key={item.id} href={targetHref} className="block">
                {cardInner}
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
