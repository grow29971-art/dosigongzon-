"use client";

import { useEffect, useState } from "react";
import { Gift, Copy, Check, Share2, Users, Loader2 } from "lucide-react";
import { getMyInviteInfo, type MyInviteInfo } from "@/lib/invites-repo";
import { shareToKakao } from "@/lib/kakao-share";
import { track } from "@vercel/analytics";

export default function InviteSection() {
  const [info, setInfo] = useState<MyInviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getMyInviteInfo()
      .then((res) => { if (!cancelled) { setInfo(res); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const inviteUrl = info?.inviteCode
    ? `${typeof window !== "undefined" ? window.location.origin : "https://dosigongzon.com"}/signup?invite=${info.inviteCode}`
    : "";

  const handleCopy = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      try { track("invite_link_copied"); } catch {}
    } catch {
      window.prompt("링크를 복사해주세요:", inviteUrl);
    }
  };

  const handleShare = async () => {
    if (!info?.inviteCode || sharing) return;
    setSharing(true);
    try { track("invite_share_kakao_started"); } catch {}

    const origin = typeof window !== "undefined" ? window.location.origin : "https://dosigongzon.com";
    const url = `${origin}/signup?invite=${info.inviteCode}&utm_source=kakao&utm_medium=invite&utm_campaign=mypage`;
    const title = "도시공존에 초대해요 🐾";
    const description = `동네 길고양이 돌봄 지도에 함께해요. 초대 코드: ${info.inviteCode}`;
    const imageUrl = `${origin}/opengraph-image`;

    const ok = await shareToKakao({
      title,
      description,
      imageUrl,
      url,
      buttonText: "초대 수락하고 가입하기",
    });

    if (!ok) {
      // 폴백: 복사
      handleCopy();
    } else {
      try { track("invite_share_kakao_sent"); } catch {}
    }
    setSharing(false);
  };

  return (
    <div className="mb-3">
      <div className="flex items-center gap-2 mb-3 px-1">
        <div className="w-1 h-4 rounded-full" style={{ backgroundColor: "var(--color-like)" }} />
        <h2 className="text-[15px] font-bold text-text-main tracking-tight">
          친구 초대
        </h2>
        <span className="text-[9px] font-bold tracking-[0.15em]" style={{ color: "var(--color-like)", opacity: 0.6 }}>
          GROW TOGETHER
        </span>
      </div>

      <div
        className="p-5"
        style={{
          background: "linear-gradient(135deg, #FFF5F8 0%, #FFE9F0 100%)",
          borderRadius: "var(--radius-card)",
          border: "1px solid var(--color-like-soft)",
          boxShadow: "0 4px 14px var(--color-like-soft)",
        }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
            style={{
              background: "var(--color-like)",
              boxShadow: "0 4px 12px var(--color-like-soft)",
            }}
          >
            <Gift size={20} color="#fff" strokeWidth={2.2} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-bold text-text-main tracking-tight">
              내 초대 코드
            </p>
            <p className="text-[11px] text-text-sub mt-0.5 leading-snug">
              친구가 이 코드로 가입하면 서로 연결돼요
            </p>
          </div>
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full" style={{ background: "var(--color-like-soft)" }}>
            <Users size={12} style={{ color: "var(--color-like)" }} />
            <span className="text-[11px] font-bold" style={{ color: "var(--color-like)" }}>
              {info?.invitedCount ?? 0}명
            </span>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 size={18} className="animate-spin text-text-muted" />
          </div>
        ) : info?.inviteCode ? (
          <>
            {/* 코드 표시 */}
            <div
              className="flex items-center justify-between gap-2 px-4 py-3.5 rounded-xl mb-2.5"
              style={{ background: "#FFF", border: "1.5px dashed var(--color-like-soft)" }}
            >
              <div>
                <p className="text-[11px] font-bold text-text-light tracking-[0.1em]">INVITE CODE</p>
                <p
                  className="text-[24px] font-extrabold tracking-[0.18em] mt-0.5"
                  style={{ color: "var(--color-like)" }}
                >
                  {info.inviteCode}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl press-strong transition-transform"
                style={{
                  background: copied ? "var(--color-sage-soft)" : "var(--color-like-soft)",
                  color: copied ? "#2E7D32" : "var(--color-like)",
                }}
                aria-label="초대 링크 복사"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                <span className="text-[13px] font-bold">{copied ? "복사됨" : "링크 복사"}</span>
              </button>
            </div>

            {/* 카톡 공유 */}
            <button
              type="button"
              onClick={handleShare}
              disabled={sharing}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl press transition-transform disabled:opacity-60"
              style={{
                backgroundColor: "#FEE500",
                color: "#191919",
                boxShadow: "0 4px 12px rgba(254,229,0,0.35)",
              }}
            >
              <Share2 size={14} />
              <span className="text-[13px] font-bold">카카오톡으로 초대장 보내기</span>
            </button>

            {info.invitedByCode && (
              <p className="text-[11px] text-text-light text-center mt-3">
                ✨ <b style={{ color: "var(--color-primary)" }}>{info.invitedByCode}</b> 코드로 가입했어요
              </p>
            )}
          </>
        ) : (
          <p className="text-[13px] text-text-sub text-center py-4">
            초대 코드를 불러올 수 없어요. 잠시 후 다시 시도해주세요.
          </p>
        )}
      </div>
    </div>
  );
}
