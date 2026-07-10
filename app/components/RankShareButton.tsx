"use client";

// 케어테이커 랭킹 자랑하기 — navigator.share(모바일) → 클립보드 복사 폴백.
import { useState } from "react";
import { Share2, Check } from "lucide-react";

export default function RankShareButton({
  rank,
  score,
  top3,
}: {
  rank: number;
  score: number;
  top3: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const text = top3
      ? `🏆 도시공존 케어테이커 랭킹 ${rank}위 달성! 우리 동네 길고양이 돌보는 중이에요 🐾 (${score.toLocaleString()}점)`
      : `🐾 도시공존 케어테이커 랭킹 ${rank}위! 같이 우리 동네 길고양이 돌봐요 (${score.toLocaleString()}점)`;
    const url = "https://dosigongzon.com/ranking";
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: "도시공존 케어테이커 랭킹", text, url });
      } else {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch {
      /* 취소 등 무시 */
    }
  };

  return (
    <button
      type="button"
      onClick={share}
      className="h-9 px-3.5 rounded-full flex items-center gap-1.5 shrink-0 active:scale-95 transition-transform text-white"
      style={{ background: top3 ? "#C9A961" : "#3182F6", boxShadow: "0 3px 10px rgba(49,130,246,0.3)" }}
      aria-label="내 순위 자랑하기"
    >
      {copied ? <Check size={14} /> : <Share2 size={14} />}
      <span className="text-[12px] font-extrabold">{copied ? "복사됨" : "자랑하기"}</span>
    </button>
  );
}
