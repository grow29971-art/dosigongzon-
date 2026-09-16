"use client";

// 시작 가이드 카드 (첫 등록 전 신규 유저). 2026-09-16 「익숙한 동네앱」 리디자인:
// 채움 아이콘·스텝 카드 그림자 폐기 → 흰 면 + 헤어라인, 스텝은 구분선 리스트.

import Link from "next/link";
import { useMemo } from "react";
import { MapPin, PawPrint, Heart, Check, X, ChevronRight } from "lucide-react";

interface OnboardingCardProps {
  hasActivityRegion: boolean;   // 활동 지역 설정 완료
  hasMyCat: boolean;            // 내가 등록한 고양이 있음
  hasCareLog: boolean;          // 돌봄 일지 작성 경험
  hasCircleMember?: boolean;    // 내 서클에 1명 이상 멤버 (선택)
  onDismiss?: () => void;       // "나중에" 버튼
}

interface Step {
  key: string;
  done: boolean;
  title: string;
  subtitle: string;
  href: string;
  Icon: typeof MapPin;
}

export default function OnboardingCard({
  hasActivityRegion,
  hasMyCat,
  hasCareLog,
  onDismiss,
}: OnboardingCardProps) {
  // 순서가 곧 유도 흐름 — 등록은 지역설정 없이도 가능하므로 '첫 고양이 등록'을 1순위로.
  // 지역설정은 관문이 아니라 '동네 소식을 받는' 선택 단계로 마지막에 둔다(가입→등록 이탈 완화).
  // "가입 완료"를 0번 완료 스텝으로 부여 — endowed progress(이미 진행됐다는 프레이밍이
  // 완주율을 올린다, Nunes & Drèze 2006). 실제로 완료한 일에만 크레딧.
  const steps: Step[] = useMemo(() => [
    {
      key: "signup",
      done: true,
      title: "가입 완료",
      subtitle: "",
      href: "/mypage",
      Icon: Check,
    },
    {
      key: "cat",
      done: hasMyCat,
      title: "첫 고양이 등록",
      subtitle: "지도에서 + 버튼으로 아이를 등록해요",
      href: "/map?add=1",
      Icon: PawPrint,
    },
    {
      key: "care",
      done: hasCareLog,
      title: "첫 돌봄 기록",
      subtitle: "밥·물·건강 체크 한 번만 남겨봐요",
      href: "/map",
      Icon: Heart,
    },
    {
      key: "region",
      done: hasActivityRegion,
      title: "내 동네 소식 받기",
      subtitle: "동네를 정하면 근처 소식·이웃이 보여요 (선택)",
      href: "/mypage/activity-regions",
      Icon: MapPin,
    },
  ], [hasActivityRegion, hasMyCat, hasCareLog]);

  const doneCount = steps.filter((s) => s.done).length;
  const total = steps.length;
  const allDone = doneCount === total;
  const progress = Math.round((doneCount / total) * 100);

  // 전부 완료했으면 렌더 안 함
  if (allDone) return null;

  // 다음에 해야 할 스텝 (완료 안 된 첫 번째)
  const nextIdx = steps.findIndex((s) => !s.done);

  return (
    <div
      className="mb-4 p-4"
      style={{
        background: "var(--color-surface)",
        borderRadius: "var(--radius-card)",
        border: "1px solid var(--color-border)",
      }}
    >
      {/* 헤더 */}
      <div className="flex items-start gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-semibold text-text-main leading-snug">
            시작 가이드 <span className="text-text-light tabular-nums">{doneCount}/{total}</span>
          </p>
          <p className="text-[13px] text-text-sub mt-0.5 leading-snug">
            지도에서 아이 한 마리만 등록하면 시작돼요
          </p>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="w-8 h-8 -mt-1 -mr-1 flex items-center justify-center press-strong shrink-0"
            aria-label="나중에"
          >
            <X size={16} style={{ color: "var(--color-text-light)" }} />
          </button>
        )}
      </div>

      {/* 진행률 바 — 단색 primary */}
      <div className="progress-bar mb-2">
        <div style={{ width: `${progress}%`, background: "var(--color-primary)" }} />
      </div>

      {/* 스텝 목록 — 구분선 리스트 */}
      <div>
        {steps.map((s, idx) => {
          const isNext = idx === nextIdx;
          return (
            <Link
              key={s.key}
              href={s.href}
              className="flex items-center gap-3 py-3 press transition-transform"
              style={{ borderTop: idx > 0 ? "1px solid var(--color-divider)" : "none", minHeight: 56 }}
            >
              {/* 체크 / 번호 */}
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[13px] font-semibold"
                style={{
                  background: s.done
                    ? "var(--color-primary)"
                    : "var(--color-surface)",
                  color: s.done ? "var(--color-surface)" : isNext ? "var(--color-primary)" : "var(--color-text-light)",
                  border: s.done
                    ? "1px solid var(--color-primary)"
                    : `1px solid ${isNext ? "var(--color-primary)" : "var(--color-border)"}`,
                }}
              >
                {s.done ? <Check size={13} strokeWidth={3} /> : idx + 1}
              </div>

              {/* 본문 */}
              <div className="flex-1 min-w-0">
                <p
                  className="text-[15px] font-semibold leading-snug"
                  style={{
                    color: s.done ? "var(--color-text-light)" : "var(--color-text-main)",
                    textDecoration: s.done ? "line-through" : "none",
                  }}
                >
                  {s.title}
                </p>
                {!s.done && s.subtitle && (
                  <p className="text-[13px] text-text-sub mt-0.5 truncate">
                    {s.subtitle}
                  </p>
                )}
              </div>

              {!s.done && (
                <ChevronRight size={18} className="shrink-0" style={{ color: isNext ? "var(--color-text-sub)" : "var(--color-text-muted)" }} />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
