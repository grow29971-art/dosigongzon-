"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Footprints,
  Flame,
  Handshake,
  Star,
  Moon,
  Heart,
  PawPrint,
  ChevronRight,
  MapPin,
  BookOpen,
  Compass,
  UserPlus,
  Sparkles,
} from "lucide-react";

/* ═══ 슬라이드 데이터 ═══ */
const SLIDES = [
  {
    /* 어둠 — 차가운 밤 */
    bg: "linear-gradient(170deg, #1a1a2e 0%, #2d2b55 40%, #4a3f6b 100%)",
    particleColor: "rgba(255,255,255,0.06)",
    accentColor: "#C4B5FD",
    dotActive: "#C4B5FD",
    title: "모두가 잠든 차가운 밤,\n당신은 다시 문을 나섭니다.",
    body: "누구도 알아주지 않는 어둠 속에서,\n당신을 기다릴 작은 숨결들을 위해\n무거운 가방을 메고 나서는\n그 다정한 발걸음을\n우리는 알고 있습니다.",
    MainIcon: Footprints,
    floats: [
      { Icon: Moon, x: "15%", y: "12%", size: 28, opacity: 0.15, rotate: -10 },
      { Icon: Star, x: "78%", y: "8%", size: 18, opacity: 0.12, rotate: 15 },
      { Icon: Star, x: "85%", y: "22%", size: 14, opacity: 0.08, rotate: 0 },
      { Icon: PawPrint, x: "22%", y: "65%", size: 22, opacity: 0.08, rotate: -15 },
      { Icon: PawPrint, x: "72%", y: "58%", size: 18, opacity: 0.06, rotate: 20 },
      { Icon: Star, x: "40%", y: "15%", size: 12, opacity: 0.1, rotate: 30 },
    ],
  },
  {
    /* 중간 — 따뜻한 빛 */
    bg: "linear-gradient(170deg, #3d2e1f 0%, #6b4c2a 30%, #c8956c 70%, #e8c49a 100%)",
    particleColor: "rgba(255,220,160,0.08)",
    accentColor: "#D4B676",
    dotActive: "#D4B676",
    title: "당신이 전한 그 온기 하나가,\n누군가에겐 삶의 전부가 됩니다.",
    body: "차가운 아스팔트 위에서\n밤을 지새우는 아이들에게,\n우리가 함께 만든 작은 쉼터는\n세상에서 가장 안전하고\n포근한 품이 되어줄 거예요.",
    MainIcon: Flame,
    floats: [
      { Icon: Heart, x: "18%", y: "14%", size: 22, opacity: 0.12, rotate: -8 },
      { Icon: Flame, x: "76%", y: "10%", size: 20, opacity: 0.1, rotate: 12 },
      { Icon: PawPrint, x: "25%", y: "62%", size: 20, opacity: 0.08, rotate: -20 },
      { Icon: Heart, x: "70%", y: "55%", size: 16, opacity: 0.07, rotate: 15 },
      { Icon: Star, x: "82%", y: "35%", size: 14, opacity: 0.08, rotate: 0 },
      { Icon: Flame, x: "12%", y: "40%", size: 16, opacity: 0.06, rotate: -5 },
    ],
  },
  {
    /* 새벽 — 희망의 빛 */
    bg: "linear-gradient(170deg, #5a3e22 0%, #b87050 25%, #d4906a 50%, #e8c4a8 75%, #f5f0e8 100%)",
    particleColor: "rgba(212,149,111,0.08)",
    accentColor: "#C47E5A",
    dotActive: "#C47E5A",
    title: "이제 '도시공존'이\n당신의 든든한 쉼터가\n되어드릴게요.",
    body: "혼자 하는 돌봄이 외롭지 않도록,\n당신의 진심이 지치지 않도록.\n우리가 곁에서 정보를 나누고\n진심을 더하겠습니다.\n\n함께 공존의 길을 걸어봐요.",
    MainIcon: Handshake,
    floats: [
      { Icon: Heart, x: "20%", y: "10%", size: 24, opacity: 0.15, rotate: -12 },
      { Icon: PawPrint, x: "75%", y: "12%", size: 22, opacity: 0.12, rotate: 10 },
      { Icon: Star, x: "82%", y: "30%", size: 16, opacity: 0.1, rotate: 0 },
      { Icon: Heart, x: "15%", y: "55%", size: 18, opacity: 0.08, rotate: 15 },
      { Icon: PawPrint, x: "70%", y: "60%", size: 20, opacity: 0.08, rotate: -18 },
      { Icon: Star, x: "45%", y: "18%", size: 14, opacity: 0.1, rotate: 25 },
    ],
  },
];

/* ═══ 페이지 ═══ */
export default function OnboardingPage() {
  const router = useRouter();
  const [current, setCurrent] = useState(0);
  const [fading, setFading] = useState(false);
  const [heartbeat, setHeartbeat] = useState(false);

  const slide = SLIDES[current];
  const isLast = current === SLIDES.length - 1;

  const goTo = (index: number) => {
    if (index === current || fading) return;
    setFading(true);
    setTimeout(() => {
      setCurrent(index);
      setFading(false);
    }, 400);
  };

  const completeOnboarding = () => {
    try { localStorage.setItem("dosigongzon_onboarded", "true"); } catch {}
  };

  const goAndComplete = (path: string) => {
    setHeartbeat(true);
    completeOnboarding();
    setTimeout(() => router.push(path), 400);
  };

  const handleNext = () => {
    if (isLast) {
      // 마지막 슬라이드 → 시작점 선택 화면(4번째)으로
      goTo(current + 1);
    } else if (current < SLIDES.length - 1) {
      goTo(current + 1);
    }
  };

  // 4번째: "이렇게 시작해보세요" 액션 카드 화면
  const isPicker = current === SLIDES.length;
  const pickerSlide = {
    bg: "linear-gradient(170deg, #C47E5A 0%, #D4956F 50%, #F5F0E8 100%)",
    accentColor: "#C47E5A",
    dotActive: "#C47E5A",
  };
  const activeBg = isPicker ? pickerSlide.bg : slide.bg;
  const activeAccent = isPicker ? pickerSlide.accentColor : slide.accentColor;
  const activeDot = isPicker ? pickerSlide.dotActive : slide.dotActive;

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ background: activeBg, transition: "background 0.8s ease" }}>
      {/* ── 건너뛰기 ── */}
      <button
        onClick={() => { completeOnboarding(); router.push("/map"); }}
        className="absolute top-12 right-5 z-20 text-[13px] font-medium px-3 py-1.5 rounded-full active:opacity-50 transition-opacity"
        style={{ color: isPicker ? "rgba(0,0,0,0.45)" : "rgba(255,255,255,0.5)" }}
      >
        건너뛰기
      </button>

      {/* ── 배경 파티클 아이콘 (감성 슬라이드만) ── */}
      {!isPicker && (
        <div className="absolute inset-0 z-0 transition-opacity duration-700" style={{ opacity: fading ? 0 : 1 }}>
          {slide.floats.map((f, i) => (
            <div
              key={`${current}-${i}`}
              className="absolute"
              style={{
                left: f.x,
                top: f.y,
                opacity: f.opacity,
                transform: `rotate(${f.rotate}deg)`,
              }}
            >
              <f.Icon size={f.size} color={slide.accentColor} strokeWidth={1.2} />
            </div>
          ))}
        </div>
      )}

      {/* ── 메인 콘텐츠 ── */}
      {isPicker ? (
        <div
          className="relative z-10 flex flex-col items-center justify-center h-full px-6 transition-opacity duration-400"
          style={{ opacity: fading ? 0 : 1 }}
        >
          <div
            className="w-20 h-20 rounded-[28px] flex items-center justify-center mb-6"
            style={{
              backgroundColor: "rgba(255,255,255,0.45)",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,0.5)",
            }}
          >
            <Compass size={38} color="#FFFFFF" strokeWidth={1.6} />
          </div>
          <h1 className="text-[22px] font-extrabold text-center text-white tracking-tight mb-2">
            어디부터 시작해볼까요?
          </h1>
          <p className="text-[13px] text-center text-white/85 mb-8">
            관심 가는 곳부터 천천히 둘러보세요
          </p>

          {/* 액션 카드 — 가입 유도 우선 */}
          <div className="w-full max-w-[360px] space-y-2.5">
            <SignupActionCard onClick={() => goAndComplete("/signup")} />
            <ActionCard
              icon={<MapPin size={20} color="#C47E5A" strokeWidth={2.2} />}
              title="가입 없이 지도부터 보기"
              desc="구경만 해도 OK — 나중에 가입할 수 있어요"
              onClick={() => goAndComplete("/map")}
            />
            <ActionCard
              icon={<BookOpen size={20} color="#5BA876" strokeWidth={2.2} />}
              title="보호지침 먼저 익히기"
              desc="응급·먹이·TNR·임시보호 가이드"
              onClick={() => goAndComplete("/protection")}
            />
          </div>

          <button
            onClick={() => goAndComplete("/login")}
            className="mt-6 text-[12px] font-bold text-white/80 underline underline-offset-4"
          >
            이미 계정이 있어요 — 로그인
          </button>
        </div>
      ) : (
        <div
          className="relative z-10 flex flex-col items-center justify-center h-full px-8 transition-opacity duration-400"
          style={{ opacity: fading ? 0 : 1 }}
        >
          <div
            className="w-24 h-24 rounded-[32px] flex items-center justify-center mb-10"
            style={{
              backgroundColor: "rgba(255,255,255,0.1)",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <slide.MainIcon size={44} color={slide.accentColor} strokeWidth={1.4} />
          </div>

          <h1
            className="text-[24px] font-extrabold text-center leading-[1.5] tracking-tight mb-6 whitespace-pre-line"
            style={{ color: "rgba(255,255,255,0.95)" }}
          >
            {slide.title}
          </h1>

          <p
            className="text-[15px] text-center leading-[2] whitespace-pre-line max-w-[300px]"
            style={{ color: "rgba(255,255,255,0.6)" }}
          >
            {slide.body}
          </p>
        </div>
      )}

      {/* ── 하단 컨트롤 ── */}
      <div className="absolute bottom-0 left-0 right-0 z-20 px-6 pb-10">
        {/* 인디케이터 — 4점 (감성 3 + picker 1) */}
        <div className="flex items-center justify-center gap-2.5 mb-6">
          {[...SLIDES.map((s) => s.dotActive), pickerSlide.dotActive].map((color, i) => (
            <button
              key={i}
              onClick={() => {
                if (i < SLIDES.length) goTo(i);
                // picker 인덱스로는 next로만 이동 (이전 슬라이드에서)
              }}
              className="transition-all duration-500 ease-out"
              style={{
                width: i === current ? 28 : 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: i === current ? color : isPicker ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.2)",
              }}
            />
          ))}
        </div>

        {/* 버튼 — picker일 땐 숨김 (카드 선택이 진행 액션) */}
        {!isPicker && (
          <button
            onClick={handleNext}
            className="w-full py-4.5 rounded-2xl text-[16px] font-bold flex items-center justify-center gap-2"
            style={{
              backgroundColor: activeAccent,
              color: isLast ? "#fff" : "#2A2A28",
              boxShadow: `0 8px 24px ${activeAccent}44`,
              transform: heartbeat ? "scale(1.05)" : "scale(1)",
              transition: "transform 0.3s ease, background-color 0.8s ease, box-shadow 0.8s ease",
              animation: heartbeat ? "heartbeat 0.6s ease" : "none",
            }}
          >
            {isLast ? (
              <>
                <PawPrint size={20} />
                다정한 공존 시작하기
              </>
            ) : (
              <>
                다음
                <ChevronRight size={18} />
              </>
            )}
          </button>
        )}
      </div>

      {/* ── 하트비트 애니메이션 ── */}
      <style>{`
        @keyframes heartbeat {
          0% { transform: scale(1); }
          25% { transform: scale(1.06); }
          50% { transform: scale(0.98); }
          75% { transform: scale(1.04); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

function SignupActionCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl active:scale-[0.98] transition-transform relative overflow-hidden"
      style={{
        background: "linear-gradient(135deg, #2A2A28 0%, #4A3F36 100%)",
        boxShadow: "0 10px 28px rgba(0,0,0,0.28)",
        border: "1px solid rgba(255,247,196,0.25)",
      }}
    >
      <span
        aria-hidden="true"
        className="absolute -top-3 -right-3 w-16 h-16 rounded-full"
        style={{ background: "rgba(255,247,196,0.10)", filter: "blur(8px)" }}
      />
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 relative z-10"
        style={{
          background: "linear-gradient(135deg, #FFF7C4 0%, #E8B040 100%)",
          boxShadow: "0 4px 12px rgba(232,176,64,0.35)",
        }}
      >
        <UserPlus size={22} color="#2A2A28" strokeWidth={2.4} />
      </div>
      <div className="flex-1 min-w-0 text-left relative z-10">
        <div className="flex items-center gap-1 mb-0.5">
          <Sparkles size={10} color="#FFF7C4" />
          <p className="text-[9.5px] font-extrabold tracking-[0.14em]" style={{ color: "#FFF7C4" }}>
            추천 · 1초 가입
          </p>
        </div>
        <p className="text-[14.5px] font-extrabold text-white tracking-tight leading-tight">
          지금 가입하고 함께 시작하기
        </p>
        <p className="text-[11px] mt-0.5 truncate" style={{ color: "rgba(255,255,255,0.7)" }}>
          카카오·구글로 1초 · 광고 없음 · 무료
        </p>
      </div>
      <ChevronRight size={16} className="shrink-0 relative z-10" color="#FFF7C4" />
    </button>
  );
}

function ActionCard({
  icon,
  title,
  desc,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl active:scale-[0.98] transition-transform"
      style={{
        background: "rgba(255,255,255,0.95)",
        boxShadow: "0 6px 20px rgba(0,0,0,0.10)",
        border: "1px solid rgba(255,255,255,0.6)",
      }}
    >
      <div
        className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
        style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.05)" }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0 text-left">
        <p className="text-[14.5px] font-extrabold text-text-main tracking-tight leading-tight">
          {title}
        </p>
        <p className="text-[11.5px] text-text-sub mt-0.5 truncate">{desc}</p>
      </div>
      <ChevronRight size={16} className="shrink-0 text-text-light" />
    </button>
  );
}
