"use client";

// 온보딩→홈 핸드오프 카드 (2026-07-18 전체회의 1순위)
// 온보딩 pick 단계에서 고른 아이(localStorage: dosigongzon_pending_care)를 가입 후
// 홈 최상단에서 이어받아 "방금 고른 ○○ 첫 밥 주기" 단일 CTA로 연결한다.
// 감정 커밋(고르기) 직후 24시간이 가장 비싼 순간 — 여기서 첫 행동을 완성시킨다.
// 밥 기록 성공 or 닫기 시 pending 키를 지워 카드는 다시 나타나지 않는다.

import { useEffect, useState } from "react";
import Link from "next/link";
import { X, ChevronRight, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createCareLog } from "@/lib/care-logs-repo";
import { thumbnailUrl } from "@/lib/cats-repo";
import { logFunnelEvent } from "@/lib/funnel-repo";

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
      if (!raw) return;
      pending = JSON.parse(raw) as PendingCare;
      if (!pending?.id || Date.now() - new Date(pending.at).getTime() > MAX_AGE_MS) {
        localStorage.removeItem(PENDING_KEY);
        return;
      }
    } catch {
      return;
    }

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
        // 퍼널 3단: 고른 아이를 들고 가입 후 홈에 도달
        logFunnelEvent("signup_home", (data as HandoffCat).id);
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
        background: "linear-gradient(135deg, #4A3527 0%, #7A5238 55%, #C47E5A 100%)",
        borderRadius: "var(--radius-card)",
        boxShadow: "0 10px 28px rgba(122,82,56,0.35)",
      }}
    >
      {phase !== "done" && (
        <button
          onClick={dismiss}
          className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center active:scale-90 transition-transform"
          style={{ background: "rgba(255,255,255,0.15)" }}
          aria-label="닫기"
        >
          <X size={14} color="rgba(255,255,255,0.8)" />
        </button>
      )}

      <div className="flex items-center gap-3.5">
        <Link href={`/cats/${cat.id}`} className="shrink-0 active:scale-95 transition-transform">
          <div
            className="w-16 h-16 rounded-2xl overflow-hidden"
            style={{ border: "2px solid rgba(255,255,255,0.35)", boxShadow: "0 4px 14px rgba(0,0,0,0.25)" }}
          >
            {thumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumb} alt={cat.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-2xl" style={{ background: "#F4E6CE" }}>
                🐱
              </div>
            )}
          </div>
        </Link>

        <div className="flex-1 min-w-0">
          {phase === "done" ? (
            <>
              <p className="text-[15px] font-extrabold text-white leading-snug">
                {cat.name}가 첫 밥을 받았어요! 🎉
              </p>
              <p className="text-[11.5px] mt-0.5" style={{ color: "rgba(255,255,255,0.75)" }}>
                내일 또 챙겨주면 진짜 돌봄이 시작돼요
              </p>
            </>
          ) : (
            <>
              <p className="text-[10px] font-extrabold tracking-[0.14em]" style={{ color: "rgba(255,235,210,0.9)" }}>
                방금 고른 아이
              </p>
              <p className="text-[15.5px] font-extrabold text-white leading-snug mt-0.5">
                {cat.name}
                {cat.region ? (
                  <span className="text-[11px] font-bold ml-1.5" style={{ color: "rgba(255,255,255,0.6)" }}>
                    {cat.region}
                  </span>
                ) : null}
              </p>
              <p className="text-[11.5px] mt-0.5 leading-snug" style={{ color: "rgba(255,255,255,0.8)" }}>
                기다리고 있었어요 — 첫 밥 한 끼 기록해줄까요?
              </p>
            </>
          )}
        </div>
      </div>

      {phase === "done" ? (
        <Link
          href={`/cats/${cat.id}`}
          className="mt-3.5 flex items-center justify-center gap-1.5 py-3 rounded-xl text-[13.5px] font-extrabold active:scale-[0.98] transition-transform"
          style={{ background: "rgba(255,255,255,0.95)", color: "#7A5238" }}
        >
          {cat.name} 보러 가기 <ChevronRight size={14} />
        </Link>
      ) : (
        <>
          <button
            onClick={feed}
            disabled={phase === "busy"}
            className="mt-3.5 w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[14px] font-extrabold active:scale-[0.98] transition-transform"
            style={{
              background: "linear-gradient(135deg, #FFF7C4 0%, #E8B040 100%)",
              color: "#4A3527",
              boxShadow: "0 6px 16px rgba(232,176,64,0.35)",
              opacity: phase === "busy" ? 0.7 : 1,
            }}
          >
            {phase === "busy" ? <Loader2 size={16} className="animate-spin" /> : "🍚"} {cat.name} 첫 밥 주기
          </button>
          {error && (
            <p className="mt-2 text-[11px] font-semibold text-center" style={{ color: "#FFD9D9" }}>
              {error}
            </p>
          )}
        </>
      )}
    </div>
  );
}
