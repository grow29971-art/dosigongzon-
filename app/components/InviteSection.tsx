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
    const url = `${origin}/signup?invite=${info.inviteCode}&utm_source=kakao&utm_medium=invite`;
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
        <div className="w-1 h-4 rounded-full" style={{ backgroundColor: "#E86B8C" }} />
        <h2 className="text-[14px] font-extrabold text-text-main tracking-tight">
          친구 초대
        </h2>
        <span className="text-[9px] font-bold tracking-[0.15em]" style={{ color: "#E86B8C", opacity: 0.6 }}>
          GROW TOGETHER
        </span>
      </div>

      <div
        className="p-5"
        style={{
          background: "linear-gradient(135deg, #FFF5F8 0%, #FFE9F0 100%)",
          borderRadius: 20,
          border: "1px solid rgba(232,107,140,0.18)",
          boxShadow: "0 4px 14px rgba(232,107,140,0.12)",
        }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
            style={{
              background: "linear-gradient(135deg, #E86B8C 0%, #D85577 100%)",
              boxShadow: "0 4px 12px rgba(232,107,140,0.35)",
            }}
          >
            <Gift size={20} color="#fff" strokeWidth={2.2} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13.5px] font-extrabold text-text-main tracking-tight">
              내 초대 코드
            </p>
            <p className="text-[11px] text-text-sub mt-0.5 leading-snug">
              친구가 이 코드로 가입하면 서로 연결돼요
            </p>
          </div>
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full" style={{ background: "rgba(232,107,140,0.12)" }}>
            <Users size={12} style={{ color: "#E86B8C" }} />
            <span className="text-[11px] font-extrabold" style={{ color: "#E86B8C" }}>
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
              style={{ background: "#FFF", border: "1.5px dashed rgba(232,107,140,0.35)" }}
            >
              <div>
                <p className="text-[10px] font-bold text-text-light tracking-[0.1em]">INVITE CODE</p>
                <p
                  className="text-[22px] font-black tracking-[0.18em] mt-0.5"
                  style={{ color: "#D85577" }}
                >
                  {info.inviteCode}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl active:scale-95 transition-transform"
                style={{
                  background: copied ? "#E8F5E9" : "rgba(232,107,140,0.12)",
                  color: copied ? "#2E7D32" : "#D85577",
                }}
                aria-label="초대 링크 복사"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                <span className="text-[11.5px] font-extrabold">{copied ? "복사됨" : "링크 복사"}</span>
              </button>
            </div>

            {/* 카톡 공유 */}
            <button
              type="button"
              onClick={handleShare}
              disabled={sharing}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl active:scale-[0.98] transition-transform disabled:opacity-60"
              style={{
                backgroundColor: "#FEE500",
                color: "#191919",
                boxShadow: "0 4px 12px rgba(254,229,0,0.35)",
              }}
            >
              <Share2 size={14} />
              <span className="text-[13px] font-extrabold">카카오톡으로 초대장 보내기</span>
            </button>

            {info.invitedByCode && (
              <p className="text-[10.5px] text-text-light text-center mt-3">
                ✨ <b style={{ color: "#C47E5A" }}>{info.invitedByCode}</b> 코드로 가입했어요
              </p>
            )}
          </>
        ) : (
          <p className="text-[12px] text-text-sub text-center py-4">
            초대 코드를 불러올 수 없어요. 잠시 후 다시 시도해주세요.
          </p>
        )}
      </div>
    </div>
  );
}
