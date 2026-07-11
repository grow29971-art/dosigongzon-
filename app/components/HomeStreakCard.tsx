"use client";

// 홈 — 돌봄 연속 일수(스트릭) 카드. HomeAuthed 인라인 블록에서 분리 (2026-07-10).
// 위치 이동을 쉽게 하려고 컴포넌트화. 로직/디자인은 기존과 동일.

import Link from "next/link";
import StreakFreezeButton from "@/app/components/StreakFreezeButton";
import type { StreakInfo } from "@/lib/streak-repo";

export default function HomeStreakCard({
  streakInfo,
  onFreezeUsed,
}: {
  streakInfo: StreakInfo;
  onFreezeUsed: () => void;
}) {
  // 노출 조건: 연속 1일+ / 이번 주 기록 있음 / 오늘 미기록
  if (!(streakInfo.streak > 0 || streakInfo.weekly.count > 0 || !streakInfo.hasToday)) {
    return null;
  }

  const s = streakInfo.streak;
  const hasToday = streakInfo.hasToday;
  const weekly = streakInfo.weekly;
  const progress = Math.min(100, Math.round((weekly.count / weekly.goal) * 100));
  const fireCount = s >= 30 ? 3 : s >= 7 ? 2 : s >= 1 ? 1 : 0;
  const accent =
    s >= 30 ? "#D85555" :
    s >= 7  ? "#E88D5A" :
    s >= 1  ? "var(--color-primary)" : "#A38E7A";
  const headline = s === 0
    ? (hasToday ? "오늘 돌봄을 시작했어요" : "오늘 첫 돌봄을 기록해보세요")
    : hasToday
      ? `${s}일 연속 돌봄 중!`
      : `${s}일 연속 — 오늘도 이어가볼까요?`;
  const kstHourForSubline = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }),
  ).getHours();
  const urgentSubline = !hasToday && s >= 2 && kstHourForSubline >= 18;
  const subline = s === 0
    ? "1건만 기록해도 연속 일수가 시작돼요"
    : urgentSubline
      ? `${s}일 연속 기록이 오늘 끊길 수 있어요. 한 줄이면 돼요!`
      : !hasToday
        ? "아직 오늘 기록이 없어요. 끊기지 않게 💛"
        : s >= 7
          ? "대단해요! 꾸준함이 아이들을 지켜요"
          : "매일 조금씩이 가장 큰 힘이에요";

  const dayLabels = ["월", "화", "수", "목", "금", "토", "일"];
  const kstNowForStreak = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }),
  );
  const todayIdx = (kstNowForStreak.getDay() + 6) % 7;
  const kstHour = kstNowForStreak.getHours();
  const atRisk = !hasToday && s >= 2 && kstHour >= 18;
  const hoursLeft = atRisk ? Math.max(1, 24 - kstHour) : 0;

  return (
    <Link href="/map" className="block mb-4 active:scale-[0.99] transition-transform">
      <div
        className="p-5 relative"
        style={{
          background: atRisk
            ? "linear-gradient(135deg, #FFF1F1 0%, #FFE5E5 100%)"
            : hasToday
              ? `linear-gradient(135deg, ${accent}18 0%, ${accent}08 100%)`
              : "#FFFFFF",
          borderRadius: 22,
          border: atRisk
            ? "1.5px solid #D85555"
            : `1px solid ${hasToday ? `${accent}30` : "rgba(0,0,0,0.05)"}`,
          boxShadow: atRisk
            ? "0 4px 16px rgba(216,85,85,0.18)"
            : "0 4px 16px rgba(0,0,0,0.05)",
        }}
      >
        {atRisk && (
          <div
            className="absolute -top-2 right-4 px-2.5 py-1 rounded-full flex items-center gap-1"
            style={{
              background: "linear-gradient(135deg, #E85555 0%, #C43838 100%)",
              boxShadow: "0 4px 10px rgba(216,85,85,0.45)",
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#FFF" }} />
            <span className="text-[10px] font-extrabold text-white tracking-tight">
              ⏰ {hoursLeft}시간 남음
            </span>
          </div>
        )}
        <div className="flex items-start gap-3 mb-3">
          <div
            className="flex items-center justify-center shrink-0"
            style={{
              width: 52,
              height: 52,
              borderRadius: 18,
              background: s >= 1 ? `linear-gradient(135deg, #FF9A3C 0%, #E8652A 100%)` : "#F0EBE3",
              boxShadow: s >= 1 ? "0 6px 16px rgba(255,154,60,0.35)" : "none",
              fontSize: 26,
            }}
          >
            <span style={{ filter: s === 0 ? "grayscale(1)" : "none", opacity: s === 0 ? 0.5 : 1 }}>
              {fireCount === 3 ? "🔥🔥🔥" : fireCount === 2 ? "🔥🔥" : "🔥"}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-extrabold tracking-[0.12em]" style={{ color: accent }}>
              STREAK
            </p>
            <p className="text-[16px] font-extrabold text-text-main tracking-tight leading-tight mt-0.5">
              {headline}
            </p>
            <p className="text-[11.5px] text-text-sub mt-1 leading-snug">{subline}</p>
            <StreakFreezeButton streak={s} hasToday={hasToday} onUsed={onFreezeUsed} />
          </div>
        </div>

        <div className="mt-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold text-text-sub">이번 주 돌봄</span>
            <span className="text-[12px] font-extrabold" style={{ color: accent }}>
              {weekly.count}/{weekly.goal}
              {progress >= 100 && <span className="ml-1">🎉</span>}
            </span>
          </div>
          <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.06)" }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${progress}%`, background: `linear-gradient(90deg, ${accent} 0%, ${accent}CC 100%)` }}
            />
          </div>
          <div className="flex items-center justify-between mt-2.5">
            {weekly.byDay.map((done, i) => {
              const isToday = i === todayIdx;
              return (
                <div key={i} className="flex flex-col items-center gap-1" style={{ width: 32 }}>
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-extrabold"
                    style={{
                      background: done ? accent : isToday ? `${accent}25` : "rgba(0,0,0,0.05)",
                      color: done ? "#fff" : isToday ? accent : "#B0A89C",
                      border: isToday && !done ? `1.5px dashed ${accent}` : "none",
                    }}
                  >
                    {done ? "✓" : ""}
                  </div>
                  <span className="text-[9px] font-bold" style={{ color: isToday ? accent : "#A38E7A" }}>
                    {dayLabels[i]}
                  </span>
                </div>
              );
            })}
          </div>

          {streakInfo.longestStreak >= 2 && (
            <div
              className="mt-3 px-3 py-2 rounded-lg flex items-center justify-between"
              style={{
                background: streakInfo.isRecord
                  ? "linear-gradient(135deg, #FFF4DC 0%, #FFE9C5 100%)"
                  : "rgba(0,0,0,0.035)",
                border: streakInfo.isRecord ? "1px solid #E8B84A55" : "none",
              }}
            >
              <span className="text-[10.5px] font-bold" style={{ color: streakInfo.isRecord ? "#A67B1E" : "#8C7B6A" }}>
                {streakInfo.isRecord
                  ? `🎉 역대 최장 기록 갱신 중! (${streakInfo.longestStreak}일)`
                  : `🏆 역대 최장 ${streakInfo.longestStreak}일 · 돌파까지 ${streakInfo.longestStreak - s + 1}일`}
              </span>
            </div>
          )}

          <div className="mt-3 px-3 py-2 rounded-lg flex items-center justify-between" style={{ background: `${accent}12` }}>
            <span className="text-[10.5px] font-bold" style={{ color: accent }}>
              {progress >= 100
                ? "🏆 주간 개근 달성! +5점 · 업적 잠금 해제"
                : s >= 100
                ? "👑 100일 연속 · +100점 유지 중"
                : s >= 30
                ? "🔥🔥 30일 연속 · +30점 · 다음 목표: 100일"
                : s >= 7
                ? "🔥 7일 연속 · +10점 · 다음 목표: 30일"
                : `7일 연속 달성 시 🔥 +10점 · 주간 개근 +5점`}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
