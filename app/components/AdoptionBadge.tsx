// 고양이 입양·임시보호 상태 배지 + DM 문의 버튼.
// 고양이 상세 페이지, 지도 마커, 카드 등에서 재사용.
// 2026-09-16 리디자인: 상태색 틴트·그라디언트·이모지 폐지 — 회색 사각 칩 + 테라코타 CTA.

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
      className={`inline-flex items-center gap-1 chip-square font-semibold ${
        isSm ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-[13px]"
      }`}
      style={{
        backgroundColor: "var(--color-gray-100)",
        color: "var(--color-text-sub)",
      }}
    >
      <HandHeart size={isSm ? 11 : 13} />
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
      name: caretakerName ?? "길집사",
      preset,
    });
    router.push(`/messages?${params.toString()}`);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="w-full flex items-center justify-center gap-2 h-12 font-semibold press"
      style={{
        background: "var(--color-primary)",
        color: "var(--color-surface)",
        borderRadius: "var(--radius-input)",
      }}
    >
      <HandHeart size={16} />
      <span className="text-[15px]">{meta.short} 문의하기</span>
    </button>
  );
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
