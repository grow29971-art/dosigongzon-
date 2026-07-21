"use client";

// 오늘의 냥 상자 — 일일 출석 리추얼. (HomeAuthed 상단, 로그인 유저 전원)
//  - 날짜 시드로 매일 다른 냥식 노출 (모두 같은 날 같은 글 → 대화거리)
//  - 탭해서 "열기" → 연속 출석일 +1, 가벼운 햅틱, 가끔(약 1/6) 깜짝 보상 문구
// DB 없음 — localStorage만 사용. 변동-보상으로 "내일 또" 고리 형성.

import { useEffect, useState } from "react";
import { Gift, Flame, Sparkles, PawPrint } from "lucide-react";
import { CAT_FACTS } from "@/lib/cat-facts";

const LAST_KEY = "dosigongzon_daily_box_last";
const STREAK_KEY = "dosigongzon_daily_box_streak";

function kstDate(offsetDays = 0): string {
  return new Date(Date.now() + offsetDays * 86_400_000).toLocaleDateString("en-CA", {
    timeZone: "Asia/Seoul",
  });
}
// FNV-1a 해시 → 날짜별 결정적 인덱스 (서버·클라 동일)
function seeded(s: string, mod: number): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % mod;
}

export default function DailyCatBox() {
  const today = kstDate();
  const fact = CAT_FACTS[seeded(today, CAT_FACTS.length)];
  const isBonus = seeded(today + "-bonus", 6) === 0; // 약 1/6 깜짝 보상일

  const [mounted, setMounted] = useState(false);
  const [opened, setOpened] = useState(false);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    setMounted(true);
    try {
      if (localStorage.getItem(LAST_KEY) === today) {
        setOpened(true);
        setStreak(Number(localStorage.getItem(STREAK_KEY) ?? "1") || 1);
      }
    } catch {
      /* localStorage 차단 — 닫힌 상태 유지 */
    }
  }, [today]);

  const open = () => {
    let next = 1;
    try {
      const last = localStorage.getItem(LAST_KEY);
      const prev = Number(localStorage.getItem(STREAK_KEY) ?? "0");
      next = last === kstDate(-1) ? prev + 1 : 1; // 어제 열었으면 연속, 아니면 리셋
      localStorage.setItem(LAST_KEY, today);
      localStorage.setItem(STREAK_KEY, String(next));
    } catch {
      /* ignore */
    }
    setStreak(next);
    setOpened(true);
    try { navigator.vibrate?.(15); } catch { /* 햅틱 미지원 */ }
  };

  // ── 닫힌 상태 (오늘 아직 안 엶) — mount 전엔 항상 닫힘으로 통일(hydration 안전)
  if (!opened) {
    return (
      <button
        type="button"
        onClick={open}
        disabled={!mounted}
        className="w-full mb-3 active:scale-[0.98] transition-transform text-left"
        style={{
          background: "linear-gradient(135deg, #FFF1D9 0%, #FFE0C0 100%)",
          borderRadius: 18,
          padding: "14px 16px",
          border: "1px solid rgba(49,130,246,0.22)",
          boxShadow: "0 4px 14px rgba(49,130,246,0.14)",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 text-2xl"
            style={{ background: "linear-gradient(135deg, #E88D5A 0%, var(--color-primary) 100%)", boxShadow: "0 4px 12px rgba(49,130,246,0.4)" }}
          >
            🎁
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-extrabold tracking-[0.15em]" style={{ color: "var(--color-primary-dark)" }}>오늘의 냥 상자</p>
            <p className="text-[14px] font-extrabold text-text-main leading-tight mt-0.5">탭해서 오늘의 냥식을 열어보세요</p>
            <p className="text-[11px] text-text-sub mt-0.5">매일 새로운 고양이 이야기 · 출석 도장 🐾</p>
          </div>
          <Sparkles size={16} style={{ color: "#E88D5A" }} className="shrink-0" />
        </div>
      </button>
    );
  }

  // ── 열린 상태
  return (
    <div
      className="mb-3"
      style={{
        background: "linear-gradient(135deg, #FFFDF8 0%, #FFF4E4 100%)",
        borderRadius: 18,
        padding: "14px 16px",
        border: "1px solid rgba(49,130,246,0.2)",
        boxShadow: "0 4px 14px var(--color-primary-soft)",
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-extrabold tracking-[0.15em] flex items-center gap-1" style={{ color: "var(--color-primary-dark)" }}>
          <PawPrint size={11} /> 오늘의 냥
        </p>
        {streak > 0 && (
          <span className="flex items-center gap-1 text-[11px] font-extrabold" style={{ color: "#E88D5A" }}>
            <Flame size={12} /> {streak}일째 출석
          </span>
        )}
      </div>
      <p className="text-[13.5px] font-bold text-text-main leading-relaxed">{fact}</p>
      {isBonus && (
        <div className="mt-2.5 flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: "rgba(232,141,90,0.12)" }}>
          <Gift size={14} style={{ color: "#D8743C" }} className="shrink-0" />
          <p className="text-[11.5px] font-extrabold leading-snug" style={{ color: "var(--color-primary-dark)" }}>
            오늘은 행운의 날! 길고양이에게 따뜻한 한 끼 어때요 🐾
          </p>
        </div>
      )}
    </div>
  );
}
