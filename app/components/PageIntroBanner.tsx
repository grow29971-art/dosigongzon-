"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X, Sparkles, ArrowRight } from "lucide-react";

interface Props {
  /** localStorage 키 — 페이지별로 다르게 */
  id: string;
  /** 배너 제목 */
  title: string;
  /** 설명 본문 — 2~3줄 */
  description: string;
  /** CTA 버튼 라벨 (선택) */
  ctaLabel?: string;
  /** CTA 링크 — 가이드/자세히 보기 */
  ctaHref?: string;
  /** 악센트 색상 */
  accent?: string;
}

/**
 * 페이지 상단에 표시되는 "이 페이지 사용법" 안내 배너.
 * X로 dismiss하면 7일 동안 다시 안 뜸.
 */
export default function PageIntroBanner({
  id,
  title,
  description,
  ctaLabel,
  ctaHref,
  accent = "#C47E5A",
}: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`dosigongzon_intro_${id}`);
      if (raw) {
        const ts = parseInt(raw, 10);
        if (!isNaN(ts) && Date.now() - ts < 7 * 24 * 60 * 60 * 1000) return;
      }
    } catch { /* no-op */ }
    setVisible(true);
  }, [id]);

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(`dosigongzon_intro_${id}`, String(Date.now()));
    } catch { /* no-op */ }
  };

  if (!visible) return null;

  return (
    <div
      className="relative rounded-2xl p-4 mx-1"
      style={{
        background: `linear-gradient(135deg, #FFFFFF 0%, ${accent}0C 100%)`,
        border: `1px solid ${accent}30`,
        boxShadow: `0 4px 14px ${accent}12`,
      }}
      role="note"
    >
      <button
        type="button"
        onClick={dismiss}
        className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full flex items-center justify-center active:scale-90"
        style={{ background: "rgba(0,0,0,0.05)" }}
        aria-label="안내 닫기"
      >
        <X size={11} className="text-text-sub" />
      </button>
      <div className="flex items-start gap-2.5 pr-6">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
          style={{ backgroundColor: `${accent}1A` }}
        >
          <Sparkles size={14} style={{ color: accent }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-extrabold text-text-main tracking-tight">
            {title}
          </p>
          <p className="text-[11.5px] text-text-sub mt-1 leading-relaxed">
            {description}
          </p>
          {ctaLabel && ctaHref && (
            <Link
              href={ctaHref}
              className="inline-flex items-center gap-0.5 mt-2 text-[11.5px] font-extrabold active:scale-95 transition-transform"
              style={{ color: accent }}
            >
              {ctaLabel}
              <ArrowRight size={11} />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
