"use client";

// 고양이 등록 시작 전 노출되는 "공개 범위 3단계" 안내 시트.
// 매번 등록 시작할 때마다 노출 — 학대 우려 케어테이커 안전 선택 유도.

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { X, ArrowRight, ShieldCheck } from "lucide-react";
import { VISIBILITY_MAP, type CatVisibility } from "@/lib/cats-repo";

interface VisibilityIntroSheetProps {
  open: boolean;
  onClose: () => void;
  onPick: (visibility: CatVisibility) => void;
}

export default function VisibilityIntroSheet({ open, onClose, onPick }: VisibilityIntroSheetProps) {
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setPortalRoot(document.body);
  }, []);

  // 모달 열림 시 body scroll lock
  useEffect(() => {
    if (!open) return;
    const orig = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = orig;
    };
  }, [open]);

  if (!open || !portalRoot) return null;

  const overlay = (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-t-[28px] overflow-hidden animate-slide-up"
        style={{ maxHeight: "92dvh", boxShadow: "0 -4px 24px rgba(0,0,0,0.18)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div
          className="px-5 pt-5 pb-4"
          style={{ background: "linear-gradient(160deg, #FFF9F2 0%, #F7F4EE 100%)" }}
        >
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck size={18} style={{ color: "#4F6B53" }} />
              <span className="text-[11px] font-extrabold tracking-[0.16em]" style={{ color: "#4F6B53" }}>
                STEP 1 · 공개 범위 선택
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center active:scale-90"
              style={{ background: "rgba(0,0,0,0.05)" }}
              aria-label="닫기"
            >
              <X size={15} className="text-text-sub" />
            </button>
          </div>
          <h2 className="text-[19px] font-extrabold text-text-main leading-snug tracking-tight">
            어떻게 등록할까요?
          </h2>
          <p className="text-[12.5px] text-text-sub leading-relaxed mt-1.5">
            아이의 안전을 위해 공개 범위를 먼저 골라주세요.
            <br />등록 후에도 마이페이지에서 언제든지 바꿀 수 있어요.
          </p>
        </div>

        {/* 3 카드 */}
        <div className="px-5 py-4 space-y-2.5 overflow-y-auto" style={{ maxHeight: "calc(92dvh - 200px)" }}>
          {(Object.entries(VISIBILITY_MAP) as [CatVisibility, typeof VISIBILITY_MAP["public"]][]).map(
            ([key, info]) => (
              <button
                key={key}
                type="button"
                onClick={() => onPick(key)}
                className="w-full p-4 rounded-2xl text-left flex items-start gap-3 active:scale-[0.98] transition-transform"
                style={{
                  background: `${info.color}10`,
                  border: `1.5px solid ${info.color}55`,
                }}
              >
                <div
                  className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 text-[20px]"
                  style={{ background: `${info.color}25` }}
                >
                  {info.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <p className="text-[15px] font-extrabold tracking-tight" style={{ color: info.color }}>
                      {info.label}
                    </p>
                    {key === "circle" && (
                      <span
                        className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full"
                        style={{ background: info.color, color: "#fff" }}
                      >
                        NEW
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] text-text-sub leading-relaxed mb-1.5">{info.description}</p>
                  <p className="text-[11px] leading-relaxed" style={{ color: `${info.color}` }}>
                    {key === "public" && "이웃과 함께 돌보는 표준 옵션"}
                    {key === "circle" && "학대 우려가 큰 아이에게 추천"}
                    {key === "private" && "기록만 남기고 누구에게도 안 보임"}
                  </p>
                </div>
                <ArrowRight size={16} className="shrink-0 self-center" style={{ color: info.color, opacity: 0.6 }} />
              </button>
            ),
          )}
        </div>

        {/* 풋터 안내 */}
        <div
          className="px-5 py-3 border-t"
          style={{
            borderColor: "rgba(0,0,0,0.06)",
            background: "#FAFAF8",
            paddingBottom: "max(12px, env(safe-area-inset-bottom))",
          }}
        >
          <p className="text-[10.5px] text-text-light text-center leading-relaxed">
            ⓘ 어떤 옵션이든 사진 GPS는 자동 제거되고, 좌표는 ±444m 흐려서 저장돼요.
          </p>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, portalRoot);
}
