// 공존 디자인 시스템 — 빈 상태 (2026-09-16 리디자인 접합부 중복 부품 승격)
// 회색 선 아이콘(호출부가 크기·굵기를 정해 넘긴다) + 15px 600 제목 + 13px text-sub 설명, 가운데 정렬.
// 바깥 여백·면은 className 으로(기본 py-16, 카드 안에 넣을 땐 "card p-6"). 순수 프리젠테이션 — "use client" 없음.

import type { ReactNode } from "react";

export default function EmptyState({
  icon,
  title,
  desc,
  className = "py-16",
}: {
  icon?: ReactNode;
  title: ReactNode;
  desc?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center text-center ${className}`}>
      {icon && <span className="flex text-text-light mb-3">{icon}</span>}
      <p className="text-[15px] font-semibold text-text-main">{title}</p>
      {desc && <p className="text-[13px] text-text-sub mt-1 leading-relaxed max-w-[280px]">{desc}</p>}
    </div>
  );
}
