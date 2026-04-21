"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, Sparkles } from "lucide-react";
import type { MyActivitySummary } from "@/lib/cats-repo";

interface Props {
  activity: MyActivitySummary | null;
  hasTodayCare: boolean;      // 오늘 돌봄 기록 있음 (streakInfo.hasToday)
  unreadCount: number;
  rescueCount?: number;       // /rescue 대기중 고양이 수
}

interface Item {
  id: string;
  label: string;
  href: string;
  done: boolean;
  emoji: string;
}

/**
 * Zeigarnik 효과 — 미완료 작업은 마음에 남는다.
 * 오늘 해볼 법한 3가지 작은 동작을 체크리스트로 제시.
 */
export default function TodayChecklist({
  activity,
  hasTodayCare,
  unreadCount,
  rescueCount = 0,
}: Props) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      const key = "today-checklist-dismissed";
      const val = localStorage.getItem(key);
      if (val) {
        // KST 날짜가 같으면 dismiss 유지
        const today = new Date().toLocaleDateString("en-CA", {
          timeZone: "Asia/Seoul",
        });
        if (val === today) setDismissed(true);
      }
    } catch {}
  }, []);

  if (dismissed || !activity) return null;

  // 체크리스트 구성 — 상황에 따라 동적 선택
  const items: Item[] = [];

  // 1) 오늘 돌봄 기록
  items.push({
    id: "care_today",
    label: "오늘 돌봄 기록 한 줄 남기기",
    href: "/map",
    done: hasTodayCare,
    emoji: "📝",
  });

  // 2) 조건부 — 긴급 고양이 있음
  if (rescueCount > 0) {
    items.push({
      id: "rescue",
      label: `긴급 상태 아이 ${rescueCount}마리 안부 확인`,
      href: "/rescue",
      done: false,
      emoji: "🚨",
    });
  } else if (unreadCount > 0) {
    items.push({
      id: "notifications",
      label: `알림 ${unreadCount}개 확인`,
      href: "/notifications",
      done: false,
      emoji: "🔔",
    });
  } else {
    items.push({
      id: "explore_map",
      label: "동네 지도 한번 둘러보기",
      href: "/map",
      done: false,
      emoji: "🗺️",
    });
  }

  // 3) 조건부 — 고양이 없으면 등록 / 있으면 커뮤니티 구경
  if (activity.catCount === 0) {
    items.push({
      id: "first_cat",
      label: "우리 동네 첫 아이 등록하기",
      href: "/map",
      done: false,
      emoji: "🐱",
    });
  } else {
    items.push({
      id: "community",
      label: "이웃 이야기 한 편 읽어보기",
      href: "/community",
      done: false,
      emoji: "💬",
    });
  }

  const doneCount = items.filter((i) => i.done).length;
  const allDone = doneCount === items.length;

  const handleDismiss = () => {
    try {
      const today = new Date().toLocaleDateString("en-CA", {
        timeZone: "Asia/Seoul",
      });
      localStorage.setItem("today-checklist-dismissed", today);
    } catch {}
    setDismissed(true);
  };

  return (
    <div
      className="mb-5 rounded-2xl overflow-hidden"
      style={{
        background: "#FFFFFF",
        boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
        border: "1px solid rgba(0,0,0,0.04)",
      }}
    >
      <div
        className="px-4 py-3 flex items-center gap-2"
        style={{
          background: allDone
            ? "linear-gradient(135deg, #E8F4E8 0%, #D5EDD5 100%)"
            : "linear-gradient(135deg, #FFF9EF 0%, #FFF4E0 100%)",
          borderBottom: "1px solid rgba(0,0,0,0.04)",
        }}
      >
        <Sparkles size={14} style={{ color: allDone ? "#3F5B42" : "#C47E5A" }} />
        <p className="text-[12px] font-extrabold tracking-tight" style={{ color: allDone ? "#3F5B42" : "#A67B1E" }}>
          {allDone ? "오늘 할 일 모두 완료! 🎉" : `오늘 해볼 것 ${doneCount}/${items.length}`}
        </p>
        <button
          type="button"
          onClick={handleDismiss}
          className="ml-auto text-[10px] font-bold text-text-light active:scale-95"
        >
          숨기기
        </button>
      </div>

      <div className="divide-y divide-divider">
        {items.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className="flex items-center gap-3 px-4 py-3 active:bg-surface-alt transition-colors"
          >
            <div className="shrink-0">
              {item.done ? (
                <CheckCircle2 size={20} style={{ color: "#6B8E6F" }} fill="#6B8E6F20" />
              ) : (
                <Circle size={20} className="text-text-light" />
              )}
            </div>
            <span className="text-[14px] shrink-0">{item.emoji}</span>
            <span
              className="flex-1 text-[12.5px] font-bold leading-tight"
              style={{
                color: item.done ? "#A38E7A" : "#2A2A28",
                textDecoration: item.done ? "line-through" : "none",
              }}
            >
              {item.label}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
