"use client";

// 이모지 리액션 바 — 선택지 이모지 자체가 리액션 데이터(기능)라 이모지는 유지한다.
// 2026-09-16 리디자인: 필 → 사각 칩, 리액션별 색 틴트 → 선택 시 테라코타 soft, 미선택은 회색.

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
      {REACTION_EMOJIS.map(({ key, emoji }) => {
        const count = cur.counts[key] ?? 0;
        const picked = cur.myReactions.has(key);
        return (
          <button
            key={key}
            type="button"
            onClick={() => handleClick(key)}
            disabled={busy === key}
            className="flex items-center gap-1 px-2 py-1 chip-square text-[11px] font-semibold press-strong transition-colors disabled:opacity-50"
            style={{
              background: picked ? "var(--color-primary-soft)" : "var(--color-surface)",
              border: `1px solid ${picked ? "var(--color-primary)" : "var(--color-border)"}`,
              color: picked ? "var(--color-primary)" : "var(--color-text-sub)",
            }}
            aria-label={`${emoji} 반응`}
            aria-pressed={picked}
          >
            <span style={{ fontSize: 13 }}>{emoji}</span>
            {count > 0 && <span className="tabular-nums">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
