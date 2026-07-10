"use client";

import type { LucideIcon } from "lucide-react";

// 하단 네비(nav-icons.tsx) 스티커 스타일을 일반 lucide 아이콘에도 씌우는 래퍼.
// 색이 있는 원형 배지 + 굵은 남색 테두리로 "스티커" 느낌을 냄.
// 페이지마다 제각각인 커스텀 SVG를 전부 새로 그리는 대신, 기존 lucide 아이콘을
// 그대로 두고 배지만 씌워서 톤을 맞추는 가벼운 방식.

const STROKE = "#1B3A5C";

interface Props {
  icon: LucideIcon;
  color?: string; // 배지 배경색
  size?: number;  // 배지 지름
  iconSize?: number;
}

export default function StickerIcon({ icon: Icon, color = "#3182F6", size = 34, iconSize }: Props) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-full shrink-0"
      style={{
        width: size, height: size,
        background: color,
        boxShadow: `0 0 0 2px #fff, 0 0 0 3.5px ${STROKE}, 0 2px 5px rgba(20,40,70,0.25)`,
      }}
    >
      <Icon size={iconSize ?? Math.round(size * 0.56)} color="#fff" strokeWidth={2.4} />
    </span>
  );
}
