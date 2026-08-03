// 자동전투 엔진 — 냥줍 lib/battle-engine.ts 이식 (2026-08-04 P4).
// HTTP/DB 없이 카드 두 장으로 승부를 시뮬레이션하는 순수 로직.
// 라우트(app/api/catch/battle)·매칭·테스트가 전부 이 한 파일을 공유하므로,
// 밸런스 숫자는 여기서만 고친다.
//
// 냥줍 대비 변경:
//  · SPECIAL_SKILLS는 city lib/battle-config.ts(동일 계보, P2 capture가 이미 사용) 재사용.
//  · 장착 아이템(applyEquipBonuses/shop-config) 미이식 — city 상점은 배틀 장비를 팔지
//    않아 catch_cards.equipped_slots가 항상 '{}'. 스탯 계산에서 장비 보정을 제거해도
//    동작이 동일하므로 의존성째 뺐다(복원 시 냥줍 lib/shop-config.ts EquipEffect 참조).
//  · CardCat에 species_key 추가 — city 포획 카드는 실사 대신 종 아트를 그린다.
import { SPECIAL_SKILLS, type SpecialSkillId } from "@/lib/battle-config";

export interface CardCat {
  id: string;
  photo_url: string | null;
  owner_id: string;
  card_level: number;
  card_exp: number;
  card_rarity: string;
  card_name: string | null;
  card_traits: string[] | null;
  card_stats: { cuteness: number; wildness: number; sociability: number; mysteriousness: number } | null;
  card_flavor?: string | null;
  /** city 종 아트 키 — PVE 합성 상대는 null(이모지/로컬 에셋으로 표시) */
  species_key?: string | null;
  battle_atk: number | null;
  battle_def: number | null;
  battle_eva: number | null;
  battle_crit: number | null;
  battle_special: string | null;
  battle_special2: string | null;
  battle_special3: string | null;
  battle_special4: string | null;
  win_streak: number | null;
  // 카드 훈장 계산용 — 리셋 없는 all-time 기록.
  best_win_streak?: number | null;
  pve_win_count?: number | null;
  // PVP/PVE 승·패·무 전적 — 카드 상세에 표시.
  pvp_wins?: number | null;
  pvp_losses?: number | null;
  pvp_draws?: number | null;
  pve_losses?: number | null;
  pve_draws?: number | null;
  // PVE 상대(빌런 이외의 야생동물)는 실제 사진이 없어 이모지로 표시 — 유저 카드는 항상 null.
  placeholder_emoji?: string | null;
  // 테두리 코스메틱 — 스탯엔 영향 없고 배틀 화면 카드 표시용. PVE 합성 상대는 항상 null.
  equipped_border_key?: string | null;
  // PVE 전용 HP 배율(밸런스 패치 2026-07-12). 유저 카드는 항상 undefined — calcStats에서 1로 취급.
  pve_hp_mult?: number;
}

// 등급별 HP 보너스: 일반→레전드로 갈수록 체력이 두껍게
// 밸런스 패치(2026-07-13 시뮬 기반): 등급 벽 완화 — 한 등급 차 승률 95:5 → 75:25 목표
export const RARITY_HP_BONUS: Record<string, number> = { common:0, uncommon:30, rare:58, legendary:90 };

// PVE 상대의 레벨은 내 레벨의 절반만 따라온다 — 레벨업할수록 PVE가 어려워지는 역진행 방지.
function pveLevelFor(myLevel: number): number {
  return 1 + Math.floor((Math.max(1, myLevel) - 1) / 2);
}

// 고양이학대범(PVE) — 실제 유저 카드 대신 등장하는 스크립트 상대.
// DB에 존재하지 않는 고정 id라서 결과 기록 시 상대 카드/유저 업데이트는 건너뛴다.
export const BOSS_CAT_ID = "00000000-0000-0000-0000-0000000000b0";

// 등급별 보스 배율 - 보스 스탯이 내 스탯에서 파생되다 보니 단일 배율로는
// "common은 가끔, legendary는 절반쯤 이긴다"를 동시에 못 맞춘다(시뮬 실측).
const BOSS_TUNE: Record<string, { hp: number; atk: number }> = {
  common:    { hp: 1.45, atk: 0.95 },
  uncommon:  { hp: 1.75, atk: 1.00 },
  rare:      { hp: 1.90, atk: 1.03 },
  legendary: { hp: 2.10, atk: 1.05 },
};

export function makeBossOpponent(myCat: CardCat): CardCat {
  const baseAtk = myCat.battle_atk ?? 40;
  const baseDef = myCat.battle_def ?? 25;
  const bt = BOSS_TUNE[myCat.card_rarity ?? "common"] ?? BOSS_TUNE.common;
  return {
    id: BOSS_CAT_ID,
    photo_url: "/boss/villain-card.jpg",
    owner_id: BOSS_CAT_ID,
    card_level: pveLevelFor(myCat.card_level ?? 1),
    card_exp: 0,
    card_rarity: myCat.card_rarity ?? "common",
    card_name: "고양이 학대범",
    card_traits: ["그물 던지기", "위협하기", "괴롭히기"],
    card_stats: { cuteness: 20, wildness: 75, sociability: 15, mysteriousness: 65 },
    card_flavor: "길고양이를 괴롭히는 나쁜 사람. 반드시 혼내줘야 한다!",
    battle_atk: Math.round(baseAtk * bt.atk) + 2,
    battle_def: Math.round(baseDef * 1.05) + 2,
    battle_eva: 10,
    battle_crit: 12,
    pve_hp_mult: bt.hp,
    battle_special: "bind",
    battle_special2: "intimidate",
    battle_special3: "curse",
    battle_special4: "dominate",
    win_streak: 0,
  };
}

// PVE 야생동물 로스터 — 우리 동네 아이가 실제로 마주칠 법한 잡다한 불청객들.
// 사진 에셋이 없으면 이모지(placeholder_emoji)로 표시, 체력/공격력은 내 카드 스탯 대비 배율.
export interface PveCreature {
  key: string; name: string; emoji: string; flavor: string;
  atkMult: number; defMult: number; eva: number; crit: number;
  hpMult?: number; // 종별 HP 배율(기본 1.7) - 잔챙이는 얇게(속전), 대형은 두껍게
  traits: [string, string]; stats: { cuteness: number; wildness: number; sociability: number; mysteriousness: number };
  skills: [string, string, string, string];
}
// 로스터는 분류군별로 묶고, 각 분류군 안에서는 약한 순으로 정렬(패턴 감 잡기 쉽게).
export const PVE_ROSTER: PveCreature[] = [
  // ── 곤충·벌레류 (약한 순) ──
  { key: "slug", name: "민달팽이", emoji: "🐌", flavor: "느릿느릿 끈적한 자국을 남기며 기어가는 무해해 보이는 불청객",
    atkMult: 0.3, defMult: 0.20, eva: 4, crit: 5, hpMult: 1.15,
    traits: ["끈적한 점액", "느릿느릿 전진"], stats: { cuteness: 30, wildness: 5, sociability: 5, mysteriousness: 10 },
    skills: ["tail_whip", "sharp_claws", "regen", "scratch"] },
  { key: "mosquito", name: "모기", emoji: "🦟", flavor: "귓가에서 앵앵대다 따끔하게 무는 작은 불청객",
    atkMult: 0.42, defMult: 0.18, eva: 22, crit: 9, hpMult: 1.2,
    traits: ["앵앵 소리", "따끔한 침"], stats: { cuteness: 5, wildness: 10, sociability: 5, mysteriousness: 15 },
    skills: ["quick_dodge", "venom_fang", "tail_whip", "sharp_claws"] },
  { key: "fly", name: "파리", emoji: "🪰", flavor: "밥상 위를 맴돌며 성가시게 구는 잽싼 불청객",
    atkMult: 0.46, defMult: 0.22, eva: 21, crit: 8, hpMult: 1.2,
    traits: ["잽싼 날갯짓", "성가신 맴돌기"], stats: { cuteness: 5, wildness: 12, sociability: 8, mysteriousness: 10 },
    skills: ["quick_dodge", "dash_strike", "tail_whip", "sharp_claws"] },
  { key: "spider", name: "거미", emoji: "🕷️", flavor: "구석에 거미줄을 친 작은 사냥꾼",
    atkMult: 0.44, defMult: 0.26, eva: 18, crit: 10, hpMult: 1.25,
    traits: ["거미줄 치기", "살금살금 접근"], stats: { cuteness: 8, wildness: 20, sociability: 5, mysteriousness: 35 },
    skills: ["bind", "quick_dodge", "sharp_claws", "scratch"] },
  { key: "ant", name: "개미", emoji: "🐜", flavor: "떼로 몰려와 성가시게 무는 작은 불청객",
    atkMult: 0.46, defMult: 0.25, eva: 15, crit: 9, hpMult: 1.25,
    traits: ["떼로 몰려오기", "작은 턱"], stats: { cuteness: 15, wildness: 20, sociability: 15, mysteriousness: 10 },
    skills: ["double_strike", "sharp_claws", "quick_dodge", "tail_whip"] },
  { key: "roach", name: "바퀴벌레", emoji: "🪳", flavor: "부엌을 어지럽히던 잽싼 침입자",
    atkMult: 0.48, defMult: 0.30, eva: 20, crit: 8, hpMult: 1.3,
    traits: ["잽싼 발놀림", "깜짝 도주"], stats: { cuteness: 10, wildness: 15, sociability: 5, mysteriousness: 10 },
    skills: ["quick_dodge", "tail_whip", "claw_flurry", "sharp_claws"] },
  { key: "centipede", name: "지네", emoji: "🐛", flavor: "돌 틈에서 스멀스멀 기어나온 다리 많은 불청객",
    atkMult: 0.51, defMult: 0.28, eva: 16, crit: 11, hpMult: 1.3,
    traits: ["다리 많은 질주", "독니 물기"], stats: { cuteness: 5, wildness: 25, sociability: 5, mysteriousness: 30 },
    skills: ["venom_fang", "quick_dodge", "sharp_claws", "scratch"] },
  { key: "wasp", name: "말벌", emoji: "🐝", flavor: "건드리면 위험한 노란 침입자",
    atkMult: 0.56, defMult: 0.30, eva: 16, crit: 13, hpMult: 1.45,
    traits: ["따끔한 침", "윙윙 위협"], stats: { cuteness: 5, wildness: 45, sociability: 5, mysteriousness: 30 },
    skills: ["venom_fang", "poison", "static_shock", "dash_strike"] },

  // ── 포유류 (약한 순) ──
  { key: "mouse", name: "생쥐", emoji: "🐭", flavor: "찬장 밑에서 튀어나온 작은 도둑",
    atkMult: 0.53, defMult: 0.35, eva: 17, crit: 8, hpMult: 1.35,
    traits: ["살금살금", "작은 이빨"], stats: { cuteness: 20, wildness: 20, sociability: 10, mysteriousness: 15 },
    skills: ["quick_dodge", "scratch", "tail_whip", "sharp_claws"] },
  { key: "mole", name: "두더지", emoji: "🕳️", flavor: "땅굴 속에서 갑자기 튀어나오는 기습꾼",
    atkMult: 0.6, defMult: 0.48, eva: 12, crit: 10, hpMult: 1.5,
    traits: ["땅굴 기습", "억센 앞발"], stats: { cuteness: 25, wildness: 20, sociability: 5, mysteriousness: 25 },
    skills: ["ambush", "body_slam", "bind", "scratch"] },
  { key: "rat", name: "쥐", emoji: "🐀", flavor: "하수구를 누비는 덩치 큰 쥐",
    atkMult: 0.56, defMult: 0.45, eva: 16, crit: 10, hpMult: 1.55,
    traits: ["날카로운 이빨", "질긴 생명력"], stats: { cuteness: 15, wildness: 35, sociability: 10, mysteriousness: 20 },
    skills: ["venom_fang", "scratch", "rend", "body_slam"] },
  { key: "deer", name: "고라니", emoji: "🦌", flavor: "도로 위로 불쑥 튀어나오는 의외의 복병 — 뜻밖의 송곳니를 숨기고 있다",
    atkMult: 0.6, defMult: 0.40, eva: 14, crit: 11, hpMult: 1.45,
    traits: ["껑충 도약", "숨겨진 송곳니"], stats: { cuteness: 45, wildness: 45, sociability: 15, mysteriousness: 35 },
    skills: ["dash_strike", "pounce", "quick_dodge", "ambush"] },
  { key: "marten", name: "담비", emoji: "🦫", flavor: "나뭇가지 사이를 날렵하게 넘나드는 재빠른 사냥꾼",
    atkMult: 0.64, defMult: 0.45, eva: 15, crit: 13, hpMult: 1.5,
    traits: ["날쌘 도약", "예리한 이빨"], stats: { cuteness: 30, wildness: 55, sociability: 10, mysteriousness: 40 },
    skills: ["dash_strike", "ambush", "night_prowl", "sharp_claws"] },
  { key: "weasel", name: "족제비", emoji: "🐿️", flavor: "밤에만 움직이는 날렵한 침입자",
    atkMult: 0.66, defMult: 0.55, eva: 14, crit: 14, hpMult: 1.5,
    traits: ["날렵한 몸놀림", "기습 발톱"], stats: { cuteness: 25, wildness: 55, sociability: 15, mysteriousness: 45 },
    skills: ["dash_strike", "claw_flurry", "ambush", "night_prowl"] },
  { key: "badger", name: "오소리", emoji: "🦡", flavor: "땅을 파헤치며 버티는 억센 불청객",
    atkMult: 0.62, defMult: 0.62, eva: 10, crit: 9, hpMult: 1.75,
    traits: ["억센 발톱", "질긴 가죽"], stats: { cuteness: 20, wildness: 60, sociability: 15, mysteriousness: 35 },
    skills: ["claw_flurry", "rend", "body_slam", "intimidate"] },
  { key: "raccoon", name: "너구리", emoji: "🦝", flavor: "쓰레기통을 뒤지는 덩치 큰 불청객",
    atkMult: 0.64, defMult: 0.6, eva: 9, crit: 8, hpMult: 1.75,
    traits: ["묵직한 몸통박치기", "날카로운 발톱"], stats: { cuteness: 30, wildness: 60, sociability: 20, mysteriousness: 40 },
    skills: ["body_slam", "claw_flurry", "intimidate", "frenzy"] },
  { key: "boar", name: "멧돼지", emoji: "🐗", flavor: "산에서 마을로 내려온 묵직한 돌진꾼",
    atkMult: 0.67, defMult: 0.7, eva: 6, crit: 10, hpMult: 1.8,
    traits: ["묵직한 돌진", "날카로운 엄니"], stats: { cuteness: 15, wildness: 80, sociability: 10, mysteriousness: 30 },
    skills: ["body_slam", "rend", "frenzy", "intimidate"] },

  // ── 조류 (약한 순) ──
  { key: "pigeon", name: "비둘기", emoji: "🐦", flavor: "전깃줄 위의 뻔뻔한 불청객",
    atkMult: 0.6, defMult: 0.40, eva: 18, crit: 10, hpMult: 1.3,
    traits: ["푸드덕 날갯짓", "부리 쪼기"], stats: { cuteness: 25, wildness: 30, sociability: 20, mysteriousness: 15 },
    skills: ["quick_dodge", "pounce", "tail_whip", "dash_strike"] },
  { key: "crow", name: "까마귀", emoji: "🐦‍⬛", flavor: "영리하게 약 올리는 검은 그림자",
    atkMult: 0.62, defMult: 0.50, eva: 18, crit: 12, hpMult: 1.4,
    traits: ["약 올리는 울음", "급강하 공격"], stats: { cuteness: 20, wildness: 40, sociability: 15, mysteriousness: 50 },
    skills: ["intimidate", "hiss", "ambush", "thunderclap"] },
  { key: "hawk", name: "황조롱이", emoji: "🦅", flavor: "하늘에서 노려보는 진짜 위협 — 사냥하는 입장이 뒤바뀌는 상대",
    atkMult: 0.58, defMult: 0.50, eva: 15, crit: 12, hpMult: 1.65,
    traits: ["급강하 발톱", "매서운 눈매"], stats: { cuteness: 15, wildness: 65, sociability: 10, mysteriousness: 55 },
    skills: ["pounce", "ambush", "dash_strike", "judgment"] },
  { key: "owl", name: "부엉이", emoji: "🦉", flavor: "소리 없이 다가와 매서운 눈으로 노려보는 밤의 사냥꾼",
    atkMult: 0.7, defMult: 0.52, eva: 16, crit: 15, hpMult: 1.65,
    traits: ["소리 없는 비행", "매서운 눈빛"], stats: { cuteness: 20, wildness: 60, sociability: 10, mysteriousness: 70 },
    skills: ["night_prowl", "ambush", "pounce", "cold_glare"] },

  // ── 파충류 ──
  { key: "snake", name: "뱀", emoji: "🐍", flavor: "담벼락 틈에서 스르륵 나타난 서늘한 불청객",
    atkMult: 0.58, defMult: 0.35, eva: 20, crit: 12, hpMult: 1.5,
    traits: ["스르륵 접근", "독니 물기"], stats: { cuteness: 10, wildness: 50, sociability: 5, mysteriousness: 40 },
    skills: ["venom_fang", "poison", "bind", "ambush"] },
];

// 실제 사진이 준비된 PVE 로스터 키 — public/pve/{key}.jpg 로 존재.
export const PVE_PHOTO_KEYS = new Set([
  "mosquito", "fly", "centipede", "slug", "ant", "roach", "mouse", "rat", "pigeon",
  "wasp", "crow", "raccoon", "spider", "weasel", "hawk", "owl", "snake",
  "boar", "deer", "badger", "marten", "mole",
]);

// PVE 야생동물 상대 합성 — 종별 상대 배율(atkMult/defMult)을 내 카드 스탯에 곱한다.
export function makeCreatureOpponent(myCat: CardCat, c: PveCreature): CardCat {
  const baseAtk = myCat.battle_atk ?? 40;
  const baseDef = myCat.battle_def ?? 25;
  return {
    id: `pve-${c.key}`,
    photo_url: PVE_PHOTO_KEYS.has(c.key) ? `/pve/${c.key}.jpg` : null,
    placeholder_emoji: c.emoji,
    owner_id: BOSS_CAT_ID,
    card_level: pveLevelFor(myCat.card_level ?? 1), // 보스와 동일 - 역진행 방지
    card_exp: 0,
    card_rarity: myCat.card_rarity ?? "common",
    card_name: c.name,
    card_traits: c.traits,
    card_stats: c.stats,
    card_flavor: c.flavor,
    battle_atk: Math.max(8, Math.round(baseAtk * c.atkMult * 1.34)),
    battle_def: Math.max(3, Math.round(baseDef * c.defMult)),
    battle_eva: c.eva,
    battle_crit: c.crit,
    pve_hp_mult: c.hpMult ?? 1.7,
    battle_special: c.skills[0],
    battle_special2: c.skills[1],
    battle_special3: c.skills[2],
    battle_special4: c.skills[3],
    win_streak: 0,
  };
}

// 15%는 고양이학대범(최상위 보스), 85%는 야생동물 로스터 중 무작위.
export function makePveOpponent(myCat: CardCat): CardCat {
  if (Math.random() < 0.15) return makeBossOpponent(myCat);
  const c = PVE_ROSTER[Math.floor(Math.random() * PVE_ROSTER.length)];
  return makeCreatureOpponent(myCat, c);
}

// 도전자 보정 - 등급/레벨이 낮은 쪽에 피해·체력 보너스 (2026-07-13 등급 벽 완화).
// PVE 상대(pve_hp_mult 보유)는 자체 배율로 튜닝하므로 제외.
export const RARITY_RANK: Record<string, number> = { common: 0, uncommon: 1, rare: 2, legendary: 3 };
export function underdogBoost(mine: CardCat, opp: CardCat): { dmg: number; hp: number } {
  if (mine.pve_hp_mult || opp.pve_hp_mult) return { dmg: 1, hp: 1 };
  const tierGap = Math.max(0, (RARITY_RANK[opp.card_rarity] ?? 0) - (RARITY_RANK[mine.card_rarity] ?? 0));
  const lvGap = Math.max(0, (opp.card_level ?? 1) - (mine.card_level ?? 1));
  // common은 스탯 격차가 상대적으로 가장 커서(스킬 풀도 최약) 가산 보정
  const grassroots = tierGap > 0 && mine.card_rarity === "common" ? 0.14 : 0;
  return {
    dmg: Math.min(1.6, 1 + tierGap * 0.16 + lvGap * 0.03 + grassroots),
    hp: Math.min(1.45, 1 + tierGap * 0.11 + lvGap * 0.02 + grassroots * 0.6),
  };
}

export function calcStats(cat: CardCat) {
  const lv = cat.card_level ?? 1;
  const s = cat.card_stats ?? { cuteness: 50, wildness: 50, sociability: 50, mysteriousness: 50 };
  const hpBonus = RARITY_HP_BONUS[cat.card_rarity ?? "common"] ?? 0;
  const baseAtk = cat.battle_atk ?? Math.round(s.wildness * 0.8 + 20);
  const baseDef = cat.battle_def ?? Math.round(s.mysteriousness * 0.5 + 15);
  const hp   = Math.round(s.cuteness * 1.3 + s.wildness * 0.65) + 95 + hpBonus + (lv - 1) * 13;
  const atk  = baseAtk + (lv - 1) * 3;
  const def  = baseDef + (lv - 1) * 2;
  const eva  = Math.min(45, cat.battle_eva ?? 8);
  const crit = Math.min(45, cat.battle_crit ?? 8);
  // PVE 상대 전용 HP 배율 — 유저 카드는 pve_hp_mult가 없어 그대로
  return { hp: Math.round(hp * (cat.pve_hp_mult ?? 1)), atk, def, eva, crit, spd: Math.round(s.sociability * 0.5 + 20) + lv };
}

function rnd(min: number, max: number) {
  return min + Math.random() * (max - min);
}

// 매칭용 승률 추정 — 실제 배틀 시뮬레이션(simulateBattle)을 여러 번 돌려 승률을 근사.
export function estimateWinRate(mine: CardCat, opp: CardCat, trials = 40): number {
  let wins = 0;
  for (let i = 0; i < trials; i++) if (simulateBattle(mine, opp).attackerWins) wins++;
  return wins / trials;
}
export function pickByTargetWinRate(mine: CardCat, candidates: CardCat[], target: number): CardCat {
  const scored = candidates
    .map(o => ({ o, diff: Math.abs(estimateWinRate(mine, o) - target) }))
    .sort((a, b) => a.diff - b.diff);
  const closePicks = scored.slice(0, Math.max(1, Math.ceil(scored.length * 0.25)));
  return closePicks[Math.floor(Math.random() * closePicks.length)].o;
}

export interface AutoLogEntry {
  turn: number; actor: string; dmg: number; aHp: number; dHp: number;
  isCritical: boolean; isDodge: boolean; isCounterAttack: boolean;
  skillName: string; skillId?: string; isDot?: boolean; isStunSkip?: boolean;
  // 이번 턴에 상대에게 새로 걸린 상태이상 — 클라이언트가 리플레이 중 실제 이펙트를 띄우는 데 사용
  statusType?: "stun" | "poison" | "bleed" | "bind"; statusTurns?: number;
}

// 자동전투 전용 스킬 효과표 — 수동 배틀 로직(applySkill/runSpecial)의 축약판.
export interface AutoSkillFx {
  dmgMult: number; hits?: number; ignoreDef?: boolean; guaranteedCrit?: boolean;
  statusType?: "stun" | "poison" | "bleed" | "bind";
  statusChance?: number; statusTurns?: number;
  healPct?: number; cleanse?: boolean; lifestealPct?: number;
  evaBuffTurns?: number; // 시전자가 다음 N회 피격 시 회피 +35%p (재빠른 도약)
  invuln?: boolean;      // 시전자가 다음 1회 피해 완전 무효 (무적)
}
export const AUTO_SKILL_FX: Partial<Record<SpecialSkillId, AutoSkillFx>> = {
  sharp_claws:   { dmgMult: 1.4 },
  quick_dodge:   { dmgMult: 0, evaBuffTurns: 3 },
  focus:         { dmgMult: 0.78, guaranteedCrit: true },
  intimidate_sm: { dmgMult: 0.85, statusType: "bind", statusChance: 0.3, statusTurns: 2 },
  hiss:          { dmgMult: 0.5, statusType: "stun", statusChance: 0.3, statusTurns: 2 },
  grooming:      { dmgMult: 0, healPct: 0.16 },
  warm_nap:      { dmgMult: 0, healPct: 0.14 },
  tail_whip:     { dmgMult: 1.0, ignoreDef: true },
  claw_flurry:   { dmgMult: 0.6, hits: 2 },
  body_slam:     { dmgMult: 1.3 },
  freeze:        { dmgMult: 0.5, statusType: "stun", statusChance: 0.45, statusTurns: 2 },
  scratch:       { dmgMult: 0.8, statusType: "bleed", statusChance: 1, statusTurns: 3 },
  intimidate:    { dmgMult: 0.5, statusType: "stun", statusChance: 0.55, statusTurns: 2 },
  pounce:        { dmgMult: 1.1, ignoreDef: true },
  ambush:        { dmgMult: 0.88, guaranteedCrit: true },
  static_shock:  { dmgMult: 0.6, statusType: "stun", statusChance: 0.3, statusTurns: 2 },
  night_prowl:   { dmgMult: 1.25 },
  thunderclap:   { dmgMult: 0.8, statusType: "stun", statusChance: 0.25, statusTurns: 2 },
  cold_glare:    { dmgMult: 0.7, statusType: "stun", statusChance: 0.3, statusTurns: 2 },
  dash_strike:   { dmgMult: 1.5 },
  poison:        { dmgMult: 0.85, statusType: "poison", statusChance: 1, statusTurns: 4 },
  bind:          { dmgMult: 0.7, statusType: "bind", statusChance: 0.75, statusTurns: 3 },
  slow:          { dmgMult: 0.55, statusType: "stun", statusChance: 0.6, statusTurns: 2 },
  double_strike: { dmgMult: 0.75, hits: 2 },
  rend:          { dmgMult: 1.0, ignoreDef: true, statusType: "bleed", statusChance: 1, statusTurns: 3 },
  howl:          { dmgMult: 0.7, statusType: "bind", statusChance: 0.75, statusTurns: 3 },
  frenzy:        { dmgMult: 1.6 },
  curse:         { dmgMult: 0.85, statusType: "poison", statusChance: 1, statusTurns: 5 },
  venom_fang:    { dmgMult: 1.1, statusType: "poison", statusChance: 1, statusTurns: 4 },
  shockwave:     { dmgMult: 1.6 },
  vampirism:     { dmgMult: 1.2, lifestealPct: 0.45 },
  invincible:    { dmgMult: 0, invuln: true },
  dominate:      { dmgMult: 1.0, ignoreDef: true, statusType: "bind", statusChance: 1, statusTurns: 3 },
  regen:         { dmgMult: 0, healPct: 0.34 },
  eclipse:       { dmgMult: 1.3, healPct: 0.15 },
  overdrive:     { dmgMult: 1.8 },
  meteor:        { dmgMult: 2.0 },
  cleanse:       { dmgMult: 0, healPct: 0.32, cleanse: true },
  judgment:      { dmgMult: 1.05, statusType: "stun", statusChance: 0.5, statusTurns: 2 },
  apocalypse_strike: { dmgMult: 2.05 },
};
const DEFAULT_FX: AutoSkillFx = { dmgMult: 1.2 };

// 기본공격/방어 가상 액션 ID — 실제 SpecialSkillId가 아니라 자체 예약어.
export const AUTO_NORMAL = "__normal__";
export const AUTO_GUARD = "__guard__";
const AUTO_GUARD_USES = 5; // 수동 배틀의 GUARD_USES와 동일 — 방어는 배틀당 5회로 제한

interface AutoSideState {
  stun: number; poison: number; bleed: number; bind: number;
  cds: Record<string, number>;
  guarding: boolean; // 이번에 방어를 써서 다음에 맞을 때 피해 감소가 적용될 차례
  guardUses: number;
  evaBuff: number;      // 남은 회피 버프 피격 횟수 (재빠른 도약: +35%p)
  invuln: number;       // 남은 피해 무효 횟수 (무적)
  firstShield: boolean; // 후공 보정 - 첫 피격 피해 15% 감소 (선공 이점 완화)
}

// 스킬 4개가 전부 쿨다운 중이면(또는 방어를 골랐으면) 기본공격/방어로 대체한다.
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

export function simulateBattle(attacker: CardCat, defender: CardCat) {
  const as = calcStats(attacker);
  const ds = calcStats(defender);
  // 도전자 보정 - 등급/레벨 열세측 강화 (PVE는 내부에서 1배 반환)
  const aB = underdogBoost(attacker, defender);
  const dB = underdogBoost(defender, attacker);
  as.atk = Math.round(as.atk * aB.dmg); as.hp = Math.round(as.hp * aB.hp);
  ds.atk = Math.round(ds.atk * dB.dmg); ds.hp = Math.round(ds.hp * dB.hp);
  let aHp = as.hp, dHp = ds.hp;
  const aMaxHp = as.hp, dMaxHp = ds.hp;
  const log: AutoLogEntry[] = [];
  let turn = 0;
  const MAX_TURNS = 40; // 상태이상으로 기절 턴이 끼어들 수 있어 여유 있게

  const aSkills = [attacker.battle_special, attacker.battle_special2, attacker.battle_special3, attacker.battle_special4]
    .map(id => id ?? "sharp_claws");
  const dSkills = [defender.battle_special, defender.battle_special2, defender.battle_special3, defender.battle_special4]
    .map(id => id ?? "sharp_claws");

  const aState: AutoSideState = { stun: 0, poison: 0, bleed: 0, bind: 0, cds: {}, guarding: false, guardUses: AUTO_GUARD_USES, evaBuff: 0, invuln: 0, firstShield: false };
  const dState: AutoSideState = { stun: 0, poison: 0, bleed: 0, bind: 0, cds: {}, guarding: false, guardUses: AUTO_GUARD_USES, evaBuff: 0, invuln: 0, firstShield: false };

  // 속도 동률이면 랜덤 선공. 후공측은 첫 피격 15% 감소 - 선공 승률 완화용.
  const aFirst = as.spd === ds.spd ? Math.random() < 0.5 : as.spd > ds.spd;
  let aTurn = aFirst;
  (aFirst ? dState : aState).firstShield = true;

  while (aHp > 0 && dHp > 0 && turn < MAX_TURNS) {
    turn++;
    const actorIsA = aTurn;
    const atkSt = actorIsA ? as : ds;
    const defSt = actorIsA ? ds : as;
    const atkState = actorIsA ? aState : dState;
    const defState = actorIsA ? dState : aState;
    const atkSkills = actorIsA ? aSkills : dSkills;
    const atkName = (actorIsA ? attacker.card_name : defender.card_name) ?? "카드";
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

    // 회피 버프(재빠른 도약) - 피격 시도마다 1회씩 소모
    const evaNow = defSt.eva + (defState.evaBuff > 0 ? 35 : 0);
    if (defState.evaBuff > 0 && fx.dmgMult > 0) defState.evaBuff--;
    const isDodge = !wasBound && !isGuardAction && Math.random() * 100 < evaNow;
    let dmg = 0, isCritical = false;
    if (!isDodge && fx.dmgMult > 0) {
      const counterBoost = atkHp < atkMaxHp * 0.25 ? 1.3 : 1.0;
      const hits = fx.hits ?? 1;
      const def = fx.ignoreDef ? defSt.def * 0.3 : defSt.def;
      // 최소뎀은 공격력 비례(15%) - 등급 벽 완전 무력 상태 제거 (2026-07-13 등급 압축 패치)
      const minBase = Math.max(4, Math.round(atkSt.atk * 0.15));
      for (let h = 0; h < hits; h++) {
        const hitCrit = fx.guaranteedCrit || Math.random() * 100 < atkSt.crit;
        if (hitCrit) isCritical = true;
        const base = Math.max(minBase, Math.round((atkSt.atk - def * 0.35) * rnd(0.80, 1.30) * counterBoost));
        dmg += Math.round(base * fx.dmgMult * (hitCrit ? 2.0 : 1.0));
      }
      // 상대가 방어 중이면 이번 피해 40% 감소 (수동 배틀과 동일한 배율)
      if (dmg > 0 && defState.guarding) { dmg = Math.round(dmg * 0.6); defState.guarding = false; }
      // 무적(다음 피해 1회 무효) -> 후공 첫 피격 보정 순으로 적용
      if (dmg > 0 && defState.invuln > 0) { dmg = 0; defState.invuln--; }
      else if (dmg > 0 && defState.firstShield) { dmg = Math.round(dmg * 0.85); defState.firstShield = false; }
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
    if (fx.evaBuffTurns) atkState.evaBuff = fx.evaBuffTurns;
    if (fx.invuln) atkState.invuln = 1;

    log.push({
      turn, actor: atkName, dmg, aHp, dHp, isCritical, isDodge,
      isCounterAttack: atkHp < atkMaxHp * 0.25,
      skillName: isNormalAction ? "기본 공격" : isGuardAction ? "🛡️ 방어 자세" : (SPECIAL_SKILLS[skillId as SpecialSkillId]?.name ?? "공격"),
      skillId, isDot: false,
      statusType: appliedStatus?.type, statusTurns: appliedStatus?.turns,
    });

    // 한 라운드(양쪽 모두 행동) 종료 시 도트 틱 + 쿨다운 감소
    if (turn % 2 === 0) {
      // 도트는 피해자 최대 HP 비례(독 3.5%/출혈 2.5%) - 고정치는 함정이었다(시뮬 실측)
      const aPo = Math.max(6, Math.round(aMaxHp * 0.035)), aBl = Math.max(4, Math.round(aMaxHp * 0.025));
      const dPo = Math.max(6, Math.round(dMaxHp * 0.035)), dBl = Math.max(4, Math.round(dMaxHp * 0.025));
      let aDot = 0, dDot = 0;
      if (aState.poison > 0) { aDot += aPo; aState.poison--; }
      if (aState.bleed  > 0) { aDot += aBl; aState.bleed--; }
      if (dState.poison > 0) { dDot += dPo; dState.poison--; }
      if (dState.bleed  > 0) { dDot += dBl; dState.bleed--; }
      if (aDot > 0) { aHp = Math.max(0, aHp - aDot); log.push({ turn, actor: attacker.card_name ?? "카드", dmg: aDot, aHp, dHp, isCritical:false, isDodge:false, isCounterAttack:false, skillName: "☠️ 상태이상 피해", isDot: true }); }
      if (dDot > 0) { dHp = Math.max(0, dHp - dDot); log.push({ turn, actor: defender.card_name ?? "카드", dmg: dDot, aHp, dHp, isCritical:false, isDodge:false, isCounterAttack:false, skillName: "☠️ 상태이상 피해", isDot: true }); }
      for (const k in aState.cds) aState.cds[k] = Math.max(0, aState.cds[k] - 1);
      for (const k in dState.cds) dState.cds[k] = Math.max(0, dState.cds[k] - 1);
      if (aHp <= 0 || dHp <= 0) break;
    }

    aTurn = !aTurn;
  }

  // 도트 틱으로 양쪽이 동시에 0이 되거나, MAX_TURNS까지 체력이 정확히 같으면 무승부.
  const isDraw = aHp === dHp;
  const attackerWins = aHp > dHp;
  return { attackerWins, isDraw, aHp, dHp, aMaxHp, dMaxHp, rounds: turn, log };
}
