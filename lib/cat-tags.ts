// 고양이 태그 프리셋 + 토글 규칙 (2026-09-18 UX 감사 6번)
// 배경: "TNR 완료"와 "TNR 필요", "성묘"와 "어린 고양이"가 한 아이에 동시에 붙어 상세가 모순돼 보였다.
// 등록(AddCatModal)·수정(지도 시트) 두 곳이 같은 토글을 쓰도록 여기로 모은다.

export const CAT_TAG_PRESETS = [
  "TNR 완료",
  "TNR 필요",
  "이어팁",
  "사람 친화",
  "겁 많음",
  "성묘",
  "어린 고양이",
  "새끼 동반",
  "야행성",
  "온순",
  "예민",
  "식탐 많음",
] as const;

/** 서로 배타적인 태그 묶음 — 하나를 켜면 같은 묶음의 나머지는 꺼진다 */
const EXCLUSIVE_GROUPS: readonly (readonly string[])[] = [
  ["TNR 완료", "TNR 필요"],
  ["성묘", "어린 고양이"],
];

export function toggleCatTag(prev: readonly string[], tag: string): string[] {
  if (prev.includes(tag)) return prev.filter((t) => t !== tag);
  const rivals = EXCLUSIVE_GROUPS.find((g) => g.includes(tag))?.filter((t) => t !== tag) ?? [];
  return [...prev.filter((t) => !rivals.includes(t)), tag];
}
