export type SpecialSkillId =
  | "sharp_claws" | "quick_dodge" | "focus" | "intimidate_sm" | "hiss" | "grooming" | "warm_nap" | "tail_whip"
  | "freeze" | "scratch" | "intimidate" | "pounce" | "ambush" | "static_shock" | "night_prowl" | "thunderclap"
  | "poison" | "bind" | "slow" | "double_strike" | "rend" | "howl" | "frenzy" | "curse"
  | "vampirism" | "invincible" | "dominate" | "regen" | "eclipse" | "overdrive" | "meteor" | "cleanse";

export interface SpecialSkill {
  id: SpecialSkillId;
  name: string;
  desc: string;
  icon: string;
  rarity: "common" | "uncommon" | "rare" | "legendary";
}

export const SPECIAL_SKILLS: Record<SpecialSkillId, SpecialSkill> = {
  // 일반
  sharp_claws:   { id:"sharp_claws",   name:"날카로운 발톱", desc:"이번 공격 +40% 피해", icon:"🐾", rarity:"common" },
  quick_dodge:   { id:"quick_dodge",   name:"재빠른 도약",   desc:"이번 턴 회피율 +35%",  icon:"💨", rarity:"common" },
  focus:         { id:"focus",         name:"집중의 눈빛",   desc:"이번 공격 치명타 확정", icon:"👁️", rarity:"common" },
  intimidate_sm: { id:"intimidate_sm", name:"견제",           desc:"상대 공격력 -15% (1턴)",icon:"😠", rarity:"common" },
  hiss:          { id:"hiss",          name:"하악 위협",      desc:"40% 확률로 1턴 기절",   icon:"😾", rarity:"common" },
  grooming:      { id:"grooming",      name:"그루밍",         desc:"HP 10% 회복",           icon:"🧼", rarity:"common" },
  warm_nap:      { id:"warm_nap",      name:"따뜻한 낮잠",    desc:"HP 8% 회복",            icon:"😴", rarity:"common" },
  tail_whip:     { id:"tail_whip",     name:"꼬리 치기",      desc:"상대 방어 30% 무시 공격", icon:"🐈", rarity:"common" },
  // 희귀
  freeze:       { id:"freeze",       name:"얼리기",      desc:"상대 60% 확률 1턴 빙결",   icon:"❄️", rarity:"uncommon" },
  scratch:      { id:"scratch",      name:"할퀴기",      desc:"2턴 출혈 (-5HP/턴)",       icon:"🩸", rarity:"uncommon" },
  intimidate:   { id:"intimidate",   name:"공포의 눈빛", desc:"상대 공격력 -25% (2턴)",   icon:"😱", rarity:"uncommon" },
  pounce:       { id:"pounce",       name:"도약 강타",   desc:"방어 무시 강타",            icon:"🦘", rarity:"uncommon" },
  ambush:       { id:"ambush",       name:"급습",        desc:"+20% 피해, 치명타 확정",    icon:"🌑", rarity:"uncommon" },
  static_shock: { id:"static_shock", name:"정전기 충격", desc:"40% 확률로 1턴 기절",       icon:"⚡", rarity:"uncommon" },
  night_prowl:  { id:"night_prowl",  name:"야습",        desc:"회피 불가 관통 +10% 피해",  icon:"🌌", rarity:"uncommon" },
  thunderclap:  { id:"thunderclap",  name:"천둥벽력",    desc:"소량 피해 + 35% 확률 기절",  icon:"🌩️", rarity:"uncommon" },
  // 레어
  poison:        { id:"poison",        name:"독",       desc:"3턴 중독 (-8HP/턴)",        icon:"☠️", rarity:"rare" },
  bind:          { id:"bind",          name:"속박",     desc:"상대 회피율 0% (2턴)",       icon:"⛓️", rarity:"rare" },
  slow:          { id:"slow",          name:"느리게",   desc:"상대 선제권 박탈 (2턴)",     icon:"🐌", rarity:"rare" },
  double_strike: { id:"double_strike", name:"연속 공격",desc:"이번 턴 2번 연속 공격",      icon:"⚡", rarity:"rare" },
  rend:          { id:"rend",          name:"찢기",     desc:"방어 무시 강타 + 2턴 출혈",  icon:"🗡️", rarity:"rare" },
  howl:          { id:"howl",          name:"하울링",   desc:"상대 회피율 0% (2턴)",       icon:"🐺", rarity:"rare" },
  frenzy:        { id:"frenzy",        name:"맹공",     desc:"강타 (1.6×)",                icon:"🔱", rarity:"rare" },
  curse:         { id:"curse",         name:"저주",     desc:"4턴 저주 (-8HP/턴)",         icon:"👹", rarity:"rare" },
  // 레전드
  vampirism:  { id:"vampirism",  name:"흡혈",  desc:"가한 피해 30% 흡수",            icon:"🧛", rarity:"legendary" },
  invincible: { id:"invincible", name:"무적",  desc:"다음 피해 완전 무효화",          icon:"✨", rarity:"legendary" },
  dominate:   { id:"dominate",   name:"지배",  desc:"상대 전 스탯 -20% (3턴)",       icon:"👑", rarity:"legendary" },
  regen:      { id:"regen",      name:"재생",  desc:"매 턴 최대 HP 5% 회복 (패시브)", icon:"💚", rarity:"legendary" },
  eclipse:    { id:"eclipse",    name:"월식",  desc:"강타 + HP 15% 회복",            icon:"🌘", rarity:"legendary" },
  overdrive:  { id:"overdrive",  name:"폭주",  desc:"피해 2배, 반동 8%",             icon:"💢", rarity:"legendary" },
  meteor:     { id:"meteor",     name:"메테오", desc:"필살 강타 (2.0×)",             icon:"☄️", rarity:"legendary" },
  cleanse:    { id:"cleanse",    name:"정화",  desc:"상태이상 해제 + HP 10% 회복",   icon:"💫", rarity:"legendary" },
};

const SKILL_POOL: Record<string, SpecialSkillId[]> = {
  common:    ["sharp_claws", "quick_dodge", "focus", "intimidate_sm", "hiss", "grooming", "warm_nap", "tail_whip"],
  uncommon:  ["freeze", "scratch", "intimidate", "pounce", "ambush", "static_shock", "night_prowl", "thunderclap"],
  rare:      ["poison", "bind", "slow", "double_strike", "rend", "howl", "frenzy", "curse"],
  legendary: ["vampirism", "invincible", "dominate", "regen", "eclipse", "overdrive", "meteor", "cleanse"],
};

const STAT_RANGE: Record<string, { atk:[number,number]; def:[number,number]; eva:[number,number]; crit:[number,number] }> = {
  common:    { atk:[20,45], def:[15,35], eva:[3,10],  crit:[5,12]  },
  uncommon:  { atk:[35,60], def:[25,50], eva:[7,18],  crit:[8,18]  },
  rare:      { atk:[50,75], def:[40,65], eva:[12,25], crit:[12,24] },
  legendary: { atk:[65,90], def:[55,80], eva:[18,35], crit:[18,30] },
};

function ri(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function generateBattleStats(rarity: string) {
  const range = STAT_RANGE[rarity] ?? STAT_RANGE.common;
  const pool  = SKILL_POOL[rarity] ?? SKILL_POOL.common;
  const idx1 = Math.floor(Math.random() * pool.length);
  let idx2 = Math.floor(Math.random() * pool.length);
  if (pool.length > 1 && idx2 === idx1) idx2 = (idx2 + 1) % pool.length;
  return {
    battle_atk:      ri(...range.atk),
    battle_def:      ri(...range.def),
    battle_eva:      ri(...range.eva),
    battle_crit:     ri(...range.crit),
    battle_special:  pool[idx1],
    battle_special2: pool[idx2],
  };
}

// 돌봄 횟수 → 등급 자동 진화 임계값
export const RARITY_CARE_THRESHOLD: Record<string, number> = {
  common:   20,
  uncommon: 60,
  rare:     150,
};
export const RARITY_UPGRADE_TARGET: Record<string, string> = {
  common:   "uncommon",
  uncommon: "rare",
  rare:     "legendary",
};
