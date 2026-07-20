// 코인 상점 설정 — 2026-07-20 카드배틀 기능 전면 삭제에 맞춰 축소.
// 남은 품목: 케어 간식(홈 다마고치) + 테두리 코스메틱(카드 꾸미기).
// 전투 소모품·장착 아이템·스킬 재배정 머신은 배틀과 함께 제거됨 (복구: git 이력 참고).
export type ShopItemKey =
  | "border_rainbow" | "border_gold" | "border_holo" | "border_sparkle" | "border_neon_blue"
  | "border_neon_pink" | "border_fire" | "border_ice" | "border_starlight" | "border_shadow"
  | "premium_can" | "churu" | "growth_can";

// 카드 테두리 코스메틱 — 순수 시각 효과.
// 실제 CSS 애니메이션은 app/components/CatCard.tsx의 BORDER_FX에서 정의.
export type BorderFxKey =
  | "rainbow" | "gold" | "holo" | "sparkle" | "neon_blue"
  | "neon_pink" | "fire" | "ice" | "starlight" | "shadow";

export interface ShopItem {
  key: ShopItemKey;
  name: string;
  desc: string;
  icon: string;
  price: number;
  borderFx?: BorderFxKey;  // 있으면 "테두리 코스메틱" — 카드 외형만 바꿈
  care?: { fullness?: number; mood?: number; exp?: number }; // 있으면 "케어 아이템" — 다마고치 게이지 증가량(100 클램프)
}

export const SHOP_ITEMS: Record<ShopItemKey, ShopItem> = {
  // ── 케어 아이템 — 다마고치(대표묘 케어) 전용. 일일 급여 한도와 무관하게 사용 가능 ──
  premium_can: { key: "premium_can", name: "프리미엄 캔", desc: "포만감 가득 + 기분 소폭 + EXP", icon: "🥫", price: 45, care: { fullness: 100, mood: 10, exp: 6 } },
  churu:       { key: "churu",       name: "츄르",        desc: "기분 만점! + EXP",             icon: "🍦", price: 30, care: { mood: 100, exp: 4 } },
  growth_can:  { key: "growth_can",  name: "성장 캔",     desc: "포만감 소폭 + EXP 듬뿍",       icon: "✨", price: 90, care: { fullness: 25, exp: 15 } },

  // ── 테두리 코스메틱 — 카드를 레어해 보이게 꾸며줌 ──
  border_rainbow:   { key: "border_rainbow",   name: "무지개 테두리", desc: "테두리가 무지개색으로 빙글빙글 돈다",     icon: "🌈", price: 120, borderFx: "rainbow" },
  border_gold:      { key: "border_gold",      name: "골드 샤인",    desc: "황금빛 광택이 테두리를 스윽 훑고 지나간다", icon: "✨", price: 120, borderFx: "gold" },
  border_holo:      { key: "border_holo",      name: "홀로그램",    desc: "보는 각도에 따라 색이 바뀌는 홀로 효과",   icon: "💿", price: 140, borderFx: "holo" },
  border_sparkle:   { key: "border_sparkle",   name: "반짝이 가루",  desc: "테두리에 작은 반짝임이 계속 터진다",       icon: "💫", price: 110, borderFx: "sparkle" },
  border_neon_blue: { key: "border_neon_blue", name: "네온 블루",    desc: "파란 네온 빛이 은은하게 맥박친다",         icon: "🔵", price: 100, borderFx: "neon_blue" },
  border_neon_pink: { key: "border_neon_pink", name: "네온 핑크",    desc: "핑크 네온 빛이 은은하게 맥박친다",         icon: "🌸", price: 100, borderFx: "neon_pink" },
  border_fire:      { key: "border_fire",      name: "불꽃 오라",    desc: "테두리가 이글이글 타오르는 불꽃빛",        icon: "🔥", price: 130, borderFx: "fire" },
  border_ice:       { key: "border_ice",       name: "얼음 오라",    desc: "테두리가 서늘한 얼음빛으로 반짝인다",      icon: "❄️", price: 130, borderFx: "ice" },
  border_starlight: { key: "border_starlight", name: "별빛 가루",    desc: "작은 별들이 테두리 위에서 반짝인다",       icon: "⭐", price: 140, borderFx: "starlight" },
  border_shadow:    { key: "border_shadow",    name: "다크 오라",    desc: "보랏빛 어둠의 기운이 은은하게 감돈다",     icon: "🌑", price: 130, borderFx: "shadow" },
};

export const SHOP_ITEM_KEYS = Object.keys(SHOP_ITEMS) as ShopItemKey[];
export const BORDER_FX_ITEM_KEYS = SHOP_ITEM_KEYS.filter(k => !!SHOP_ITEMS[k].borderFx);

// 코인 지급량 — 2026-07-20 전체 하향(약 절반). 같은 날 카드배틀 삭제로
// 배틀·보스·주간랭킹 보상은 제거됨. 남은 지급처: 출석체크(checkin/complete)·로그인·돌봄일지.
export const COINS_LOGIN_BONUS = 8;
export const COINS_CARE_PER_LOG = 1;
export const COINS_CARE_DAILY_CAP = 5; // 하루 최대 지급 횟수 (총 5코인)

export function kstDateString(d: Date = new Date()): string {
  return new Date(d.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}
