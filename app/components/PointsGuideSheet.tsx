"use client";

// 포인트 안내 바텀시트 — 쇼핑몰 첫 진입 시 1회 자동, 이후 안내 띠 탭으로 재열람.
// 버는 법(돌봄+구매)·적립·사용을 한 화면에. 요율은 points-config에서 참조해 설정과 동기화.
// (2026-08-30 사장님 요청)

import { useEffect, useState } from "react";
import { X, PawPrint, ShoppingBag, Coins, Gift } from "lucide-react";
import {
  POINTS_MAX_USE_RATE,
  PURCHASE_REWARD_BASE_RATE,
  PURCHASE_REWARD_MAX_RATE,
} from "@/lib/points-config";

const SEEN_KEY = "dosigongzon_points_guide_seen_v1";

export default function PointsGuideSheet() {
  const [open, setOpen] = useState(false);

  // 첫 진입 1회 자동 표시
  useEffect(() => {
    try {
      if (!localStorage.getItem(SEEN_KEY)) setOpen(true);
    } catch { /* 저장소 차단 — 자동 표시 생략 */ }

    // 안내 띠 등에서 재열람 요청 (커스텀 이벤트)
    const reopen = () => setOpen(true);
    window.addEventListener("open-points-guide", reopen);
    return () => window.removeEventListener("open-points-guide", reopen);
  }, []);

  const dismiss = () => {
    try { localStorage.setItem(SEEN_KEY, "1"); } catch { /* 무시 */ }
    setOpen(false);
  };

  if (!open) return null;

  const basePct = Math.round(PURCHASE_REWARD_BASE_RATE * 100);
  const maxPct = Math.round(PURCHASE_REWARD_MAX_RATE * 100);
  const usePct = Math.round(POINTS_MAX_USE_RATE * 100);

  return (
    <div
      className="fixed inset-0 z-[150] flex items-end"
      style={{ background: "rgba(30,22,16,0.4)" }}
      onClick={dismiss}
    >
      <div
        className="w-full bg-white px-5 pt-6"
        style={{
          borderRadius: "var(--radius-sheet) var(--radius-sheet) 0 0",
          boxShadow: "var(--shadow-sheet)",
          paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))",
          animation: "pointsGuideUp 0.32s ease-out",
          maxHeight: "88vh",
          overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-[19px] font-bold text-text-main tracking-tight">포인트 안내</h2>
          <button
            type="button"
            onClick={dismiss}
            className="w-8 h-8 rounded-full flex items-center justify-center press-strong"
            style={{ background: "rgba(0,0,0,0.05)" }}
            aria-label="닫기"
          >
            <X size={16} className="text-text-sub" />
          </button>
        </div>
        <p className="text-[13px] text-text-sub leading-relaxed mb-4">
          포인트는 쇼핑몰에서 <b className="text-text-main">1P = 1원</b>처럼 쓰는 할인 적립금이에요.
          버는 방법은 두 가지예요.
        </p>

        {/* 1. 돌봄으로 벌기 */}
        <div className="rounded-2xl p-4 mb-2.5" style={{ background: "var(--color-primary-softer)", border: "1px solid rgba(176,92,54,0.18)" }}>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(176,92,54,0.15)" }}>
              <PawPrint size={15} style={{ color: "var(--color-primary)" }} />
            </span>
            <p className="text-[14px] font-bold text-text-main">① 돌봄 기록으로 벌기</p>
          </div>
          <p className="text-[12px] text-text-sub leading-relaxed">
            한 주(월~일)에 <b>돌봄 기록을 남긴 날</b>이 쌓이면 포인트를 드려요.
            <br />
            <b className="text-text-main">3일 50P · 5일 100P · 7일 150P</b>
            <br />
            <span className="text-text-light">홈의 &lsquo;이번 주 돌봄&rsquo; 보드에서 받기 버튼을 누르면 적립돼요.</span>
          </p>
        </div>

        {/* 2. 구매로 벌기 */}
        <div className="rounded-2xl p-4 mb-2.5" style={{ background: "var(--color-sage-soft)", border: "1px solid rgba(34,163,102,0.2)" }}>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(34,163,102,0.15)" }}>
              <Gift size={15} style={{ color: "#1E8E56" }} />
            </span>
            <p className="text-[14px] font-bold text-text-main">② 구매하면 적립</p>
          </div>
          <p className="text-[12px] text-text-sub leading-relaxed">
            상품을 사면 결제 금액의 <b className="text-text-main">{basePct}%</b>가 포인트로 돌아와요.
            <br />
            많이 구매한 단골일수록 적립률이 올라가요 — <b>기본 {basePct}% · 단골 {basePct + 1}% · VIP {maxPct}%</b>.
            <br />
            <span className="text-text-light">결제 완료 화면에서 바로 적립돼요.</span>
          </p>
        </div>

        {/* 3. 사용하기 */}
        <div className="rounded-2xl p-4 mb-4" style={{ background: "var(--color-surface-alt)", border: "1px solid var(--color-divider)" }}>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: "var(--color-gray-100)" }}>
              <Coins size={15} style={{ color: "var(--color-gray-600)" }} />
            </span>
            <p className="text-[14px] font-bold text-text-main">③ 사용하기</p>
          </div>
          <p className="text-[12px] text-text-sub leading-relaxed">
            결제할 때 <b className="text-text-main">1P = 1원</b>으로 할인에 써요.
            <br />
            한 주문에서 <b>주문 금액의 {usePct}%</b>까지 쓸 수 있어요(부담 없이 오래 모으라고 둔 상한).
            <br />
            <span className="text-text-light">주문을 취소하면 사용한 포인트는 자동으로 돌아와요.</span>
          </p>
        </div>

        <p className="text-[11px] text-text-light leading-relaxed mb-4 flex items-start gap-1.5">
          <ShoppingBag size={13} className="shrink-0 mt-0.5" />
          <span>포인트는 회원만 쌓고 쓸 수 있어요(비회원 주문은 적립·사용이 안 돼요). 현금 환급·양도는 안 돼요.</span>
        </p>

        <button
          type="button"
          onClick={dismiss}
          className="w-full py-3.5 rounded-2xl text-white text-[15px] font-bold press"
          style={{ background: "var(--color-primary)", boxShadow: "var(--shadow-primary)" }}
        >
          알겠어요
        </button>
      </div>

      <style>{`
        @keyframes pointsGuideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @media (prefers-reduced-motion: reduce) { [style*="pointsGuideUp"] { animation: none !important; } }
      `}</style>
    </div>
  );
}
