// 한국어 조사 붙이기 — "오콩이을(를)" 같은 병기 표기를 없앤다 (2026-09-18 UX 감사 8번)
// 마지막 글자가 한글이면 받침 유무로 고르고, 아니면(영문·숫자·이모지) 병기 표기를 그대로 둔다.

const PAIRS = {
  "을/를": ["을", "를", "을(를)"],
  "이/가": ["이", "가", "이(가)"],
  "은/는": ["은", "는", "은(는)"],
  "과/와": ["과", "와", "과(와)"],
} as const;

export type JosaKind = keyof typeof PAIRS;

/** 받침 있으면 true, 없으면 false, 한글이 아니면 null */
export function hasBatchim(word: string): boolean | null {
  const ch = word.trim().slice(-1);
  const code = ch.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return null;
  return (code - 0xac00) % 28 !== 0;
}

/** josa("오콩이", "을/를") → "오콩이를", josa("대감", "을/를") → "대감을", josa("Tom", "을/를") → "Tom을(를)" */
export function josa(word: string, kind: JosaKind): string {
  const [withBatchim, withoutBatchim, both] = PAIRS[kind];
  const b = hasBatchim(word);
  return word + (b === null ? both : b ? withBatchim : withoutBatchim);
}
