"use client";

// 일일 출석체크 — 앱을 열면 홈 화면에 하루 한 번 뜨는 돌봄 체크리스트.
// 물주기/밥주기/청소/건강체크를 전부 체크하고 제출하면:
//  - 코인 +25, 카드 경험치 +50(대표 카드 없으면 최근 카드), 계정 레벨 점수도
//    체크한 항목 수만큼 실제 돌봄일지(care_logs)로 기록돼 자연히 오름
// box/supabase_daily_checkin_migration.sql 실행 전이면 API가 에러를 내는데,
// 그 경우 이 모달은 그냥 조용히 안 뜬다(홈 화면 다른 기능엔 영향 없음).

import { useEffect, useState } from "react";
import { CheckCircle2, Circle, X, Coins, Sparkles } from "lucide-react";
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
  const [show, setShow] = useState(false);
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
        if (row && row.last_checkin_date !== kstToday()) setShow(true);
      })
      .catch(() => { /* 마이그레이션 전이면 컬럼이 없어 에러 — 조용히 무시하고 안 띄움 */ });
    return () => { cancelled = true; };
  }, [user]);

  if (!show) return null;

  const toggle = (key: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const allChecked = checked.size === TASKS.length;

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
        setShow(false);
      }
    } catch {
      setShow(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[190] flex items-center justify-center p-6" style={{ background: "rgba(20,30,50,0.6)" }}>
      <div className="w-full max-w-xs rounded-3xl overflow-hidden" style={{ background: "#fff", boxShadow: "0 20px 50px rgba(0,0,0,0.3)" }}>
        {result ? (
          <div className="p-6 text-center">
            <p style={{ fontSize: 44 }} className="mb-2">🎉</p>
            <p className="text-[17px] font-extrabold mb-1" style={{ color: "#2B2B3D" }}>오늘의 출석체크 완료!</p>
            <p className="text-[12px] mb-4" style={{ color: "#8A8598" }}>오늘도 아이들을 챙겨주셔서 고마워요</p>
            <div className="flex justify-center gap-2 mb-5">
              <span className="flex items-center gap-1 px-3 py-1.5 rounded-full text-[12px] font-extrabold" style={{ background: "#FFF3D6", color: "#C98A1E" }}>
                <Coins size={13} /> +{result.coins}
              </span>
              {result.exp > 0 && (
                <span className="flex items-center gap-1 px-3 py-1.5 rounded-full text-[12px] font-extrabold" style={{ background: "#E3EEF9", color: "#2F5E93" }}>
                  <Sparkles size={13} /> 카드 EXP +{result.exp}
                </span>
              )}
            </div>
            {result.leveledUp && (
              <p className="text-[12px] font-extrabold mb-3" style={{ color: "#4FAF63" }}>🎊 대표 카드가 Lv.{result.newLevel}로 레벨업했어요!</p>
            )}
            <button onClick={() => setShow(false)} className="w-full py-3 rounded-2xl text-[13px] font-extrabold text-white"
              style={{ background: "linear-gradient(135deg,var(--color-primary),var(--color-primary-dark))" }}>
              확인
            </button>
          </div>
        ) : (
          <div className="p-6">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[17px] font-extrabold" style={{ color: "#2B2B3D" }}>🐾 오늘의 출석체크</p>
              <button onClick={() => setShow(false)} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "#F1F0F5" }}>
                <X size={14} style={{ color: "#8A8598" }} />
              </button>
            </div>
            <p className="text-[12px] mb-4" style={{ color: "#8A8598" }}>오늘 아이들을 챙겼다면 체크해주세요</p>
            <div className="flex flex-col gap-2 mb-5">
              {TASKS.map((t) => {
                const on = checked.has(t.key);
                return (
                  <button key={t.key} onClick={() => toggle(t.key)}
                    className="flex items-center gap-2.5 rounded-2xl px-3 py-3 text-left"
                    style={{ background: on ? "#E3EEF9" : "#F6F5FA" }}>
                    {on ? <CheckCircle2 size={20} style={{ color: "var(--color-primary)" }} /> : <Circle size={20} style={{ color: "#C4C0CE" }} />}
                    <span style={{ fontSize: 16 }}>{t.emoji}</span>
                    <span className="text-[13px] font-bold" style={{ color: on ? "#2F5E93" : "#6B6578" }}>{t.label}</span>
                  </button>
                );
              })}
            </div>
            <button onClick={submit} disabled={!allChecked || submitting}
              className="w-full py-3 rounded-2xl text-[13px] font-extrabold text-white"
              style={{
                background: allChecked ? "linear-gradient(135deg,var(--color-primary),var(--color-primary-dark))" : "#E3E1EC",
                color: allChecked ? "#fff" : "#B4AFC2",
                opacity: submitting ? 0.7 : 1,
              }}>
              {submitting ? "처리 중…" : allChecked ? "출석체크 완료하기" : `${checked.size}/${TASKS.length}개 체크했어요`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
