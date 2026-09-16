"use client";

import { useEffect, useState } from "react";
import { Eye } from "lucide-react";

/**
 * 오늘 방문자 수 / 전체 가입 유저 수 표시.
 * /api/visit GET 호출 (public, 인증 불필요).
 * 2026-09-16 「익숙한 동네앱」 리디자인: 청록 틴트 필 → 회색 글자 한 줄.
 */
export default function TodayVisitors() {
  const [todayCount, setTodayCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/visit")
      .then((r) => r.json())
      .then((d) => {
        // 문구가 "지금까지 N명"이므로 오늘이 아니라 누적을 쓴다
        if (!cancelled) setTodayCount(typeof d.cumulative === "number" ? d.cumulative : 0);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (todayCount === null) return null;

  return (
    <div className="inline-flex items-center gap-1.5 mt-3 text-text-sub">
      <Eye size={13} />
      <span className="text-[13px]">
        지금까지 {todayCount.toLocaleString()}명이 둘러봤어요
      </span>
    </div>
  );
}
