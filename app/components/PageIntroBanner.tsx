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
// 2026-09-16 시빅 포스터(대안 C): 틴트 그라디언트 카드 → 검정 밴드 + 라임 아이콘 박스.
// accent prop은 호환용으로 남기되 밴드에서는 쓰지 않는다(라임은 검정 위에서만).
export default function PageIntroBanner({
  id,
  title,
  description,
  ctaLabel,
  ctaHref,
}: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`dosigongzon_intro_${id}`);
      if (raw) {
        const ts = parseInt(raw, 10);
        const now = Date.now();
        // 미래 timestamp/비정상 값 배제 (영구 숨김 악용 방지)
        if (!isNaN(ts) && ts > 0 && ts <= now && now - ts < 7 * 24 * 60 * 60 * 1000) {
          return;
        }
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
      className="relative p-4 mx-1"
      style={{ background: "var(--color-rule)", color: "#FFFFFF" }}
      role="note"
    >
      <button
        type="button"
        onClick={dismiss}
        className="absolute top-2.5 right-2.5 w-6 h-6 flex items-center justify-center press-strong"
        style={{ background: "rgba(255,255,255,0.12)" }}
        aria-label="안내 닫기"
      >
        <X size={11} color="#FFFFFF" />
      </button>
      <div className="flex items-start gap-2.5 pr-6">
        <div
          className="w-7 h-7 flex items-center justify-center shrink-0 mt-0.5"
          style={{ backgroundColor: "var(--color-lime)" }}
        >
          <Sparkles size={14} color="#111111" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold tracking-tight" style={{ color: "#FFFFFF" }}>
            {title}
          </p>
          <p className="text-[13px] mt-1 leading-relaxed" style={{ color: "rgba(255,255,255,0.72)" }}>
            {description}
          </p>
          {ctaLabel && ctaHref && (
            <Link
              href={ctaHref}
              className="inline-flex items-center gap-0.5 mt-2 text-[13px] font-bold press-strong transition-transform"
              style={{ color: "var(--color-lime)" }}
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
