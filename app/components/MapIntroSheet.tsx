"use client";

// 첫 방문 인트로 바텀시트 — "지도가 곧 온보딩" (2026-07-22 12에이전트 회의 B안).
// 구 /onboarding 인터스티셜 3장을 대체: 첫 방문자는 지도에 바로 떨어지고,
// 이 시트 1장이 3초 안에 앱의 정체(정의 한 줄 + 실데이터 카운트)를 밝힌다.
// 카피 원칙(한국심리 담당): 죄책감 프레임 금지, 앱이 뭘 하는지 명사로, 요구는 0.
// dosigongzon_onboarded 키를 그대로 사용 — iOS(ViewController 주입)·기존 유저 자동 스킵.

import { useEffect, useState } from "react";
import Link from "next/link";
import { MapPin, BookOpen, Siren } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { logFunnelEvent } from "@/lib/funnel-repo";

const ONBOARDED_KEY = "dosigongzon_onboarded";

export default function MapIntroSheet() {
  const [open, setOpen] = useState(false);
  const [catCount, setCatCount] = useState<number | null>(null);

  useEffect(() => {
    try {
      if (localStorage.getItem(ONBOARDED_KEY)) return;
    } catch {
      return; // 저장소 차단 — 매 방문 시트가 뜨는 것보다 안 뜨는 쪽을 택함
    }
    setOpen(true);
    // 새 온보딩의 intro 노출 계측 (기기당 1회)
    logFunnelEvent("onboarding_intro");
    // 실데이터 카운트 — 실패해도 시트는 카피만으로 동작
    const supabase = createClient();
    supabase
      .from("cats")
      .select("id", { count: "exact", head: true })
      .then(({ count }: { count: number | null }) => {
        if (typeof count === "number" && count > 0) setCatCount(count);
      });
  }, []);

  if (!open) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(ONBOARDED_KEY, "true");
    } catch { /* 무시 */ }
    setOpen(false);
  };

  return (
    <div
      className="fixed inset-0 z-[150] flex items-end"
      style={{ background: "rgba(30,22,16,0.4)" }}
      onClick={dismiss}
    >
      <div
        className="w-full bg-white px-6 pt-7"
        style={{
          borderRadius: "28px 28px 0 0",
          boxShadow: "0 -12px 40px rgba(0,0,0,0.18)",
          paddingBottom: "max(1.75rem, env(safe-area-inset-bottom))",
          animation: "introSheetUp 0.35s ease-out",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="w-10 h-1 rounded-full mx-auto mb-5"
          style={{ background: "rgba(0,0,0,0.12)" }}
        />

        <h2 className="text-[20px] font-extrabold text-text-main tracking-tight leading-snug">
          우리 동네 길고양이,
          <br />
          지도 한 장에 다 있어요
        </h2>
        <p className="text-[13.5px] text-text-sub leading-relaxed mt-2.5">
          {catCount !== null ? (
            <>
              지금 <b className="text-primary">{catCount.toLocaleString()}마리</b>가 이웃들의
              돌봄 기록으로 지켜지고 있어요.{" "}
            </>
          ) : null}
          누가 밥을 챙겼는지, 어디가 아픈지 — 지도에서 확인하고 함께 기록할 수 있어요.
        </p>

        <button
          type="button"
          onClick={dismiss}
          className="mt-6 w-full py-4 rounded-2xl text-white text-[15px] font-extrabold flex items-center justify-center gap-2 active:scale-[0.98]"
          style={{
            background: "linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)",
            boxShadow: "0 6px 18px rgba(173,94,59,0.3)",
          }}
        >
          <MapPin size={18} />
          지도 둘러보기
        </button>

        <div className="mt-2.5 flex gap-2">
          <Link
            href="/protection"
            onClick={dismiss}
            className="flex-1 py-3 rounded-2xl text-[13px] font-bold text-center flex items-center justify-center gap-1.5 active:scale-[0.98]"
            style={{ background: "#F1ECE4", color: "#6B5847" }}
          >
            <BookOpen size={14} />
            보호지침 보기
          </Link>
          <Link
            href="/protection/emergency-guide"
            onClick={dismiss}
            className="flex-1 py-3 rounded-2xl text-[13px] font-bold text-center flex items-center justify-center gap-1.5 active:scale-[0.98]"
            style={{ background: "#FBEAEA", color: "#B84545" }}
          >
            <Siren size={14} />
            응급상황이에요
          </Link>
        </div>

        <p className="text-center text-[11.5px] text-text-light mt-4">
          기록을 남기려면{" "}
          <Link href="/login" onClick={dismiss} className="font-bold underline underline-offset-2 text-text-sub">
            로그인
          </Link>
          이 필요해요 — 구경은 그냥 하셔도 돼요
        </p>
      </div>

      <style>{`
        @keyframes introSheetUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="introSheetUp"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
