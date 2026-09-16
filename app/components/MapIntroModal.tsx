"use client";

// 지도 진입 안내 모달 (2026-07-15)
// 처음 지도 열 때(또는 dismiss 전까지) 위치 보호 방식을 안내.
// localStorage로 영구 dismiss.
// 2026-09-16 「익숙한 동네앱」 리디자인: 틴트 헤더·아이콘 원·이모지 불릿 제거,
// 흰 면 + 헤어라인 구획, 모달 라운드 12px, CTA는 텍스트 버튼(PageIntroModal과 동일 문법).

import { useEffect, useState } from "react";
import { X, Check, CircleHelp } from "lucide-react";

const ITEMS = [
  <>
    지도 속 고양이는 <b className="text-text-main">실제 위치가 아니에요.</b> 자기 동네 안을
    불규칙하게 돌아다니며 계속 자리를 바꿔요.
  </>,
  <>
    등록할 때부터 <b className="text-text-main">실제 좌표는 저장하지 않아요.</b> 그래서 지도를
    아무리 봐도 급식소나 아지트는 알 수 없어요.
  </>,
  <>쉬고 · 산책하고 · 우다다 하는 모습을 구경하고, 탭해서 쓰다듬어 주세요.</>,
];

export default function MapIntroModal() {
  const [show, setShow] = useState(false);

  // 4일에 한 번만 노출 (계정별 독립 쿨다운)
  useEffect(() => {
    let cancelled = false;
    const REMIND_MS = 4 * 24 * 60 * 60 * 1000;
    (async () => {
      let uid = "anon";
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const { data } = await createClient().auth.getUser();
        if (data.user) uid = data.user.id;
      } catch { /* anon */ }
      if (cancelled) return;
      const tsKey = `dosigongzon_intro_map_${uid}_ts`;
      let due = true;
      try { due = Date.now() - Number(localStorage.getItem(tsKey) || 0) > REMIND_MS; } catch { due = true; }
      if (!due) return;
      setTimeout(() => {
        if (cancelled) return;
        setShow(true);
        try { localStorage.setItem(tsKey, String(Date.now())); } catch { /* ignore */ }
      }, 600);
    })();
    return () => { cancelled = true; };
  }, []);

  const close = () => setShow(false); // 닫아도 다음 방문 때 다시 노출

  // 닫힌 상태 → 좌하단 도움말 버튼 (언제든 다시 보기, 원형 아이콘 버튼 — full 허용)
  if (!show) {
    return (
      <button
        onClick={() => setShow(true)}
        className="fixed z-40 w-8 h-8 rounded-full flex items-center justify-center press-strong transition-transform"
        style={{
          left: 12,
          bottom: "calc(5.5rem + env(safe-area-inset-bottom))",
          background: "var(--color-surface)",
          color: "var(--color-text-light)",
          boxShadow: "var(--shadow-raised)",
          border: "1px solid var(--color-border)",
        }}
        aria-label="이용안내 다시 보기"
      >
        <CircleHelp size={18} />
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-5"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={close}
    >
      <div
        className="relative w-full max-w-sm overflow-hidden"
        style={{
          background: "var(--color-surface)",
          borderRadius: "var(--radius-modal)",
          boxShadow: "var(--shadow-modal)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="px-5 pt-5 pb-4 pr-12">
          <p className="text-[11px] font-medium text-text-light mb-1">안심하고 둘러보세요</p>
          <h2 className="text-[15px] font-semibold text-text-main leading-snug text-balance">
            아이들의 위치는 안전하게 지켜져요
          </h2>
        </div>

        {/* 본문 */}
        <div className="px-5 pb-5">
          <div className="flex flex-col gap-3">
            {ITEMS.map((text, i) => (
              <div key={i} className="flex gap-2.5">
                <Check size={16} className="shrink-0 mt-0.5" style={{ color: "var(--color-text-light)" }} />
                <p className="text-[13px] leading-[1.65] text-text-sub">{text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 버튼 */}
        <button
          onClick={close}
          className="w-full h-12 text-[15px] font-semibold press transition-transform"
          style={{
            background: "transparent",
            color: "var(--color-primary)",
            borderTop: "1px solid var(--color-border)",
          }}
        >
          둘러보기 시작
        </button>

        <button
          onClick={close}
          className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center press-strong"
          aria-label="닫기"
        >
          <X size={18} style={{ color: "var(--color-text-light)" }} />
        </button>
      </div>
    </div>
  );
}
