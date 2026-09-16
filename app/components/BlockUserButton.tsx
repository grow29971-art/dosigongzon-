"use client";

import { useEffect, useState } from "react";
import { Ban, ShieldOff, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { blockUser, unblockUser, isBlockedByMe } from "@/lib/blocks-repo";

interface Props {
  userId: string;
  userName?: string;
  size?: "sm" | "md";
  onChange?: (nowBlocked: boolean) => void;
}

export default function BlockUserButton({ userId, userName, size = "sm", onChange }: Props) {
  const { user } = useAuth();
  const [blocked, setBlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user || user.id === userId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    isBlockedByMe(userId)
      .then((v) => { if (!cancelled) setBlocked(v); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user, userId]);

  if (!user || user.id === userId) return null;

  const toggle = async () => {
    if (busy) return;
    if (!blocked) {
      const ok = confirm(
        `${userName ?? "이 사용자"}님을 차단할까요?\n\n` +
        `차단 시:\n` +
        `· 서로 메시지를 주고받을 수 없어요\n` +
        `· 이 사용자의 댓글이 안 보여요\n` +
        `· 마이페이지에서 언제든 해제할 수 있어요`,
      );
      if (!ok) return;
    }
    setBusy(true);
    const prev = blocked;
    setBlocked(!prev);
    try {
      if (prev) await unblockUser(userId);
      else await blockUser(userId);
      onChange?.(!prev);
    } catch (e) {
      setBlocked(prev);
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
        className={`inline-flex items-center justify-center ${sm ? "px-2.5 py-1" : "px-3 py-1.5"}`}
        style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-input)", opacity: 0.6 }}
      >
        <Loader2 size={iconSize} className="animate-spin text-text-sub" />
      </button>
    );
  }

  const Icon = blocked ? ShieldOff : Ban;
  const label = blocked ? "차단 해제" : "차단";
  // 헤어라인 버튼 — 차단은 error 글자, 해제는 회색 글자
  const fg = blocked ? "var(--color-text-sub)" : "var(--color-error)";

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className={`inline-flex items-center gap-1 font-semibold press-strong transition-transform disabled:opacity-60 ${sm ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-[13px]"}`}
      style={{
        background: "var(--color-surface)",
        color: fg,
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-input)",
      }}
      aria-label={label}
    >
      {busy ? <Loader2 size={iconSize} className="animate-spin" /> : <Icon size={iconSize} strokeWidth={2} />}
      {label}
    </button>
  );
}
