// 소식(뉴스) 글 공유 버튼 — 카카오톡 Feed 템플릿 + 클립보드 폴백.
// 동적 OG 이미지(/news/[id]/opengraph-image)와 함께 매력적 미리보기 발송.

"use client";

import { useState } from "react";
import { Share2, Check } from "lucide-react";
import { shareToKakao } from "@/lib/kakao-share";

interface Props {
  newsId: string;
  title: string;
  description: string | null;
  badgeLabel?: string;
}

export default function ShareNewsButton({ newsId, title, description, badgeLabel }: Props) {
  const [status, setStatus] = useState<"idle" | "copied" | "sent">("idle");
  const [loading, setLoading] = useState(false);

  const handleShare = async () => {
    if (loading) return;
    setLoading(true);

    const origin = window.location.origin;
    const url = `${origin}/news/${newsId}`;
    const imageUrl = `${origin}/news/${newsId}/opengraph-image`;
    const desc =
      (description ?? "").slice(0, 100) ||
      `${badgeLabel ?? "소식"} — 도시공존이 전하는 길고양이·동물보호 이야기`;

    const ok = await shareToKakao({
      title,
      description: desc,
      imageUrl,
      url,
      buttonText: "기사 읽기",
    });

    if (ok) {
      setStatus("sent");
      setTimeout(() => setStatus("idle"), 2000);
      setLoading(false);
      return;
    }

    try {
      await navigator.clipboard?.writeText(url);
      setStatus("copied");
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      window.prompt("아래 링크를 복사해서 공유하세요:", url);
    }
    setLoading(false);
  };

  const label =
    status === "sent"
      ? "카카오톡으로 보냈어요"
      : status === "copied"
      ? "링크가 복사됐어요"
      : "이 소식 카톡으로 공유";

  return (
    <button
      type="button"
      onClick={handleShare}
      disabled={loading}
      className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl active:scale-[0.98] transition-transform disabled:opacity-70"
      style={{
        backgroundColor: status === "idle" ? "#FEE500" : "#E8F5E9",
        color: status === "idle" ? "#191919" : "#2E7D32",
        boxShadow:
          status === "idle"
            ? "0 4px 14px rgba(254,229,0,0.35)"
            : "0 2px 8px rgba(46,125,50,0.18)",
      }}
    >
      {status === "idle" ? <Share2 size={16} aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
      <span className="text-[13.5px] font-extrabold">{label}</span>
    </button>
  );
}
