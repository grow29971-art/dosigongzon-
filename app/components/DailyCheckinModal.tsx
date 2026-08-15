"use client";

// 일일 출석체크 — 물주기/밥주기/청소/건강체크. 전부 체크하고 제출하면:
//  - 코인 +25, 카드 경험치 +50(대표 카드 없으면 최근 카드), 계정 레벨 점수도
//    체크한 항목 수만큼 실제 돌봄일지(care_logs)로 기록돼 자연히 오름
// 2026-08-15 홈 다이어트 후속: 홈 진입 시 자동 팝업 → 인라인 카드(탭하면 모달)로 전환.
//   "첫 화면 프롬프트 1개" 원칙 — 개입형 모달을 유저가 여는 카드로 강등.
// box/supabase_daily_checkin_migration.sql 실행 전이면 API가 에러를 내는데,
// 그 경우 이 카드는 그냥 조용히 안 뜬다(홈 화면 다른 기능엔 영향 없음).

import { useEffect, useState } from "react";
import { CheckCircle2, Circle, X, Coins, Sparkles, ChevronRight } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { kstToday } from "@/lib/kst";

const TASKS = [
  { key: "water", label: "물 갈아주기", emoji: "💧" },
  { key: "feed", label: "밥 주기", emoji: "🍚" },
  { key: "clean", label: "화장실·집 청소", emoji: "🧹" },
  { key: "health", label: "건강 상태 확인", emoji: "🩺" },
];

export default function DailyCheckinModal() {
  const { user } = useAuth();
  const [eligible, setEligible] = useState(false); // 오늘 아직 출석 안 함 → 인라인 카드 노출
  const [open, setOpen] = useState(false); // 카드 탭 → 체크리스트 모달
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ coins: number; exp: number; leveledUp: boolean; newLevel: number | null } | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    createClient()
      .from("profiles").select("last_checkin_date").eq("id", user.id).maybeSingle()
      .then((res: { data: unknown }) => {
        if (cancelled) return;
        const row = res.data as { last_checkin_date?: string | null } | null;
        if (row && row.last_checkin_date !== kstToday()) setEligible(true);
      })
      .catch(() => { /* 마이그레이션 전이면 컬럼이 없어 에러 — 조용히 무시하고 안 띄움 */ });
    return () => { cancelled = true; };
  }, [user]);

  if (!eligible) return null;

  const toggle = (key: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const allChecked = checked.size === TASKS.length;

  const finish = () => {
    setOpen(false);
    if (result) setEligible(false); // 완료했으면 카드도 내림
  };

  const submit = async () => {
    if (!allChecked || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/checkin/complete", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ tasks: Array.from(checked) }),
      });
      const json = await res.json();
      if (res.ok) {
        setResult({ coins: json.coins_gained, exp: json.card_exp_gained, leveledUp: json.card_leveled_up, newLevel: json.card_new_level });
        navigator.vibrate?.([30, 40, 60]);
      } else {
        setOpen(false);
      }
    } catch {
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* 인라인 진입 카드 */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full card px-4 py-3.5 mb-5 flex items-center gap-3 press text-left"
      >
        <div
          className="w-9 h-9 flex items-center justify-center shrink-0"
          style={{ background: "var(--color-primary-soft)", borderRadius: "var(--radius-square-lg)" }}
        >
          <CheckCircle2 size={17} style={{ color: "var(--color-primary)" }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-text-main">오늘의 출석체크</p>
          <p className="text-[11px] text-text-light mt-0.5">아이들 챙기고 코인 받기 · {checked.size}/{TASKS.length}</p>
        </div>
        <ChevronRight size={15} className="shrink-0 text-text-muted" />
      </button>

      {/* 체크리스트 모달 — 카드 탭했을 때만 */}
      {open && (
        <div className="fixed inset-0 z-[190] flex items-center justify-center p-6" style={{ background: "rgba(20,30,50,0.6)" }}>
          <div className="w-full max-w-xs rounded-3xl overflow-hidden" style={{ background: "var(--color-surface)", boxShadow: "var(--shadow-modal)" }}>
            {result ? (
              <div className="p-6 text-center">
                <p style={{ fontSize: 44 }} className="mb-2">🎉</p>
                <p className="text-[17px] font-bold mb-1 text-text-main">오늘의 출석체크 완료!</p>
                <p className="text-[13px] mb-4 text-text-sub">오늘도 아이들을 챙겨주셔서 고마워요</p>
                <div className="flex justify-center gap-2 mb-5">
                  <span className="flex items-center gap-1 px-3 py-1.5 chip-square text-[13px] font-bold" style={{ background: "var(--color-warning-soft)", color: "var(--color-care)" }}>
                    <Coins size={13} /> +{result.coins}
                  </span>
                  {result.exp > 0 && (
                    <span className="flex items-center gap-1 px-3 py-1.5 chip-square text-[13px] font-bold" style={{ background: "var(--color-primary-soft)", color: "var(--color-primary-dark)" }}>
                      <Sparkles size={13} /> 카드 EXP +{result.exp}
                    </span>
                  )}
                </div>
                {result.leveledUp && (
                  <p className="text-[13px] font-bold mb-3" style={{ color: "var(--color-sage)" }}>대표 카드가 Lv.{result.newLevel}로 레벨업했어요!</p>
                )}
                <button onClick={finish} className="w-full py-3 rounded-2xl text-[13px] font-bold text-white"
                  style={{ background: "var(--color-primary)" }}>
                  확인
                </button>
              </div>
            ) : (
              <div className="p-6">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[17px] font-bold text-text-main">오늘의 출석체크</p>
                  <button onClick={() => setOpen(false)} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "var(--color-gray-100)" }}>
                    <X size={14} className="text-text-light" />
                  </button>
                </div>
                <p className="text-[13px] mb-4 text-text-sub">오늘 아이들을 챙겼다면 체크해주세요</p>
                <div className="flex flex-col gap-2 mb-5">
                  {TASKS.map((t) => {
                    const on = checked.has(t.key);
                    return (
                      <button key={t.key} onClick={() => toggle(t.key)}
                        className="flex items-center gap-2.5 rounded-2xl px-3 py-3 text-left"
                        style={{ background: on ? "var(--color-primary-soft)" : "var(--color-surface-alt)" }}>
                        {on ? <CheckCircle2 size={20} style={{ color: "var(--color-primary)" }} /> : <Circle size={20} style={{ color: "var(--color-gray-300)" }} />}
                        <span style={{ fontSize: 17 }}>{t.emoji}</span>
                        <span className="text-[13px] font-bold" style={{ color: on ? "var(--color-primary-dark)" : "var(--color-text-sub)" }}>{t.label}</span>
                      </button>
                    );
                  })}
                </div>
                <button onClick={submit} disabled={!allChecked || submitting}
                  className="w-full py-3 rounded-2xl text-[13px] font-bold"
                  style={{
                    background: allChecked ? "var(--color-primary)" : "var(--color-gray-200)",
                    color: allChecked ? "#fff" : "var(--color-text-muted)",
                    opacity: submitting ? 0.7 : 1,
                  }}>
                  {submitting ? "처리 중…" : allChecked ? "출석체크 완료하기" : `${checked.size}/${TASKS.length}개 체크했어요`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
