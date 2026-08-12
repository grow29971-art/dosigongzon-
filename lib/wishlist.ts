// 오픈 전 찜(위시리스트) — localStorage 1단계 (2026-07-21 쇼핑 동선 회의 채택)
// 결제 하드락 기간에 유저가 완결할 수 있는 유일한 쇼핑 행동.
// ⚠ 회의 합의: 찜 수가 20 미만일 땐 입고/소싱 의사결정 근거로 쓰지 않는다 (통계적 무의미).
//    "찜 많은 순으로 들여온다" 같은 약속 카피도 금지 — MOQ 현실상 지킬 수 없는 약속.
// 2026-08-12 서버 계측 추가(화이트리스트 ①, 해제조건=통판신고서 제출 확인 — 8/12 제출됨):
//    UI 상태는 여전히 localStorage가 진실이고, 토글마다 add/remove 이벤트만 서버로 보낸다
//    (/api/shop/wishlist → shop_wishlist_events). 결제 오픈 게이트(유니크 15명·찜 40개) 측정용.

import { getAnonId, getSource } from "@/lib/funnel-repo";
import { createClient } from "@/lib/supabase/client";

const KEY = "dosigongzon_shop_wishlist";

// 계측 실패는 절대 UX로 새어나가면 안 된다 — 완전 fire-and-forget (퍼널과 동일 원칙).
// 가드 없이 토글마다 전송: 찜은 add/remove 반복이 정상 행동이라 기기당 1회 제한이 없다.
function reportToggle(productId: string, action: "add" | "remove"): void {
  (async () => {
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      try {
        const { data } = await createClient().auth.getSession();
        if (data.session?.access_token) {
          headers["Authorization"] = `Bearer ${data.session.access_token}`;
        }
      } catch { /* 비로그인 — anon 계측 */ }
      await fetch("/api/shop/wishlist", {
        method: "POST",
        headers,
        body: JSON.stringify({ anonId: getAnonId(), productId, action, source: getSource() }),
        keepalive: true,
      });
    } catch { /* 네트워크 실패 — localStorage 상태는 이미 반영됐으므로 무시 */ }
  })();
}

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
  const removing = cur.includes(productId);
  const next = removing ? cur.filter((id) => id !== productId) : [...cur, productId];
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch { /* 시크릿 모드 등 저장 불가 환경 — 세션 내 상태만 유지 */ }
  reportToggle(productId, removing ? "remove" : "add");
  return next;
}
