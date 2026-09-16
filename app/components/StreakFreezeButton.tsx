"use client";

import { useEffect, useState } from "react";
import { Snowflake, Loader2, Check } from "lucide-react";
import {
  getMyFreezeStatus,
  applyFreezeToday,
  type FreezeStatus,
} from "@/lib/streak-freeze-repo";

interface Props {
  /** 현재 스트릭 일수 (2 이상일 때만 의미 있음) */
  streak: number;
  /** 오늘 이미 돌봄 기록이 있는지 */
  hasToday: boolean;
  /** 사용 성공 시 부모에게 알림 — streak 재조회 트리거 */
  onUsed?: () => void;
}

/**
 * 스트릭 프리즈 쿠폰 — 1주에 1회 "오늘 건너뛰기".
 * 오늘 돌봄이 없고 streak ≥ 2 일 때만 의미.
 * 2026-09-16 리디자인: 파란 틴트 패널·이모지 폐지 — 흰 면 + 헤어라인, 회색 선 아이콘.
 */
export default function StreakFreezeButton({ streak, hasToday, onUsed }: Props) {
  const [status, setStatus] = useState<FreezeStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getMyFreezeStatus().then((s) => {
      if (!cancelled) setStatus(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // 노출 조건: 스트릭 2일 이상, 오늘 미기록, 이번 주 미사용
  if (!status) return null;
  if (streak < 2 || hasToday) return null;

  const handleUse = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await applyFreezeToday();
      if (!res.ok) {
        setError(res.error ?? "사용에 실패했어요");
        setBusy(false);
        return;
      }
      // 상태 재조회
      const fresh = await getMyFreezeStatus();
      setStatus(fresh);
      onUsed?.();
    } finally {
      setBusy(false);
    }
  };

  // 이번 주 이미 사용한 경우 — 안내만
  if (status.usedThisWeek) {
    return (
      <div
        className="mt-2 px-3 py-2 flex items-center gap-2 text-[11px] font-semibold text-text-sub"
        style={{ background: "var(--color-gray-100)", borderRadius: "var(--radius-input)" }}
      >
        <Check size={12} />
        이번 주 쿠폰을 이미 사용했어요
      </div>
    );
  }

  if (confirming) {
    return (
      <div
        className="mt-2 px-3 py-2.5"
        // 부모 카드가 <Link href="/map">라 이 패널의 버튼 클릭이 버블되면 지도로
        // 튕겨 성공/에러 피드백을 못 봤음 — 패널 루트에서 기본이동·전파를 막는다.
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-card-sm)",
        }}
      >
        <p className="text-[13px] font-bold text-text-main mb-2 flex items-center gap-1.5">
          <Snowflake size={13} className="text-text-sub" />
          오늘을 건너뛸까요? (주 1회 한정)
        </p>
        <p className="text-[11px] text-text-sub mb-2.5 leading-snug">
          오늘을 &lsquo;있었던 날&rsquo;로 처리해 스트릭을 이어요. 내일부터는 다시 기록해야 해요.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={handleUse}
            className="flex-1 h-8 text-[11px] font-semibold press-strong disabled:opacity-60 flex items-center justify-center gap-1"
            style={{
              background: "var(--color-primary)",
              color: "var(--color-surface)",
              borderRadius: "var(--radius-input)",
            }}
          >
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Snowflake size={12} />}
            쿠폰 사용
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirming(false)}
            className="px-3 h-8 text-[11px] font-semibold press-strong"
            style={{
              background: "var(--color-gray-100)",
              color: "var(--color-text-main)",
              borderRadius: "var(--radius-input)",
            }}
          >
            취소
          </button>
        </div>
        {error && (
          <p className="text-[11px] mt-2 font-semibold" style={{ color: "var(--color-error)" }}>
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setConfirming(true);
      }}
      className="mt-2 w-full px-3 py-2 flex items-center justify-center gap-1.5 press text-text-sub"
      style={{
        background: "var(--color-surface)",
        border: "1px dashed var(--color-gray-300)",
        borderRadius: "var(--radius-input)",
      }}
    >
      <Snowflake size={12} />
      <span className="text-[11px] font-semibold">주 1회 쿠폰으로 오늘 건너뛰기</span>
    </button>
  );
}
