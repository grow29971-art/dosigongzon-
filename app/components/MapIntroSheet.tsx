"use client";

// 첫 방문 인트로 바텀시트 — "지도가 곧 온보딩" (2026-07-22 12에이전트 회의 B안).
// 구 /onboarding 인터스티셜 3장을 대체: 첫 방문자는 지도에 바로 떨어지고,
// 이 시트 1장이 3초 안에 앱의 정체(정의 한 줄 + 실데이터 카운트)를 밝힌다.
// 카피 원칙(한국심리 담당): 죄책감 프레임 금지, 앱이 뭘 하는지 명사로, 요구는 0.
// dosigongzon_onboarded 키를 그대로 사용 — iOS(ViewController 주입)·기존 유저 자동 스킵.
// 2026-09-16 「익숙한 동네앱」 리디자인: 세리프 제목 폐기(고딕 700), 그림자·틴트 버튼 제거,
// 시트 라운드 12px, 등장 애니메이션은 공용 animate-slide-up.

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
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={dismiss}
    >
      <div
        className="w-full px-6 pt-7 animate-slide-up"
        style={{
          background: "var(--color-surface)",
          borderRadius: "var(--radius-sheet) var(--radius-sheet) 0 0",
          boxShadow: "var(--shadow-sheet)",
          paddingBottom: "max(1.75rem, env(safe-area-inset-bottom))",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="w-10 h-1 rounded-full mx-auto mb-5"
          style={{ background: "var(--color-gray-300)" }}
        />

        {/* 2026-08-29 PMF 개편: "기록 앱" → "지켜주는 도구"로 가치 제안 재작성.
            죄책감 프레임 금지 원칙 유지 — 요구가 아니라 앱이 해주는 일을 말한다. */}
        <h2 className="text-[20px] font-bold text-text-main tracking-tight leading-snug">
          돌보는 사람을 지켜주는
          <br />
          길고양이 지도예요
        </h2>
        <p className="text-[15px] text-text-sub leading-relaxed mt-2.5">
          {catCount !== null ? (
            <>
              지금 <b className="text-primary">{catCount.toLocaleString()}마리</b>의 돌봄이
              기록되고 있어요.{" "}
            </>
          ) : null}
          여기 쌓인 밥·건강 기록은 민원·학대 신고 때 아이들과 나를 지키는 증빙이 돼요.
        </p>

        <button
          type="button"
          onClick={dismiss}
          className="mt-6 w-full h-12 text-white text-[15px] font-semibold flex items-center justify-center gap-2 press"
          style={{
            background: "var(--color-primary)",
            borderRadius: "var(--radius-input)",
          }}
        >
          <MapPin size={18} />
          지도 둘러보기
        </button>

        <div className="mt-2.5 flex gap-2">
          <Link
            href="/protection"
            onClick={dismiss}
            className="flex-1 h-10 text-[13px] font-semibold text-center flex items-center justify-center gap-1.5 press"
            style={{
              background: "var(--color-gray-100)",
              color: "var(--color-text-main)",
              borderRadius: "var(--radius-input)",
            }}
          >
            <BookOpen size={14} />
            보호지침 보기
          </Link>
          <Link
            href="/protection/emergency-guide"
            onClick={dismiss}
            className="flex-1 h-10 text-[13px] font-semibold text-center flex items-center justify-center gap-1.5 press"
            style={{
              background: "var(--color-error-soft)",
              color: "var(--color-error)",
              borderRadius: "var(--radius-input)",
            }}
          >
            <Siren size={14} />
            응급상황이에요
          </Link>
        </div>

        <p className="text-center text-[13px] text-text-light mt-4">
          기록을 남기려면{" "}
          <Link href="/login" onClick={dismiss} className="font-semibold underline underline-offset-2 text-text-sub">
            로그인
          </Link>
          이 필요해요 — 구경은 그냥 하셔도 돼요
        </p>
      </div>
    </div>
  );
}
