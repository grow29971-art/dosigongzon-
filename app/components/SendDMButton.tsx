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
        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold active:scale-95 transition-transform"
        style={{ backgroundColor: "#EEE8E0", color: "#A38E7A" }}
      >
        <Mail size={10} /> 쪽지
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="active:scale-90 transition-transform"
      title="쪽지 보내기"
    >
      <Mail size={12} style={{ color: "#A38E7A" }} />
    </button>
  );
}
