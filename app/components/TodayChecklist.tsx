"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, Sparkles } from "lucide-react";
import type { MyActivitySummary } from "@/lib/cats-repo";

interface Props {
  activity: MyActivitySummary | null;
  hasTodayCare: boolean;      // 오늘 돌봄 기록 있음 (streakInfo.hasToday, DB 기반)
  unreadCount: number;
  rescueCount?: number;       // /rescue 대기중 고양이 수
}

interface Item {
  id: string;
  label: string;
  href: string;
  done: boolean;
  emoji: string;
  storageKey?: string;        // 클릭 시 localStorage에 today 기록할 키
}

const KST_TODAY = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });

/**
 * Zeigarnik 효과 + 3축 균형(지도·커뮤니티·보호지침).
 * 핵심 3개 기능을 매일 골고루 사용하도록 의도적 분배.
 */
export default function TodayChecklist({
  activity,
  hasTodayCare,
  unreadCount,
  rescueCount = 0,
}: Props) {
  const [dismissed, setDismissed] = useState(false);
  const [communityDone, setCommunityDone] = useState(false);
  const [protectionDone, setProtectionDone] = useState(false);

  // dismiss 상태 + localStorage 기반 done 동기화
  useEffect(() => {
    try {
      const today = KST_TODAY();
      const dis = localStorage.getItem("today-checklist-dismissed");
      if (dis === today) setDismissed(true);
      if (localStorage.getItem("today-community-viewed") === today) setCommunityDone(true);
      if (localStorage.getItem("today-protection-viewed") === today) setProtectionDone(true);
    } catch {}
  }, []);

  if (dismissed || !activity) return null;

  const markViewed = (key: string) => {
    try { localStorage.setItem(key, KST_TODAY()); } catch {}
  };

  // ── 핵심 3축 — 매일 균형 사용 유도 ──
  const items: Item[] = [
    {
      id: "care_map",
      label: activity.catCount === 0
        ? "지도에서 첫 고양이 등록하기"
        : "오늘 돌봄 기록 한 줄 남기기",
      href: "/map",
      done: hasTodayCare,
      emoji: "🗺️",
    },
    {
      id: "community_today",
      label: "동네 이야기 한 편 읽기",
      href: "/community",
      done: communityDone,
      emoji: "💬",
      storageKey: "today-community-viewed",
    },
    {
      id: "protection_today",
      label: "보호지침 가이드 한 개 보기",
      href: "/protection",
      done: protectionDone,
      emoji: "📖",
      storageKey: "today-protection-viewed",
    },
  ];

  // ── 조건부 4번 항목 — 긴급·알림 ──
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
      label: `읽지 않은 알림 ${unreadCount}개`,
      href: "/notifications",
      done: false,
      emoji: "🔔",
    });
  }

  const doneCount = items.filter((i) => i.done).length;
  const allDone = doneCount === items.length;

  const handleDismiss = () => {
    try { localStorage.setItem("today-checklist-dismissed", KST_TODAY()); } catch {}
    setDismissed(true);
  };

  const handleClick = (item: Item) => {
    if (item.storageKey) {
      markViewed(item.storageKey);
      // 즉시 UI 반영 (페이지 떠나기 전)
      if (item.id === "community_today") setCommunityDone(true);
      if (item.id === "protection_today") setProtectionDone(true);
    }
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
        className={`px-4 py-3 flex items-center gap-2 ${
          allDone
            ? "bg-[linear-gradient(135deg,#E8F4E8_0%,#D5EDD5_100%)] dark:bg-[linear-gradient(135deg,#1F2E20_0%,#1A2A1C_100%)]"
            : "bg-[linear-gradient(135deg,#FFF9EF_0%,#FFF4E0_100%)] dark:bg-[linear-gradient(135deg,#2A2410_0%,#2C2510_100%)]"
        }`}
        style={{
          borderBottom: "1px solid rgba(0,0,0,0.04)",
        }}
      >
        <Sparkles size={14} className={allDone ? "text-[#3F5B42] dark:text-[#A8E0A8]" : "text-[#C47E5A] dark:text-[#E8B57E]"} />
        <p className={`text-[12px] font-extrabold tracking-tight ${allDone ? "text-[#3F5B42] dark:text-[#A8E0A8]" : "text-[#A67B1E] dark:text-[#FFD68A]"}`}>
          {allDone ? "오늘 완벽한 하루! 🎉" : `오늘의 균형 ${doneCount}/${items.length}`}
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
            onClick={() => handleClick(item)}
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
              className={`flex-1 text-[12.5px] font-bold leading-tight ${
                item.done ? "text-text-light line-through" : "text-text-main"
              }`}
            >
              {item.label}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
