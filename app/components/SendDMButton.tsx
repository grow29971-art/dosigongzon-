"use client";

import { useRouter } from "next/navigation";
import { Mail } from "lucide-react";

interface Props {
  userId: string | null;
  userName: string | null;
  currentUserId?: string;
  size?: "xs" | "sm";
}

export default function SendDMButton({ userId, userName, currentUserId, size = "xs" }: Props) {
  const router = useRouter();

  if (!userId || userId === currentUserId) return null;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/messages?to=${userId}&name=${encodeURIComponent(userName ?? "익명")}`);
  };

  if (size === "sm") {
    return (
      <button
        type="button"
        onClick={handleClick}
        className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-text-sub press-strong transition-transform"
        style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-square)" }}
      >
        <Mail size={10} /> 쪽지
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="press-strong transition-transform"
      title="쪽지 보내기"
    >
      <Mail size={12} style={{ color: "var(--color-text-light)" }} />
    </button>
  );
}
