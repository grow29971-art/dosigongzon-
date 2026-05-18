"use client";

// 출시 카운트다운 배너 — HomeLanding 최상단에 표시.
// 신청·앱 출시 D-Day 기준일: 2026-05-28 (KST).

import { useEffect, useState } from "react";
import { Rocket, Sparkles } from "lucide-react";

const LAUNCH_DATE = new Date("2026-05-28T00:00:00+09:00");

export default function LaunchCountdown() {
  const [days, setDays] = useState<number | null>(null);

  useEffect(() => {
    const calc = () => {
      const now = new Date();
      const diff = LAUNCH_DATE.getTime() - now.getTime();
      // 일자 ceil — 5/28 0시 기준 5/27 23:59면 D-1로 표시
      const d = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
      setDays(d);
    };
    calc();
    const id = setInterval(calc, 60_000); // 1분마다 재계산
    return () => clearInterval(id);
  }, []);

  if (days === null) return null;

  // D-Day 또는 이후
  if (days <= 0) {
    return (
      <div
        className="px-5 py-2.5 flex items-center justify-center gap-2 text-white"
        style={{
          background: "linear-gradient(90deg, #C47E5A 0%, #E86B8C 50%, #C47E5A 100%)",
        }}
      >
        <Rocket size={14} />
        <span className="text-[12.5px] font-extrabold tracking-tight">
          🎉 도시공존 앱 정식 출시!
        </span>
      </div>
    );
  }

  // D-1 ~ D-3 — 긴급 톤 (펄스 애니메이션)
  const isUrgent = days <= 3;

  return (
    <div
      className={`px-5 py-2.5 flex items-center justify-center gap-2 text-white ${isUrgent ? "animate-pulse-soft" : ""}`}
      style={{
        background: isUrgent
          ? "linear-gradient(90deg, #D85555 0%, #E86B8C 50%, #D85555 100%)"
          : "linear-gradient(90deg, #C47E5A 0%, #E86B8C 50%, #C47E5A 100%)",
      }}
    >
      <Rocket size={14} className="shrink-0" />
      <span className="text-[12.5px] font-extrabold tracking-tight whitespace-nowrap">
        도시공존 신청 · 앱 출시 <span className="mx-0.5 px-1.5 py-0.5 rounded-md" style={{ background: "rgba(255,255,255,0.22)" }}>D-{days}</span>
      </span>
      <Sparkles size={11} className="shrink-0" style={{ color: "#FFF7C4" }} />
    </div>
  );
}
