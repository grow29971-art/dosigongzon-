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
  /** @deprecated 리디자인(2026-09-16)으로 악센트 폐지 — 받되 무시한다(호출처 호환) */
  accent?: string;
}

export default function ShareGuideButton({ slug, title, description }: Props) {
  const [status, setStatus] = useState<"idle" | "copied" | "sent">("idle");
  const [loading, setLoading] = useState(false);

  const handleShare = async () => {
    if (loading) return;
    setLoading(true);

    const origin = window.location.origin;
    const url = `${origin}/protection/${slug}?utm_source=kakao&utm_medium=share&utm_campaign=guide_share`;
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
      className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl press transition-transform disabled:opacity-70"
      style={{
        backgroundColor: status === "idle" ? "#FEE500" : "var(--color-gray-100)",
        color: status === "idle" ? "var(--color-text-main)" : "var(--color-sage)",
      }}
      aria-label="카카오톡으로 가이드 공유"
    >
      {status === "idle" ? <Share2 size={16} /> : <Check size={16} />}
      <span className="text-[15px] font-bold">{label}</span>
    </button>
  );
}
