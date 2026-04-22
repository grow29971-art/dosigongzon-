"use client";

import { useEffect, useState } from "react";
import { Snowflake, Loader2, Check } from "lucide-react";
import {
  getMyFreezeStatus,
  useFreezeToday,
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
      const res = await useFreezeToday();
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
        className="mt-2 px-3 py-2 rounded-xl flex items-center gap-2 text-[11px] font-bold"
        style={{ background: "rgba(74,123,168,0.08)", color: "#4A7BA8" }}
      >
        <Check size={12} />
        이번 주 쿠폰을 이미 사용했어요
      </div>
    );
  }

  if (confirming) {
    return (
      <div
        className="mt-2 px-3 py-2.5 rounded-xl"
        style={{
          background: "linear-gradient(135deg, #E8F0F8 0%, #D8E4F0 100%)",
          border: "1px solid rgba(74,123,168,0.25)",
        }}
      >
        <p className="text-[11.5px] font-extrabold text-text-main mb-2">
          🧊 오늘을 건너뛸까요? (주 1회 한정)
        </p>
        <p className="text-[10.5px] text-text-sub mb-2.5 leading-snug">
          스트릭이 끊기지 않도록 오늘을 '있었던 날'로 처리해요.
          내일부터는 다시 기록해야 이어져요.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={handleUse}
            className="flex-1 py-2 rounded-xl text-[11px] font-extrabold text-white active:scale-95 disabled:opacity-60 flex items-center justify-center gap-1"
            style={{
              background: "linear-gradient(135deg, #4A7BA8 0%, #2E5A8A 100%)",
              boxShadow: "0 2px 8px rgba(74,123,168,0.35)",
            }}
          >
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Snowflake size={12} />}
            쿠폰 사용
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirming(false)}
            className="px-3 py-2 rounded-xl text-[11px] font-bold"
            style={{ background: "#F7F4EE", color: "#A38E7A" }}
          >
            취소
          </button>
        </div>
        {error && (
          <p className="text-[10px] mt-2 font-bold" style={{ color: "#B84545" }}>
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
      className="mt-2 w-full px-3 py-2 rounded-xl flex items-center justify-center gap-1.5 active:scale-[0.98]"
      style={{
        background: "rgba(74,123,168,0.10)",
        border: "1px dashed rgba(74,123,168,0.35)",
        color: "#4A7BA8",
      }}
    >
      <Snowflake size={12} />
      <span className="text-[11px] font-extrabold">🧊 주 1회 쿠폰으로 오늘 건너뛰기</span>
    </button>
  );
}
