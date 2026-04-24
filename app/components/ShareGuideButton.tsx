// 보호지침 가이드 공유 버튼 — 카카오톡 Feed 템플릿으로 보내고,
// 실패 시 클립보드 복사 폴백.

"use client";

import { useState } from "react";
import { Share2, Check } from "lucide-react";
import { shareToKakao } from "@/lib/kakao-share";

interface Props {
  slug: string;           // 예: "emergency-guide"
  title: string;          // 예: "길고양이 응급 구조·응급처치 완벽 가이드"
  description: string;    // 1~2줄 요약
  accent?: string;        // 버튼 accent (가이드 색상)
}

export default function ShareGuideButton({ slug, title, description, accent }: Props) {
  const [status, setStatus] = useState<"idle" | "copied" | "sent">("idle");
  const [loading, setLoading] = useState(false);

  const handleShare = async () => {
    if (loading) return;
    setLoading(true);

    const origin = window.location.origin;
    const url = `${origin}/protection/${slug}`;
    const imageUrl = `${origin}/protection/${slug}/opengraph-image`;

    const ok = await shareToKakao({
      title,
      description,
      imageUrl,
      url,
      buttonText: "가이드 읽기",
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
      : "이 가이드 카톡으로 공유";

  return (
    <button
      type="button"
      onClick={handleShare}
      disabled={loading}
      className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl active:scale-[0.98] transition-transform disabled:opacity-70"
      style={{
        backgroundColor: status === "idle" ? "#FEE500" : "#E8F5E9",
        color: status === "idle" ? "#191919" : "#2E7D32",
        boxShadow: status === "idle"
          ? `0 4px 14px rgba(254,229,0,0.35)${accent ? `, 0 0 0 1px ${accent}22` : ""}`
          : "0 2px 8px rgba(46,125,50,0.18)",
      }}
      aria-label="카카오톡으로 가이드 공유"
    >
      {status === "idle" ? <Share2 size={16} /> : <Check size={16} />}
      <span className="text-[13.5px] font-extrabold">{label}</span>
    </button>
  );
}
