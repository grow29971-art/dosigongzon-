// 오픈 전 찜(위시리스트) — localStorage 1단계 (2026-07-21 쇼핑 동선 회의 채택)
// 결제 하드락 기간에 유저가 완결할 수 있는 유일한 쇼핑 행동.
// ⚠ 회의 합의: 찜 수가 20 미만일 땐 입고/소싱 의사결정 근거로 쓰지 않는다 (통계적 무의미).
//    "찜 많은 순으로 들여온다" 같은 약속 카피도 금지 — MOQ 현실상 지킬 수 없는 약속.
// 2단계(DB 테이블 + RLS + 오픈 푸시 타겟팅)는 오픈 준비 시점에 마이그레이션으로 승격.

const KEY = "dosigongzon_shop_wishlist";

export function readWishlist(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function toggleWishlist(productId: string): string[] {
  const cur = readWishlist();
  const next = cur.includes(productId) ? cur.filter((id) => id !== productId) : [...cur, productId];
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch { /* 시크릿 모드 등 저장 불가 환경 — 세션 내 상태만 유지 */ }
  return next;
}
