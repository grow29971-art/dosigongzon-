"use client";

// 공존 디자인 시스템 — 리스트 행 (2026-07-15)
// 토스식 리스트 문법: [아이콘] 제목/부제 ─── 우측값 >
// 시그니처: 아이콘 박스가 원형이 아닌 라운드 사각(radius-square-lg).

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

interface UIListRowProps {
  /** 좌측 아이콘 (이모지 문자열 또는 lucide 노드) */
  icon?: ReactNode;
  /** 아이콘 박스 배경 (기본: 서피스 그레이) */
  iconBg?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  /** 우측 값 텍스트 (금액·상태 등) */
  value?: ReactNode;
  /** 우측 커스텀 요소 (토글 등) — 지정 시 value/chevron 대신 렌더 */
  right?: ReactNode;
  href?: string;
  onClick?: () => void;
  /** 탭 가능 행의 우측 화살표 표시 (기본 true) */
  chevron?: boolean;
  className?: string;
  style?: CSSProperties;
}

export default function UIListRow({
  icon,
  iconBg = "var(--color-surface-alt)",
  title,
  subtitle,
  value,
  right,
  href,
  onClick,
  chevron = true,
  className = "",
  style,
}: UIListRowProps) {
  const interactive = href || onClick;

  const inner = (
    <>
      {icon !== undefined && (
        <div
          className="w-10 h-10 flex items-center justify-center shrink-0 text-[19px]"
          style={{ background: iconBg, borderRadius: "var(--radius-square-lg)" }}
        >
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-semibold text-text-main leading-snug truncate">{title}</p>
        {subtitle !== undefined && (
          <p className="text-[12.5px] text-text-light leading-snug mt-0.5 truncate">{subtitle}</p>
        )}
      </div>
      {right !== undefined ? (
        right
      ) : (
        <>
          {value !== undefined && (
            <span className="text-[14px] font-bold text-text-sub shrink-0">{value}</span>
          )}
          {interactive && chevron && (
            <ChevronRight size={16} className="shrink-0" style={{ color: "var(--color-text-muted)" }} />
          )}
        </>
      )}
    </>
  );

  const cls = `flex items-center gap-3 px-1 py-3 ${interactive ? "press" : ""} ${className}`;

  if (href) {
    return (
      <Link href={href} className={cls} style={style}>
        {inner}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${cls} w-full text-left`} style={style}>
        {inner}
      </button>
    );
  }
  return (
    <div className={cls} style={style}>
      {inner}
    </div>
  );
}
