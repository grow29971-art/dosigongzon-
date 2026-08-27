// 코인 상점 설정 — 2026-08-27 카드 시스템 전면 폐지(사장님 지시)로 케어 간식만 남김.
// (2026-07-20 배틀 삭제 → 2026-08-27 카드·테두리 코스메틱까지 제거. 복구: git 이력 참고)
export type ShopItemKey = "premium_can" | "churu" | "growth_can";

export interface ShopItem {
  key: ShopItemKey;
  name: string;
  desc: string;
  icon: string;
  price: number;
  care?: { fullness?: number; mood?: number; exp?: number }; // 다마고치 게이지 증가량(100 클램프)
}

export const SHOP_ITEMS: Record<ShopItemKey, ShopItem> = {
  // ── 케어 아이템 — 다마고치(대표묘 케어) 전용. 일일 급여 한도와 무관하게 사용 가능 ──
  premium_can: { key: "premium_can", name: "프리미엄 캔", desc: "포만감 가득 + 기분 소폭 + EXP", icon: "🥫", price: 45, care: { fullness: 100, mood: 10, exp: 6 } },
  churu:       { key: "churu",       name: "츄르",        desc: "기분 만점! + EXP",             icon: "🍦", price: 30, care: { mood: 100, exp: 4 } },
  growth_can:  { key: "growth_can",  name: "성장 캔",     desc: "포만감 소폭 + EXP 듬뿍",       icon: "✨", price: 90, care: { fullness: 25, exp: 15 } },
};

export const SHOP_ITEM_KEYS = Object.keys(SHOP_ITEMS) as ShopItemKey[];

// 코인 지급량 — 2026-07-20 전체 하향(약 절반). 같은 날 카드배틀 삭제로
// 배틀·보스·주간랭킹 보상은 제거됨. 남은 지급처: 출석체크(checkin/complete)·로그인·돌봄일지.
export const COINS_LOGIN_BONUS = 8;
export const COINS_CARE_PER_LOG = 1;
export const COINS_CARE_DAILY_CAP = 5; // 하루 최대 지급 횟수 (총 5코인)

export function kstDateString(d: Date = new Date()): string {
  return new Date(d.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}
