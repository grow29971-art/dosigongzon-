"use client";

// 로그인 후 홈 최초 진입 시 1회 뜨는 "기능 웰컴 투어".
// /onboarding(로그인 전, 감성 슬라이드 + 목적지 선택)과는 다른 레이어 —
// 여기는 포획/지도/AI집사/등급성장/배틀/커뮤니티/가이드 7개 기능을 하나씩 보여준다.
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
  Swords,
  Users,
  BookOpen,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

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
    color: "#4C82BC",
    eyebrow: "WELCOME",
    title: "처음 오셨어요?",
    body: "우리 동네 길 위의 아이들, 함께 알아가 볼까요?",
  },
  {
    Icon: PawPrint,
    color: "#E88D5A",
    eyebrow: "핵심 기능",
    title: "포획해서 카드 만들기",
    body: "지도에서 실제로 만난 우리 동네 고양이를 사진으로 포획하면, 그 아이만의 고양이 카드가 생겨요.",
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
    Icon: Swords,
    color: "#D85555",
    eyebrow: "배틀",
    title: "카드가 모이면, 배틀도",
    body: "내 고양이 카드를 모으면 서로 배틀도 할 수 있어요. 함께한 시간만큼 더 강해져요.",
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
    color: "#3E6FA8",
    eyebrow: "가이드",
    title: "언제든 다시 볼 수 있는 가이드",
    body: "응급처치·새끼 발견·TNR·겨울 쉼터까지, 필요할 때마다 꺼내볼 수 있는 가이드가 준비돼 있어요.",
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

  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

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
    router.push(destination);
  };

  const handleNext = () => {
    if (isLast) {
      finish(hasRegion ? "/map" : "/mypage/activity-regions");
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
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
            {STEPS.map((_, i) => (
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
