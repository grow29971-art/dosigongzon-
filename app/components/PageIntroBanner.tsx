"use client";

// 페이지 상단 "이 페이지 사용법" 안내 배너.
// 2026-09-16 「익숙한 동네앱」 리디자인: 틴트 그라디언트·아이콘 박스·accent 색을 걷어내고
// 흰 면 + 1px 헤어라인. 제목 15px 600, 본문 13px text-sub, CTA는 텍스트 링크.
// X로 dismiss하면 다시 안 뜸.

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

function PageIntroBannerInner(props: Props) {
  const { id, title, description, ctaLabel, ctaHref } = props; // accent는 의도적으로 읽지 않는다
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`dosigongzon_intro_${id}`);
      if (raw) {
        const ts = parseInt(raw, 10);
        const now = Date.now();
        // 한 번 닫으면 다시 안 뜬다 (2026-09-18: 7일 재노출 폐지). 비정상 값만 배제.
        if (!isNaN(ts) && ts > 0 && ts <= now) {
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

// 2026-09-22 디자인 감사: 페이지마다 뜨는 "이 화면은 이런 곳이에요" 모달·배너는 AI 생성 앱의 1순위 지문
// (첫 진입 오버레이 중첩·설명문 과다). 당근·토스는 화면이 스스로 설명한다. 되살리려면 이 플래그만 true.
const SHOW_PAGE_INTROS = false;
export default function PageIntroBanner(props: Parameters<typeof PageIntroBannerInner>[0]) {
  if (!SHOW_PAGE_INTROS) return null;
  return <PageIntroBannerInner {...props} />;
}
