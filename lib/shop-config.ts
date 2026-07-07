export type ShopItemKey =
  | "heal_potion" | "shield" | "cleanse_potion" | "skill_recharge" | "power_up" | "lucky_charm"
  | "skill_relearn"
  | "atk_charm" | "def_charm" | "crit_charm" | "eva_charm" | "hp_charm"
  | "border_rainbow" | "border_gold" | "border_holo" | "border_sparkle" | "border_neon_blue"
  | "border_neon_pink" | "border_fire" | "border_ice" | "border_starlight" | "border_shadow";

// 카드 테두리 코스메틱 — 순수 시각 효과, 전투에 아무 영향 없음.
// 실제 CSS 애니메이션은 app/components/CatCard.tsx의 BORDER_FX에서 정의.
export type BorderFxKey =
  | "rainbow" | "gold" | "holo" | "sparkle" | "neon_blue"
  | "neon_pink" | "fire" | "ice" | "starlight" | "shadow";

// 장착 아이템(포켓몬 지닌 도구 스타일) 효과 — 퍼센트/포인트 전부 한 자릿수대로
// 낮게 잡아서 "장착하면 유리하지만 안 해도 이길 수 있는" 수준으로 제한.
// 마비/빙결 같은 행동 불능 CC나 큰 폭 공격력 상승은 의도적으로 배제(게임 밸런스 붕괴 방지).
export interface EquipEffect {
  atkPct?: number;  // 공격력 +N% (배수)
  defPct?: number;  // 방어력 +N%
  hpPct?: number;   // 최대 체력 +N%
  critAdd?: number; // 크리티컬 확률 +N%p
  evaAdd?: number;  // 회피율 +N%p
}

export interface ShopItem {
  key: ShopItemKey;
  name: string;
  desc: string;
  icon: string;
  price: number;
  usableInBattle: boolean; // false면 카드 관리 화면에서만 사용 (전투 중 사용 아이템 아님)
  equip?: EquipEffect;     // 있으면 "장착 아이템" — 소모되지 않고 카드에 계속 장착됨
  borderFx?: BorderFxKey;  // 있으면 "테두리 코스메틱" — 스탯 영향 없이 카드 외형만 바꿈
}

export const SHOP_ITEMS: Record<ShopItemKey, ShopItem> = {
  heal_potion:    { key: "heal_potion",    name: "치료 물약",   desc: "HP 20% 회복",              icon: "🧪", price: 30, usableInBattle: true },
  shield:         { key: "shield",         name: "방어막",      desc: "다음 피해 완전 무효화",     icon: "🛡️", price: 45, usableInBattle: true },
  cleanse_potion: { key: "cleanse_potion", name: "정화제",      desc: "모든 상태이상 해제",        icon: "💊", price: 35, usableInBattle: true },
  skill_recharge: { key: "skill_recharge", name: "스킬 충전기", desc: "모든 스킬 쿨다운 초기화",   icon: "🔋", price: 40, usableInBattle: true },
  power_up:       { key: "power_up",       name: "파워업 캔",   desc: "이번 공격 피해 +30%",       icon: "🥫", price: 35, usableInBattle: true },
  lucky_charm:    { key: "lucky_charm",    name: "행운의 부적", desc: "상대 다음 공격 100% 회피",  icon: "🍀", price: 35, usableInBattle: true },
  skill_relearn:  { key: "skill_relearn",  name: "기술 다시 배우기 머신", desc: "카드 스킬 1개를 새 스킬로 재배정", icon: "📜", price: 60, usableInBattle: false },

  // ── 장착 아이템 — 카드 하나에 1개씩 장착, 구매 수량만큼 여러 카드에 나눠 장착 가능 ──
  atk_charm:  { key: "atk_charm",  name: "공격의 발톱", desc: "장착 시 공격력 +6%",        icon: "🗡️", price: 80, usableInBattle: false, equip: { atkPct: 0.06 } },
  def_charm:  { key: "def_charm",  name: "수호의 목걸이", desc: "장착 시 방어력 +6%",       icon: "🛡️", price: 80, usableInBattle: false, equip: { defPct: 0.06 } },
  hp_charm:   { key: "hp_charm",   name: "생명의 부적", desc: "장착 시 최대 체력 +8%",      icon: "❤️", price: 85, usableInBattle: false, equip: { hpPct: 0.08 } },
  crit_charm: { key: "crit_charm", name: "급소의 렌즈", desc: "장착 시 크리티컬 확률 +5%p", icon: "🎯", price: 90, usableInBattle: false, equip: { critAdd: 5 } },
  eva_charm:  { key: "eva_charm",  name: "바람의 깃털", desc: "장착 시 회피율 +5%p",        icon: "🍃", price: 90, usableInBattle: false, equip: { evaAdd: 5 } },

  // ── 테두리 코스메틱 — 전투 능력치엔 영향 없이 카드를 레어해 보이게 꾸며줌 ──
  border_rainbow:   { key: "border_rainbow",   name: "무지개 테두리", desc: "테두리가 무지개색으로 빙글빙글 돈다",     icon: "🌈", price: 120, usableInBattle: false, borderFx: "rainbow" },
  border_gold:      { key: "border_gold",      name: "골드 샤인",    desc: "황금빛 광택이 테두리를 스윽 훑고 지나간다", icon: "✨", price: 120, usableInBattle: false, borderFx: "gold" },
  border_holo:      { key: "border_holo",      name: "홀로그램",    desc: "보는 각도에 따라 색이 바뀌는 홀로 효과",   icon: "💿", price: 140, usableInBattle: false, borderFx: "holo" },
  border_sparkle:   { key: "border_sparkle",   name: "반짝이 가루",  desc: "테두리에 작은 반짝임이 계속 터진다",       icon: "💫", price: 110, usableInBattle: false, borderFx: "sparkle" },
  border_neon_blue: { key: "border_neon_blue", name: "네온 블루",    desc: "파란 네온 빛이 은은하게 맥박친다",         icon: "🔵", price: 100, usableInBattle: false, borderFx: "neon_blue" },
  border_neon_pink: { key: "border_neon_pink", name: "네온 핑크",    desc: "핑크 네온 빛이 은은하게 맥박친다",         icon: "🌸", price: 100, usableInBattle: false, borderFx: "neon_pink" },
  border_fire:      { key: "border_fire",      name: "불꽃 오라",    desc: "테두리가 이글이글 타오르는 불꽃빛",        icon: "🔥", price: 130, usableInBattle: false, borderFx: "fire" },
  border_ice:       { key: "border_ice",       name: "얼음 오라",    desc: "테두리가 서늘한 얼음빛으로 반짝인다",      icon: "❄️", price: 130, usableInBattle: false, borderFx: "ice" },
  border_starlight: { key: "border_starlight", name: "별빛 가루",    desc: "작은 별들이 테두리 위에서 반짝인다",       icon: "⭐", price: 140, usableInBattle: false, borderFx: "starlight" },
  border_shadow:    { key: "border_shadow",    name: "다크 오라",    desc: "보랏빛 어둠의 기운이 은은하게 감돈다",     icon: "🌑", price: 130, usableInBattle: false, borderFx: "shadow" },
};

export const SHOP_ITEM_KEYS = Object.keys(SHOP_ITEMS) as ShopItemKey[];
export const BATTLE_ITEM_KEYS = SHOP_ITEM_KEYS.filter(k => SHOP_ITEMS[k].usableInBattle);
export const EQUIP_ITEM_KEYS = SHOP_ITEM_KEYS.filter(k => !!SHOP_ITEMS[k].equip);
export const BORDER_FX_ITEM_KEYS = SHOP_ITEM_KEYS.filter(k => !!SHOP_ITEMS[k].borderFx);

// 장착된 아이템의 보너스를 스탯에 적용 — calcStats(route.ts)에서 사용.
// itemKey가 없거나(마이그레이션 전 포함) 알 수 없는 키면 원본 스탯 그대로 반환.
export function applyEquipBonus(
  stats: { hp: number; atk: number; def: number; eva: number; crit: number },
  itemKey: string | null | undefined,
): typeof stats {
  const eq = itemKey ? SHOP_ITEMS[itemKey as ShopItemKey]?.equip : undefined;
  if (!eq) return stats;
  return {
    hp: Math.round(stats.hp * (1 + (eq.hpPct ?? 0))),
    atk: Math.round(stats.atk * (1 + (eq.atkPct ?? 0))),
    def: Math.round(stats.def * (1 + (eq.defPct ?? 0))),
    eva: Math.min(50, stats.eva + (eq.evaAdd ?? 0)),
    crit: Math.min(50, stats.crit + (eq.critAdd ?? 0)),
  };
}

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
