"use client";

import { useEffect, useState } from "react";
import { X, ArrowDownRight } from "lucide-react";

const KEY = "dosigongzon_map_coachmark_ts_v2";
const DISMISS_TTL_HOURS = 24;

interface Props {
  /** 유저가 이미 고양이를 등록한 적 있는지. true면 안 띄움 */
  hasMyCat: boolean;
  /** 유저 로그인 상태 */
  isLoggedIn: boolean;
}

export default function MapCoachmark({ hasMyCat, isLoggedIn }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isLoggedIn || hasMyCat) return;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const ts = parseInt(raw, 10);
        if (!isNaN(ts) && Date.now() - ts < DISMISS_TTL_HOURS * 60 * 60 * 1000) return;
      }
    } catch { /* no-op */ }

    // 지도 로딩 끝난 뒤 5초 후 노출
    const timer = setTimeout(() => setVisible(true), 5000);
    return () => clearTimeout(timer);
  }, [isLoggedIn, hasMyCat]);

  const dismiss = () => {
    setVisible(false);
    try { localStorage.setItem(KEY, String(Date.now())); } catch { /* no-op */ }
  };

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-50 pointer-events-none"
      role="dialog"
      aria-label="고양이 등록 안내"
    >
      {/* 반투명 배경 */}
      <div
        className="absolute inset-0 pointer-events-auto"
        onClick={dismiss}
        style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(2px)" }}
      />

      {/* 안내 말풍선 — FAB 위쪽에 */}
      <div
        className="absolute right-4 pointer-events-auto"
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0) + 162px)" }}
      >
        <div
          className="relative rounded-2xl px-4 py-3"
          style={{
            background: "linear-gradient(135deg, #FFFFFF 0%, #FFF9F0 100%)",
            boxShadow: "0 12px 28px rgba(0,0,0,0.25), 0 2px 6px rgba(196,126,90,0.2)",
            maxWidth: 240,
          }}
        >
          <button
            type="button"
            onClick={dismiss}
            className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center active:scale-90"
            style={{ background: "rgba(0,0,0,0.05)" }}
            aria-label="닫기"
          >
            <X size={11} className="text-text-sub" />
          </button>
          <div className="flex items-center gap-1.5 mb-1 pr-6">
            <span style={{ fontSize: 16 }}>🐾</span>
            <p className="text-[12px] font-extrabold" style={{ color: "#C47E5A" }}>
              첫 고양이 등록하기
            </p>
          </div>
          <p className="text-[12.5px] font-bold text-text-main leading-snug">
            여기 <span className="text-primary">+ 버튼</span>을 눌러서
            <br />우리 동네 아이를 등록해보세요
          </p>
          {/* 말풍선 꼬리 */}
          <div
            className="absolute -bottom-2 right-8 w-4 h-4 rotate-45"
            style={{
              background: "linear-gradient(135deg, #FFFFFF 0%, #FFF9F0 100%)",
              boxShadow: "2px 2px 4px rgba(0,0,0,0.08)",
            }}
          />
        </div>

        {/* 움직이는 화살표 + FAB 하이라이트 */}
        <div
          className="absolute flex items-center justify-center pointer-events-none"
          style={{
            bottom: -80,
            right: 2,
            width: 80,
            height: 80,
          }}
        >
          {/* 펄스 링 */}
          <div
            className="absolute inset-2 rounded-[22px] animate-ping"
            style={{ background: "rgba(196,126,90,0.35)" }}
          />
          <ArrowDownRight
            size={32}
            color="#fff"
            strokeWidth={3}
            className="absolute"
            style={{
              right: 58,
              bottom: 50,
              filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.4))",
            }}
          />
        </div>
      </div>
    </div>
  );
}
