"use client";

import Link from "next/link";
import { useMemo } from "react";
import { MapPin, PawPrint, Heart, Check, X, Sparkles } from "lucide-react";

interface OnboardingCardProps {
  hasActivityRegion: boolean;   // 활동 지역 설정 완료
  hasMyCat: boolean;            // 내가 등록한 고양이 있음
  hasCareLog: boolean;          // 돌봄 일지 작성 경험
  onDismiss?: () => void;       // "나중에" 버튼
}

interface Step {
  key: string;
  done: boolean;
  title: string;
  subtitle: string;
  href: string;
  Icon: typeof MapPin;
  color: string;
}

export default function OnboardingCard({
  hasActivityRegion,
  hasMyCat,
  hasCareLog,
  onDismiss,
}: OnboardingCardProps) {
  const steps: Step[] = useMemo(() => [
    {
      key: "region",
      done: hasActivityRegion,
      title: "내 활동 지역 설정",
      subtitle: "우리 동네를 먼저 정해주세요",
      href: "/mypage/activity-regions",
      Icon: MapPin,
      color: "#C47E5A",
    },
    {
      key: "cat",
      done: hasMyCat,
      title: "첫 고양이 등록",
      subtitle: "지도에서 + 버튼으로 아이를 등록해요",
      href: "/map",
      Icon: PawPrint,
      color: "#E88D5A",
    },
    {
      key: "care",
      done: hasCareLog,
      title: "첫 돌봄 기록",
      subtitle: "밥·물·건강 체크 한 번만 남겨봐요",
      href: "/map",
      Icon: Heart,
      color: "#E86B8C",
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
      className="mb-4 p-5"
      style={{
        background: "linear-gradient(135deg, #FFF9F0 0%, #FFF2DF 100%)",
        borderRadius: 22,
        border: "1px solid rgba(196,126,90,0.2)",
        boxShadow: "0 6px 20px rgba(196,126,90,0.12)",
      }}
    >
      {/* 헤더 */}
      <div className="flex items-start gap-3 mb-4">
        <div
          className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
          style={{
            background: "linear-gradient(135deg, #C47E5A 0%, #A8684A 100%)",
            boxShadow: "0 4px 12px rgba(196,126,90,0.35)",
          }}
        >
          <Sparkles size={19} color="#fff" strokeWidth={2.3} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-extrabold tracking-[0.12em]" style={{ color: "#C47E5A" }}>
            WELCOME
          </p>
          <p className="text-[15px] font-extrabold text-text-main tracking-tight leading-tight mt-0.5">
            시작 가이드 <span style={{ color: "#C47E5A" }}>{doneCount}/{total}</span>
          </p>
          <p className="text-[11.5px] text-text-sub mt-1 leading-snug">
            3단계만 거치면 바로 돌봄 시작!
          </p>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="w-7 h-7 rounded-full flex items-center justify-center active:scale-90 shrink-0"
            style={{ background: "rgba(0,0,0,0.05)" }}
            aria-label="나중에"
          >
            <X size={13} className="text-text-sub" />
          </button>
        )}
      </div>

      {/* 진행률 바 */}
      <div
        className="w-full h-1.5 rounded-full overflow-hidden mb-4"
        style={{ background: "rgba(196,126,90,0.15)" }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${progress}%`,
            background: "linear-gradient(90deg, #C47E5A 0%, #E88D5A 100%)",
          }}
        />
      </div>

      {/* 스텝 목록 */}
      <div className="space-y-2">
        {steps.map((s, idx) => {
          const isNext = idx === nextIdx;
          return (
            <Link
              key={s.key}
              href={s.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl active:scale-[0.99] transition-transform"
              style={{
                background: s.done
                  ? "rgba(107,142,111,0.1)"
                  : isNext
                    ? "#FFFFFF"
                    : "rgba(255,255,255,0.6)",
                border: s.done
                  ? "1px solid rgba(107,142,111,0.2)"
                  : isNext
                    ? `1px solid ${s.color}40`
                    : "1px solid rgba(0,0,0,0.04)",
                boxShadow: isNext ? `0 3px 10px ${s.color}20` : "none",
              }}
            >
              {/* 체크 / 번호 */}
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                style={{
                  background: s.done
                    ? "#6B8E6F"
                    : isNext
                      ? s.color
                      : "rgba(0,0,0,0.08)",
                  color: "#fff",
                }}
              >
                {s.done ? (
                  <Check size={13} strokeWidth={3} />
                ) : (
                  <span className="text-[11px] font-extrabold">{idx + 1}</span>
                )}
              </div>

              {/* 본문 */}
              <div className="flex-1 min-w-0">
                <p
                  className="text-[13px] font-extrabold tracking-tight"
                  style={{
                    color: s.done ? "#3F5B42" : "#2A2A28",
                    textDecoration: s.done ? "line-through" : "none",
                    opacity: s.done ? 0.7 : 1,
                  }}
                >
                  {s.title}
                </p>
                {!s.done && (
                  <p className="text-[10.5px] text-text-sub mt-0.5 truncate">
                    {s.subtitle}
                  </p>
                )}
              </div>

              {/* 아이콘 */}
              {!s.done && (
                <s.Icon
                  size={16}
                  style={{ color: s.color, opacity: isNext ? 1 : 0.5 }}
                  strokeWidth={2.2}
                />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
