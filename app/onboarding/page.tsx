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
    accentColor: "#FCD34D",
    dotActive: "#FCD34D",
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
    bg: "linear-gradient(170deg, #6b4c2a 0%, #d4856a 25%, #f4a985 50%, #fcd5c0 75%, #fff5ee 100%)",
    particleColor: "rgba(255,180,140,0.08)",
    accentColor: "#FF8A65",
    dotActive: "#FF8A65",
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

  const handleNext = () => {
    if (isLast) {
      setHeartbeat(true);
      setTimeout(() => {
        router.push("/login");
      }, 600);
    } else {
      goTo(current + 1);
    }
  };

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ background: slide.bg, transition: "background 0.8s ease" }}>
      {/* ── 건너뛰기 ── */}
      <button
        onClick={() => router.push("/login")}
        className="absolute top-12 right-5 z-20 text-[13px] font-medium px-3 py-1.5 rounded-full active:opacity-50 transition-opacity"
        style={{ color: "rgba(255,255,255,0.5)" }}
      >
        건너뛰기
      </button>

      {/* ── 배경 파티클 아이콘 ── */}
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

      {/* ── 메인 콘텐츠 (페이드 전환) ── */}
      <div
        className="relative z-10 flex flex-col items-center justify-center h-full px-8 transition-opacity duration-400"
        style={{ opacity: fading ? 0 : 1 }}
      >
        {/* 메인 아이콘 */}
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

        {/* 제목 */}
        <h1
          className="text-[24px] font-extrabold text-center leading-[1.5] tracking-tight mb-6 whitespace-pre-line"
          style={{ color: "rgba(255,255,255,0.95)" }}
        >
          {slide.title}
        </h1>

        {/* 본문 */}
        <p
          className="text-[15px] text-center leading-[2] whitespace-pre-line max-w-[300px]"
          style={{ color: "rgba(255,255,255,0.6)" }}
        >
          {slide.body}
        </p>
      </div>

      {/* ── 하단 컨트롤 ── */}
      <div className="absolute bottom-0 left-0 right-0 z-20 px-6 pb-10">
        {/* 인디케이터 */}
        <div className="flex items-center justify-center gap-2.5 mb-6">
          {SLIDES.map((s, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className="transition-all duration-500 ease-out"
              style={{
                width: i === current ? 28 : 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: i === current ? s.dotActive : "rgba(255,255,255,0.2)",
              }}
            />
          ))}
        </div>

        {/* 버튼 */}
        <button
          onClick={handleNext}
          className="w-full py-4.5 rounded-2xl text-[16px] font-bold flex items-center justify-center gap-2"
          style={{
            backgroundColor: slide.accentColor,
            color: isLast ? "#fff" : "#1a1a2e",
            boxShadow: `0 8px 24px ${slide.accentColor}44`,
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
