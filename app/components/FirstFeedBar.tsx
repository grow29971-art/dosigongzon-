"use client";

// 가입 후 착지점(고양이 상세) 하단 고정 "첫 밥 주기" 바 (2026-07-24 회의 P0-1)
// 배경: pick CTA가 가입 후 next=/cats/{id}로 되돌리는데 상세에는 밥 버튼이 없어
// 감정 정점에서 읽기 전용 화면에 착지했다 — Day0 첫 행동의 최대 끊김 지점.
// pending_care(방금 고른 아이)가 이 고양이와 일치 + 로그인 상태일 때만 표시.
// 완주 동작은 홈 PendingCareHandoff와 동일(createCareLog + first_feed 계측 + 키 정리).

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createCareLog } from "@/lib/care-logs-repo";
import { logFunnelEvent } from "@/lib/funnel-repo";
import FirstFeedPushPrompt from "@/app/components/FirstFeedPushPrompt";

const PENDING_KEY = "dosigongzon_pending_care";
// PendingCareHandoff와 동일 기준 — 고른 지 7일 지나면 맥락이 죽은 커밋
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export default function FirstFeedBar({ catId, catName }: { catId: string; catName: string }) {
  const [show, setShow] = useState<false | "pending" | "fallback">(false);
  const [phase, setPhase] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    // pick 산출물(pending_care)이 이 고양이와 일치하는지 — 기존 노출 경로
    let pendingMatch = false;
    try {
      const raw = localStorage.getItem(PENDING_KEY);
      if (raw) {
        const pending = JSON.parse(raw) as { id?: string; at?: string };
        pendingMatch =
          pending?.id === catId &&
          !!pending.at &&
          Date.now() - new Date(pending.at).getTime() <= MAX_AGE_MS;
      }
    } catch {
      pendingMatch = false;
    }

    let cancelled = false;
    const supabase = createClient();
    supabase.auth
      .getUser()
      .then(async ({ data }: { data: { user: { id: string; created_at: string } | null } }) => {
        if (cancelled || !data.user) return;

        if (pendingMatch) {
          setShow("pending");
          // pick을 거쳐 가입한 사람은 홈이 아니라 이 상세로 착지하기 때문에
          // PendingCareHandoff가 뜨지 않고, 그래서 signup_home을 구조적으로
          // 한 번도 찍을 수 없었다(퍼널이 pick →(공백)→ first_feed로 끊김).
          // 여기 조건(pending_care 일치 + 로그인)이 signup_home의 정의 그 자체다.
          // logFunnelEvent에 스텝당 기기 1회 가드가 있어 중복 발화하지 않는다.
          logFunnelEvent("signup_home", catId);
          return;
        }

        // fallback (2026-08-20 원탁회의 P0): pick이 빈사 상태라 pending 경로의
        // 실노출이 사실상 0 — 첫밥 CTA가 구조적으로 봉인돼 있었다.
        // 가입 7일 이내 && 케어기록 0건인 유저에겐 어느 고양이 상세에서든 노출.
        // signup_home은 pending 경로의 정의이므로 여기서는 찍지 않는다(계측 오염 방지).
        const signupAgeMs = Date.now() - new Date(data.user.created_at).getTime();
        if (signupAgeMs > MAX_AGE_MS) return;
        const { count, error: countError } = await supabase
          .from("care_logs")
          .select("id", { count: "exact", head: true })
          .eq("author_id", data.user.id);
        if (cancelled || countError || (count ?? 0) > 0) return;
        setShow("fallback");
      });
    return () => {
      cancelled = true;
    };
  }, [catId]);

  if (!show) return null;

  const feed = async () => {
    if (phase !== "idle") return;
    setPhase("busy");
    setError("");
    try {
      await createCareLog({ cat_id: catId, care_type: "feed" });
      logFunnelEvent("first_feed", catId);
      try {
        localStorage.removeItem(PENDING_KEY);
      } catch {}
      setPhase("done");
      try {
        navigator.vibrate?.(15);
      } catch {}
    } catch (e) {
      setPhase("idle");
      setError(e instanceof Error ? e.message : "기록에 실패했어요. 잠시 후 다시 시도해주세요.");
    }
  };

  return (
    <div
      className="fixed left-0 right-0 z-40 px-4"
      style={{ bottom: "calc(72px + env(safe-area-inset-bottom))" }}
    >
      <div
        className="mx-auto max-w-lg p-3.5"
        style={{
          // 앱에서 그라디언트가 허용되는 유일한 히어로 CTA — 단, 색은 동결 토큰 계열만
          background: "var(--color-primary)",
          borderRadius: "var(--radius-card)",
          boxShadow: "var(--shadow-primary)",
        }}
      >
        {phase === "done" ? (
          <>
            <p className="text-[15px] font-bold text-white text-center leading-snug">
              {catName}가 첫 밥을 받았어요 🎉
              <span className="block text-[13px] font-medium mt-0.5" style={{ color: "rgba(255,255,255,0.8)" }}>
                오늘부터 {catName}의 집사예요 — 내일 또 챙겨주면 진짜 돌봄이 시작돼요
              </span>
            </p>
            <FirstFeedPushPrompt catName={catName} />
          </>
        ) : (
          <>
            <button
              onClick={feed}
              disabled={phase === "busy"}
              className="w-full flex items-center justify-center gap-2 py-3 text-[15px] font-bold press transition-transform"
              style={{
                background: "#FFFFFF",
                color: "var(--color-primary-dark)",
                borderRadius: "var(--radius-input)",
                opacity: phase === "busy" ? 0.7 : 1,
              }}
            >
              {phase === "busy" && <Loader2 size={16} className="animate-spin" />}
              {show === "pending" ? `방금 고른 ${catName}, 첫 밥 주기` : `${catName}에게 첫 밥 기록하기`}
            </button>
            {error && (
              <p className="mt-1.5 text-[11px] font-medium text-center" style={{ color: "#FFD9D9" }}>
                {error}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
