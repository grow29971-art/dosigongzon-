"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { ArrowLeft, ExternalLink, Loader2 } from "lucide-react";
import { getNewsById, BADGE_PRESETS, resolveDdayLabel, type NewsItem } from "@/lib/news-repo";
import { sanitizeHttpUrl } from "@/lib/url-validate";
import ShareNewsButton from "@/app/components/ShareNewsButton";

export default function NewsDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [news, setNews] = useState<NewsItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getNewsById(id)
      .then((n) => {
        if (!cancelled) setNews(n);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center pt-20">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!news) {
    return (
      <div className="px-5 pt-14 pb-8 text-center">
        <p className="text-text-sub mt-20">소식을 찾을 수 없습니다.</p>
        <button
          onClick={() => router.back()}
          className="text-primary font-semibold mt-4"
        >
          돌아가기
        </button>
      </div>
    );
  }

  const preset = BADGE_PRESETS[news.badge_type];
  const ddayLabel = resolveDdayLabel(news);
  const isUpcoming = !!ddayLabel && ddayLabel.startsWith("D-") && ddayLabel !== "D-day";
  const isToday = ddayLabel === "D-day";
  const isEnded = ddayLabel === "종료";

  return (
    <div className="pb-8">
      {/* ── 대표 이미지 영역 ── */}
      <div
        className="relative aspect-[16/9] overflow-hidden"
        style={{ background: "var(--color-gray-100)" }}
      >
        {news.image_url && (
          <Image
            src={news.image_url}
            alt={news.title}
            fill
            priority
            sizes="(max-width: 720px) 100vw, 720px"
            style={{ objectFit: "cover" }}
          />
        )}

        {/* 뒤로가기 */}
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="뒤로가기"
          className="absolute top-12 left-4 w-10 h-10 rounded-full bg-white/70 backdrop-blur-sm flex items-center justify-center press-strong transition-transform"
        >
          <ArrowLeft size={20} className="text-text-main" />
        </button>

        {/* D-Day 뱃지 */}
        {ddayLabel && (
          <div className="absolute top-12 right-4">
            <span
              className="text-[13px] font-semibold px-3 py-1.5 rounded-lg"
              style={{
                color: isEnded ? "var(--color-text-sub)" : isToday || isUpcoming ? "var(--color-error)" : "var(--color-text-sub)",
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
              }}
            >
              {ddayLabel}
            </span>
          </div>
        )}
      </div>

      {/* ── 콘텐츠 ── */}
      <div className="px-5 -mt-6 relative">
        {/* 카드 헤더 */}
        <div className="card p-5 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <span
              className="text-[11px] font-bold px-2.5 py-1 rounded-lg"
              style={{ color: "var(--color-text-sub)", backgroundColor: "var(--color-gray-100)" }}
            >
              {preset.label}
            </span>
            {news.date_label && (
              <span className="text-[13px] text-text-light">
                {news.date_label}
              </span>
            )}
          </div>
          <h1 className="text-[20px] font-bold text-text-main leading-snug mb-2">
            {news.title}
          </h1>
          {news.description && (
            <p className="text-[15px] text-text-sub leading-relaxed">
              {news.description}
            </p>
          )}
        </div>

        {/* 본문 */}
        {news.body && (
          <div className="card p-5 mb-4">
            <div className="text-[15px] text-text-main leading-[1.8] whitespace-pre-line">
              {news.body}
            </div>
          </div>
        )}

        {/* 카톡 공유 */}
        <div className="mb-4">
          <ShareNewsButton
            newsId={news.id}
            title={news.title}
            description={news.description}
            badgeLabel={preset.label}
          />
        </div>

        {/* 외부 링크 */}
        {news.external_url && sanitizeHttpUrl(news.external_url) && (
          <a
            href={sanitizeHttpUrl(news.external_url)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-4 rounded-xl bg-primary text-white text-[15px] font-bold press-strong transition-transform"
          >
            <ExternalLink size={18} />
            {news.external_label || "관련 홈페이지 바로가기"}
          </a>
        )}
      </div>
    </div>
  );
}
