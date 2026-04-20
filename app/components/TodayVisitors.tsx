"use client";

import { useEffect, useState } from "react";
import { Eye } from "lucide-react";

/**
 * 오늘 방문자 수 / 전체 가입 유저 수 표시.
 * /api/visit GET 호출 (public, 인증 불필요).
 */
export default function TodayVisitors() {
  const [todayCount, setTodayCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/visit")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setTodayCount(typeof d.today === "number" ? d.today : 0);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (todayCount === null) return null;

  return (
    <div
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full mt-3"
      style={{
        background: "rgba(72,165,158,0.10)",
        border: "1px solid rgba(72,165,158,0.22)",
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full animate-pulse"
        style={{ background: "#48A59E" }}
      />
      <Eye size={12} style={{ color: "#48A59E" }} />
      <span className="text-[11.5px] font-extrabold" style={{ color: "#2E7870" }}>
        지금까지 {todayCount.toLocaleString()}명이 둘러봤어요
      </span>
    </div>
  );
}
