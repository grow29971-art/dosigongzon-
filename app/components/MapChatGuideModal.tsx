"use client";

import { useEffect, useState } from "react";
import { X, MessageCircle, Globe } from "lucide-react";

const STORAGE_KEY = "dosigongzon_intro_map_chat_guide_v1";
const DISMISS_DAYS = 30;

/**
 * 지도 페이지 첫 진입 시 동네 채팅 / 전체 채팅 사용법 안내.
 * X로 닫으면 30일간 다시 안 뜸.
 * 2026-09-16 「익숙한 동네앱」 리디자인: 틴트 카드·색 아이콘 원 제거 → 구분선 리스트 행(회색 선 아이콘),
 * 모달 라운드 12px, 영문 대문자 라벨 제거.
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
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={dismiss}
      role="dialog"
      aria-modal="true"
      aria-label="지도 채팅 사용법 안내"
    >
      <div
        className="w-full max-w-md relative animate-rise overflow-hidden"
        style={{
          background: "var(--color-surface)",
          borderRadius: "var(--radius-modal)",
          boxShadow: "var(--shadow-modal)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={dismiss}
          className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center press-strong"
          aria-label="닫기"
        >
          <X size={18} style={{ color: "var(--color-text-light)" }} />
        </button>

        <div className="px-5 pt-5 pb-3 pr-12">
          <p className="text-[11px] font-medium text-text-light mb-1">지도 채팅</p>
          <h2 className="text-[17px] font-bold text-text-main tracking-tight leading-snug">
            지도에서 다른 사람들과 대화해보세요
          </h2>
          <p className="text-[13px] text-text-sub mt-1 leading-relaxed">
            지도 좌하단 채팅 버튼으로 다른 길집사들과 실시간으로 이야기할 수 있어요.
          </p>
        </div>

        {/* 전체 채팅 행 */}
        <div className="px-5">
          <div
            className="flex items-start gap-3 py-3"
            style={{ borderTop: "1px solid var(--color-divider)" }}
          >
            <Globe size={20} className="shrink-0 mt-0.5" style={{ color: "var(--color-text-sub)" }} />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-text-main">전체 채팅</p>
              <p className="text-[13px] text-text-sub mt-0.5 leading-relaxed">
                전국 모든 사용자가 함께 쓰는 방이에요. 길고양이 정보 공유, 응급 도움 요청, 소소한 일상까지.
              </p>
            </div>
          </div>

          {/* 동네 채팅 행 — 일시 숨김 (가입자 늘면 아래 false→true로 복원) */}
          {false && (
            <div
              className="flex items-start gap-3 py-3"
              style={{ borderTop: "1px solid var(--color-divider)" }}
            >
              <MessageCircle size={20} className="shrink-0 mt-0.5" style={{ color: "var(--color-text-sub)" }} />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold text-text-main">동네 채팅</p>
                <p className="text-[13px] text-text-sub mt-0.5 leading-relaxed">
                  현재 보고 있는 구 단위 채팅방이에요. 지도 위치를 옮기면 그 동네 채팅방으로 자동 연결돼요.
                </p>
              </div>
            </div>
          )}

          <p className="text-[11px] text-text-light pt-2 pb-4">
            매일 새벽 4시 자동 정리되어 새로 시작해요
          </p>
        </div>

        <button
          type="button"
          onClick={dismiss}
          className="w-full h-12 text-[15px] font-semibold press transition-transform"
          style={{
            background: "transparent",
            color: "var(--color-primary)",
            borderTop: "1px solid var(--color-border)",
          }}
        >
          알겠어요
        </button>
      </div>
    </div>
  );
}
