"use client";

// 고양이 등록 시작 전 노출되는 "공개 범위 3단계" 안내 시트.
// 매번 등록 시작할 때마다 노출 — 학대 우려 길집사 안전 선택 유도.
// 2026-09-16 「익숙한 동네앱」 리디자인: 틴트 헤더·색 테두리 카드·이모지 원 → 흰 면 + 구분선 리스트 행
// (회색 선 아이콘, 선택은 chevron), 시트 라운드 12px. VISIBILITY_MAP의 color/emoji 필드는 참조하지 않는다.

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { X, ChevronRight, ShieldCheck, Globe, Users, Lock } from "lucide-react";
import { VISIBILITY_MAP, type CatVisibility } from "@/lib/cats-repo";

interface VisibilityIntroSheetProps {
  open: boolean;
  onClose: () => void;
  onPick: (visibility: CatVisibility) => void;
}

const VISIBILITY_ICON: Record<CatVisibility, typeof Globe> = {
  public: Globe,
  circle: Users,
  private: Lock,
};

const VISIBILITY_HINT: Record<CatVisibility, string> = {
  public: "이웃과 함께 돌보는 표준 옵션",
  circle: "학대 우려가 큰 아이에게 추천",
  private: "기록만 남기고 누구에게도 안 보임",
};

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
        className="w-full max-w-lg overflow-hidden animate-slide-up"
        style={{
          maxHeight: "92dvh",
          background: "var(--color-surface)",
          borderRadius: "var(--radius-sheet) var(--radius-sheet) 0 0",
          boxShadow: "var(--shadow-sheet)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="px-5 pt-5 pb-4" style={{ borderBottom: "1px solid var(--color-divider)" }}>
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} style={{ color: "var(--color-text-sub)" }} />
              <span className="text-[11px] font-medium text-text-light">
                STEP 1 · 공개 범위 선택
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center press-strong"
              style={{ background: "var(--color-gray-100)" }}
              aria-label="닫기"
            >
              <X size={15} className="text-text-sub" />
            </button>
          </div>
          <h2 className="text-[20px] font-bold text-text-main leading-snug tracking-tight">
            어떻게 등록할까요?
          </h2>
          <p className="text-[13px] text-text-sub leading-relaxed mt-1.5">
            아이의 안전을 위해 공개 범위를 먼저 골라주세요. 등록 후에도 마이페이지에서 바꿀 수 있어요.
          </p>
        </div>

        {/* 3 행 */}
        <div className="px-5 py-2 overflow-y-auto" style={{ maxHeight: "calc(92dvh - 200px)" }}>
          {/* 민감 케이스 → 서클 유도 넛지 (2026-08-29) */}
          <p className="text-[12px] leading-relaxed text-text-sub py-3" style={{ borderBottom: "1px solid var(--color-divider)" }}>
            <b className="text-text-main">개인 급식소·집 근처</b>이거나 <b className="text-text-main">학대·괴롭힘을 당한 적 있는 아이</b>라면{" "}
            <b className="text-text-main">내 서클</b>을 골라주세요. 믿을 수 있는 이웃에게만 보여요.
          </p>
          {(Object.entries(VISIBILITY_MAP) as [CatVisibility, typeof VISIBILITY_MAP["public"]][]).map(
            ([key, info], i, arr) => {
              const Icon = VISIBILITY_ICON[key];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onPick(key)}
                  className="w-full py-3.5 text-left flex items-start gap-3 press transition-transform"
                  style={{ borderBottom: i < arr.length - 1 ? "1px solid var(--color-divider)" : "none" }}
                >
                  <Icon size={20} className="shrink-0 mt-0.5" style={{ color: "var(--color-text-sub)" }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <p className="text-[15px] font-semibold text-text-main tracking-tight">
                        {info.label}
                      </p>
                      {key === "circle" && (
                        <span
                          className="text-[11px] font-medium px-1.5 py-0.5 chip-square text-text-sub"
                          style={{ border: "1px solid var(--color-border)" }}
                        >
                          NEW
                        </span>
                      )}
                    </div>
                    <p className="text-[13px] text-text-sub leading-relaxed">{info.description}</p>
                    <p className="text-[11px] text-text-light leading-relaxed mt-0.5">{VISIBILITY_HINT[key]}</p>
                  </div>
                  <ChevronRight size={18} className="shrink-0 self-center" style={{ color: "var(--color-text-muted)" }} />
                </button>
              );
            },
          )}
        </div>

        {/* 풋터 안내 */}
        <div
          className="px-5 py-3"
          style={{
            borderTop: "1px solid var(--color-divider)",
            background: "var(--color-surface)",
            paddingBottom: "max(12px, env(safe-area-inset-bottom))",
          }}
        >
          <p className="text-[11px] text-text-light text-center leading-relaxed">
            어떤 옵션이든 사진 GPS는 자동 제거되고, 좌표는 ±444m 흐려서 저장돼요.
          </p>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, portalRoot);
}
