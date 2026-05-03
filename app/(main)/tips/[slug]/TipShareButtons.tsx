"use client";

import { useState } from "react";
import { Link2, Check } from "lucide-react";

interface Props {
  url: string;
  title: string;
  description: string;
}

export default function TipShareButtons({ url, title, description }: Props) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } finally {
        document.body.removeChild(ta);
      }
    }
  };

  const naverUrl = `https://share.naver.com/web/shareView?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`;
  const twitterUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`;

  // 카카오톡 공유는 SDK 필요 — 모바일에선 Web Share API로 폴백
  const onKakao = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, text: description, url });
        return;
      } catch {
        // 사용자가 취소한 경우 무시
        return;
      }
    }
    // 데스크탑 폴백: URL 복사
    onCopy();
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        type="button"
        onClick={onCopy}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white text-[12.5px] font-bold text-text-main border border-black/[0.06] active:scale-95 transition-transform"
      >
        {copied ? <Check size={14} className="text-primary" /> : <Link2 size={14} />}
        {copied ? "복사됨" : "URL 복사"}
      </button>

      <button
        type="button"
        onClick={onKakao}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12.5px] font-bold active:scale-95 transition-transform"
        style={{ background: "#FEE500", color: "#3C1E1E" }}
      >
        <span>💬</span> 카카오톡
      </button>

      <a
        href={naverUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12.5px] font-bold text-white active:scale-95 transition-transform"
        style={{ background: "#03C75A" }}
      >
        N 네이버
      </a>

      <a
        href={twitterUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12.5px] font-bold text-white active:scale-95 transition-transform"
        style={{ background: "#000" }}
      >
        𝕏 트위터
      </a>
    </div>
  );
}
