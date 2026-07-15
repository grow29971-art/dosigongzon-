"use client";

// 공존 디자인 시스템 — 카드 (2026-07-15)
// 화이트 서피스 + 얕은 그림자 + radius-card. 탭 가능하면 press 피드백 자동.
// 기존 .card CSS 유틸의 컴포넌트 판 — 링크/버튼/정적 세 용법을 하나로.

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

interface UICardProps {
  children: ReactNode;
  /** 지정하면 <Link> 카드 */
  href?: string;
  /** 지정하면 <button> 카드 */
  onClick?: () => void;
  padding?: number | string;
  className?: string;
  style?: CSSProperties;
}

export default function UICard({
  children,
  href,
  onClick,
  padding = 20,
  className = "",
  style,
}: UICardProps) {
  const base: CSSProperties = {
    background: "var(--color-surface)",
    borderRadius: "var(--radius-card)",
    border: "1px solid var(--color-divider)",
    boxShadow: "var(--shadow-card-sm)",
    padding,
    ...style,
  };
  const interactive = href || onClick;
  const cls = `block ${interactive ? "press" : ""} ${className}`;

  if (href) {
    return (
      <Link href={href} className={cls} style={base}>
        {children}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${cls} w-full text-left`} style={base}>
        {children}
      </button>
    );
  }
  return (
    <div className={cls} style={base}>
      {children}
    </div>
  );
}
