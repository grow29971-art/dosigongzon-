"use client";

import type { LucideIcon } from "lucide-react";

// lucide 아이콘을 원형 배지 안에 넣는 래퍼.
// 2026-09-16 리디자인: 색 배지·남색 링·그림자(스티커 스타일) 폐지 —
// 연회색 원 + 회색 선 아이콘. color 프롭은 호출처 호환용으로 받되 무시한다.

interface Props {
  icon: LucideIcon;
  /** @deprecated 리디자인으로 틴트 배지 폐지 — 받되 무시한다 */
  color?: string;
  size?: number;  // 배지 지름
  iconSize?: number;
}

export default function StickerIcon({ icon: Icon, size = 34, iconSize }: Props) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-full shrink-0"
      style={{
        width: size, height: size,
        background: "var(--color-gray-100)",
        color: "var(--color-text-sub)",
      }}
    >
      <Icon size={iconSize ?? Math.round(size * 0.56)} strokeWidth={2} />
    </span>
  );
}
