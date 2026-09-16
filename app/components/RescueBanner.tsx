"use client";

import Link from "next/link";
import { AlertTriangle, ChevronRight } from "lucide-react";

/**
 * 긴급 상태 고양이가 있을 때만 홈에 표시되는 배너.
 * Scarcity/Urgency 원리 — 제한적으로 노출되어야 효과.
 * 2026-09-16 「익숙한 동네앱」 리디자인: 붉은 그라디언트 → 흰 면 + 헤어라인, 긴급만 error 의미색.
 */
export default function RescueBanner({ count }: { count: number }) {
  if (count <= 0) return null;

  return (
    <Link
      href="/rescue"
      className="block mb-5 press transition-transform"
    >
      <div
        className="px-4 flex items-center gap-3"
        style={{
          minHeight: 64,
          background: "var(--color-surface)",
          borderRadius: "var(--radius-card)",
          border: "1px solid var(--color-border)",
        }}
      >
        <AlertTriangle size={22} className="shrink-0" style={{ color: "var(--color-error)" }} strokeWidth={2} />
        <div className="flex-1 min-w-0 py-3">
          <p className="text-[11px] font-semibold" style={{ color: "var(--color-error)" }}>
            URGENT · 지금 돌봄 필요
          </p>
          <p className="text-[15px] font-semibold text-text-main leading-snug mt-0.5">
            위험 상태 아이 <span style={{ color: "var(--color-error)" }}>{count}마리</span>가 기다리고 있어요
          </p>
        </div>
        <ChevronRight size={18} className="shrink-0" style={{ color: "var(--color-text-muted)" }} />
      </div>
    </Link>
  );
}
