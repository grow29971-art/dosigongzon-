// 작성자 이름 옆에 작은 타이틀 뱃지 표시.
// 2026-09-16 「익숙한 동네앱」 리디자인: 색 채움·이모지 없이 1px 헤어라인 + text-sub 글자로 name만.
// 타이틀별 색(CATEGORY_COLORS·admin.color)은 화면에 쓰지 않는다 — 배지가 본문보다 튀지 않게.

import { findTitleById, findAdminTitle } from "@/lib/titles";

interface Props {
  titleId: string | null | undefined;
  size?: "xs" | "sm";
}

export default function TitleBadge({ titleId, size = "xs" }: Props) {
  // 획득형 타이틀 → 없으면 관리자 부여 타이틀(운영 배지 'staff' 포함).
  // author_title 사칭은 DB 트리거(guard_*_snapshot)가 막는다.
  const earned = findTitleById(titleId);
  const admin = earned ? null : findAdminTitle(titleId);
  const title = earned ?? admin;
  if (!title || (admin && admin.hidden)) return null;

  const fontSize = size === "sm" ? 11 : 10;
  const padX = size === "sm" ? 6 : 5;
  const padY = size === "sm" ? 2 : 1.5;

  return (
    <span
      className="inline-flex items-center font-medium whitespace-nowrap"
      style={{
        fontSize,
        padding: `${padY}px ${padX}px`,
        borderRadius: "var(--radius-square)",
        background: "var(--color-surface)",
        color: "var(--color-text-sub)",
        border: "1px solid var(--color-border)",
        lineHeight: 1.1,
      }}
      title={title.description}
    >
      {title.name}
    </span>
  );
}
