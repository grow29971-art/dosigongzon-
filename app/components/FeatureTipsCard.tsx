"use client";

// 기능 가이드 팁 카드 (시작 가이드 종료 유저). 조건에 맞는 팁 1개만 노출, 2시간 dismiss.
// 2026-09-16 「익숙한 동네앱」 리디자인: 팁별 색·틴트 아이콘 박스·이모지 폐기 → 흰 면 + 헤어라인,
// 회색 선 아이콘, CTA는 primary 텍스트 링크.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  MapPin, PawPrint, Pencil, Gift, BookOpen, X,
  Heart, Users, MessageCircle, Plus, ChevronRight,
} from "lucide-react";
import type { MyActivitySummary } from "@/lib/cats-repo";
import type { ActivityRegion } from "@/lib/activity-regions-repo";

/** dismiss TTL — 2시간 뒤 자동 재노출 (하루 3~5번 노출) */
const DISMISS_TTL_HOURS = 2;
const DISMISS_KEY = "dosigongzon_feature_tips_dismissed_v3";

interface Tip {
  id: string;
  icon: typeof PawPrint;
  title: string;
  desc: string;
  ctaLabel: string;
  href: string;
  /** 이 팁을 보여줄 조건 (true면 노출) */
  show: (ctx: TipContext) => boolean;
  /** 우선순위 숫자 낮을수록 먼저 노출 */
  priority: number;
}

interface TipContext {
  activity: MyActivitySummary;
  regions: ActivityRegion[];
}

const TIPS: Tip[] = [
  {
    id: "set_region",
    icon: MapPin,
    title: "활동 지역 설정하기",
    desc: "내 동네를 지정하면 홈에 그 지역 고양이·새 소식만 모아서 보여줘요.",
    ctaLabel: "지금 설정",
    href: "/mypage/activity-regions",
    show: ({ regions }) => regions.length === 0,
    priority: 1,
  },
  {
    id: "first_cat",
    icon: PawPrint,
    title: "첫 고양이 등록하기",
    desc: "지도에서 + 버튼을 눌러 우리 동네 길고양이를 기록해보세요. 위치는 근사치로만 공개돼요.",
    ctaLabel: "지도 열기",
    href: "/map",
    show: ({ activity }) => activity.catCount === 0,
    priority: 2,
  },
  {
    id: "first_care",
    icon: Pencil,
    title: "돌봄다이어리 남기기",
    desc: "밥·물·간식·건강체크를 기록하면 다른 이웃도 아이 상태를 알 수 있어요.",
    ctaLabel: "고양이 보러 가기",
    href: "/map",
    show: ({ activity }) => activity.catCount > 0 && activity.careLogCount === 0,
    priority: 3,
  },
  {
    id: "area_chat",
    icon: MessageCircle,
    title: "지역 채팅 참여하기",
    desc: "지도 하단 채팅 버튼을 누르면 우리 구 이웃들과 실시간으로 이야기할 수 있어요.",
    ctaLabel: "지도에서 채팅 열기",
    href: "/map",
    // 활동 지역이 있거나 고양이가 있으면 — 즉 지역 밀착 유저라면 계속 권장
    show: ({ activity, regions }) => regions.length > 0 || activity.catCount > 0,
    priority: 4,
  },
  {
    id: "more_cats",
    icon: Plus,
    title: "주변에 또 다른 아이 있나요?",
    desc: "동네에 등록 안 된 아이가 더 있다면 지도에 올려주세요. 다른 이웃이 함께 챙길 수 있어요.",
    ctaLabel: "지도에서 등록",
    href: "/map",
    // 이미 몇 마리 등록했지만 더 있을 가능성 — 20마리 미만까지 계속 권장
    show: ({ activity }) => activity.catCount >= 1 && activity.catCount < 20,
    priority: 5,
  },
  {
    id: "streak_challenge",
    icon: Heart,
    title: "7일 연속 돌봄 도전",
    desc: "이번 주 월~일 모두 기록하면 주간 개근 업적과 보너스 점수를 받아요. 하루 하나만 기록해도 OK.",
    ctaLabel: "지도에서 시작",
    href: "/map",
    show: ({ activity }) =>
      activity.careLogCount > 0 && activity.currentStreak < 7 && !activity.weeklyGoalAchieved,
    priority: 6,
  },
  {
    id: "invite_friend",
    icon: Gift,
    title: "친구를 초대해보세요",
    desc: "내 초대 코드로 친구가 가입하면 15점 보너스와 '씨앗을 심는 자' 업적을 받아요.",
    ctaLabel: "내 코드 보기",
    href: "/mypage",
    show: ({ activity }) => activity.inviteCount === 0 && activity.catCount > 0,
    priority: 7,
  },
  {
    id: "community",
    icon: Users,
    title: "커뮤니티에서 이웃 만나기",
    desc: "긴급·임보·입양·나눔까지. 근처 길집사와 직접 이야기를 나눌 수 있어요.",
    ctaLabel: "커뮤니티 열기",
    href: "/community",
    show: ({ activity }) => activity.catCount > 0 && activity.commentCount >= 3,
    priority: 8,
  },
  {
    id: "protection_guide",
    icon: BookOpen,
    title: "보호 가이드 읽기",
    desc: "응급처치·TNR·먹이·겨울 쉼터까지, 공공기관 자료 기반으로 정리된 가이드예요.",
    ctaLabel: "가이드 보기",
    href: "/protection",
    show: () => true, // fallback
    priority: 9,
  },
];

interface Props {
  activity: MyActivitySummary;
  regions: ActivityRegion[];
}

export default function FeatureTipsCard({ activity, regions }: Props) {
  const [dismissMap, setDismissMap] = useState<Record<string, number>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DISMISS_KEY);
      if (raw) setDismissMap(JSON.parse(raw) as Record<string, number>);
    } catch { /* no-op */ }
  }, []);

  const dismiss = (id: string) => {
    const next = { ...dismissMap, [id]: Date.now() };
    setDismissMap(next);
    try {
      localStorage.setItem(DISMISS_KEY, JSON.stringify(next));
    } catch { /* no-op */ }
  };

  const ctx: TipContext = useMemo(() => ({ activity, regions }), [activity, regions]);

  const tip = useMemo(() => {
    const ttlMs = DISMISS_TTL_HOURS * 60 * 60 * 1000;
    const now = Date.now();
    const isDismissedRecently = (id: string) => {
      const ts = dismissMap[id];
      return typeof ts === "number" && now - ts < ttlMs;
    };
    const candidates = TIPS
      .filter((t) => !isDismissedRecently(t.id))
      .filter((t) => t.show(ctx))
      .sort((a, b) => a.priority - b.priority);
    return candidates[0] ?? null;
  }, [ctx, dismissMap]);

  if (!tip) return null;

  const Icon = tip.icon;

  return (
    <div className="mb-5">
      <div className="mb-2 px-1">
        <h2 className="text-[17px] font-bold text-text-main">
          도시공존 살펴보기
        </h2>
      </div>
      <div
        className="p-4 relative"
        style={{
          background: "var(--color-surface)",
          borderRadius: "var(--radius-card)",
          border: "1px solid var(--color-border)",
        }}
      >
        <button
          type="button"
          onClick={() => dismiss(tip.id)}
          className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center press-strong"
          aria-label="이 팁 숨기기"
        >
          <X size={16} style={{ color: "var(--color-text-light)" }} />
        </button>
        <div className="flex items-start gap-3 pr-7">
          <Icon size={22} className="shrink-0 mt-0.5" style={{ color: "var(--color-text-sub)" }} strokeWidth={1.8} />
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-semibold text-text-main leading-snug">
              {tip.title}
            </p>
            <p className="text-[13px] text-text-sub mt-1 leading-relaxed">
              {tip.desc}
            </p>
            <Link
              href={tip.href}
              className="inline-flex items-center gap-0.5 mt-2 text-[13px] font-semibold press-strong transition-transform"
              style={{ color: "var(--color-primary)" }}
            >
              {tip.ctaLabel} <ChevronRight size={14} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
