"use client";

// 주간 돌봄 보드 — 이번 주(월~일) 돌봄일지를 남긴 날 스탬프 + 마일스톤 포인트 수령.
// 2026-08-29 게임 요소 제거로, 출석 스탬프(checkin_days) 대신 그날 care_logs가 있으면 스탬프.
// 3일 50P / 5일 100P / 7일 150P — 포인트는 쇼핑몰에서 1P=1원 할인.
// 서버(claim-weekly/route.ts)의 MILESTONES와 반드시 같은 값 유지.
// 2026-09-16 「익숙한 동네앱」 리디자인: 이모지 스탬프 → 체크 아이콘, 색은 토큰만, 헤어라인 카드.

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { thisMondayKstDate, thisMondayKstISO, kstToday, toKstDate, isoWeekKey } from "@/lib/kst";

const MILESTONES = [
  { days: 3, points: 50 },
  { days: 5, points: 100 },
  { days: 7, points: 150 },
];
const DAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];

// 서버(claim-weekly)와 동일한 lib/kst 소스로 주 경계·주차키 계산 — weekKey가 어긋나면
// 수령 여부 표시가 서버와 불일치. weekDates는 care_logs의 KST 날짜와 대조할 달력 날짜.
function kstWeek(): { weekDates: string[]; weekKey: string; todayIdx: number } {
  const monday = thisMondayKstDate();
  const anchor = new Date(monday + "T00:00:00Z");
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(anchor);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
  return { weekDates, weekKey: isoWeekKey(monday), todayIdx: weekDates.indexOf(kstToday()) };
}

export default function WeeklyCheckinCard() {
  const [ready, setReady] = useState(false);
  const [checkedDays, setCheckedDays] = useState<Set<string>>(new Set());
  const [claimed, setClaimed] = useState<Set<number>>(new Set());
  const [balance, setBalance] = useState(0);
  const [claiming, setClaiming] = useState(false);
  const [justGranted, setJustGranted] = useState(0);

  const { weekDates, weekKey, todayIdx } = kstWeek();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return;
      const [logsRes, ledgerRes, pointRes] = await Promise.all([
        sb.from("care_logs").select("logged_at").eq("author_id", user.id).gte("logged_at", thisMondayKstISO()),
        sb.from("point_ledger").select("reason").eq("user_id", user.id).like("reason", `weekly:${weekKey}:%`),
        sb.from("user_points").select("balance").eq("user_id", user.id).maybeSingle(),
      ]);
      // 마이그레이션 전(테이블 없음)이면 렌더하지 않음
      if (logsRes.error || ledgerRes.error) return;
      if (cancelled) return;
      // 그날 돌봄일지가 하나라도 있으면 스탬프 — KST 달력일로 유일화
      setCheckedDays(new Set((logsRes.data ?? []).map((r: { logged_at: string }) => toKstDate(r.logged_at))));
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
        background: "var(--color-surface)",
        borderRadius: "var(--radius-card)",
        border: "1px solid var(--color-border)",
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {/* "출석"(게임 용어) → "돌봄"(행동 용어) 재프레이밍 (2026-08-29 PMF 개편) */}
          <h3 className="text-[15px] font-semibold text-text-main">이번 주 돌봄</h3>
          <span className="text-[13px] text-text-light tabular-nums">{dayCount}/7일</span>
        </div>
        <span
          className="text-[13px] font-semibold px-2 py-0.5 tabular-nums text-text-main"
          style={{ borderRadius: "var(--radius-square)", background: "var(--color-surface-alt)" }}
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
                className="w-full aspect-square flex items-center justify-center"
                style={{
                  borderRadius: "var(--radius-card-sm)",
                  background: done ? "var(--color-primary)" : "var(--color-surface)",
                  color: "var(--color-surface)",
                  border: done
                    ? "1px solid var(--color-primary)"
                    : `1px solid ${isToday ? "var(--color-primary)" : "var(--color-border)"}`,
                }}
              >
                {done && <Check size={14} strokeWidth={3} />}
              </div>
              <span className={`text-[11px] ${isToday ? "text-primary font-semibold" : "text-text-light"}`}>{label}</span>
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
                className="flex-1 text-center text-[11px] font-medium py-1.5 tabular-nums"
                style={{
                  borderRadius: "var(--radius-square)",
                  background: got ? "var(--color-sage-soft)" : "var(--color-surface-alt)",
                  color: got ? "var(--color-sage)" : reached ? "var(--color-text-main)" : "var(--color-text-light)",
                }}
              >
                {m.days}일 {m.points}P
              </span>
            );
          })}
        </div>
        {claimableSum > 0 && (
          <button
            onClick={claim}
            disabled={claiming}
            className="shrink-0 h-8 px-3 text-[13px] font-semibold press-strong transition-transform"
            style={{ borderRadius: "var(--radius-input)", background: "var(--color-primary)", color: "var(--color-surface)" }}
          >
            {claiming ? "받는 중…" : `+${claimableSum}P 받기`}
          </button>
        )}
      </div>

      {justGranted > 0 && (
        <p className="text-[13px] font-medium text-center mt-2" style={{ color: "var(--color-sage)" }}>
          {justGranted}P 적립 · 쇼핑에서 1P=1원으로 쓸 수 있어요
        </p>
      )}
      <p className="text-[11px] text-text-light mt-2 text-center">
        그날 돌봄 기록을 남기면 스탬프가 찍혀요 · 포인트는 쇼핑몰 결제 할인에 사용
      </p>
    </div>
  );
}
