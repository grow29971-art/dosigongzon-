// 고양이 입양·임시보호 상태 배지 + DM 문의 버튼.
// 고양이 상세 페이지, 지도 마커, 카드 등에서 재사용.

"use client";

import { useRouter } from "next/navigation";
import { HandHeart } from "lucide-react";
import { ADOPTION_MAP, type AdoptionStatus } from "@/lib/cats-repo";

interface BadgeProps {
  status: AdoptionStatus;
  size?: "sm" | "md";
}

/** 상태 배지만 (작은 라벨) */
export function AdoptionBadge({ status, size = "sm" }: BadgeProps) {
  if (!status) return null;
  const meta = ADOPTION_MAP[status];
  const isSm = size === "sm";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-extrabold ${
        isSm ? "px-2 py-0.5 text-[10.5px]" : "px-2.5 py-1 text-[12px]"
      }`}
      style={{
        backgroundColor: `${meta.color}18`,
        color: meta.color,
        border: `1px solid ${meta.color}33`,
      }}
    >
      <span>{meta.emoji}</span>
      <span>{meta.short}</span>
    </span>
  );
}

interface InquireProps {
  status: AdoptionStatus;
  caretakerId: string | null;
  caretakerName: string | null;
  catName: string;
  currentUserId: string | null | undefined;
}

/** 입양/임보 문의 CTA — 클릭 시 /messages에 preset 메시지 달고 이동 */
export function AdoptionInquireButton({
  status, caretakerId, caretakerName, catName, currentUserId,
}: InquireProps) {
  const router = useRouter();

  if (!status || !caretakerId) return null;
  if (caretakerId === currentUserId) return null; // 본인 고양이엔 안 보임

  const meta = ADOPTION_MAP[status];

  const handleClick = () => {
    if (!currentUserId) {
      router.push(`/login?next=/cats`);
      return;
    }
    const preset = buildPresetMessage(status, catName);
    const params = new URLSearchParams({
      to: caretakerId,
      name: caretakerName ?? "캣맘·캣대디",
      preset,
    });
    router.push(`/messages?${params.toString()}`);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-extrabold text-white active:scale-[0.98] transition-transform"
      style={{
        background: `linear-gradient(135deg, ${meta.color} 0%, ${darken(meta.color)} 100%)`,
        boxShadow: `0 6px 18px ${meta.color}40`,
      }}
    >
      <HandHeart size={16} />
      <span className="text-[13.5px]">{meta.short} 문의하기</span>
    </button>
  );
}

function darken(hex: string): string {
  // 단순화된 darker 버전 — 정교한 색상 조정은 tailwind 토큰으로 대체 가능
  const map: Record<string, string> = {
    "#C47E5A": "#A8684A",
    "#4A7BA8": "#3A6B96",
    "#8B65B8": "#6F4D97",
  };
  return map[hex] ?? hex;
}

function buildPresetMessage(status: Exclude<AdoptionStatus, null>, catName: string): string {
  switch (status) {
    case "seeking_home":
      return `안녕하세요! ${catName}의 입양을 문의드리고 싶어요. 혹시 상세한 얘기 나눠볼 수 있을까요?`;
    case "temp_care":
      return `안녕하세요! ${catName}의 임시보호를 도와드릴 수 있을 것 같아 연락드려요. 자세한 내용 여쭙고 싶습니다.`;
    case "both":
      return `안녕하세요! ${catName}의 입양 또는 임시보호로 도움드리고 싶어요. 자세히 얘기 나눠볼 수 있을까요?`;
  }
}
