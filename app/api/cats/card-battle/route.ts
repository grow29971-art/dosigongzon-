import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as serviceClient } from "@supabase/supabase-js";
import { COINS_BATTLE_WIN, COINS_BATTLE_LOSE, COINS_BOSS_WIN, COINS_BOSS_LOSE } from "@/lib/shop-config";
import { SPECIAL_SKILLS, type SpecialSkillId } from "@/lib/battle-config";

export const maxDuration = 15;

interface CardCat {
  id: string;
  name: string;
  photo_url: string | null;
  caretaker_id: string;
  card_level: number;
  card_exp: number;
  card_rarity: string;
  card_name: string | null;
  card_traits: string[] | null;
  card_stats: { cuteness: number; wildness: number; sociability: number; mysteriousness: number } | null;
  card_flavor?: string | null;
  battle_atk: number | null;
  battle_def: number | null;
  battle_eva: number | null;
  battle_crit: number | null;
  battle_special: string | null;
  battle_special2: string | null;
  battle_special3: string | null;
  battle_special4: string | null;
  win_streak: number | null;
  // 카드 훈장(성장 스티커) 계산용 — 리셋 없는 all-time 기록. 훈장 조건은 CatCard.tsx에서 계산.
  best_win_streak?: number | null;
  pve_win_count?: number | null;
  // PVE 상대(고양이학대범 이외의 야생동물)는 실제 사진이 없어 이모지로 표시 — 진짜 고양이 카드는 항상 null.
  placeholder_emoji?: string | null;
}

// 등급별 HP 보너스: 일반→레전드로 갈수록 체력이 두껍게 (전투가 늘어지지 않도록 전체적으로 하향)
const RARITY_HP_BONUS: Record<string, number> = { common:0, uncommon:35, rare:73, legendary:122 };

// 고양이학대범(PVE) — 실제 유저 카드 대신 등장하는 스크립트 상대.
// DB에 존재하지 않는 고정 id라서 결과 기록 시 상대 카드/유저 업데이트는 건너뛴다.
// 예전엔 12% 확률로만 랜덤하게 마주치는 이벤트였는데, 이제 PVE 모드를 선택하면
// 항상 이 빌런과 붙는다 — "평소엔 PVE, 다른 유저와 직접 겨루고 싶을 때만 PVP"로
// 재구성. 실제 고양이끼리 싸우게 하는 게 이 앱 톤(우리 동네 아이 존중)과 안 맞는다는
// 판단 아래, 기본 배틀 상대를 "빌런"으로 바꾸고 PVP는 선택 옵션으로 남겨둠.
const BOSS_CAT_ID = "00000000-0000-0000-0000-0000000000b0";

function makeBossOpponent(myCat: CardCat): CardCat {
  const baseAtk = myCat.battle_atk ?? 40;
  const baseDef = myCat.battle_def ?? 25;
  return {
    id: BOSS_CAT_ID,
    name: "고양이학대범",
    photo_url: "/boss/villain-card.jpg",
    caretaker_id: BOSS_CAT_ID,
    card_level: myCat.card_level ?? 1,
    card_exp: 0,
    card_rarity: myCat.card_rarity ?? "common",
    card_name: "고양이 학대범",
    card_traits: ["그물 던지기", "위협하기", "괴롭히기"],
    card_stats: { cuteness: 20, wildness: 75, sociability: 15, mysteriousness: 65 },
    card_flavor: "길고양이를 괴롭히는 나쁜 사람. 반드시 혼내줘야 한다!",
    battle_atk: Math.round(baseAtk * 1.12) + 4,
    battle_def: Math.round(baseDef * 1.08) + 2,
    battle_eva: 10,
    battle_crit: 14,
    battle_special: "bind",
    battle_special2: "intimidate",
    battle_special3: "curse",
    battle_special4: "dominate",
    win_streak: 0,
  };
}

// PVE 야생동물 로스터 — "고양이학대범 한 종류만 계속" 대신, 우리 동네 아이가 실제로
// 마주칠 법한 잡다한 불청객들과도 붙어보게 다양성을 줌. 사진 에셋이 없어 이모지로
// 표시하고(placeholder_emoji), 체력/공격력은 내 카드 스탯 대비 상대 배율로 스케일한다.
// 학대범(사람)만 진짜 "빌런" 취급이라 사진이 있고 별도로 더 강하게 잡아둔다.
interface PveCreature {
  key: string; name: string; emoji: string; flavor: string;
  atkMult: number; defMult: number; eva: number; crit: number;
  traits: [string, string]; stats: { cuteness: number; wildness: number; sociability: number; mysteriousness: number };
  skills: [string, string, string, string];
}
const PVE_ROSTER: PveCreature[] = [
  { key: "mosquito", name: "모기", emoji: "🦟", flavor: "귓가에서 앵앵대다 따끔하게 무는 작은 불청객",
    atkMult: 0.35, defMult: 0.18, eva: 34, crit: 9,
    traits: ["앵앵 소리", "따끔한 침"], stats: { cuteness: 5, wildness: 10, sociability: 5, mysteriousness: 15 },
    skills: ["quick_dodge", "venom_fang", "tail_whip", "sharp_claws"] },
  { key: "fly", name: "파리", emoji: "🪰", flavor: "밥상 위를 맴돌며 성가시게 구는 잽싼 불청객",
    atkMult: 0.40, defMult: 0.22, eva: 32, crit: 8,
    traits: ["잽싼 날갯짓", "성가신 맴돌기"], stats: { cuteness: 5, wildness: 12, sociability: 8, mysteriousness: 10 },
    skills: ["quick_dodge", "dash_strike", "tail_whip", "sharp_claws"] },
  { key: "centipede", name: "지네", emoji: "🐛", flavor: "돌 틈에서 스멀스멀 기어나온 다리 많은 불청객",
    atkMult: 0.45, defMult: 0.28, eva: 22, crit: 11,
    traits: ["다리 많은 질주", "독니 물기"], stats: { cuteness: 5, wildness: 25, sociability: 5, mysteriousness: 30 },
    skills: ["venom_fang", "quick_dodge", "sharp_claws", "scratch"] },
  { key: "slug", name: "민달팽이", emoji: "🐌", flavor: "느릿느릿 끈적한 자국을 남기며 기어가는 무해해 보이는 불청객",
    atkMult: 0.25, defMult: 0.20, eva: 4, crit: 5,
    traits: ["끈적한 점액", "느릿느릿 전진"], stats: { cuteness: 30, wildness: 5, sociability: 5, mysteriousness: 10 },
    skills: ["tail_whip", "sharp_claws", "regen", "scratch"] },
  { key: "ant", name: "개미", emoji: "🐜", flavor: "떼로 몰려와 성가시게 무는 작은 불청객",
    atkMult: 0.40, defMult: 0.25, eva: 18, crit: 9,
    traits: ["떼로 몰려오기", "작은 턱"], stats: { cuteness: 15, wildness: 20, sociability: 15, mysteriousness: 10 },
    skills: ["double_strike", "sharp_claws", "quick_dodge", "tail_whip"] },
  { key: "roach", name: "바퀴벌레", emoji: "🪳", flavor: "부엌을 어지럽히던 잽싼 침입자",
    atkMult: 0.42, defMult: 0.30, eva: 30, crit: 8,
    traits: ["잽싼 발놀림", "깜짝 도주"], stats: { cuteness: 10, wildness: 15, sociability: 5, mysteriousness: 10 },
    skills: ["quick_dodge", "tail_whip", "claw_flurry", "sharp_claws"] },
  { key: "mouse", name: "생쥐", emoji: "🐭", flavor: "찬장 밑에서 튀어나온 작은 도둑",
    atkMult: 0.50, defMult: 0.35, eva: 24, crit: 8,
    traits: ["살금살금", "작은 이빨"], stats: { cuteness: 20, wildness: 20, sociability: 10, mysteriousness: 15 },
    skills: ["quick_dodge", "scratch", "tail_whip", "sharp_claws"] },
  { key: "rat", name: "쥐", emoji: "🐀", flavor: "하수구를 누비는 덩치 큰 쥐",
    atkMult: 0.65, defMult: 0.45, eva: 16, crit: 10,
    traits: ["날카로운 이빨", "질긴 생명력"], stats: { cuteness: 15, wildness: 35, sociability: 10, mysteriousness: 20 },
    skills: ["venom_fang", "scratch", "rend", "body_slam"] },
  { key: "mole", name: "두더지", emoji: "🕳️", flavor: "땅굴 속에서 갑자기 튀어나오는 기습꾼",
    atkMult: 0.58, defMult: 0.48, eva: 12, crit: 10,
    traits: ["땅굴 기습", "억센 앞발"], stats: { cuteness: 25, wildness: 20, sociability: 5, mysteriousness: 25 },
    skills: ["ambush", "body_slam", "bind", "scratch"] },
  { key: "pigeon", name: "비둘기", emoji: "🐦", flavor: "전깃줄 위의 뻔뻔한 불청객",
    atkMult: 0.60, defMult: 0.40, eva: 28, crit: 10,
    traits: ["푸드덕 날갯짓", "부리 쪼기"], stats: { cuteness: 25, wildness: 30, sociability: 20, mysteriousness: 15 },
    skills: ["quick_dodge", "pounce", "tail_whip", "dash_strike"] },
  { key: "wasp", name: "말벌", emoji: "🐝", flavor: "건드리면 위험한 노란 침입자",
    atkMult: 0.70, defMult: 0.30, eva: 22, crit: 16,
    traits: ["따끔한 침", "윙윙 위협"], stats: { cuteness: 5, wildness: 45, sociability: 5, mysteriousness: 30 },
    skills: ["venom_fang", "poison", "static_shock", "dash_strike"] },
  { key: "crow", name: "까마귀", emoji: "🐦‍⬛", flavor: "영리하게 약 올리는 검은 그림자",
    atkMult: 0.80, defMult: 0.50, eva: 18, crit: 12,
    traits: ["약 올리는 울음", "급강하 공격"], stats: { cuteness: 20, wildness: 40, sociability: 15, mysteriousness: 50 },
    skills: ["intimidate", "hiss", "ambush", "thunderclap"] },
  { key: "raccoon", name: "너구리", emoji: "🦝", flavor: "쓰레기통을 뒤지는 덩치 큰 불청객",
    atkMult: 1.0, defMult: 0.70, eva: 9, crit: 8,
    traits: ["묵직한 몸통박치기", "날카로운 발톱"], stats: { cuteness: 30, wildness: 60, sociability: 20, mysteriousness: 40 },
    skills: ["body_slam", "claw_flurry", "intimidate", "frenzy"] },
  { key: "spider", name: "거미", emoji: "🕷️", flavor: "구석에 거미줄을 친 작은 사냥꾼",
    atkMult: 0.38, defMult: 0.26, eva: 26, crit: 10,
    traits: ["거미줄 치기", "살금살금 접근"], stats: { cuteness: 8, wildness: 20, sociability: 5, mysteriousness: 35 },
    skills: ["bind", "quick_dodge", "sharp_claws", "scratch"] },
  { key: "weasel", name: "족제비", emoji: "🐿️", flavor: "밤에만 움직이는 날렵한 침입자",
    atkMult: 0.85, defMult: 0.55, eva: 20, crit: 14,
    traits: ["날렵한 몸놀림", "기습 발톱"], stats: { cuteness: 25, wildness: 55, sociability: 15, mysteriousness: 45 },
    skills: ["dash_strike", "claw_flurry", "ambush", "night_prowl"] },
  { key: "hawk", name: "황조롱이", emoji: "🦅", flavor: "하늘에서 노려보는 진짜 위협 — 사냥하는 입장이 뒤바뀌는 상대",
    atkMult: 0.88, defMult: 0.50, eva: 15, crit: 13,
    traits: ["급강하 발톱", "매서운 눈매"], stats: { cuteness: 15, wildness: 65, sociability: 10, mysteriousness: 55 },
    skills: ["pounce", "ambush", "dash_strike", "judgment"] },
  { key: "owl", name: "부엉이", emoji: "🦉", flavor: "소리 없이 다가와 매서운 눈으로 노려보는 밤의 사냥꾼",
    atkMult: 0.90, defMult: 0.52, eva: 16, crit: 15,
    traits: ["소리 없는 비행", "매서운 눈빛"], stats: { cuteness: 20, wildness: 60, sociability: 10, mysteriousness: 70 },
    skills: ["night_prowl", "ambush", "pounce", "cold_glare"] },
  { key: "snake", name: "뱀", emoji: "🐍", flavor: "담벼락 틈에서 스르륵 나타난 서늘한 불청객",
    atkMult: 0.72, defMult: 0.35, eva: 20, crit: 12,
    traits: ["스르륵 접근", "독니 물기"], stats: { cuteness: 10, wildness: 50, sociability: 5, mysteriousness: 40 },
    skills: ["venom_fang", "poison", "bind", "ambush"] },
  { key: "boar", name: "멧돼지", emoji: "🐗", flavor: "산에서 마을로 내려온 묵직한 돌진꾼",
    atkMult: 1.15, defMult: 0.85, eva: 6, crit: 10,
    traits: ["묵직한 돌진", "날카로운 엄니"], stats: { cuteness: 15, wildness: 80, sociability: 10, mysteriousness: 30 },
    skills: ["body_slam", "rend", "frenzy", "intimidate"] },
  { key: "deer", name: "고라니", emoji: "🦌", flavor: "도로 위로 불쑥 튀어나오는 의외의 복병 — 뜻밖의 송곳니를 숨기고 있다",
    atkMult: 0.75, defMult: 0.40, eva: 25, crit: 11,
    traits: ["껑충 도약", "숨겨진 송곳니"], stats: { cuteness: 45, wildness: 45, sociability: 15, mysteriousness: 35 },
    skills: ["dash_strike", "pounce", "quick_dodge", "ambush"] },
  { key: "badger", name: "오소리", emoji: "🦡", flavor: "땅을 파헤치며 버티는 억센 불청객",
    atkMult: 0.95, defMult: 0.75, eva: 10, crit: 9,
    traits: ["억센 발톱", "질긴 가죽"], stats: { cuteness: 20, wildness: 60, sociability: 15, mysteriousness: 35 },
    skills: ["claw_flurry", "rend", "body_slam", "intimidate"] },
  { key: "marten", name: "담비", emoji: "🦫", flavor: "나뭇가지 사이를 날렵하게 넘나드는 재빠른 사냥꾼",
    atkMult: 0.82, defMult: 0.45, eva: 24, crit: 15,
    traits: ["날쌘 도약", "예리한 이빨"], stats: { cuteness: 30, wildness: 55, sociability: 10, mysteriousness: 40 },
    skills: ["dash_strike", "ambush", "night_prowl", "sharp_claws"] },
];

// 실제 사진이 준비된 PVE 로스터 키 — public/pve/{key}.jpg 로 존재. 아직 사진이 없는
// 종(예: 쥐)은 이 목록에서 빠져 기존처럼 placeholder_emoji로 표시된다.
const PVE_PHOTO_KEYS = new Set([
  "mosquito", "fly", "centipede", "slug", "ant", "roach", "mouse", "pigeon",
  "wasp", "crow", "raccoon", "spider", "weasel", "hawk", "owl", "snake",
  "boar", "deer", "badger", "marten", "mole",
]);

// 20%는 고양이학대범(최종 빌런), 80%는 야생동물 로스터 중 무작위 — 매번 같은 상대만
// 반복하지 않게 다양성을 주되, 진짜 "혼내줘야 할 사람"이라는 임팩트는 남겨둔다.
function makePveOpponent(myCat: CardCat): CardCat {
  if (Math.random() < 0.2) return makeBossOpponent(myCat);

  const c = PVE_ROSTER[Math.floor(Math.random() * PVE_ROSTER.length)];
  const baseAtk = myCat.battle_atk ?? 40;
  const baseDef = myCat.battle_def ?? 25;
  return {
    id: `pve-${c.key}`,
    name: c.name,
    photo_url: PVE_PHOTO_KEYS.has(c.key) ? `/pve/${c.key}.jpg` : null,
    placeholder_emoji: c.emoji,
    caretaker_id: BOSS_CAT_ID,
    card_level: myCat.card_level ?? 1,
    card_exp: 0,
    card_rarity: myCat.card_rarity ?? "common",
    card_name: c.name,
    card_traits: c.traits,
    card_stats: c.stats,
    card_flavor: c.flavor,
    battle_atk: Math.max(5, Math.round(baseAtk * c.atkMult)),
    battle_def: Math.max(3, Math.round(baseDef * c.defMult)),
    battle_eva: c.eva,
    battle_crit: c.crit,
    battle_special: c.skills[0],
    battle_special2: c.skills[1],
    battle_special3: c.skills[2],
    battle_special4: c.skills[3],
    win_streak: 0,
  };
}

function calcStats(cat: CardCat) {
  const lv = cat.card_level ?? 1;
  const s = cat.card_stats ?? { cuteness: 50, wildness: 50, sociability: 50, mysteriousness: 50 };
  const hpBonus = RARITY_HP_BONUS[cat.card_rarity ?? "common"] ?? 0;
  const baseAtk = cat.battle_atk ?? Math.round(s.wildness * 0.8 + 20);
  const baseDef = cat.battle_def ?? Math.round(s.mysteriousness * 0.5 + 15);
  return {
    hp:   Math.round(s.cuteness * 1.3 + s.wildness * 0.65) + 95 + hpBonus + (lv - 1) * 13,
    atk:  baseAtk + (lv - 1) * 3,
    def:  baseDef + (lv - 1) * 2,
    spd:  Math.round(s.sociability * 0.5 + 20) + lv,
    eva:  Math.min(45, cat.battle_eva ?? 8),
    crit: Math.min(45, cat.battle_crit ?? 8),
  };
}

function rnd(min: number, max: number) {
  return min + Math.random() * (max - min);
}

// 매칭용 승률 추정 — 실제 배틀 시뮬레이션(simulateBattle)을 그대로 여러 번 돌려서 승률을 근사.
// 예전엔 스킬/상태이상을 빼고 순수 기본공격만 도는 단순 모델(quickSimWin)로 추정했는데,
// 실제 승부는 스킬·상태이상까지 다 들어가다 보니 추정치와 실제 승률이 꽤 어긋났었다
// (목표 45% 매칭인데 실측하면 43%, 목표 50%인데 실측 46% 식으로 항상 낮게 나옴).
// 실제 로직을 그대로 재사용하면 이 괴리가 구조적으로 없어진다.
function estimateWinRate(mine: CardCat, opp: CardCat, trials = 40): number {
  let wins = 0;
  for (let i = 0; i < trials; i++) if (simulateBattle(mine, opp).attackerWins) wins++;
  return wins / trials;
}
function pickByTargetWinRate(mine: CardCat, candidates: CardCat[], target: number): CardCat {
  const scored = candidates
    .map(o => ({ o, diff: Math.abs(estimateWinRate(mine, o) - target) }))
    .sort((a, b) => a.diff - b.diff);
  const closePicks = scored.slice(0, Math.max(1, Math.ceil(scored.length * 0.25)));
  return closePicks[Math.floor(Math.random() * closePicks.length)].o;
}

interface AutoLogEntry {
  turn: number; actor: string; dmg: number; aHp: number; dHp: number;
  isCritical: boolean; isDodge: boolean; isCounterAttack: boolean;
  skillName: string; skillId?: string; isDot?: boolean; isStunSkip?: boolean;
  // 이번 턴에 상대에게 새로 걸린 상태이상 — 클라이언트가 리플레이 중 실제 이펙트를 띄우는 데 사용
  statusType?: "stun" | "poison" | "bleed" | "bind"; statusTurns?: number;
}

// 자동전투 전용 스킬 효과표 — 실제 수동 배틀 로직(applySkill/runSpecial)의 축약판.
// 수동 쪽 숫자와 100% 동일하진 않지만(자동전투는 원래 별도 EXP/코인 체계라 이미 다름),
// "실제로 그 카드가 가진 4개 스킬을 쓰고 상태이상도 진짜로 걸린다"는 핵심만 살린다.
interface AutoSkillFx {
  dmgMult: number; hits?: number; ignoreDef?: boolean; guaranteedCrit?: boolean;
  statusType?: "stun" | "poison" | "bleed" | "bind";
  statusChance?: number; statusTurns?: number;
  healPct?: number; cleanse?: boolean; lifestealPct?: number;
}
const AUTO_SKILL_FX: Partial<Record<SpecialSkillId, AutoSkillFx>> = {
  sharp_claws:   { dmgMult: 1.4 },
  quick_dodge:   { dmgMult: 0 },
  focus:         { dmgMult: 1.0, guaranteedCrit: true },
  intimidate_sm: { dmgMult: 0.6, statusType: "bind", statusChance: 0.3, statusTurns: 2 },
  hiss:          { dmgMult: 0, statusType: "stun", statusChance: 0.3, statusTurns: 2 },
  grooming:      { dmgMult: 0, healPct: 0.10 },
  warm_nap:      { dmgMult: 0, healPct: 0.08 },
  tail_whip:     { dmgMult: 1.0, ignoreDef: true },
  claw_flurry:   { dmgMult: 0.6, hits: 2 },
  body_slam:     { dmgMult: 1.3 },
  freeze:        { dmgMult: 0, statusType: "stun", statusChance: 0.45, statusTurns: 2 },
  scratch:       { dmgMult: 0.8, statusType: "bleed", statusChance: 1, statusTurns: 3 },
  intimidate:    { dmgMult: 0, statusType: "stun", statusChance: 0.55, statusTurns: 2 },
  pounce:        { dmgMult: 1.1, ignoreDef: true },
  ambush:        { dmgMult: 1.2, guaranteedCrit: true },
  static_shock:  { dmgMult: 0, statusType: "stun", statusChance: 0.3, statusTurns: 2 },
  night_prowl:   { dmgMult: 1.1 },
  thunderclap:   { dmgMult: 0.6, statusType: "stun", statusChance: 0.25, statusTurns: 2 },
  cold_glare:    { dmgMult: 0, statusType: "stun", statusChance: 0.3, statusTurns: 2 },
  dash_strike:   { dmgMult: 1.5 },
  poison:        { dmgMult: 0.7, statusType: "poison", statusChance: 1, statusTurns: 4 },
  bind:          { dmgMult: 0, statusType: "bind", statusChance: 0.65, statusTurns: 3 },
  slow:          { dmgMult: 0, statusType: "stun", statusChance: 0.6, statusTurns: 2 },
  double_strike: { dmgMult: 0.8, hits: 2 },
  rend:          { dmgMult: 1.0, ignoreDef: true, statusType: "bleed", statusChance: 1, statusTurns: 3 },
  howl:          { dmgMult: 0, statusType: "bind", statusChance: 0.65, statusTurns: 3 },
  frenzy:        { dmgMult: 1.6 },
  curse:         { dmgMult: 0.7, statusType: "poison", statusChance: 1, statusTurns: 5 },
  venom_fang:    { dmgMult: 1.1, statusType: "poison", statusChance: 1, statusTurns: 4 },
  shockwave:     { dmgMult: 1.7 },
  vampirism:     { dmgMult: 1.2, lifestealPct: 0.3 },
  invincible:    { dmgMult: 0 },
  dominate:      { dmgMult: 1.0, ignoreDef: true, statusType: "bind", statusChance: 1, statusTurns: 3 },
  regen:         { dmgMult: 0, healPct: 0.12 },
  eclipse:       { dmgMult: 1.3, healPct: 0.15 },
  overdrive:     { dmgMult: 1.8 },
  meteor:        { dmgMult: 2.0 },
  cleanse:       { dmgMult: 0, healPct: 0.10, cleanse: true },
  judgment:      { dmgMult: 1.2, statusType: "stun", statusChance: 0.55, statusTurns: 2 },
  apocalypse_strike: { dmgMult: 2.2 },
};
const DEFAULT_FX: AutoSkillFx = { dmgMult: 1.2 };

// 기본공격/방어 가상 액션 ID — 실제 SpecialSkillId가 아니라 자체 예약어.
const AUTO_NORMAL = "__normal__";
const AUTO_GUARD = "__guard__";
const AUTO_GUARD_USES = 5; // 수동 배틀의 GUARD_USES와 동일 — 방어는 배틀당 5회로 제한

interface AutoSideState {
  stun: number; poison: number; bleed: number; bind: number;
  cds: Record<string, number>;
  guarding: boolean; // 이번에 방어를 써서 다음에 맞을 때 피해 감소가 적용될 차례
  guardUses: number;
}

// 스킬 4개가 전부 쿨다운 중이면(또는 방어를 골랐으면) 기본공격/방어로 대체한다.
// 예전엔 "쿨다운 중인 스킬 전부"를 그냥 무시하고 스킬 풀 전체에서 다시 뽑아버려서
// 쿨다운이 사실상 의미가 없었고, 기본공격/방어 개념 자체가 없어 자동전투에서
// 둘 다 한 번도 안 쓰이는 문제가 있었음.
function pickAutoAction(skills: string[], state: AutoSideState, hpRatio: number, targetVulnerable: boolean): string {
  const available = skills.filter(id => (state.cds[id] ?? 0) === 0);

  if (hpRatio < 0.35) {
    const heal = available.find(id => (AUTO_SKILL_FX[id as SpecialSkillId]?.healPct ?? 0) > 0);
    if (heal && Math.random() < 0.6) return heal;
  }
  if (!targetVulnerable) {
    const cc = available.filter(id => AUTO_SKILL_FX[id as SpecialSkillId]?.statusType);
    if (cc.length > 0 && Math.random() < 0.35) return cc[Math.floor(Math.random() * cc.length)];
  }

  // 체력이 애매하게 낮고 상대를 확실히 끝낼 타이밍이 아니면, 가끔 방어로 버틴다.
  const guardReady = state.guardUses > 0 && (state.cds[AUTO_GUARD] ?? 0) === 0;
  if (guardReady && hpRatio < 0.55 && !targetVulnerable && Math.random() < 0.25) return AUTO_GUARD;

  if (available.length > 0) {
    const weighted = available.map(id => ({ id, w: Math.max(0.3, AUTO_SKILL_FX[id as SpecialSkillId]?.dmgMult ?? 1) }));
    const total = weighted.reduce((s, w) => s + w.w, 0);
    let r = Math.random() * total;
    for (const w of weighted) { r -= w.w; if (r <= 0) return w.id; }
    return weighted[0].id;
  }

  // 스킬이 전부 쿨다운 중이면 기본공격(무제한, 항상 가능)으로
  return AUTO_NORMAL;
}

function simulateBattle(attacker: CardCat, defender: CardCat) {
  const as = calcStats(attacker);
  const ds = calcStats(defender);
  let aHp = as.hp, dHp = ds.hp;
  const aMaxHp = as.hp, dMaxHp = ds.hp;
  const log: AutoLogEntry[] = [];
  let turn = 0;
  const MAX_TURNS = 40; // 상태이상으로 기절 턴이 끼어들 수 있어 여유 있게

  const aSkills = [attacker.battle_special, attacker.battle_special2, attacker.battle_special3, attacker.battle_special4]
    .map(id => id ?? "sharp_claws");
  const dSkills = [defender.battle_special, defender.battle_special2, defender.battle_special3, defender.battle_special4]
    .map(id => id ?? "sharp_claws");

  const aState: AutoSideState = { stun: 0, poison: 0, bleed: 0, bind: 0, cds: {}, guarding: false, guardUses: AUTO_GUARD_USES };
  const dState: AutoSideState = { stun: 0, poison: 0, bleed: 0, bind: 0, cds: {}, guarding: false, guardUses: AUTO_GUARD_USES };

  let aTurn = as.spd >= ds.spd;

  while (aHp > 0 && dHp > 0 && turn < MAX_TURNS) {
    turn++;
    const actorIsA = aTurn;
    const atkSt = actorIsA ? as : ds;
    const defSt = actorIsA ? ds : as;
    const atkState = actorIsA ? aState : dState;
    const defState = actorIsA ? dState : aState;
    const atkSkills = actorIsA ? aSkills : dSkills;
    const atkName = actorIsA ? attacker.name : defender.name;
    const atkMaxHp = actorIsA ? aMaxHp : dMaxHp;
    const atkHp = actorIsA ? aHp : dHp;

    if (atkState.stun > 0) {
      atkState.stun--;
      log.push({ turn, actor: atkName, dmg: 0, aHp, dHp, isCritical: false, isDodge: false, isCounterAttack: false, skillName: "기절", isDot: false, isStunSkip: true });
      aTurn = !aTurn;
      continue;
    }

    const skillId = pickAutoAction(atkSkills, atkState, atkHp / atkMaxHp, defState.stun > 0 || defState.bind > 0);
    const isGuardAction = skillId === AUTO_GUARD;
    const isNormalAction = skillId === AUTO_NORMAL;
    const fx: AutoSkillFx = isGuardAction || isNormalAction
      ? { dmgMult: isNormalAction ? 1.0 : 0 }
      : (AUTO_SKILL_FX[skillId as SpecialSkillId] ?? DEFAULT_FX);
    // 스킬만 쿨다운 — 기본공격은 무제한, 방어는 횟수+쿨다운 둘 다 소모
    if (!isGuardAction && !isNormalAction) atkState.cds[skillId] = 5;
    if (isGuardAction) { atkState.guarding = true; atkState.guardUses--; atkState.cds[AUTO_GUARD] = 3; }

    // 속박 소모(회피 불가) — 새 속박 적용보다 먼저 처리
    const wasBound = defState.bind > 0;
    if (defState.bind > 0) defState.bind--;

    const isDodge = !wasBound && !isGuardAction && Math.random() * 100 < defSt.eva;
    let dmg = 0, isCritical = false;
    if (!isDodge && fx.dmgMult > 0) {
      const counterBoost = atkHp < atkMaxHp * 0.25 ? 1.3 : 1.0;
      const hits = fx.hits ?? 1;
      const def = fx.ignoreDef ? defSt.def * 0.3 : defSt.def;
      for (let h = 0; h < hits; h++) {
        const hitCrit = fx.guaranteedCrit || Math.random() * 100 < atkSt.crit;
        if (hitCrit) isCritical = true;
        const base = Math.max(5, Math.round((atkSt.atk - def * 0.4) * rnd(0.80, 1.30) * counterBoost));
        dmg += Math.round(base * fx.dmgMult * (hitCrit ? 2.0 : 1.0));
      }
      // 상대가 방어 중이면 이번 피해 40% 감소 (수동 배틀과 동일한 배율)
      if (dmg > 0 && defState.guarding) { dmg = Math.round(dmg * 0.6); defState.guarding = false; }
    }

    let appliedStatus: { type: "stun"|"poison"|"bleed"|"bind"; turns: number } | null = null;
    if (!isDodge && fx.statusType && Math.random() < (fx.statusChance ?? 1)) {
      const turns = fx.statusTurns ?? (fx.statusType === "poison" ? 4 : fx.statusType === "bleed" ? 3 : 2);
      if (fx.statusType === "stun") defState.stun = turns;
      else if (fx.statusType === "bind") defState.bind = turns;
      else if (fx.statusType === "poison") defState.poison = turns;
      else if (fx.statusType === "bleed") defState.bleed = turns;
      appliedStatus = { type: fx.statusType, turns };
    }

    if (dmg > 0) { if (actorIsA) dHp = Math.max(0, dHp - dmg); else aHp = Math.max(0, aHp - dmg); }
    if (fx.healPct) {
      const heal = Math.round(atkMaxHp * fx.healPct);
      if (actorIsA) aHp = Math.min(aMaxHp, aHp + heal); else dHp = Math.min(dMaxHp, dHp + heal);
    }
    if (fx.lifestealPct && dmg > 0) {
      const heal = Math.round(dmg * fx.lifestealPct);
      if (actorIsA) aHp = Math.min(aMaxHp, aHp + heal); else dHp = Math.min(dMaxHp, dHp + heal);
    }
    if (fx.cleanse) { atkState.poison = 0; atkState.bleed = 0; atkState.bind = 0; atkState.stun = 0; }

    log.push({
      turn, actor: atkName, dmg, aHp, dHp, isCritical, isDodge,
      isCounterAttack: atkHp < atkMaxHp * 0.25,
      skillName: isNormalAction ? "기본 공격" : isGuardAction ? "🛡️ 방어 자세" : (SPECIAL_SKILLS[skillId as SpecialSkillId]?.name ?? "공격"),
      skillId, isDot: false,
      statusType: appliedStatus?.type, statusTurns: appliedStatus?.turns,
    });

    // 한 라운드(양쪽 모두 행동) 종료 시 도트 틱 + 쿨다운 감소
    if (turn % 2 === 0) {
      let aDot = 0, dDot = 0;
      if (aState.poison > 0) { aDot += 8; aState.poison--; }
      if (aState.bleed  > 0) { aDot += 5; aState.bleed--; }
      if (dState.poison > 0) { dDot += 8; dState.poison--; }
      if (dState.bleed  > 0) { dDot += 5; dState.bleed--; }
      if (aDot > 0) { aHp = Math.max(0, aHp - aDot); log.push({ turn, actor: attacker.name, dmg: aDot, aHp, dHp, isCritical:false, isDodge:false, isCounterAttack:false, skillName: "☠️ 상태이상 피해", isDot: true }); }
      if (dDot > 0) { dHp = Math.max(0, dHp - dDot); log.push({ turn, actor: defender.name, dmg: dDot, aHp, dHp, isCritical:false, isDodge:false, isCounterAttack:false, skillName: "☠️ 상태이상 피해", isDot: true }); }
      for (const k in aState.cds) aState.cds[k] = Math.max(0, aState.cds[k] - 1);
      for (const k in dState.cds) dState.cds[k] = Math.max(0, dState.cds[k] - 1);
      if (aHp <= 0 || dHp <= 0) break;
    }

    aTurn = !aTurn;
  }

  const attackerWins = aHp >= dHp;
  return { attackerWins, aHp, dHp, aMaxHp, dMaxHp, rounds: turn, log };
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { my_cat_id, mode = "auto", battle_type = "pve" } = await req.json();
  if (!my_cat_id) return NextResponse.json({ error: "my_cat_id required" }, { status: 400 });

  // 내 카드 조회
  const { data: myCat } = await supabase
    .from("cats")
    .select("id,name,photo_url,caretaker_id,card_level,card_exp,card_rarity,card_name,card_traits,card_stats,battle_atk,battle_def,battle_eva,battle_crit,battle_special,battle_special2,battle_special3,battle_special4,win_streak,best_win_streak,pve_win_count")
    .eq("id", my_cat_id)
    .eq("caretaker_id", user.id)
    .not("card_generated_at", "is", null)
    .maybeSingle();

  if (!myCat) return NextResponse.json({ error: "cat not found" }, { status: 404 });

  // PVE("평소에" 하는 기본 모드) → 항상 고양이학대범과 대결. PVP는 실제 다른 유저 카드와 매칭.
  const isBossEncounter = battle_type === "pve";
  let opponent: CardCat;

  if (isBossEncounter) {
    opponent = makePveOpponent(myCat as CardCat);
  } else {
    // 상대 선택 — 가능하면 같은 등급으로, 없으면 인근 등급으로 확대
    const NEARBY_RARITIES: Record<string, string[]> = {
      common: ["common", "uncommon"],
      uncommon: ["common", "uncommon", "rare"],
      rare: ["uncommon", "rare", "legendary"],
      legendary: ["rare", "legendary"],
    };
    const myRarity = myCat.card_rarity ?? "common";
    const OPP_COLS = "id,name,photo_url,caretaker_id,card_level,card_exp,card_rarity,card_name,card_traits,card_stats,battle_atk,battle_def,battle_eva,battle_crit,battle_special,battle_special2,battle_special3,battle_special4,win_streak";

    const { data: sameRarityOpponents } = await supabase
      .from("cats")
      .select(OPP_COLS)
      .neq("caretaker_id", user.id)
      .eq("card_rarity", myRarity)
      .not("card_generated_at", "is", null)
      .limit(50);

    let opponents = sameRarityOpponents;
    if (!opponents || opponents.length === 0) {
      const matchRarities = NEARBY_RARITIES[myRarity] ?? ["common"];
      const { data: nearbyOpponents } = await supabase
        .from("cats")
        .select(OPP_COLS)
        .neq("caretaker_id", user.id)
        .in("card_rarity", matchRarities)
        .not("card_generated_at", "is", null)
        .limit(50);
      opponents = nearbyOpponents;
    }

    if (!opponents || opponents.length === 0) {
      return NextResponse.json({ error: "no_opponents" }, { status: 404 });
    }

    // 승률 50%(팽팽한 접전)를 노려 매칭. 예전엔 자동전투만 45%(무관심 파밍 방지 목적)로
    // 일부러 불리하게, 수동은 완전 랜덤으로 뽑았는데 — 실측해보니 자동전투는 "너무 자주 짐",
    // 수동은 상대 뽑기 운에 따라 압승/완패가 갈리는 문제가 있었음("적당히 밸런스" 피드백).
    // 이제 둘 다 같은 방식으로 매칭하되, 상위 25% 후보 중 랜덤 선택은 유지해서
    // (pickByTargetWinRate 내부) 매번 100% 예측 가능한 접전이 되진 않게 약간의 변수는 남겨둔다.
    opponent = pickByTargetWinRate(myCat as CardCat, opponents as CardCat[], 0.50);
  }

  // 수동 배틀: 스탯만 반환 (시뮬레이션 없음)
  if (mode === "manual") {
    return NextResponse.json({
      my_cat: myCat,
      opponent,
      my_stats: calcStats(myCat as CardCat),
      opp_stats: calcStats(opponent),
      is_boss: isBossEncounter,
    });
  }

  // 자동 배틀 시뮬레이션
  const result = simulateBattle(myCat as CardCat, opponent);

  // EXP 지급
  const svc = serviceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const winnerExp = 14, loserExp = 5;
  const myNewExp  = (myCat.card_exp ?? 0) + (result.attackerWins ? winnerExp : loserExp);
  const oppNewExp = (opponent.card_exp ?? 0) + (result.attackerWins ? loserExp : winnerExp);

  function computeLevel(exp: number) {
    const thresholds = [0, 90, 210, 380, 610, 900, 1260, 1690, 2200, 2800];
    for (let i = thresholds.length - 1; i >= 0; i--) {
      if (exp >= thresholds[i]) return i + 1;
    }
    return 1;
  }

  const { data: myProfile } = await svc.from("profiles").select("coins").eq("id", user.id).maybeSingle();
  const myCoinsNow = myProfile?.coins ?? 0;
  const coinsGained = isBossEncounter
    ? (result.attackerWins ? COINS_BOSS_WIN : COINS_BOSS_LOSE)
    : (result.attackerWins ? COINS_BATTLE_WIN : COINS_BATTLE_LOSE);
  const newCoins = Math.max(0, myCoinsNow + coinsGained);
  const myNewStreak  = result.attackerWins ? (myCat.win_streak ?? 0) + 1 : 0;
  const oppNewStreak = result.attackerWins ? 0 : (opponent.win_streak ?? 0) + 1;
  // 카드 훈장(성장 스티커)용 all-time 기록 — win_streak과 달리 지더라도 절대 줄어들지 않는다.
  const myNewBestStreak = Math.max(myCat.best_win_streak ?? 0, myNewStreak);
  const oppNewBestStreak = Math.max(opponent.best_win_streak ?? 0, oppNewStreak);
  const myNewPveWins = (myCat.pve_win_count ?? 0) + (isBossEncounter && result.attackerWins ? 1 : 0);

  // 배틀 타이틀 카운터 — box/supabase_battle_titles_migration.sql 실행 전이면 조용히 0으로 취급될 뿐,
  // 코인 지급(위 newCoins)과는 완전히 분리된 쿼리라 마이그레이션 여부와 무관하게 안전함
  const { data: battleProfile } = await svc.from("profiles").select("boss_defeats,best_win_streak").eq("id", user.id).maybeSingle();
  const newBossDefeats = (battleProfile?.boss_defeats ?? 0) + (isBossEncounter && result.attackerWins ? 1 : 0);
  const newBestStreak = Math.max(battleProfile?.best_win_streak ?? 0, myNewStreak);

  await Promise.all([
    svc.from("cats").update({ card_exp: myNewExp,  card_level: computeLevel(myNewExp),  win_streak: myNewStreak, best_win_streak: myNewBestStreak, pve_win_count: myNewPveWins }).eq("id", myCat.id),
    isBossEncounter ? Promise.resolve() : svc.from("cats").update({ card_exp: oppNewExp, card_level: computeLevel(oppNewExp), win_streak: oppNewStreak, best_win_streak: oppNewBestStreak }).eq("id", opponent.id),
    svc.from("profiles").update({ coins: newCoins }).eq("id", user.id),
    svc.from("profiles").update({ boss_defeats: newBossDefeats, best_win_streak: newBestStreak }).eq("id", user.id),
    isBossEncounter ? Promise.resolve() : svc.from("card_battles").insert({
      challenger_id:     user.id,
      challenger_cat_id: myCat.id,
      opponent_id:       opponent.caretaker_id,
      opponent_cat_id:   opponent.id,
      winner_id:         result.attackerWins ? user.id : opponent.caretaker_id,
      challenger_hp_left: result.aHp,
      opponent_hp_left:   result.dHp,
      rounds:             result.rounds,
      battle_log:         result.log,
    }),
  ]);

  return NextResponse.json({
    my_cat: myCat,
    opponent,
    is_boss: isBossEncounter,
    result: {
      winner: result.attackerWins ? "me" : "opponent",
      my_hp_left: result.aHp,
      opp_hp_left: result.dHp,
      my_max_hp: result.aMaxHp,
      opp_max_hp: result.dMaxHp,
      rounds: result.rounds,
      log: result.log,
      exp_gained: result.attackerWins ? winnerExp : loserExp,
      my_new_level: computeLevel(myNewExp),
      leveled_up: computeLevel(myNewExp) > (myCat.card_level ?? 1),
      coins_gained: coinsGained,
      coins_total: newCoins,
    },
  });
}
