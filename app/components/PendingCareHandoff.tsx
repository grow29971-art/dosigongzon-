"use client";

// 온보딩→홈 핸드오프 카드 (2026-07-18 전체회의 1순위)
// 온보딩 pick 단계에서 고른 아이(localStorage: dosigongzon_pending_care)를 가입 후
// 홈 최상단에서 이어받아 "방금 고른 ○○ 첫 밥 주기" 단일 CTA로 연결한다.
// 감정 커밋(고르기) 직후 24시간이 가장 비싼 순간 — 여기서 첫 행동을 완성시킨다.
// 밥 기록 성공 or 닫기 시 pending 키를 지워 카드는 다시 나타나지 않는다.
// 2026-09-16 「익숙한 동네앱」 리디자인: 다크 브라운 카드 → 흰 면 + 헤어라인, 썸네일 원형(사진 없으면 마커 아트),
// 노랑 CTA → primary 버튼, 이모지·그림자 제거.

import { useEffect, useState } from "react";
import Link from "next/link";
import { X, ChevronRight, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createCareLog } from "@/lib/care-logs-repo";
import { thumbnailUrl } from "@/lib/cats-repo";
import { hasLoggedFunnelStep, logFunnelEvent } from "@/lib/funnel-repo";
import { catArtWalkSvg } from "@/lib/cat-art";
import FirstFeedPushPrompt from "@/app/components/FirstFeedPushPrompt";

const PENDING_KEY = "dosigongzon_pending_care";
// 고른 지 7일 지나면 맥락이 죽은 커밋 — 조용히 버린다
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

interface PendingCare {
  id: string;
  name: string;
  at: string;
}

interface HandoffCat {
  id: string;
  name: string;
  photo_url: string | null;
  region: string | null;
}

export default function PendingCareHandoff() {
  const [cat, setCat] = useState<HandoffCat | null>(null);
  const [phase, setPhase] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    let pending: PendingCare | null = null;
    try {
      const raw = localStorage.getItem(PENDING_KEY);
      if (raw) {
        pending = JSON.parse(raw) as PendingCare;
        if (!pending?.id || Date.now() - new Date(pending.at).getTime() > MAX_AGE_MS) {
          localStorage.removeItem(PENDING_KEY);
          pending = null;
        }
      }
    } catch {
      pending = null;
    }

    // 퍼널 3단: 이 기기에서 온보딩(intro)을 본 뒤 로그인 상태로 홈에 도달.
    // pending_care에 묶어두면 pick을 안 거친 가입이 전부 누락돼 스텝이 죽는다 (2026-07-24 분리)
    if (pending || hasLoggedFunnelStep("onboarding_intro")) {
      logFunnelEvent("signup_home", pending?.id ?? null);
    }

    if (!pending) return;

    let cancelled = false;
    (async () => {
      try {
        // 고른 아이가 여전히 존재·공개인지 확인 (anon 시절 고른 아이 — RLS가 public만 반환)
        const { data } = await createClient()
          .from("cats")
          .select("id, name, photo_url, region")
          .eq("id", pending!.id)
          .maybeSingle();
        if (cancelled) return;
        if (!data) {
          localStorage.removeItem(PENDING_KEY);
          return;
        }
        setCat(data as HandoffCat);
      } catch {
        /* 조회 실패 — 카드 미표시 (다음 방문에 재시도) */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!cat) return null;

  const clearPending = () => {
    try {
      localStorage.removeItem(PENDING_KEY);
    } catch {}
  };

  const dismiss = () => {
    clearPending();
    setCat(null);
  };

  const feed = async () => {
    if (phase !== "idle") return;
    setPhase("busy");
    setError("");
    try {
      await createCareLog({ cat_id: cat.id, care_type: "feed" });
      logFunnelEvent("first_feed", cat.id);
      clearPending();
      setPhase("done");
      try {
        navigator.vibrate?.(15);
      } catch {}
    } catch (e) {
      setPhase("idle");
      setError(e instanceof Error ? e.message : "기록에 실패했어요. 잠시 후 다시 시도해주세요.");
    }
  };

  const thumb = thumbnailUrl(cat.photo_url, 160);

  return (
    <div
      className="mb-4 p-4 relative overflow-hidden"
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-card)",
      }}
    >
      {phase !== "done" && (
        <button
          onClick={dismiss}
          className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center press-strong transition-transform"
          style={{ background: "var(--color-gray-100)" }}
          aria-label="닫기"
        >
          <X size={14} style={{ color: "var(--color-text-sub)" }} />
        </button>
      )}

      <div className="flex items-center gap-3.5">
        <Link href={`/cats/${cat.id}`} className="shrink-0 press-strong transition-transform">
          <div
            className="w-16 h-16 rounded-full overflow-hidden flex items-center justify-center"
            style={{ background: "var(--color-gray-100)", border: "1px solid var(--color-border)" }}
          >
            {thumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumb} alt={cat.name} className="w-full h-full object-cover" />
            ) : (
              // 사진 없는 아이는 지도 마커와 같은 걷는 고양이 아트 (id 해시 팔레트)
              <div
                aria-hidden
                className="flex items-center justify-center"
                dangerouslySetInnerHTML={{ __html: catArtWalkSvg(cat.id, 48) }}
              />
            )}
          </div>
        </Link>

        <div className="flex-1 min-w-0">
          {phase === "done" ? (
            <>
              <p className="text-[15px] font-semibold text-text-main leading-snug">
                {cat.name}가 첫 밥을 받았어요
              </p>
              <p className="text-[13px] mt-0.5 text-text-sub">
                오늘부터 {cat.name}의 집사예요 — 내일 또 챙겨주면 진짜 돌봄이 시작돼요
              </p>
            </>
          ) : (
            <>
              <p className="text-[11px] font-medium text-text-light">방금 고른 아이</p>
              <p className="text-[17px] font-bold text-text-main leading-snug mt-0.5">
                {cat.name}
                {cat.region ? (
                  <span className="text-[11px] font-medium ml-1.5 text-text-light">
                    {cat.region}
                  </span>
                ) : null}
              </p>
              <p className="text-[13px] mt-0.5 leading-snug text-text-sub">
                기다리고 있었어요 — 첫 밥 한 끼 기록해줄까요?
              </p>
            </>
          )}
        </div>
      </div>

      {phase === "done" ? (
        <>
          <FirstFeedPushPrompt catName={cat.name} />
          <Link
            href={`/cats/${cat.id}`}
            className="mt-3.5 h-12 flex items-center justify-center gap-1.5 text-[15px] font-semibold press transition-transform"
            style={{
              background: "var(--color-gray-100)",
              color: "var(--color-text-main)",
              borderRadius: "var(--radius-input)",
            }}
          >
            {cat.name} 보러 가기 <ChevronRight size={14} />
          </Link>
        </>
      ) : (
        <>
          <button
            onClick={feed}
            disabled={phase === "busy"}
            className="mt-3.5 w-full h-12 flex items-center justify-center gap-2 text-[15px] font-semibold text-white press transition-transform"
            style={{
              background: "var(--color-primary)",
              borderRadius: "var(--radius-input)",
              opacity: phase === "busy" ? 0.7 : 1,
            }}
          >
            {phase === "busy" && <Loader2 size={16} className="animate-spin" />}
            {cat.name} 첫 밥 주기
          </button>
          {error && (
            <p className="mt-2 text-[11px] font-medium text-center" style={{ color: "var(--color-error)" }}>
              {error}
            </p>
          )}
        </>
      )}
    </div>
  );
}
