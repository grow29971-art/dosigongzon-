"use client";

import { useState } from "react";
import { Sparkles, PawPrint, Heart, Share2 } from "lucide-react";
import { getMyInviteInfo } from "@/lib/invites-repo";
import { shareToKakao } from "@/lib/kakao-share";
import { track } from "@vercel/analytics";
import CatCard, { type CatCardData } from "@/app/components/CatCard";
import type { Cat } from "@/lib/cats-repo";

type Props = {
  open: boolean;
  catName: string;
  isFirstEver: boolean;
  registrationCount?: number;
  cat?: Cat | null;
  card?: CatCardData | null;
  onClose: () => void;
};

/**
 * 고양이 등록 직후 peak-end 축하.
 * - 첫 등록은 특별한 메시지 (서비스 합류의 순간)
 * - 일반 등록은 짧은 확인
 */
export default function CatRegistrationCelebration({
  open,
  catName,
  isFirstEver,
  registrationCount = 0,
  cat = null,
  card = null,
  onClose,
}: Props) {
  const [inviting, setInviting] = useState(false);

  if (!open) return null;

  // peak-end 시점에 viral 트리거 — cat 등록 직후가 사용자 만족 최고점.
  // 첫 등록(isFirstEver)일 때만 노출 — 매 등록마다 권유하면 피로감.
  const handleInvite = async () => {
    if (inviting) return;
    setInviting(true);
    try {
      const info = await getMyInviteInfo();
      if (!info?.inviteCode) {
        setInviting(false);
        return;
      }
      const origin = typeof window !== "undefined" ? window.location.origin : "https://dosigongzon.com";
      const url = `${origin}/signup?invite=${info.inviteCode}&utm_source=kakao&utm_medium=invite&utm_campaign=first_cat`;
      try { track("invite_from_first_cat_started"); } catch {}
      const ok = await shareToKakao({
        title: `${catName}을(를) 동네에 등록했어요 🐾`,
        description: "이 아이를 같이 돌볼 수 있게 도시공존에 함께해주세요. 광고 없는 무료 시민 참여 길고양이 지도예요.",
        imageUrl: `${origin}/opengraph-image`,
        url,
        buttonText: "초대 수락하고 함께 돌보기",
      });
      if (ok) {
        try { track("invite_from_first_cat_sent"); } catch {}
      }
    } catch {
      // 무시 — 사용자가 invite 보내고 싶지 않거나 카카오 실패
    } finally {
      setInviting(false);
    }
  };

  // milestone 인식 — 5/10/20/50 마리째 등록 시 특별 메시지
  // 그 외 일반 등록은 단순 확인 + N마리째 카운터 노출(누적감)
  const milestoneInfo = ((): { headline: string; subline: string } | null => {
    if (isFirstEver) return null;
    if (registrationCount === 50) return { headline: `🥇 50마리째! ${catName}`, subline: "동네의 절반을 알게 된 진정한 케어테이커예요" };
    if (registrationCount === 20) return { headline: `👑 20마리째! ${catName}`, subline: "마을의 눈 — 동네 길잡이가 되셨어요" };
    if (registrationCount === 10) return { headline: `🏡 10마리째! ${catName}`, subline: "두 자릿수 케어테이커 영역에 들어왔어요" };
    if (registrationCount === 5) return { headline: `🐾 5마리째! ${catName}`, subline: "부지런한 집사 영역에 들어왔어요" };
    if (registrationCount === 3) return { headline: `🌱 3마리째! ${catName}`, subline: "동네 지도가 점점 두꺼워져요" };
    return null;
  })();

  const headline = isFirstEver
    ? `${catName}이(가) 지도에 올라왔어요! 🎉`
    : milestoneInfo?.headline ?? `${catName} 등록 완료`;

  const subline = isFirstEver
    ? "이 아이의 첫 기록자가 되어주셨어요"
    : milestoneInfo?.subline
      ?? (registrationCount > 0
        ? `${registrationCount}마리째 친구가 합류했어요`
        : "이웃들이 함께 돌볼 수 있도록 공유됐어요");

  return (
    <div
      className="fixed inset-0 z-[160] flex items-center justify-center p-5"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="cat-register-celebration-title"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-[28px] overflow-hidden relative"
        style={{ background: "#FFFFFF", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}
      >
        <div
          className="relative px-6 pt-8 pb-5 overflow-hidden"
          style={{
            background: isFirstEver
              ? "linear-gradient(135deg, #FFE3D5 0%, #FFCFB5 100%)"
              : "linear-gradient(135deg, #F5E6D8 0%, #E8D5C0 100%)",
          }}
        >
          <div className="absolute top-3 left-5 animate-pulse">
            <Sparkles size={14} style={{ color: "#E8B040", opacity: 0.8 }} />
          </div>
          <div className="absolute top-10 right-8 animate-pulse" style={{ animationDelay: "0.3s" }}>
            <PawPrint size={12} style={{ color: "#C47E5A", opacity: 0.5 }} />
          </div>
          <div className="absolute bottom-4 right-6 animate-pulse" style={{ animationDelay: "0.6s" }}>
            <Sparkles size={16} style={{ color: "#C47E5A", opacity: 0.8 }} />
          </div>

          <div className="flex items-center justify-center mb-3">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, #C47E5A 0%, #A8684A 100%)",
                boxShadow: "0 8px 24px rgba(196,126,90,0.4)",
              }}
            >
              {isFirstEver ? (
                <Heart size={26} color="#fff" fill="#fff" strokeWidth={0} />
              ) : (
                <PawPrint size={26} color="#fff" strokeWidth={2.5} />
              )}
            </div>
          </div>

          <h2
            id="cat-register-celebration-title"
            className="text-[18px] font-extrabold text-text-main text-center tracking-tight leading-tight px-2"
          >
            {headline}
          </h2>
          <p className="text-[12.5px] font-bold text-text-sub text-center mt-1.5 leading-snug">
            {subline}
          </p>
        </div>

        <div className="px-6 pb-6 pt-4">
          {/* CatchCat 카드 */}
          {card && (
            <div className="flex flex-col items-center mb-4">
              <p className="text-[11px] font-bold text-gray-400 mb-2 tracking-widest uppercase">✦ 고양이 카드 획득 ✦</p>
              <CatCard
                name={catName}
                photoUrl={cat?.photo_url ?? null}
                card={card}
                size="md"
              />
              <p className="text-[10px] text-gray-400 mt-2">마이페이지 → 내 카드에서 확인할 수 있어요</p>
            </div>
          )}
          {isFirstEver && !card && (
            <div
              className="rounded-2xl px-4 py-3 mb-3 text-[11.5px] leading-snug"
              style={{ background: "#FFF9EF", color: "#7A5F3F" }}
            >
              <p className="font-extrabold mb-1" style={{ color: "#C47E5A" }}>
                💡 다음 단계 힌트
              </p>
              <p>
                돌봄다이어리 한 줄을 남기면 레벨·업적이 시작돼요. 근처 이웃에게
                알림도 함께 전달됩니다.
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 rounded-2xl text-[13px] font-extrabold text-white active:scale-[0.98]"
            style={{
              background: "linear-gradient(135deg, #C47E5A 0%, #A8684A 100%)",
              boxShadow: "0 4px 14px rgba(196,126,90,0.45)",
            }}
          >
            확인
          </button>
          {isFirstEver && (
            <button
              type="button"
              onClick={handleInvite}
              disabled={inviting}
              className="w-full mt-2 py-2.5 rounded-2xl text-[12px] font-extrabold flex items-center justify-center gap-1.5 active:scale-[0.98] disabled:opacity-60"
              style={{
                backgroundColor: "#FEE500",
                color: "#191919",
                boxShadow: "0 3px 10px rgba(254,229,0,0.30)",
              }}
            >
              <Share2 size={13} />
              {inviting ? "잠시만요…" : `이웃과 ${catName} 함께 돌보기`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
