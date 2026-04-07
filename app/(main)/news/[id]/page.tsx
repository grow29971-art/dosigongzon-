"use client";

import { useRouter } from "next/navigation";
import { use } from "react";
import { ArrowLeft, ExternalLink, Calendar, Scissors, Scale } from "lucide-react";
import { getNewsById } from "@/lib/news";

const BADGE_ICONS: Record<string, typeof Calendar> = {
  "행사": Calendar,
  "TNR": Scissors,
  "법령": Scale,
};

export default function NewsDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const news = getNewsById(id);

  if (!news) {
    return (
      <div className="px-5 pt-14 pb-8 text-center">
        <p className="text-text-sub mt-20">소식을 찾을 수 없습니다.</p>
        <button onClick={() => router.back()} className="text-primary font-semibold mt-4">
          돌아가기
        </button>
      </div>
    );
  }

  const BadgeIcon = BADGE_ICONS[news.badge] ?? Calendar;

  return (
    <div className="pb-8">
      {/* ── 대표 이미지 영역 ── */}
      <div className="relative aspect-[16/9] overflow-hidden">
        <img
          src={news.image}
          alt={news.title}
          className="w-full h-full object-cover"
        />
        {/* 하단 그라데이션 */}
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 50%)" }}
        />

        {/* 뒤로가기 */}
        <button
          onClick={() => router.back()}
          className="absolute top-12 left-4 w-10 h-10 rounded-2xl bg-white/70 backdrop-blur-sm flex items-center justify-center active:scale-90 transition-transform"
        >
          <ArrowLeft size={20} className="text-text-main" />
        </button>

        {/* D-Day 뱃지 */}
        <div className="absolute top-12 right-4">
          <span
            className="text-[12px] font-bold px-3 py-1.5 rounded-xl backdrop-blur-sm"
            style={{
              color: news.dday.startsWith("D-") ? "#EF4444" : "#22C55E",
              backgroundColor: news.dday.startsWith("D-") ? "rgba(254,226,226,0.9)" : "rgba(220,252,231,0.9)",
            }}
          >
            {news.dday}
          </span>
        </div>

        {/* 이미지 위 설명 */}
        <p className="absolute bottom-4 left-5 right-5 text-white text-[14px] font-semibold leading-snug drop-shadow-md">
          {news.desc}
        </p>
      </div>

      {/* ── 콘텐츠 ── */}
      <div className="px-5 -mt-6 relative">
        {/* 카드 헤더 */}
        <div className="card p-5 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <span
              className="text-[11px] font-bold px-2.5 py-1 rounded-lg"
              style={{ color: news.badgeColor, backgroundColor: news.badgeBg }}
            >
              {news.badge}
            </span>
            <span className="text-[12px] text-text-light">{news.date}</span>
          </div>
          <h1 className="text-[20px] font-extrabold text-text-main leading-snug mb-2">
            {news.title}
          </h1>
          <p className="text-[14px] text-text-sub leading-relaxed">
            {news.desc}
          </p>
        </div>

        {/* 본문 */}
        <div className="card p-5 mb-4">
          <div className="text-[14px] text-text-main leading-[1.8] whitespace-pre-line">
            {news.body}
          </div>
        </div>

        {/* 외부 링크 */}
        {news.externalUrl && (
          <a
            href={news.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl bg-primary text-white text-[15px] font-bold active:scale-[0.97] transition-transform"
            style={{ boxShadow: "0 6px 20px rgba(255,138,101,0.35)" }}
          >
            <ExternalLink size={18} />
            {news.externalLabel || "관련 홈페이지 바로가기"}
          </a>
        )}
      </div>
    </div>
  );
}
