"use client";

// 주간 출석 보드 — 이번 주(월~일) 출석 스탬프 + 마일스톤 포인트 수령 (2026-07-13)
// 일일 출석체크(DailyCheckinModal)를 완료한 날이 스탬프로 찍힘.
// 3일 50P / 5일 100P / 7일 150P — 포인트는 쇼핑몰에서 1P=1원 할인.
// 서버(claim-weekly/route.ts)의 MILESTONES와 반드시 같은 값 유지.
// 마이그레이션(supabase_weekly_points_migration.sql) 전이면 조용히 렌더 안 함.

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const MILESTONES = [
  { days: 3, points: 50 },
  { days: 5, points: 100 },
  { days: 7, points: 150 },
];
const DAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];

function kstWeek(): { monday: Date; weekKey: string; todayIdx: number } {
  const kstNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const dow = (kstNow.getDay() + 6) % 7;
  const monday = new Date(kstNow);
  monday.setDate(kstNow.getDate() - dow);
  const thu = new Date(monday);
  thu.setDate(monday.getDate() + 3);
  const jan1 = new Date(thu.getFullYear(), 0, 1);
  const week = Math.ceil(((thu.getTime() - jan1.getTime()) / 86400000 + 1) / 7);
  return { monday, weekKey: `${thu.getFullYear()}-W${String(week).padStart(2, "0")}`, todayIdx: dow };
}

export default function WeeklyCheckinCard() {
  const [ready, setReady] = useState(false);
  const [checkedDays, setCheckedDays] = useState<Set<string>>(new Set());
  const [claimed, setClaimed] = useState<Set<number>>(new Set());
  const [balance, setBalance] = useState(0);
  const [claiming, setClaiming] = useState(false);
  const [justGranted, setJustGranted] = useState(0);

  const { monday, weekKey, todayIdx } = kstWeek();
  const weekDates: string[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toLocaleDateString("en-CA");
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return;
      const [daysRes, ledgerRes, pointRes] = await Promise.all([
        sb.from("checkin_days").select("day").eq("user_id", user.id).gte("day", weekDates[0]),
        sb.from("point_ledger").select("reason").eq("user_id", user.id).like("reason", `weekly:${weekKey}:%`),
        sb.from("user_points").select("balance").eq("user_id", user.id).maybeSingle(),
      ]);
      // 마이그레이션 전(테이블 없음)이면 렌더하지 않음
      if (daysRes.error || ledgerRes.error) return;
      if (cancelled) return;
      setCheckedDays(new Set((daysRes.data ?? []).map((r: { day: string }) => r.day)));
      setClaimed(new Set(
        (ledgerRes.data ?? [])
          .map((r: { reason: string }) => Number(r.reason.split(":m")[1]))
          .filter((n: number) => !isNaN(n)),
      ));
      setBalance((pointRes.data as { balance: number } | null)?.balance ?? 0);
      setReady(true);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ready) return null;

  const dayCount = weekDates.filter((d) => checkedDays.has(d)).length;
  const claimable = MILESTONES.filter((m) => dayCount >= m.days && !claimed.has(m.days));
  const claimableSum = claimable.reduce((s, m) => s + m.points, 0);

  const claim = async () => {
    if (claiming || claimable.length === 0) return;
    setClaiming(true);
    try {
      const res = await fetch("/api/points/claim-weekly", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.ok) {
        setClaimed((prev) => new Set([...prev, ...(data.grantedMilestones as number[])]));
        setBalance(data.balance);
        if (data.granted > 0) {
          setJustGranted(data.granted);
          try { navigator.vibrate?.(16); } catch { /* 미지원 */ }
          setTimeout(() => setJustGranted(0), 3000);
        }
      }
    } catch { /* 네트워크 오류 — 다음에 다시 */ }
    setClaiming(false);
  };

  return (
    <div
      className="mb-4 p-4"
      style={{
        background: "#FFFFFF",
        borderRadius: 20,
        border: "1px solid var(--color-divider)",
        boxShadow: "var(--shadow-card-sm)",
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-[16px]">🗓️</span>
          <h3 className="text-[13.5px] font-extrabold text-text-main tracking-tight">주간 출석</h3>
          <span className="text-[10px] font-bold text-text-light">{dayCount}/7일</span>
        </div>
        <span
          className="text-[11px] font-extrabold px-2.5 py-1 rounded-full tabular-nums"
          style={{ background: "var(--color-primary-soft)", color: "var(--color-primary)" }}
        >
          {balance.toLocaleString()}P
        </span>
      </div>

      {/* 요일 스탬프 */}
      <div className="grid grid-cols-7 gap-1.5 mb-3">
        {DAY_LABELS.map((label, i) => {
          const done = checkedDays.has(weekDates[i]);
          const isToday = i === todayIdx;
          return (
            <div key={label} className="flex flex-col items-center gap-1">
              <div
                className="w-full aspect-square rounded-xl flex items-center justify-center text-[15px]"
                style={{
                  background: done ? "rgba(34,163,102,0.12)" : "var(--color-surface-alt)",
                  border: isToday ? "1.5px solid var(--color-primary)" : "1.5px solid transparent",
                }}
              >
                {done ? "🐾" : ""}
              </div>
              <span className={`text-[9px] font-bold ${isToday ? "text-primary" : "text-text-light"}`}>{label}</span>
            </div>
          );
        })}
      </div>

      {/* 마일스톤 + 받기 */}
      <div className="flex items-center gap-2">
        <div className="flex-1 flex gap-1.5">
          {MILESTONES.map((m) => {
            const reached = dayCount >= m.days;
            const got = claimed.has(m.days);
            return (
              <span
                key={m.days}
                className="flex-1 text-center text-[10px] font-extrabold py-1.5 rounded-lg tabular-nums"
                style={{
                  background: got ? "rgba(34,163,102,0.12)" : reached ? "rgba(255,169,39,0.16)" : "var(--color-surface-alt)",
                  color: got ? "#22A366" : reached ? "#E8930C" : "var(--color-text-muted)",
                }}
              >
                {got ? "✓ " : ""}{m.days}일 {m.points}P
              </span>
            );
          })}
        </div>
        {claimableSum > 0 && (
          <button
            onClick={claim}
            disabled={claiming}
            className="shrink-0 px-3.5 py-1.5 rounded-xl text-[11.5px] font-extrabold text-white active:scale-95 transition-transform"
            style={{ background: "linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)" }}
          >
            {claiming ? "받는 중…" : `+${claimableSum}P 받기`}
          </button>
        )}
      </div>

      {justGranted > 0 && (
        <p className="text-[11px] font-extrabold text-center mt-2" style={{ color: "#22A366" }}>
          🎉 {justGranted}P 적립! 쇼핑에서 1P=1원으로 쓸 수 있어요
        </p>
      )}
      <p className="text-[9.5px] text-text-light mt-2 text-center">
        일일 출석체크를 완료하면 스탬프가 찍혀요 · 포인트는 쇼핑몰 결제 할인에 사용
      </p>
    </div>
  );
}
