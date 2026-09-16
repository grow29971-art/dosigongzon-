"use client";

// 공존 디자인 시스템 — 리스트 행 (2026-07-15 → 2026-09-16 「익숙한 동네앱」 리디자인)
// 당근·토스 리스트 문법: [썸네일/아이콘] 제목(15px 600) / 부제(13px text-sub) ─── 우측 메타 >
// 행 높이 56~72px, 행 사이 헤어라인(divider). 아이콘은 틴트 박스 없이 회색 선 아이콘 그대로.
// 썸네일(이미지)을 넘기면 8px 둥근 사각으로 잘린다.

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

interface UIListRowProps {
  /** 좌측 아이콘(lucide 노드) 또는 썸네일 */
  icon?: ReactNode;
  /** @deprecated 리디자인(2026-09-16)으로 틴트 박스 폐지 — 받되 무시한다(호출처 호환) */
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
  /** 행 사이 헤어라인 (기본 true, 마지막 행은 자동 생략) */
  divider?: boolean;
  className?: string;
  style?: CSSProperties;
}

export default function UIListRow(props: UIListRowProps) {
  const {
    icon,
    title,
    subtitle,
    value,
    right,
    href,
    onClick,
    chevron = true,
    divider = true,
    className = "",
    style,
  } = props; // iconBg는 의도적으로 읽지 않는다(틴트 박스 폐지)
  const interactive = href || onClick;

  const inner = (
    <>
      {icon !== undefined && (
        <div
          className="w-10 h-10 flex items-center justify-center shrink-0 overflow-hidden text-text-sub"
          style={{ borderRadius: "var(--radius-card-sm)" }}
        >
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-semibold text-text-main leading-snug truncate">{title}</p>
        {subtitle !== undefined && (
          <p className="text-[13px] text-text-sub leading-snug mt-0.5 truncate">{subtitle}</p>
        )}
      </div>
      {right !== undefined ? (
        right
      ) : (
        <>
          {value !== undefined && (
            <span className="text-[14px] font-medium text-text-sub shrink-0">{value}</span>
          )}
          {interactive && chevron && (
            <ChevronRight size={18} className="shrink-0" style={{ color: "var(--color-text-muted)" }} />
          )}
        </>
      )}
    </>
  );

  const dividerCls = divider ? "border-b border-divider last:border-b-0" : "";
  const cls = `flex items-center gap-3 px-1 py-3 ${dividerCls} ${interactive ? "press" : ""} ${className}`;
  const rowStyle: CSSProperties = { minHeight: 56, ...style };

  if (href) {
    return (
      <Link href={href} className={cls} style={rowStyle}>
        {inner}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${cls} w-full text-left`} style={rowStyle}>
        {inner}
      </button>
    );
  }
  return (
    <div className={cls} style={rowStyle}>
      {inner}
    </div>
  );
}
