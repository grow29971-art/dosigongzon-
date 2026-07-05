export type ShopItemKey =
  | "heal_potion" | "shield" | "cleanse_potion" | "skill_recharge" | "power_up" | "lucky_charm";

export interface ShopItem {
  key: ShopItemKey;
  name: string;
  desc: string;
  icon: string;
  price: number;
}

export const SHOP_ITEMS: Record<ShopItemKey, ShopItem> = {
  heal_potion:    { key: "heal_potion",    name: "치료 물약",   desc: "HP 20% 회복",              icon: "🧪", price: 30 },
  shield:         { key: "shield",         name: "방어막",      desc: "다음 피해 완전 무효화",     icon: "🛡️", price: 45 },
  cleanse_potion: { key: "cleanse_potion", name: "정화제",      desc: "모든 상태이상 해제",        icon: "💊", price: 35 },
  skill_recharge: { key: "skill_recharge", name: "스킬 충전기", desc: "모든 스킬 쿨다운 초기화",   icon: "🔋", price: 40 },
  power_up:       { key: "power_up",       name: "파워업 캔",   desc: "이번 공격 피해 +30%",       icon: "🥫", price: 35 },
  lucky_charm:    { key: "lucky_charm",    name: "행운의 부적", desc: "상대 다음 공격 100% 회피",  icon: "🍀", price: 35 },
};

export const SHOP_ITEM_KEYS = Object.keys(SHOP_ITEMS) as ShopItemKey[];

// 코인 지급량
export const COINS_LOGIN_BONUS = 15;
export const COINS_CARE_PER_LOG = 2;
export const COINS_CARE_DAILY_CAP = 5; // 하루 최대 지급 횟수 (총 10코인)
export const COINS_BATTLE_WIN = 3;
export const COINS_BATTLE_LOSE = 1;

// 주간 배틀 랭킹 코인 보상 (1~10등)
export const WEEKLY_RANK_REWARDS = [200, 150, 120, 100, 80, 60, 50, 40, 30, 20];

export function kstDateString(d: Date = new Date()): string {
  return new Date(d.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}
