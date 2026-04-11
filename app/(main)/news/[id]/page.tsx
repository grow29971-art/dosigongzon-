"use client";

import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { ArrowLeft, ExternalLink, Loader2 } from "lucide-react";
import { getNewsById, BADGE_PRESETS, type NewsItem } from "@/lib/news-repo";
import { sanitizeHttpUrl } from "@/lib/url-validate";

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
  const isDday = news.dday?.startsWith("D-") ?? false;

  return (
    <div className="pb-8">
      {/* ── 대표 이미지 영역 ── */}
      <div
        className="relative aspect-[16/9] overflow-hidden"
        style={{ background: preset.gradient }}
      >
        {news.image_url && (
          <img
            src={news.image_url}
            alt={news.title}
            className="w-full h-full object-cover"
          />
        )}
        {/* 하단 그라데이션 */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 50%)",
          }}
        />

        {/* 뒤로가기 */}
        <button
          onClick={() => router.back()}
          className="absolute top-12 left-4 w-10 h-10 rounded-2xl bg-white/70 backdrop-blur-sm flex items-center justify-center active:scale-90 transition-transform"
        >
          <ArrowLeft size={20} className="text-text-main" />
        </button>

        {/* D-Day 뱃지 */}
        {news.dday && (
          <div className="absolute top-12 right-4">
            <span
              className="text-[12px] font-bold px-3 py-1.5 rounded-xl backdrop-blur-sm"
              style={{
                color: isDday ? "#B84545" : "#6B8E6F",
                backgroundColor: isDday
                  ? "rgba(238,227,222,0.9)"
                  : "rgba(232,236,229,0.9)",
              }}
            >
              {news.dday}
            </span>
          </div>
        )}

        {/* 이미지 위 설명 */}
        {news.description && (
          <p className="absolute bottom-4 left-5 right-5 text-white text-[14px] font-semibold leading-snug drop-shadow-md">
            {news.description}
          </p>
        )}
      </div>

      {/* ── 콘텐츠 ── */}
      <div className="px-5 -mt-6 relative">
        {/* 카드 헤더 */}
        <div className="card p-5 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <span
              className="text-[11px] font-bold px-2.5 py-1 rounded-lg"
              style={{ color: preset.color, backgroundColor: preset.bg }}
            >
              {preset.label}
            </span>
            {news.date_label && (
              <span className="text-[12px] text-text-light">
                {news.date_label}
              </span>
            )}
          </div>
          <h1 className="text-[20px] font-extrabold text-text-main leading-snug mb-2">
            {news.title}
          </h1>
          {news.description && (
            <p className="text-[14px] text-text-sub leading-relaxed">
              {news.description}
            </p>
          )}
        </div>

        {/* 본문 */}
        {news.body && (
          <div className="card p-5 mb-4">
            <div className="text-[14px] text-text-main leading-[1.8] whitespace-pre-line">
              {news.body}
            </div>
          </div>
        )}

        {/* 외부 링크 */}
        {news.external_url && sanitizeHttpUrl(news.external_url) && (
          <a
            href={sanitizeHttpUrl(news.external_url)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl bg-primary text-white text-[15px] font-bold active:scale-[0.97] transition-transform"
            style={{ boxShadow: "0 6px 20px rgba(196,126,90,0.3)" }}
          >
            <ExternalLink size={18} />
            {news.external_label || "관련 홈페이지 바로가기"}
          </a>
        )}
      </div>
    </div>
  );
}
