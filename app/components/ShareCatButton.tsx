"use client";

import { useState } from "react";
import { Share2, Check, Siren } from "lucide-react";
import { shareToKakao } from "@/lib/kakao-share";

interface Props {
  catId: string;
  name: string;
  region: string;
  description: string | null;
  urgent?: boolean;
}

export default function ShareCatButton({ catId, name, region, description, urgent = false }: Props) {
  const [status, setStatus] = useState<"idle" | "copied" | "sent">("idle");
  const [loading, setLoading] = useState(false);

  const handleShare = async () => {
    if (loading) return;
    setLoading(true);

    const origin = window.location.origin;
    const url = `${origin}/cats/${catId}`;
    const title = urgent
      ? `🚨 긴급 돌봄 필요: ${name} · ${region}`
      : `${name} · ${region}`;
    const desc = urgent
      ? description
        ? `건강 상태 위험! ${description.slice(0, 80)}`
        : `${region}의 ${name}이(가) 건강 상태가 위험해요. 근처 캣맘/캣대디의 도움이 필요합니다 🚨`
      : description
      ? description.slice(0, 100)
      : `${region}에 사는 ${name}을(를) 함께 돌봐주세요 🐾`;
    const imageUrl = `${origin}/cats/${catId}/opengraph-image`;

    const ok = await shareToKakao({
      title,
      description: desc,
      imageUrl,
      url,
      buttonText: urgent ? "바로 확인하기" : "돌봄 기록 보기",
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

  if (urgent) {
    const urgentLabel =
      status === "sent"
        ? "긴급 공유 완료"
        : status === "copied"
        ? "링크 복사됨 — 단톡방에 붙여넣기"
        : "🚨 긴급 · 동네에 알리기";
    return (
      <button
        type="button"
        onClick={handleShare}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl active:scale-[0.98] transition-transform disabled:opacity-70"
        style={{
          background: status === "idle"
            ? "linear-gradient(135deg, #E53935 0%, #C62828 100%)"
            : "linear-gradient(135deg, #2E7D32 0%, #1B5E20 100%)",
          color: "#fff",
          boxShadow: status === "idle"
            ? "0 6px 22px rgba(229,57,53,0.45)"
            : "0 4px 14px rgba(46,125,50,0.35)",
          animation: status === "idle" ? "urgent-pulse 1.6s ease-in-out infinite" : undefined,
        }}
        aria-label="긴급 카카오톡 공유"
      >
        {status === "idle" ? <Siren size={18} /> : <Check size={18} />}
        <span className="text-[14px] font-extrabold">{urgentLabel}</span>
        <style jsx>{`
          @keyframes urgent-pulse {
            0%, 100% { box-shadow: 0 6px 22px rgba(229,57,53,0.45); }
            50% { box-shadow: 0 6px 28px rgba(229,57,53,0.75); }
          }
        `}</style>
      </button>
    );
  }

  const label =
    status === "sent"
      ? "카카오톡으로 보냈어요"
      : status === "copied"
      ? "링크가 복사됐어요"
      : "이 아이 카톡으로 알리기";

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
          ? "0 4px 14px rgba(254,229,0,0.35)"
          : "0 2px 8px rgba(46,125,50,0.18)",
      }}
      aria-label="카카오톡으로 고양이 공유"
    >
      {status === "idle" ? <Share2 size={16} /> : <Check size={16} />}
      <span className="text-[13.5px] font-extrabold">{label}</span>
    </button>
  );
}
