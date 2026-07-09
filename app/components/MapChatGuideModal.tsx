"use client";

import { useEffect, useState } from "react";
import { X, MessageCircle, Globe } from "lucide-react";

const STORAGE_KEY = "dosigongzon_intro_map_chat_guide_v1";
const DISMISS_DAYS = 30;

/**
 * 지도 페이지 첫 진입 시 동네 채팅 / 전체 채팅 사용법 안내.
 * X로 닫으면 30일간 다시 안 뜸.
 */
export default function MapChatGuideModal() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const ts = parseInt(raw, 10);
        const now = Date.now();
        if (!isNaN(ts) && ts > 0 && ts <= now && now - ts < DISMISS_DAYS * 24 * 60 * 60 * 1000) {
          return;
        }
      }
    } catch { /* ignore */ }
    // 페이지 로드 직후가 아니라 살짝 지연 — 지도 렌더 끝난 뒤 부드럽게 뜨도록
    const t = window.setTimeout(() => setVisible(true), 600);
    return () => window.clearTimeout(t);
  }, []);

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch { /* ignore */ }
  };

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-6 sm:pb-0"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
      onClick={dismiss}
      role="dialog"
      aria-modal="true"
      aria-label="지도 채팅 사용법 안내"
    >
      <div
        className="bg-white w-full max-w-md rounded-3xl p-5 relative animate-slide-up"
        style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={dismiss}
          className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center active:scale-90"
          style={{ background: "rgba(0,0,0,0.05)" }}
          aria-label="닫기"
        >
          <X size={14} className="text-text-sub" />
        </button>

        <div className="mb-4 pr-8">
          <p className="text-[10.5px] font-extrabold tracking-[0.12em] mb-1" style={{ color: "#4C82BC" }}>
            CHAT GUIDE
          </p>
          <h2 className="text-[18px] font-extrabold text-text-main tracking-tight leading-tight">
            지도에서 다른 사람들과 대화해보세요
          </h2>
          <p className="text-[12px] text-text-sub mt-1.5 leading-relaxed">
            지도 좌하단의 두 가지 채팅 버튼으로 다른 케어테이커들과 실시간 소통할 수 있어요.
          </p>
        </div>

        {/* 전체 채팅 카드 */}
        <div
          className="rounded-2xl p-3.5 mb-2.5 flex items-start gap-3"
          style={{
            background: "linear-gradient(135deg, rgba(72,165,158,0.08) 0%, rgba(72,165,158,0.04) 100%)",
            border: "1px solid rgba(72,165,158,0.18)",
          }}
        >
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(135deg, #48A59E 0%, #3D8B85 100%)" }}
          >
            <Globe size={18} color="#FFFFFF" strokeWidth={2.4} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-extrabold text-text-main">🌐 전체 채팅</p>
            <p className="text-[11.5px] text-text-sub mt-1 leading-relaxed">
              <span className="font-bold" style={{ color: "#48A59E" }}>전국 어디서든</span> 모든 사용자가 함께 대화하는 방. 길고양이 정보 공유, 응급 상황 도움 요청, 소소한 일상까지.
            </p>
          </div>
        </div>

        {/* 동네 채팅 카드 */}
        <div
          className="rounded-2xl p-3.5 mb-4 flex items-start gap-3"
          style={{
            background: "linear-gradient(135deg, rgba(76,130,188,0.08) 0%, rgba(76,130,188,0.04) 100%)",
            border: "1px solid rgba(76,130,188,0.18)",
          }}
        >
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(135deg, #4C82BC 0%, #3E6FA8 100%)" }}
          >
            <MessageCircle size={18} color="#FFFFFF" strokeWidth={2.4} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-extrabold text-text-main">💬 동네 채팅</p>
            <p className="text-[11.5px] text-text-sub mt-1 leading-relaxed">
              <span className="font-bold" style={{ color: "#3E6FA8" }}>현재 보고 있는 구</span> 단위 채팅방. 같은 동네 케어테이커끼리 실시간 정보 교환. 지도 위치를 옮기면 그 동네 채팅방으로 자동 연결.
            </p>
          </div>
        </div>

        <p className="text-[10.5px] text-text-light mb-3 px-1">
          💡 매일 새벽 4시 자동 정리되어 새로 시작해요
        </p>

        <button
          type="button"
          onClick={dismiss}
          className="w-full py-3 rounded-2xl text-white text-[13px] font-extrabold active:scale-[0.99] transition-transform"
          style={{ background: "linear-gradient(135deg, #4C82BC 0%, #3E6FA8 100%)" }}
        >
          알겠어요
        </button>
      </div>

      <style>{`
        @keyframes slide-up {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-slide-up { animation: slide-up 0.3s ease-out; }
      `}</style>
    </div>
  );
}
