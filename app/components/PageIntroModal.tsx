"use client";

// 페이지 진입 안내 모달 (범용, 2026-07-15 → 2026-09-16 「익숙한 동네앱」 리디자인)
// 각 페이지 첫 방문 시 간략 설명 + 사용법. storageKey로 페이지별 1회 dismiss(쿨다운 로직 그대로).
// 흰 면 + 헤어라인 구획, 제목 15px 600, 본문 13px text-sub, CTA는 텍스트 버튼.
// headerEmoji·accent·accentDark·headerBg·items[].emoji는 호출처 호환을 위해 받되 표시하지 않는다.

import { useEffect, useState } from "react";
import { X, Check, CircleHelp } from "lucide-react";

export interface PageIntroItem {
  /** @deprecated 리디자인(2026-09-16)으로 이모지 표시 폐지 — 받되 무시한다 */
  emoji: string;
  text: React.ReactNode;
}

function PageIntroModalInner(props: {
  storageKey: string;
  badge: string;
  title: string;
  /** @deprecated 리디자인(2026-09-16)으로 표시 폐지 — 받되 무시한다 */
  headerEmoji: string;
  items: PageIntroItem[];
  buttonLabel?: string;
  /** @deprecated 리디자인(2026-09-16)으로 악센트 색 폐지 — 받되 무시한다 */
  accent?: string;
  /** @deprecated 리디자인(2026-09-16)으로 악센트 색 폐지 — 받되 무시한다 */
  accentDark?: string;
  /** @deprecated 리디자인(2026-09-16)으로 헤더 틴트 폐지 — 받되 무시한다 */
  headerBg?: string;
  /** 값이 바뀌면(도움말 버튼 클릭 등) 안내창을 강제로 다시 연다 */
  reopenSignal?: number;
}) {
  // headerEmoji·accent·accentDark·headerBg·items[].emoji는 의도적으로 읽지 않는다
  const { storageKey, badge, title, items, buttonLabel = "시작하기", reopenSignal = 0 } = props;
  const [show, setShow] = useState(false);

  // 계정당 1회만 노출. (2026-09-18 UX 감사: 4일 쿨다운은 주 1회 오는 유저에게 "매번 뜨는 안내"였다.)
  // 유저 id를 키에 넣어, 같은 브라우저라도 새 계정은 처음처럼 안내가 뜬다. 비로그인은 'anon'.
  // 다시 보고 싶으면 각 페이지의 "이용안내 다시 보기" 버튼.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let uid = "anon";
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const { data } = await createClient().auth.getUser();
        if (data.user) uid = data.user.id;
      } catch { /* 비로그인/오류 → anon */ }
      if (cancelled) return;
      const tsKey = `${storageKey}_${uid}_ts`;
      let due = true;
      try { due = !localStorage.getItem(tsKey); } catch { due = true; }
      if (!due) return;
      setTimeout(() => {
        if (cancelled) return;
        setShow(true);
        try { localStorage.setItem(tsKey, String(Date.now())); } catch { /* ignore */ }
      }, 400);
    })();
    return () => { cancelled = true; };
  }, [storageKey]);

  // 도움말 버튼 등으로 강제 재오픈
  useEffect(() => {
    if (reopenSignal > 0) setShow(true);
  }, [reopenSignal]);

  const close = () => setShow(false); // 닫아도 다음 방문 때 다시 노출

  // 닫힌 상태에선 좌하단에 작은 도움말 버튼 → 언제든 안내 다시 보기 (원형 아이콘 버튼 — full 허용)
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
        <div className="px-5 pt-5 pb-4 pr-12">
          <p className="text-[11px] font-medium text-text-light mb-1">{badge}</p>
          <h2 className="text-[15px] font-semibold text-text-main leading-snug text-balance">
            {title}
          </h2>
        </div>

        <div className="px-5 pb-5">
          <div className="flex flex-col gap-3">
            {items.map((it, i) => (
              <div key={i} className="flex gap-2.5">
                <Check size={16} className="shrink-0 mt-0.5" style={{ color: "var(--color-text-light)" }} />
                <p className="text-[13px] leading-[1.65] text-text-sub">{it.text}</p>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={close}
          className="w-full h-12 text-[15px] font-semibold press transition-transform"
          style={{
            background: "transparent",
            color: "var(--color-primary)",
            borderTop: "1px solid var(--color-border)",
          }}
        >
          {buttonLabel}
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

// 2026-09-22 디자인 감사: 페이지마다 뜨는 "이 화면은 이런 곳이에요" 모달·배너는 AI 생성 앱의 1순위 지문
// (첫 진입 오버레이 중첩·설명문 과다). 당근·토스는 화면이 스스로 설명한다. 되살리려면 이 플래그만 true.
const SHOW_PAGE_INTROS = false;
export default function PageIntroModal(props: Parameters<typeof PageIntroModalInner>[0]) {
  if (!SHOW_PAGE_INTROS) return null;
  return <PageIntroModalInner {...props} />;
}
