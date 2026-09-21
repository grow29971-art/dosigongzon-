"use client";

// 친구 초대 섹션 — 내 초대 코드 복사·카카오 공유.
// 2026-09-16 「익숙한 동네앱」 리디자인: 분홍 틴트·글로우·장식 라벨 폐기 → 흰 면 + 헤어라인.
// 카카오 노랑(#FEE500)은 브랜드 가이드 색이라 유지.

import { useEffect, useState } from "react";
import { Copy, Check, Share2, Users, Loader2 } from "lucide-react";
import { getMyInviteInfo, type MyInviteInfo } from "@/lib/invites-repo";
import { shareToKakao } from "@/lib/kakao-share";
import { track } from "@vercel/analytics";
import { hideInMiniApp } from "@/lib/miniapp";

function InviteSection() {
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
      <div className="mb-2 px-1">
        <h2 className="text-[17px] font-bold text-text-main">
          친구 초대
        </h2>
      </div>

      <div
        className="p-4"
        style={{
          background: "var(--color-surface)",
          borderRadius: "var(--radius-card)",
          border: "1px solid var(--color-border)",
        }}
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-semibold text-text-main">
              내 초대 코드
            </p>
            <p className="text-[13px] text-text-sub mt-0.5 leading-snug">
              친구가 이 코드로 가입하면 서로 연결돼요
            </p>
          </div>
          <div className="flex items-center gap-1 text-text-light">
            <Users size={13} />
            <span className="text-[13px] font-medium tabular-nums">
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
              className="flex items-center justify-between gap-2 px-4 py-3 mb-2"
              style={{ borderRadius: "var(--radius-card-sm)", background: "var(--color-surface-alt)" }}
            >
              <div>
                <p className="text-[11px] font-medium text-text-light">INVITE CODE</p>
                <p className="text-[20px] font-bold tracking-[0.12em] mt-0.5 text-text-main">
                  {info.inviteCode}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1.5 h-8 px-3 press-strong transition-transform"
                style={{
                  borderRadius: "var(--radius-input)",
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  color: copied ? "var(--color-sage)" : "var(--color-text-main)",
                }}
                aria-label="초대 링크 복사"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                <span className="text-[13px] font-semibold">{copied ? "복사됨" : "링크 복사"}</span>
              </button>
            </div>

            {/* 카톡 공유 — 카카오 브랜드 색 유지 */}
            <button
              type="button"
              onClick={handleShare}
              disabled={sharing}
              className="w-full h-10 flex items-center justify-center gap-2 press transition-transform disabled:opacity-60"
              style={{
                borderRadius: "var(--radius-input)",
                backgroundColor: "#FEE500",
                color: "var(--color-text-main)",
              }}
            >
              <Share2 size={14} />
              <span className="text-[15px] font-semibold">카카오톡으로 초대장 보내기</span>
            </button>

            {info.invitedByCode && (
              <p className="text-[11px] text-text-light text-center mt-3">
                <b className="font-semibold text-text-sub">{info.invitedByCode}</b> 코드로 가입했어요
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

// 앱인토스 미니앱에서는 숨김(웹푸시·쇼핑·서클·초대 링크 없음)
export default hideInMiniApp(InviteSection);
