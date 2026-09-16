"use client";

// 고양이별 — CSS만으로 그린 행성.
// 2026-09-16 리디자인 「익숙한 동네앱」: 그라디언트·글로우·대기광을 걷어내고 선(線)으로만 그린다.
// 본체(연회색 면 + 헤어라인) + 기울어진 고리(헤어라인) + 곁별(작은 회색 점). 전부 토큰.
// 이미지 에셋을 안 쓰는 이유는 그대로: 이 화면 한 곳에만 쓰이고 크기별 리소스가 필요 없다.

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
        s: 3 + ((i * 3) % 3),
      };
    });
  }, [companions, size]);

  const ringBorder = `${Math.max(1, Math.round(size * 0.012))}px solid var(--color-gray-300)`;

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
            border: ringBorder,
            clipPath: "inset(0 0 50% 0)",
          }}
        />

        {/* 본체 — 연회색 면 + 헤어라인 */}
        <div
          className="absolute rounded-full"
          style={{
            inset: 0,
            background: "var(--color-surface-alt)",
            border: "1px solid var(--color-border)",
          }}
        />

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
            border: ringBorder,
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
              background: "var(--color-gray-400)",
              animation: `planetDot 3.4s ease-in-out ${d.d}s infinite`,
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes planetDot {
          0%, 100% { opacity: 0.35; }
          50%      { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="planetDot"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
