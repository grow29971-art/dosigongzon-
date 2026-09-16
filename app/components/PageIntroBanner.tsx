"use client";

// 페이지 상단 "이 페이지 사용법" 안내 배너.
// 2026-09-16 「익숙한 동네앱」 리디자인: 틴트 그라디언트·아이콘 박스·accent 색을 걷어내고
// 흰 면 + 1px 헤어라인. 제목 15px 600, 본문 13px text-sub, CTA는 텍스트 링크.
// X로 dismiss하면 7일 동안 다시 안 뜸(storage 로직은 그대로).

import { useEffect, useState } from "react";
import Link from "next/link";
import { X, ChevronRight } from "lucide-react";

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
  /** @deprecated 리디자인(2026-09-16)으로 악센트 색 폐지 — 받되 무시한다(호출처 호환) */
  accent?: string;
}

export default function PageIntroBanner(props: Props) {
  const { id, title, description, ctaLabel, ctaHref } = props; // accent는 의도적으로 읽지 않는다
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
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-card)",
      }}
      role="note"
    >
      <button
        type="button"
        onClick={dismiss}
        className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center press-strong"
        aria-label="안내 닫기"
      >
        <X size={16} style={{ color: "var(--color-text-light)" }} />
      </button>
      <div className="min-w-0 pr-8">
        <p className="text-[15px] font-semibold text-text-main leading-snug">
          {title}
        </p>
        <p className="text-[13px] text-text-sub mt-1 leading-relaxed">
          {description}
        </p>
        {ctaLabel && ctaHref && (
          <Link
            href={ctaHref}
            className="inline-flex items-center gap-0.5 mt-2 text-[13px] font-semibold press-strong transition-transform"
            style={{ color: "var(--color-primary)" }}
          >
            {ctaLabel}
            <ChevronRight size={14} />
          </Link>
        )}
      </div>
    </div>
  );
}
