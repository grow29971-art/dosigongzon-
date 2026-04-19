"use client";

import { useState } from "react";
import { Share2, Check } from "lucide-react";
import { shareToKakao } from "@/lib/kakao-share";

interface Props {
  guName: string;
  slug: string;
  catCount: number;
  urgentCount: number;
}

export default function ShareAreaButton({ guName, slug, catCount, urgentCount }: Props) {
  const [status, setStatus] = useState<"idle" | "copied" | "sent">("idle");
  const [loading, setLoading] = useState(false);

  const handleShare = async () => {
    if (loading) return;
    setLoading(true);

    const origin = window.location.origin;
    const isRoot = !slug;
    // utm 파라미터로 유입 추적
    const url = isRoot
      ? `${origin}/?utm_source=kakao&utm_medium=share&utm_campaign=home_landing`
      : `${origin}/areas/${slug}?utm_source=kakao&utm_medium=share&utm_campaign=area_landing`;
    const title = isRoot
      ? "도시공존 — 길고양이 돌봄 지도"
      : `${guName} 길고양이 돌봄 지도`;
    const description = urgentCount > 0
      ? `${guName}에서 지금 도움이 필요한 아이 ${urgentCount}마리. 동네 이웃이 함께 지켜요 🐾`
      : catCount > 0
      ? isRoot
        ? `서울 전역 길고양이 ${catCount}마리의 돌봄 기록을 시민이 함께 남기고 있어요 🐾`
        : `${guName}에 등록된 길고양이 ${catCount}마리의 돌봄 기록.`
      : `${guName} 동네 길고양이를 함께 돌봐주세요 🐾`;
    const imageUrl = `${origin}/opengraph-image`;

    const ok = await shareToKakao({
      title,
      description,
      imageUrl,
      url,
      buttonText: isRoot ? "도시공존 열기" : `${guName} 지도 보기`,
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
      : !slug
      ? "단톡방에 도시공존 알리기"
      : "우리 동네 단톡방에 알리기";

  return (
    <button
      type="button"
      onClick={handleShare}
      disabled={loading}
      className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl active:scale-[0.98] transition-transform disabled:opacity-70"
      style={{
        backgroundColor: status === "idle" ? "#FEE500" : "#E8F5E9",
        color: status === "idle" ? "#191919" : "#2E7D32",
        boxShadow: status === "idle"
          ? "0 4px 14px rgba(254,229,0,0.35)"
          : "0 2px 8px rgba(46,125,50,0.18)",
      }}
      aria-label="카카오톡으로 동네 지도 공유"
    >
      {status === "idle" ? <Share2 size={14} /> : <Check size={14} />}
      <span className="text-[13px] font-extrabold">{label}</span>
    </button>
  );
}
