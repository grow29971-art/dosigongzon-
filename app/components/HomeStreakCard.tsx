"use client";

// 홈 — 돌봄 연속 일수(스트릭) 카드. HomeAuthed 인라인 블록에서 분리 (2026-07-10).
// 위치 이동을 쉽게 하려고 컴포넌트화. 로직은 기존과 동일.
// 2026-09-16 「익숙한 동네앱」 리디자인: 그라디언트·불꽃 이모지·단계별 색을 걷어내고
// 흰 면 + 헤어라인, 강조는 primary 하나. 끊길 위험은 error 의미색으로만.

import Link from "next/link";
import { Check, Flame } from "lucide-react";
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
  const headline = s === 0
    ? (hasToday ? "오늘 돌봄을 시작했어요" : "오늘 첫 돌봄을 기록해보세요")
    : hasToday
      ? `${s}일 연속 돌봄 중`
      : `${s}일 연속 — 오늘도 이어가볼까요?`;
  const kstHourForSubline = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }),
  ).getHours();
  const urgentSubline = !hasToday && s >= 2 && kstHourForSubline >= 18;
  const subline = s === 0
    ? "1건만 기록해도 연속 일수가 시작돼요"
    : urgentSubline
      ? `${s}일 연속 기록이 오늘 끊길 수 있어요. 한 줄이면 돼요`
      : !hasToday
        ? "아직 오늘 기록이 없어요. 끊기지 않게"
        : s >= 7
          ? "꾸준함이 아이들을 지켜요"
          : "매일 조금씩이 가장 큰 힘이에요";

  const dayLabels = ["월", "화", "수", "목", "금", "토", "일"];
  const kstNowForStreak = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }),
  );
  const todayIdx = (kstNowForStreak.getDay() + 6) % 7;
  const kstHour = kstNowForStreak.getHours();
  const atRisk = !hasToday && s >= 2 && kstHour >= 18;
  const hoursLeft = atRisk ? Math.max(1, 24 - kstHour) : 0;
  const accent = atRisk ? "var(--color-error)" : "var(--color-primary)";

  return (
    <Link href="/map" className="block mb-4 press transition-transform">
      <div
        className="p-4"
        style={{
          background: "var(--color-surface)",
          borderRadius: "var(--radius-card)",
          border: "1px solid var(--color-border)",
        }}
      >
        <div className="flex items-start gap-3">
          <div
            className="flex items-center justify-center shrink-0 w-10 h-10"
            style={{
              borderRadius: "var(--radius-card-sm)",
              background: "var(--color-surface-alt)",
              color: s >= 1 ? accent : "var(--color-text-muted)",
            }}
          >
            <Flame size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-medium text-text-light">연속 돌봄</p>
              {atRisk && (
                <span
                  className="text-[11px] font-semibold px-1.5 py-0.5"
                  style={{
                    borderRadius: "var(--radius-square)",
                    background: "var(--color-error-soft)",
                    color: "var(--color-error)",
                  }}
                >
                  {hoursLeft}시간 남음
                </span>
              )}
            </div>
            <p className="text-[15px] font-semibold text-text-main leading-snug mt-0.5">
              {headline}
            </p>
            <p className="text-[13px] text-text-sub mt-0.5 leading-snug">{subline}</p>
            <StreakFreezeButton streak={s} hasToday={hasToday} onUsed={onFreezeUsed} />
          </div>
        </div>

        <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--color-divider)" }}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[13px] text-text-sub">이번 주 돌봄</span>
            <span className="text-[13px] font-semibold text-text-main tabular-nums">
              {weekly.count}/{weekly.goal}
            </span>
          </div>
          <div className="progress-bar">
            <div style={{ width: `${progress}%`, background: "var(--color-primary)" }} />
          </div>
          <div className="flex items-center justify-between mt-2.5">
            {weekly.byDay.map((done, i) => {
              const isToday = i === todayIdx;
              return (
                <div key={i} className="flex flex-col items-center gap-1" style={{ width: 32 }}>
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center"
                    style={{
                      background: done ? "var(--color-primary)" : "var(--color-surface)",
                      color: "var(--color-surface)",
                      border: done
                        ? "1px solid var(--color-primary)"
                        : `1px solid ${isToday ? "var(--color-primary)" : "var(--color-border)"}`,
                    }}
                  >
                    {done && <Check size={12} strokeWidth={3} />}
                  </div>
                  <span
                    className="text-[11px]"
                    style={{ color: isToday ? "var(--color-primary)" : "var(--color-text-light)", fontWeight: isToday ? 600 : 400 }}
                  >
                    {dayLabels[i]}
                  </span>
                </div>
              );
            })}
          </div>

          {streakInfo.longestStreak >= 2 && (
            <p className="mt-3 text-[11px] text-text-light">
              {streakInfo.isRecord
                ? `역대 최장 기록 갱신 중 (${streakInfo.longestStreak}일)`
                : `역대 최장 ${streakInfo.longestStreak}일 · 돌파까지 ${streakInfo.longestStreak - s + 1}일`}
            </p>
          )}

          <p className="mt-1.5 text-[11px] text-text-light">
            {progress >= 100
              ? "주간 개근 달성 · +5점 · 업적 잠금 해제"
              : s >= 100
              ? "100일 연속 · +100점 유지 중"
              : s >= 30
              ? "30일 연속 · +30점 · 다음 목표: 100일"
              : s >= 7
              ? "7일 연속 · +10점 · 다음 목표: 30일"
              : `7일 연속 달성 시 +10점 · 주간 개근 +5점`}
          </p>
        </div>
      </div>
    </Link>
  );
}
