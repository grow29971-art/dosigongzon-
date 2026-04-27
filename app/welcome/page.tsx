"use client";

// 가입 직후 환영 페이지 — 축하 + 사용법 4단계 슬라이드.
// /api/auth/callback 에서 첫 가입자(!nickname_set)일 때 ?next=...로 우회시켜 들어온다.
// 이미 가입한 유저가 이 URL로 와도 그냥 next로 보내준다 (재노출 방지는 nickname_set 플래그로).

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  PartyPopper,
  Sparkles,
  MapPin,
  PawPrint,
  Heart,
  MessageCircle,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";

export default function WelcomePage() {
  return (
    <Suspense>
      <WelcomeContent />
    </Suspense>
  );
}

function safeNext(raw: string | null): string {
  if (!raw) return "/";
  if (!raw.startsWith("/")) return "/";
  if (raw.startsWith("//") || raw.startsWith("/\\")) return "/";
  return raw;
}

function WelcomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const next = safeNext(searchParams.get("next"));

  const [step, setStep] = useState(0);
  const [fading, setFading] = useState(false);
  const [earlySupporter, setEarlySupporter] = useState(false);

  // 비로그인 시 홈으로
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/");
    }
  }, [user, authLoading, router]);

  // early_supporter 타이틀 조회
  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    supabase
      .from("profiles")
      .select("admin_title")
      .eq("id", user.id)
      .maybeSingle()
      .then((res: { data: { admin_title: string | null } | null }) => {
        if (res.data?.admin_title === "early_supporter") setEarlySupporter(true);
      });
  }, [user]);

  const nickname =
    (user?.user_metadata?.nickname as string | undefined)
    ?? user?.email?.split("@")[0]
    ?? "이웃";

  const goTo = (idx: number) => {
    if (idx === step || fading) return;
    setFading(true);
    setTimeout(() => {
      setStep(idx);
      setFading(false);
    }, 300);
  };

  const handleNext = () => {
    if (step < SLIDES.length - 1) {
      goTo(step + 1);
    } else {
      router.replace(next);
    }
  };

  const handleSkip = () => router.replace(next);

  if (authLoading || !user) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: "#FFF9F2" }}>
        <Sparkles size={28} className="animate-pulse" style={{ color: "#C47E5A" }} />
      </div>
    );
  }

  const slide = SLIDES[step];
  const isFirst = step === 0;
  const isLast = step === SLIDES.length - 1;

  return (
    <div
      className="fixed inset-0 overflow-hidden flex flex-col"
      style={{ background: slide.bg, transition: "background 0.6s ease" }}
    >
      {/* 건너뛰기 */}
      <button
        onClick={handleSkip}
        className="absolute top-12 right-5 z-20 text-[13px] font-medium px-3 py-1.5 rounded-full active:opacity-50"
        style={{ color: "rgba(255,255,255,0.7)" }}
      >
        건너뛰기
      </button>

      {/* 콘텐츠 */}
      <div
        className="flex-1 flex flex-col items-center justify-center px-7 transition-opacity duration-300"
        style={{ opacity: fading ? 0 : 1 }}
      >
        {/* 1번 슬라이드는 닉네임/축하 특수 레이아웃 */}
        {isFirst ? (
          <>
            <div
              className="w-24 h-24 rounded-[32px] flex items-center justify-center mb-6"
              style={{
                background: "rgba(255,255,255,0.18)",
                backdropFilter: "blur(10px)",
                border: "1px solid rgba(255,255,255,0.25)",
                boxShadow: "0 12px 36px rgba(0,0,0,0.18)",
              }}
            >
              <PartyPopper size={44} color="#FFFFFF" strokeWidth={1.6} />
            </div>

            {earlySupporter && (
              <div
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full mb-3"
                style={{
                  background: "rgba(255,255,255,0.25)",
                  backdropFilter: "blur(8px)",
                  border: "1px solid rgba(255,255,255,0.35)",
                }}
              >
                <Sparkles size={11} color="#FFF7C4" />
                <span className="text-[10.5px] font-extrabold tracking-[0.12em] text-white">
                  EARLY SUPPORTER · 100명 한정
                </span>
              </div>
            )}

            <h1 className="text-[26px] font-extrabold text-center text-white tracking-tight leading-[1.3] mb-3">
              <span className="opacity-90">환영합니다,</span>
              <br />
              <span style={{ color: "#FFF7C4" }}>{nickname}</span>님 🐾
            </h1>
            <p className="text-[14px] text-center text-white/85 leading-[1.85] max-w-[300px]">
              도시공존의 새로운 이웃이 되어주셔서 정말 고마워요.
              {earlySupporter && (
                <>
                  <br />
                  <b className="text-white">초기 100명</b>에 들어오신 당신께
                  <br />
                  특별한 <b className="text-white">어얼리 서포터</b> 뱃지를 드릴게요.
                </>
              )}
            </p>
          </>
        ) : (
          <>
            <div
              className="w-20 h-20 rounded-[26px] flex items-center justify-center mb-7"
              style={{
                background: "rgba(255,255,255,0.18)",
                backdropFilter: "blur(10px)",
                border: "1px solid rgba(255,255,255,0.25)",
              }}
            >
              <slide.Icon size={38} color="#FFFFFF" strokeWidth={1.6} />
            </div>
            <h2 className="text-[22px] font-extrabold text-center text-white tracking-tight leading-[1.4] mb-4 whitespace-pre-line">
              {slide.title}
            </h2>
            <p className="text-[14px] text-center text-white/85 leading-[1.95] max-w-[320px] whitespace-pre-line">
              {slide.body}
            </p>
          </>
        )}
      </div>

      {/* 하단 컨트롤 */}
      <div className="px-6 pb-10 z-20">
        {/* 인디케이터 */}
        <div className="flex items-center justify-center gap-2 mb-5">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className="transition-all duration-400 ease-out"
              style={{
                width: i === step ? 28 : 7,
                height: 7,
                borderRadius: 4,
                backgroundColor: i === step ? "#FFFFFF" : "rgba(255,255,255,0.3)",
              }}
              aria-label={`${i + 1}번째 안내`}
            />
          ))}
        </div>

        <div className="flex items-center gap-2">
          {step > 0 && (
            <button
              onClick={() => goTo(step - 1)}
              className="w-12 h-[52px] rounded-2xl flex items-center justify-center active:scale-95"
              style={{
                background: "rgba(255,255,255,0.15)",
                backdropFilter: "blur(8px)",
                border: "1px solid rgba(255,255,255,0.2)",
              }}
              aria-label="이전"
            >
              <ChevronLeft size={18} color="#FFFFFF" />
            </button>
          )}
          <button
            onClick={handleNext}
            className="flex-1 h-[52px] rounded-2xl text-[15px] font-extrabold flex items-center justify-center gap-1.5 active:scale-[0.98]"
            style={{
              background: "#FFFFFF",
              color: slide.accent,
              boxShadow: "0 8px 22px rgba(0,0,0,0.18)",
            }}
          >
            {isLast ? (
              <>
                <PawPrint size={17} />
                지도로 시작하기
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
  );
}

const SLIDES = [
  {
    bg: "linear-gradient(170deg, #C47E5A 0%, #D4956F 50%, #E8B07C 100%)",
    accent: "#A8684A",
    Icon: PartyPopper,
    title: "",
    body: "",
  },
  {
    bg: "linear-gradient(170deg, #4A7BA8 0%, #6B9BC4 60%, #A8C7E0 100%)",
    accent: "#3A6086",
    Icon: MapPin,
    title: "지도에서\n동네 길고양이를 만나보세요",
    body: "서울 전역의 길고양이 위치·건강 상태가\n한 화면에 모여 있어요.\n\n구·동을 누르면 해당 지역 아이들만 모아 볼 수 있고,\n긴급 표시가 뜬 아이는 빠른 도움이 필요해요.",
  },
  {
    bg: "linear-gradient(170deg, #C47E5A 0%, #E88D5A 60%, #F4B58C 100%)",
    accent: "#A8684A",
    Icon: PawPrint,
    title: "처음 본 아이는\n+ 버튼으로 등록해요",
    body: "지도 우하단의 + 버튼을 누르면\n사진·이름·건강 상태를 한 번에 남길 수 있어요.\n\n비슷한 위치의 기존 아이가 있으면\n자동으로 합쳐서 중복을 막아드려요.",
  },
  {
    bg: "linear-gradient(170deg, #6B8E6F 0%, #8FAE92 50%, #BFD4C2 100%)",
    accent: "#4F6E53",
    Icon: Heart,
    title: "돌봄 한 줄,\n그게 가장 큰 힘이에요",
    body: "밥·물·건강 체크 한 번이면\n다른 이웃에게 \"오늘 이 아이 잘 있어요\"가 전해져요.\n\n돌봄을 자주 남기면 업적과 레벨이 오르고,\n첫 등록 시 어얼리 서포터 뱃지도 드려요.",
  },
  {
    bg: "linear-gradient(170deg, #8B65B8 0%, #B091D4 50%, #D4BFE8 100%)",
    accent: "#6B4D94",
    Icon: MessageCircle,
    title: "혼자가 아니에요\n커뮤니티에서 같이 해요",
    body: "동네 캣맘·캣대디들과 정보를 나누고,\n위급한 아이를 함께 구조하고,\n쪽지로 직접 연락도 할 수 있어요.\n\n준비 다 됐어요. 지금 시작해볼까요?",
  },
];
