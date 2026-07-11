"use client";

import { Share2 } from "lucide-react";
import { useToast } from "@/app/components/Toast";

export default function MonthlyReportShareButton({ text }: { text: string }) {
  const toast = useToast();

  const handleShare = async () => {
    if (navigator.share) {
      try { await navigator.share({ text }); } catch { /* 사용자가 취소한 경우 등 — 조용히 무시 */ }
      return;
    }
    await navigator.clipboard.writeText(text);
    toast.success("리포트 내용을 클립보드에 복사했어요!");
  };

  return (
    <button
      onClick={handleShare}
      className="w-full flex items-center justify-center gap-2 py-3.5 active:scale-[0.98] transition-transform"
      style={{
        background: "#5BA876",
        borderRadius: "var(--radius-input)",
        boxShadow: "0 4px 14px rgba(91,168,118,0.30)",
      }}
    >
      <Share2 size={16} color="#fff" strokeWidth={2.2} />
      <span className="text-[14px] font-extrabold text-white">이번 달 리포트 공유하기</span>
    </button>
  );
}
