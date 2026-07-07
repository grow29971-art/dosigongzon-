export type ShopItemKey =
  | "heal_potion" | "shield" | "cleanse_potion" | "skill_recharge" | "power_up" | "lucky_charm"
  | "skill_relearn";

export interface ShopItem {
  key: ShopItemKey;
  name: string;
  desc: string;
  icon: string;
  price: number;
  usableInBattle: boolean; // false면 카드 관리 화면에서만 사용 (전투 중 사용 아이템 아님)
}

export const SHOP_ITEMS: Record<ShopItemKey, ShopItem> = {
  heal_potion:    { key: "heal_potion",    name: "치료 물약",   desc: "HP 20% 회복",              icon: "🧪", price: 30, usableInBattle: true },
  shield:         { key: "shield",         name: "방어막",      desc: "다음 피해 완전 무효화",     icon: "🛡️", price: 45, usableInBattle: true },
  cleanse_potion: { key: "cleanse_potion", name: "정화제",      desc: "모든 상태이상 해제",        icon: "💊", price: 35, usableInBattle: true },
  skill_recharge: { key: "skill_recharge", name: "스킬 충전기", desc: "모든 스킬 쿨다운 초기화",   icon: "🔋", price: 40, usableInBattle: true },
  power_up:       { key: "power_up",       name: "파워업 캔",   desc: "이번 공격 피해 +30%",       icon: "🥫", price: 35, usableInBattle: true },
  lucky_charm:    { key: "lucky_charm",    name: "행운의 부적", desc: "상대 다음 공격 100% 회피",  icon: "🍀", price: 35, usableInBattle: true },
  skill_relearn:  { key: "skill_relearn",  name: "기술 다시 배우기 머신", desc: "카드 스킬 1개를 새 스킬로 재배정", icon: "📜", price: 60, usableInBattle: false },
};

export const SHOP_ITEM_KEYS = Object.keys(SHOP_ITEMS) as ShopItemKey[];
export const BATTLE_ITEM_KEYS = SHOP_ITEM_KEYS.filter(k => SHOP_ITEMS[k].usableInBattle);

// 코인 지급량
export const COINS_LOGIN_BONUS = 15;
export const COINS_CARE_PER_LOG = 2;
export const COINS_CARE_DAILY_CAP = 5; // 하루 최대 지급 횟수 (총 10코인)
export const COINS_BATTLE_WIN = 3;
export const COINS_BATTLE_LOSE = 1;

// 고양이학대범 PVE 보상 — 예전엔 12% 확률로만 만나는 희귀 이벤트라 이기면 크게(20)
// 지면 보유 코인 20%를 뺏기는 화끈한 하이리스크·하이리턴이었음. 이제 PVE가 "평소에" 하는
// 기본 모드가 되면서, 그 페널티를 매번 감당하면 재미보다 스트레스가 커서 완화함 —
// 이기면 PVP보다 조금 더(코인 8), 져도 페널티 없이 PVP 패배와 동일한 소액 위로(1)만 지급.
export const COINS_BOSS_WIN = 8;
export const COINS_BOSS_LOSE = 1;

// 주간 배틀 랭킹 코인 보상 (1~10등)
export const WEEKLY_RANK_REWARDS = [200, 150, 120, 100, 80, 60, 50, 40, 30, 20];

export function kstDateString(d: Date = new Date()): string {
  return new Date(d.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}
