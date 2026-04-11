// 작성자 이름 옆에 작은 타이틀 뱃지 표시.
// 잠금 해제된 타이틀 id를 받아 이모지 + 이름을 보여줌.

import { findTitleById, CATEGORY_COLORS } from "@/lib/titles";

interface Props {
  titleId: string | null | undefined;
  size?: "xs" | "sm";
}

export default function TitleBadge({ titleId, size = "xs" }: Props) {
  const title = findTitleById(titleId);
  if (!title) return null;

  const color = CATEGORY_COLORS[title.category];
  const fontSize = size === "sm" ? 10 : 9;
  const padX = size === "sm" ? 6 : 5;
  const padY = size === "sm" ? 2 : 1.5;

  return (
    <span
      className="inline-flex items-center gap-0.5 rounded-full font-extrabold whitespace-nowrap"
      style={{
        fontSize,
        padding: `${padY}px ${padX}px`,
        background: `${color}18`,
        color,
        border: `1px solid ${color}55`,
        lineHeight: 1.1,
      }}
      title={title.description}
    >
      <span style={{ fontSize: fontSize + 1 }}>{title.emoji}</span>
      {title.name}
    </span>
  );
}
