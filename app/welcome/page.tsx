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
  ChevronRight,
  ChevronLeft,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { trackPixelOnce } from "@/lib/meta-pixel";

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

// 마지막 슬라이드 CTA — next가 어디로 가는지에 따라 라벨 변경
function finalCtaLabel(next: string): string {
  if (next === "/" || next === "/map" || next.startsWith("/map?") || next.startsWith("/map#")) {
    return "지도로 시작하기";
  }
  if (next.startsWith("/community")) return "커뮤니티로 가기";
  if (next.startsWith("/messages")) return "쪽지로 가기";
  if (next.startsWith("/mypage")) return "마이페이지로 가기";
  if (next.startsWith("/protection")) return "보호지침으로 가기";
  return "시작하기";
}

function WelcomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const next = safeNext(searchParams.get("next"));

  const [step, setStep] = useState(0);
  const [fading, setFading] = useState(false);
  const [earlySupporter, setEarlySupporter] = useState(false);
  // 마지막 슬라이드 후 의도 picker(audience 흡수)
  const [showIntent, setShowIntent] = useState(false);

  // 비로그인 시 홈으로
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/");
    }
  }, [user, authLoading, router]);

  // 진입한 순간 "한 번 봤음" 마킹 — 중간 이탈해도 다시 강제 노출되지 않게.
  // Meta Pixel: 가입 완료 이벤트 — welcome은 신규 가입자만 거치므로 컨버전 발사 최적 위치.
  // userId 기반 dedup 키로 동일 사용자가 다시 봐도 중복 발사 X.
  // eventID=user.id로 서버 CAPI 이벤트와 dedup — 양쪽 발사돼도 한 번만 카운트.
  useEffect(() => {
    try { localStorage.setItem("dosigongzon_welcome_seen", "true"); } catch {}
    if (user?.id) {
      trackPixelOnce(
        `fbq_signup_fired_${user.id}`,
        "CompleteRegistration",
        { content_name: "signup_complete" },
        user.id,
      );
    }
  }, [user?.id]);

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
    } else if (next === "/") {
      // 기본 목적지일 때만 의도 picker — 가입 전 명시적 URL이 있으면 그대로 존중
      setShowIntent(true);
    } else {
      router.replace(next);
    }
  };

  const handleSkip = () => router.replace(next);

  // 의도 1문항 — user_metadata.intent에 저장 + 의도별 첫 화면 라우팅.
  // 광고로 들어온 broad audience를 앱 내부에서 흡수하기 위함.
  const pickIntent = async (intent: "caretaker" | "interested" | "browsing", target: string) => {
    try {
      const sb = createClient();
      await sb.auth.updateUser({ data: { intent } });
    } catch {
      /* 분류 저장 실패해도 라우팅은 진행 */
    }
    router.replace(target);
  };

  if (authLoading || !user) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: "#FFF9F2" }}>
        <Sparkles size={28} className="animate-pulse" style={{ color: "#4C82BC" }} />
      </div>
    );
  }

  // 마지막 슬라이드 후 의도 picker — 3-way 선택으로 audience 흡수.
  if (showIntent) {
    return (
      <div
        className="app-no-zoom fixed inset-0 overflow-hidden flex flex-col"
        style={{ background: "linear-gradient(170deg, #4F6B53 0%, #6B8E6F 60%, #8FAE92 100%)" }}
      >
        <button
          onClick={handleSkip}
          className="absolute top-12 right-5 z-20 text-[13px] font-medium px-3 py-1.5 rounded-full active:opacity-50"
          style={{ color: "rgba(255,255,255,0.75)" }}
        >
          건너뛰기
        </button>

        <div className="flex-1 flex flex-col items-center justify-center px-7">
          <h2 className="text-[22px] font-extrabold text-center text-white tracking-tight leading-[1.4] mb-2">
            어떻게 시작해볼까요?
          </h2>
          <p className="text-[13px] text-center text-white/85 mb-7 leading-relaxed">
            당신에게 맞는 첫 화면을 보여드릴게요
          </p>

          <div className="w-full max-w-sm flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => pickIntent("caretaker", "/map")}
              className="px-4 py-4 rounded-2xl flex items-center gap-3 active:scale-[0.98] transition-transform"
              style={{ background: "rgba(255,255,255,0.96)", boxShadow: "0 8px 22px rgba(0,0,0,0.18)" }}
            >
              <span className="text-[26px] shrink-0">🐾</span>
              <div className="text-left flex-1 min-w-0">
                <p className="text-[14.5px] font-extrabold text-text-main leading-tight">이미 돌보고 있어요</p>
                <p className="text-[11.5px] text-text-sub mt-0.5">지도·돌봄일지로 바로</p>
              </div>
              <ChevronRight size={16} className="text-text-sub shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => pickIntent("interested", "/")}
              className="px-4 py-4 rounded-2xl flex items-center gap-3 active:scale-[0.98] transition-transform"
              style={{ background: "rgba(255,255,255,0.96)", boxShadow: "0 8px 22px rgba(0,0,0,0.18)" }}
            >
              <span className="text-[26px] shrink-0">💛</span>
              <div className="text-left flex-1 min-w-0">
                <p className="text-[14.5px] font-extrabold text-text-main leading-tight">관심 있어 들어왔어요</p>
                <p className="text-[11.5px] text-text-sub mt-0.5">동네 둘러보면서 천천히</p>
              </div>
              <ChevronRight size={16} className="text-text-sub shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => pickIntent("browsing", "/shorts")}
              className="px-4 py-4 rounded-2xl flex items-center gap-3 active:scale-[0.98] transition-transform"
              style={{ background: "rgba(255,255,255,0.96)", boxShadow: "0 8px 22px rgba(0,0,0,0.18)" }}
            >
              <span className="text-[26px] shrink-0">🎬</span>
              <div className="text-left flex-1 min-w-0">
                <p className="text-[14.5px] font-extrabold text-text-main leading-tight">그냥 구경하러</p>
                <p className="text-[11.5px] text-text-sub mt-0.5">귀여운 영상부터 (냥숏츠)</p>
              </div>
              <ChevronRight size={16} className="text-text-sub shrink-0" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  const slide = SLIDES[step];
  const isFirst = step === 0;
  const isLast = step === SLIDES.length - 1;

  return (
    <div
      className="app-no-zoom fixed inset-0 overflow-hidden flex flex-col"
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
              className="w-24 h-24 rounded-full flex items-center justify-center mb-6"
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

            <h1 className="text-[26px] font-extrabold text-center text-white tracking-tight leading-[1.3] mb-2">
              <span className="opacity-90">환영합니다,</span>
              <br />
              <span style={{ color: "#FFF7C4" }}>{nickname}</span>님 🐾
            </h1>
            {/* 닉네임 변경 가능 힌트 — 신규 가입자가 random nickname을 마음에 안 들어도 모르는 경우 방지 */}
            <p className="text-[11.5px] text-white/65 mb-4 leading-snug text-center">
              ✏️ 마이페이지에서 언제든 다른 닉네임으로 바꿀 수 있어요
            </p>
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
              className="w-20 h-20 rounded-full flex items-center justify-center mb-7"
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
                {finalCtaLabel(next)}
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

// 슬라이드 3개로 압축 (이전 5개 → 환영 / 지도+등록 / 돌봄+커뮤니티)
// 테스터 피드백상 5개는 끝까지 보지 않는 경우가 있어 핵심 메시지만 남김.
const SLIDES = [
  {
    bg: "linear-gradient(170deg, #4C82BC 0%, #6FA0D8 50%, #E8B07C 100%)",
    accent: "#3E6FA8",
    Icon: PartyPopper,
    title: "",
    body: "",
  },
  {
    bg: "linear-gradient(170deg, #4A7BA8 0%, #6B9BC4 60%, #A8C7E0 100%)",
    accent: "#3A6086",
    Icon: MapPin,
    title: "🗺️ 우리 동네 고양이 지도",
    body: "어떤 아이가 어디서 사는지, 건강 상태까지\n지도 한 장에 한눈에 모여요.\n\n마음에 드는 아이에겐 응원도 한 번 🩷\n가장 쉬운 첫 걸음이에요.",
  },
  {
    bg: "linear-gradient(170deg, #6B8E6F 0%, #8FAE92 50%, #BFD4C2 100%)",
    accent: "#4F6E53",
    Icon: Heart,
    title: "🧰 돌봄에 필요한 도구",
    body: "📝 밥·물·건강 한 줄 돌봄일지\n🤖 궁금하면 AI집사에게 바로 질문\n🏥 가까운 동물병원·약국 찾기\n\n돌보는 데 필요한 도구를 한곳에 모았어요.",
  },
  {
    bg: "linear-gradient(170deg, #4F6B53 0%, #6B8E6F 60%, #8FAE92 100%)",
    accent: "#3D5640",
    Icon: ShieldCheck,
    title: "🛡️ 안전하게 돌보는 도구",
    body: "걱정되는 아이는 '내 서클·나만 보기'로\n비공개 등록 — 외부엔 존재도 안 보여요.\n\n🚨 응급 상황엔 단계별 보호 가이드가\n바로 도와줘요.",
  },
];
