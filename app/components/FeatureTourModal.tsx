"use client";

// 로그인 후 홈 최초 진입 시 1회 뜨는 "기능 웰컴 투어".
// /onboarding(로그인 전, 감성 슬라이드 + 목적지 선택)과는 다른 레이어 —
// 여기는 포획/지도/AI집사/등급성장/커뮤니티/가이드 6개 기능을 하나씩 보여준다.
// 성공 지표는 "다 봤다"가 아니라 "투어 후 첫 액션(활동지역 설정 또는 지도 진입)으로 이어졌다"이므로
// 마지막 스텝의 버튼이 곧 그 액션이다 — 별도 "완료" 화면을 더 만들지 않는다.

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  ChevronRight,
  ChevronLeft,
  PawPrint,
  MapPin,
  Bot,
  Sparkles,
  Users,
  BookOpen,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isCoreJourneyEnabled } from "@/lib/core-journey-flags";

interface TourStep {
  Icon: LucideIcon;
  color: string;
  eyebrow: string;
  title: string;
  body: string;
}

const STEPS: TourStep[] = [
  {
    Icon: PawPrint,
    color: "var(--color-primary)",
    eyebrow: "WELCOME",
    title: "처음 오셨어요?",
    body: "우리 동네 길 위의 아이들, 함께 알아가 볼까요?",
  },
  {
    Icon: PawPrint,
    color: "#E88D5A",
    // 여기가 "핵심 기능"이라고 자기 소개하는 자리다. 신규 유저 전원이 본다.
    // 원래 "포획해서 카드 만들기"였는데, 이 앱의 핵심은 돌봄 기록이다
    // (30일 care_logs 120행 vs 카드 관련 행위 실측 미미). 자기 소개를 사실과 맞춘다. (2026-08-09)
    eyebrow: "핵심 기능",
    title: "밥 준 걸 기록하기",
    body: "우리 동네 고양이를 등록하고 밥·물·건강을 1탭으로 남기면, 그 아이의 돌봄 기록이 이웃에게 이어져요. 사진을 올리면 그 아이만의 카드도 함께 생겨요.",
  },
  {
    Icon: MapPin,
    color: "#5A8AC4",
    eyebrow: "지도",
    title: "우리 동네 지도",
    body: "내 주변에 어떤 아이들이 있는지, 누가 어떤 소식을 남겼는지 지도 하나로 볼 수 있어요.",
  },
  {
    Icon: Bot,
    color: "#8B65B8",
    eyebrow: "AI 집사",
    title: "궁금할 땐 AI 집사에게",
    body: "새끼를 발견했거나 다친 아이를 만났을 때, 응급처치부터 TNR까지 바로 물어보세요.",
  },
  {
    Icon: Sparkles,
    color: "#D4A017",
    eyebrow: "등급 & 성장",
    title: "관계로 쌓는 등급",
    body: "모든 카드는 \"일반\" 등급에서 시작해요. 타고난 게 아니라, 돌보고 함께한 만큼 희귀 → 레어 → 레전드로 자라나요.",
  },
  {
    Icon: Users,
    color: "#6B8E6F",
    eyebrow: "커뮤니티",
    title: "동네 돌봄러들과 함께",
    body: "같은 동네 돌봄러들과 소식을 나누고, 도움이 필요할 때 서로 힘이 되어줘요.",
  },
  {
    Icon: BookOpen,
    color: "var(--color-primary-dark)",
    eyebrow: "가이드",
    title: "언제든 다시 볼 수 있는 가이드",
    body: "응급처치·새끼 발견·TNR·겨울 쉼터까지, 필요할 때마다 꺼내볼 수 있는 가이드가 준비돼 있어요.",
  },
];

const CORE_JOURNEY_STEPS: TourStep[] = [
  {
    Icon: MapPin,
    color: "#5A8AC4",
    eyebrow: "1 · 발견",
    title: "우리 동네 아이를 찾아요",
    body: "지도에서 가까운 아이와 최근 돌봄 소식을 먼저 확인해요.",
  },
  {
    Icon: PawPrint,
    color: "#E88D5A",
    eyebrow: "2 · 돌봄",
    title: "오늘 필요한 돌봄을 기록해요",
    body: "밥, 물, 건강 상태를 남기면 다음 돌봄이 필요한 이웃에게 이어져요.",
  },
  {
    Icon: Users,
    color: "#6B8E6F",
    eyebrow: "3 · 연결",
    title: "혼자가 아닌 돌봄을 시작해요",
    body: "활동 지역을 정하고 같은 동네 이웃과 안전하게 돌봄을 이어가요.",
  },
];

export default function FeatureTourModal({
  hasRegion,
  onDone,
}: {
  hasRegion: boolean;
  onDone: () => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [closing, setClosing] = useState(false);
  const steps = isCoreJourneyEnabled("P1") ? CORE_JOURNEY_STEPS : STEPS;

  const isLast = step === steps.length - 1;
  const current = steps[step];

  const finish = async (destination: string) => {
    if (closing) return;
    setClosing(true);
    try {
      const supabase = createClient();
      const { data: auth } = await supabase.auth.getUser();
      if (auth.user) {
        await supabase
          .from("profiles")
          .update({ feature_tour_completed_at: new Date().toISOString() })
          .eq("id", auth.user.id);
      }
    } catch {
      // 저장 실패해도 투어 진행 자체를 막지는 않음 — 다음 방문에 다시 뜰 뿐
    }
    onDone();
    // 투어를 닫았다고 보던 화면에서 쫓아내지 않는다 (2026-08-09).
    // 지금까지는 X를 눌러도 무조건 push 라, 어느 페이지에 있든 /map 또는
    // /mypage/activity-regions 로 튕겼다. 대상이 신규 유저 263명 전원이다.
    // 이미 콘텐츠를 보고 있던 사람은 그 자리에 두고, 갈 곳이 없는 경우
    // (홈·투어 전용 진입)에만 안내한다.
    try {
      const here = window.location.pathname;
      if (here.startsWith("/cats/") || here.startsWith("/map") || here.startsWith("/memorial")) return;
    } catch { /* SSR·차단 환경 — 기존 동작 유지 */ }
    router.push(destination);
  };

  const handleNext = () => {
    if (isLast) {
      finish(hasRegion ? "/map" : "/mypage/activity-regions");
      return;
    }
    setStep((s) => Math.min(s + 1, steps.length - 1));
  };

  const handleSkip = () => finish(hasRegion ? "/map" : "/mypage/activity-regions");

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: "rgba(20,16,12,0.55)", backdropFilter: "blur(4px)" }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-sm rounded-[28px] overflow-hidden relative flex flex-col"
        style={{ background: "#FFFFFF", boxShadow: "0 24px 70px rgba(0,0,0,0.35)", maxHeight: "min(640px, 92vh)" }}
      >
        {/* 건너뛰기 — 항상 도달 가능 */}
        <button
          type="button"
          onClick={handleSkip}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full flex items-center justify-center active:scale-90"
          style={{ background: "rgba(0,0,0,0.06)" }}
          aria-label="건너뛰기"
        >
          <X size={15} className="text-text-sub" />
        </button>

        {/* 헤더 */}
        <div className="px-7 pt-9 pb-7" style={{ background: `linear-gradient(135deg, ${current.color}22 0%, ${current.color}0A 100%)` }}>
          <div
            className="w-16 h-16 rounded-3xl flex items-center justify-center mb-5"
            style={{ background: `${current.color}22`, border: `1.5px solid ${current.color}55` }}
          >
            <current.Icon size={30} color={current.color} strokeWidth={2} />
          </div>
          <p className="text-[10.5px] font-extrabold tracking-[0.16em] mb-1.5" style={{ color: current.color }}>
            {current.eyebrow}
          </p>
          <h2 className="text-[21px] font-extrabold text-text-main tracking-tight leading-snug whitespace-pre-line">
            {current.title}
          </h2>
        </div>

        {/* 본문 */}
        <div className="px-7 pt-5 pb-6 flex-1 overflow-y-auto">
          <p className="text-[14px] text-text-sub leading-relaxed">{current.body}</p>
        </div>

        {/* 하단 컨트롤 */}
        <div className="px-7 pb-7">
          {/* 진행 인디케이터 */}
          <div className="flex items-center justify-center gap-1.5 mb-5">
            {steps.map((_, i) => (
              <span
                key={i}
                className="transition-all duration-300"
                style={{
                  width: i === step ? 20 : 6,
                  height: 6,
                  borderRadius: 3,
                  background: i === step ? current.color : "rgba(0,0,0,0.12)",
                }}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 active:scale-95"
                style={{ background: "rgba(0,0,0,0.05)" }}
                aria-label="이전"
              >
                <ChevronLeft size={18} className="text-text-sub" />
              </button>
            )}
            <button
              type="button"
              onClick={handleNext}
              disabled={closing}
              className="flex-1 py-3.5 rounded-2xl text-[15px] font-extrabold text-white flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform"
              style={{
                background: `linear-gradient(135deg, ${current.color} 0%, ${current.color}CC 100%)`,
                boxShadow: `0 8px 20px ${current.color}40`,
                opacity: closing ? 0.7 : 1,
              }}
            >
              {isLast ? (
                <>
                  <PawPrint size={17} />
                  {hasRegion ? "지도에서 첫 아이 찾기" : "내 동네 정하고 시작하기"}
                </>
              ) : (
                <>
                  다음
                  <ChevronRight size={17} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
