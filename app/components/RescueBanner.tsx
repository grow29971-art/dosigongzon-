"use client";

import Link from "next/link";
import { AlertTriangle, ChevronRight } from "lucide-react";

/**
 * 긴급 상태 고양이가 있을 때만 홈에 표시되는 배너.
 * Scarcity/Urgency 원리 — 제한적으로 노출되어야 효과.
 */
export default function RescueBanner({ count }: { count: number }) {
  if (count <= 0) return null;

  return (
    <Link
      href="/rescue"
      className="block mb-5 active:scale-[0.99] transition-transform"
    >
      <div
        className="rounded-2xl px-4 py-3 flex items-center gap-3"
        style={{
          background: "linear-gradient(135deg, #FFEBEB 0%, #FFD9D9 100%)",
          border: "1.5px solid #D85555",
          boxShadow: "0 4px 14px rgba(216,85,85,0.15)",
        }}
      >
        <div
          className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 relative"
          style={{
            background: "linear-gradient(135deg, #E85555 0%, #C43838 100%)",
            boxShadow: "0 4px 12px rgba(216,85,85,0.4)",
          }}
        >
          <AlertTriangle size={18} color="#fff" strokeWidth={2.5} />
          <span
            className="absolute -top-1 -right-1 w-3 h-3 rounded-full animate-pulse"
            style={{ background: "#FF3838", border: "1.5px solid #fff" }}
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-extrabold tracking-[0.12em] text-[#B84545] dark:text-[#FF9090]">
            URGENT · 지금 돌봄 필요
          </p>
          <p className="text-[13.5px] font-extrabold tracking-tight leading-tight mt-0.5 text-[#3A1F1F] dark:text-[#FFE0E0]">
            위험 상태 아이 <span className="text-[#D85555] dark:text-[#FF8585]">{count}마리</span>가 기다리고 있어요
          </p>
        </div>
        <ChevronRight size={18} className="text-[#D85555] dark:text-[#FF8585]" />
      </div>
    </Link>
  );
}
