"use client";

// 고양이별 — CSS만으로 그린 행성.
// 이미지 에셋을 안 쓴 이유: 밤하늘 위에 얹히는 물건이라 배경색이 바뀌면 가장자리가 티나고,
// 크기별 2x·3x를 들고 다녀야 하며, 이 화면 한 곳에만 쓰인다.
// 구성: 대기광 → 본체(광원 좌상단) → 지형 얼룩 → 명암 경계 → 역광 림 → 고리(뒤/앞).
// 전부 transform·opacity 애니메이션이라 리페인트가 없다.

import { useMemo } from "react";

interface Props {
  /** 행성 지름(px) */
  size?: number;
  /** 곁에 띄울 작은 별 수 — 고양이별에 온 아이들 */
  companions?: number;
}

export default function CatStarPlanet({ size = 150, companions = 0 }: Props) {
  const ringW = size * 1.85;
  const ringH = size * 0.46;

  // 곁별 배치 — 결정적(리렌더마다 안 튄다)
  const dots = useMemo(() => {
    const n = Math.min(companions, 12);
    return Array.from({ length: n }, (_, i) => {
      const angle = (i / Math.max(n, 1)) * Math.PI * 2 + 0.6;
      const r = size * (0.78 + ((i * 7) % 5) * 0.06);
      return {
        x: Math.cos(angle) * r,
        y: Math.sin(angle) * r * 0.42,
        d: (i % 5) * 0.5,
        s: 2 + ((i * 3) % 3),
      };
    });
  }, [companions, size]);

  return (
    <div
      className="relative"
      style={{ width: ringW, height: Math.max(size * 1.25, ringH * 1.6) }}
      aria-hidden="true"
    >
      <div
        className="absolute"
        style={{ left: "50%", top: "50%", transform: "translate(-50%, -50%)", width: size, height: size }}
      >
        {/* 대기광 */}
        <div
          className="absolute rounded-full"
          style={{
            inset: -size * 0.22,
            background:
              "radial-gradient(circle, rgba(255,233,168,0.30) 0%, rgba(255,200,150,0.14) 42%, rgba(255,180,140,0) 70%)",
            animation: "planetBreathe 7s ease-in-out infinite",
          }}
        />

        {/* 고리 — 뒤쪽 절반 (행성 아래로 깔린다) */}
        <div
          className="absolute rounded-full"
          style={{
            width: ringW,
            height: ringH,
            left: "50%",
            top: "50%",
            marginLeft: -ringW / 2,
            marginTop: -ringH / 2,
            transform: "rotate(-17deg)",
            border: `${Math.max(2, size * 0.022)}px solid rgba(255,224,180,0.30)`,
            boxShadow: "0 0 18px rgba(255,224,180,0.18)",
            clipPath: "inset(0 0 50% 0)",
          }}
        />

        {/* 본체 */}
        <div
          className="absolute rounded-full overflow-hidden"
          style={{
            inset: 0,
            background:
              "radial-gradient(circle at 33% 27%, #FFF1CF 0%, #F2CE8E 18%, #D99F5E 38%, #A96A3F 58%, #6B3F32 78%, #34202B 95%)",
            boxShadow:
              "inset -14px -18px 34px rgba(20,10,26,0.55), inset 8px 8px 20px rgba(255,240,205,0.22), 0 0 44px rgba(255,208,150,0.28)",
          }}
        >
          {/* 지형 얼룩 — 아주 느리게 흐른다(자전) */}
          <div
            className="absolute"
            style={{
              inset: "-10%",
              opacity: 0.5,
              backgroundImage: [
                "radial-gradient(ellipse 34% 13% at 22% 34%, rgba(92,52,44,0.55), transparent 65%)",
                "radial-gradient(ellipse 26% 10% at 63% 24%, rgba(255,240,214,0.34), transparent 62%)",
                "radial-gradient(ellipse 42% 15% at 48% 62%, rgba(84,46,48,0.45), transparent 68%)",
                "radial-gradient(ellipse 20% 8% at 80% 52%, rgba(255,232,196,0.26), transparent 60%)",
                "radial-gradient(ellipse 30% 11% at 34% 79%, rgba(70,38,44,0.42), transparent 66%)",
              ].join(","),
              animation: "planetSpin 64s linear infinite",
            }}
          />

          {/* 명암 경계 */}
          <div
            className="absolute rounded-full"
            style={{
              inset: 0,
              background:
                "linear-gradient(114deg, rgba(0,0,0,0) 42%, rgba(24,12,30,0.42) 68%, rgba(16,8,22,0.72) 100%)",
            }}
          />

          {/* 어두운 쪽 역광 림 */}
          <div
            className="absolute rounded-full"
            style={{
              inset: 0,
              boxShadow: "inset -3px -4px 10px rgba(180,170,255,0.30)",
            }}
          />
        </div>

        {/* 고리 — 앞쪽 절반 (행성 위를 지난다) */}
        <div
          className="absolute rounded-full"
          style={{
            width: ringW,
            height: ringH,
            left: "50%",
            top: "50%",
            marginLeft: -ringW / 2,
            marginTop: -ringH / 2,
            transform: "rotate(-17deg)",
            border: `${Math.max(2, size * 0.022)}px solid rgba(255,224,180,0.42)`,
            boxShadow: "0 0 14px rgba(255,224,180,0.22)",
            clipPath: "inset(50% 0 0 0)",
          }}
        />

        {/* 곁별 — 고양이별에 온 아이 수만큼 */}
        {dots.map((d, i) => (
          <span
            key={i}
            className="absolute rounded-full"
            style={{
              left: `calc(50% + ${d.x}px)`,
              top: `calc(50% + ${d.y}px)`,
              width: d.s,
              height: d.s,
              background: "#FFE9A8",
              boxShadow: "0 0 6px rgba(255,233,168,0.9)",
              animation: `planetDot 3.4s ease-in-out ${d.d}s infinite`,
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes planetSpin {
          from { transform: translateX(0); }
          to   { transform: translateX(-20%); }
        }
        @keyframes planetBreathe {
          0%, 100% { opacity: 0.75; transform: scale(1); }
          50%      { opacity: 1;    transform: scale(1.05); }
        }
        @keyframes planetDot {
          0%, 100% { opacity: 0.25; }
          50%      { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="planetSpin"], [style*="planetBreathe"], [style*="planetDot"] {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
