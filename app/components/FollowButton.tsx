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

  if (loading) {
    return (
      <button
        disabled
        className={`inline-flex items-center justify-center rounded-xl ${sm ? "px-2.5 py-1" : "px-3 py-1.5"}`}
        style={{ background: variant === "light" ? "rgba(255,255,255,0.2)" : "#F6F1EA", opacity: 0.6 }}
      >
        <Loader2 size={iconSize} className="animate-spin text-text-sub" />
      </button>
    );
  }

  const label = following ? "팔로잉" : "팔로우";
  const Icon = following ? UserCheck : UserPlus;

  // 컬러
  const bg = following
    ? variant === "light" ? "rgba(255,255,255,0.15)" : "#F6F1EA"
    : variant === "light" ? "#fff" : "#C47E5A";
  const fg = following
    ? variant === "light" ? "#fff" : "#8B5A3C"
    : variant === "light" ? "#C47E5A" : "#fff";
  const shadow = !following
    ? variant === "light" ? "0 2px 8px rgba(0,0,0,0.2)" : "0 3px 10px rgba(196,126,90,0.35)"
    : "none";

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className={`inline-flex items-center gap-1 rounded-xl font-extrabold active:scale-95 transition-transform disabled:opacity-60 ${sm ? "px-2.5 py-1 text-[10.5px]" : "px-3 py-1.5 text-[12px]"}`}
      style={{
        background: bg,
        color: fg,
        boxShadow: shadow,
        border: following ? `1px solid ${variant === "light" ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.06)"}` : "none",
      }}
      aria-label={label}
    >
      {busy ? <Loader2 size={iconSize} className="animate-spin" /> : <Icon size={iconSize} strokeWidth={2.5} />}
      {label}
    </button>
  );
}
