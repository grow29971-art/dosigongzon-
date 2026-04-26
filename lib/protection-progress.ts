// 보호지침 학습 진행 추적 — localStorage 기반.
// 가이드 페이지 진입 시 markRead 호출, /protection 메인이 진행률 표시.

const KEY = "dosi_protection_read_v1";

// 학습 진행률에 카운트되는 9개 내부 가이드 슬러그.
export const GUIDE_SLUGS = [
  "emergency-guide",
  "kitten-guide",
  "feeding-guide",
  "disease-guide",
  "shelter-guide",
  "trapping-guide",
  "pharmacy-guide",
  "legal",
  "district-contacts",
] as const;

export type GuideSlug = (typeof GUIDE_SLUGS)[number];

export function getReadSlugs(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

export function markRead(slug: GuideSlug): void {
  if (typeof window === "undefined") return;
  try {
    const set = getReadSlugs();
    if (set.has(slug)) return;
    set.add(slug);
    localStorage.setItem(KEY, JSON.stringify(Array.from(set)));
    // 다른 컴포넌트에 변경 알림
    window.dispatchEvent(new CustomEvent("protection-progress-changed"));
  } catch {}
}

export function getProgress(): { read: number; total: number; percent: number } {
  const set = getReadSlugs();
  const read = GUIDE_SLUGS.filter((s) => set.has(s)).length;
  const total = GUIDE_SLUGS.length;
  return { read, total, percent: Math.round((read / total) * 100) };
}
