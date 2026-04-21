"use client";

import { useState } from "react";
import {
  REACTION_EMOJIS,
  toggleReaction,
  emptyReactionSummary,
  type ReactionTargetType,
  type ReactionEmoji,
  type ReactionSummary,
} from "@/lib/reactions-repo";

interface Props {
  targetType: ReactionTargetType;
  targetId: string;
  summary: ReactionSummary | undefined;
  isLoggedIn: boolean;
  /** 리액션 변경 후 호출. 부모에서 집계 갱신용. */
  onChange?: (targetId: string, nextSummary: ReactionSummary) => void;
  /** 비로그인 유저 클릭 시 호출 (로그인 유도). */
  onRequireLogin?: () => void;
}

export default function ReactionBar({
  targetType,
  targetId,
  summary,
  isLoggedIn,
  onChange,
  onRequireLogin,
}: Props) {
  const [busy, setBusy] = useState<ReactionEmoji | null>(null);
  const cur = summary ?? emptyReactionSummary();

  const handleClick = async (emoji: ReactionEmoji) => {
    if (!isLoggedIn) {
      onRequireLogin?.();
      return;
    }
    if (busy) return;
    setBusy(emoji);

    // 낙관적 업데이트
    const next: ReactionSummary = {
      counts: { ...cur.counts },
      myReactions: new Set(cur.myReactions),
    };
    if (cur.myReactions.has(emoji)) {
      next.counts[emoji] = Math.max(0, next.counts[emoji] - 1);
      next.myReactions.delete(emoji);
    } else {
      next.counts[emoji] = (next.counts[emoji] ?? 0) + 1;
      next.myReactions.add(emoji);
    }
    onChange?.(targetId, next);

    try {
      await toggleReaction(targetType, targetId, emoji);
    } catch {
      // 롤백
      onChange?.(targetId, cur);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {REACTION_EMOJIS.map(({ key, emoji, color }) => {
        const count = cur.counts[key] ?? 0;
        const picked = cur.myReactions.has(key);
        const active = picked || count > 0;
        return (
          <button
            key={key}
            type="button"
            onClick={() => handleClick(key)}
            disabled={busy === key}
            className="flex items-center gap-1 px-2 py-1 rounded-full text-[10.5px] font-bold active:scale-90 transition-all disabled:opacity-50"
            style={{
              background: picked ? `${color}22` : active ? "#FFFFFF" : "transparent",
              border: `1px solid ${picked ? color : "#E3DCD3"}`,
              color: picked ? color : "#8B7562",
            }}
            aria-label={`${emoji} 반응`}
            aria-pressed={picked}
          >
            <span style={{ fontSize: 12 }}>{emoji}</span>
            {count > 0 && <span className="tabular-nums">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
