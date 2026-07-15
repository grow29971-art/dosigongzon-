"use client";

// 지도 진입 안내 모달 (2026-07-15)
// 처음 지도 열 때(또는 dismiss 전까지) 위치 보호 방식을 안내.
// localStorage로 영구 dismiss.

import { useEffect, useState } from "react";
import { X, ShieldCheck } from "lucide-react";


export default function MapIntroModal() {
  const [show, setShow] = useState(false);

  // 4일에 한 번만 노출 (매번 뜨는 피로 방지)
  useEffect(() => {
    const REMIND_MS = 4 * 24 * 60 * 60 * 1000;
    const tsKey = "dosigongzon_intro_map_ts";
    let due = true;
    try {
      const last = Number(localStorage.getItem(tsKey) || 0);
      due = Date.now() - last > REMIND_MS;
    } catch {
      due = true;
    }
    if (!due) return;
    const t = setTimeout(() => {
      setShow(true);
      try { localStorage.setItem(tsKey, String(Date.now())); } catch { /* ignore */ }
    }, 600);
    return () => clearTimeout(t);
  }, []);

  const close = () => setShow(false); // 닫아도 다음 방문 때 다시 노출

  // 닫힌 상태 → 좌하단 "?" 도움말 버튼 (언제든 다시 보기)
  if (!show) {
    return (
      <button
        onClick={() => setShow(true)}
        className="fixed z-40 w-8 h-8 rounded-full flex items-center justify-center text-[15px] font-extrabold active:scale-90 transition-transform"
        style={{
          left: 12,
          bottom: "calc(5.5rem + env(safe-area-inset-bottom))",
          background: "rgba(255,255,255,0.95)",
          color: "var(--color-text-light)",
          boxShadow: "0 3px 12px rgba(0,0,0,0.15)",
          border: "1px solid var(--color-divider)",
        }}
        aria-label="이용안내 다시 보기"
      >
        ?
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-5"
      style={{ background: "rgba(15,20,30,0.55)", backdropFilter: "blur(2px)" }}
      onClick={close}
    >
      <div
        className="relative w-full max-w-sm rounded-[26px] overflow-hidden"
        style={{ background: "#fff", boxShadow: "0 20px 50px rgba(0,0,0,0.3)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="px-6 pt-6 pb-4 text-center" style={{ background: "linear-gradient(160deg, #EEF5FF 0%, #E3EEFC 100%)" }}>
          <div className="w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-3" style={{ background: "rgba(49,130,246,0.15)" }}>
            <ShieldCheck size={28} style={{ color: "var(--color-primary-dark)" }} />
          </div>
          <p className="text-[10px] font-extrabold tracking-[0.15em] mb-1" style={{ color: "var(--color-primary-dark)" }}>
            안심하고 둘러보세요
          </p>
          <h2 className="text-[17px] font-extrabold text-text-main tracking-tight">
            아이들의 위치는 안전하게 지켜져요
          </h2>
        </div>

        {/* 본문 */}
        <div className="px-6 py-5">
          <div className="flex flex-col gap-3">
            <div className="flex gap-3">
              <span className="text-[18px] shrink-0">🐾</span>
              <p className="text-[12.5px] leading-[1.65] text-text-sub">
                지도 속 고양이는 <b className="text-text-main">실제 위치가 아니에요.</b> 자기 동네
                안을 불규칙하게 돌아다니며 계속 자리를 바꿔요.
              </p>
            </div>
            <div className="flex gap-3">
              <span className="text-[18px] shrink-0">🔒</span>
              <p className="text-[12.5px] leading-[1.65] text-text-sub">
                등록할 때부터 <b className="text-text-main">실제 좌표는 저장하지 않아요.</b> 그래서
                지도를 아무리 봐도 급식소나 아지트는 알 수 없어요.
              </p>
            </div>
            <div className="flex gap-3">
              <span className="text-[18px] shrink-0">💤</span>
              <p className="text-[12.5px] leading-[1.65] text-text-sub">
                쉬고(💤) · 산책하고(🐾) · 우다다(💨) 하는 모습을 구경하고, 탭해서
                쓰다듬어 주세요.
              </p>
            </div>
          </div>
        </div>

        {/* 버튼 */}
        <div className="px-6 pb-6">
          <button
            onClick={close}
            className="w-full py-3 rounded-2xl text-[14px] font-extrabold text-white active:scale-[0.98] transition-transform"
            style={{ background: "linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)" }}
          >
            둘러보기 시작 🐾
          </button>
        </div>

        <button
          onClick={close}
          className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center active:scale-90"
          style={{ background: "rgba(255,255,255,0.6)" }}
          aria-label="닫기"
        >
          <X size={16} className="text-text-sub" />
        </button>
      </div>
    </div>
  );
}
