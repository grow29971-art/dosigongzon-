"use client";

import { useEffect, useState } from "react";
import { UserPlus, UserCheck, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { followUser, unfollowUser, isFollowing } from "@/lib/follows-repo";

interface FollowButtonProps {
  userId: string;           // 팔로우할 대상 유저 ID
  size?: "sm" | "md";
  variant?: "default" | "light"; // light 는 어두운 배경 위에 사용
  onChange?: (followingNow: boolean) => void;
}

export default function FollowButton({ userId, size = "sm", variant = "default", onChange }: FollowButtonProps) {
  const { user } = useAuth();
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user || user.id === userId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    isFollowing(userId)
      .then((v) => { if (!cancelled) setFollowing(v); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user, userId]);

  // 자기 자신이거나 비로그인이면 렌더 안 함
  if (!user || user.id === userId) return null;

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    const prev = following;
    setFollowing(!prev); // 낙관
    try {
      if (prev) await unfollowUser(userId);
      else await followUser(userId);
      onChange?.(!prev);
    } catch (e) {
      setFollowing(prev); // 롤백
      alert(e instanceof Error ? e.message : "실패");
    } finally {
      setBusy(false);
    }
  };

  const sm = size === "sm";
  const iconSize = sm ? 12 : 14;
  const light = variant === "light";

  if (loading) {
    return (
      <button
        disabled
        className={`inline-flex items-center justify-center ${sm ? "px-2.5 py-1" : "px-3 py-1.5"}`}
        style={{
          borderRadius: "var(--radius-input)",
          background: light ? "rgba(255,255,255,0.2)" : "var(--color-gray-100)",
          opacity: 0.6,
        }}
      >
        <Loader2 size={iconSize} className="animate-spin text-text-sub" />
      </button>
    );
  }

  const label = following ? "팔로잉" : "팔로우";
  const Icon = following ? UserCheck : UserPlus;

  // 팔로우 전: 테라코타 채움(light면 흰 채움) / 팔로잉: 회색 채움(light면 반투명 흰) — 그림자 없음
  const bg = following
    ? light ? "rgba(255,255,255,0.15)" : "var(--color-gray-100)"
    : light ? "var(--color-surface)" : "var(--color-primary)";
  const fg = following
    ? light ? "var(--color-surface)" : "var(--color-text-main)"
    : light ? "var(--color-primary)" : "var(--color-surface)";

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className={`inline-flex items-center gap-1 font-semibold press-strong disabled:opacity-60 ${sm ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-[13px]"}`}
      style={{
        borderRadius: "var(--radius-input)",
        background: bg,
        color: fg,
        border: following && light ? "1px solid rgba(255,255,255,0.3)" : "none",
      }}
      aria-label={label}
    >
      {busy ? <Loader2 size={iconSize} className="animate-spin" /> : <Icon size={iconSize} strokeWidth={2} />}
      {label}
    </button>
  );
}
