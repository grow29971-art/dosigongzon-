import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as serviceClient } from "@supabase/supabase-js";
import { COINS_BATTLE_WIN, COINS_BATTLE_LOSE } from "@/lib/shop-config";

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
}

// 등급별 HP 보너스: 일반→레전드로 갈수록 체력이 두껍게 (전투가 늘어지지 않도록 전체적으로 하향)
const RARITY_HP_BONUS: Record<string, number> = { common:0, uncommon:35, rare:73, legendary:122 };

// 고양이학대범 랜덤 보스 조우 — 실제 유저 카드 대신 등장하는 스크립트 상대.
// DB에 존재하지 않는 고정 id라서 결과 기록 시 상대 카드/유저 업데이트는 건너뛴다.
const BOSS_CAT_ID = "00000000-0000-0000-0000-0000000000b0";
const BOSS_ENCOUNTER_CHANCE = 1.0; // TEMP: 확인용 100% — 확인 후 0.08로 되돌릴 것

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

// 매칭용 승률 추정 — 실제 대미지식으로 가볍게 여러 번 모의 전투해서 내 승률을 근사
function quickSimWin(mine: ReturnType<typeof calcStats>, opp: ReturnType<typeof calcStats>): boolean {
  let aHp = mine.hp, dHp = opp.hp;
  let aTurn = mine.spd >= opp.spd;
  for (let turn = 0; turn < 30 && aHp > 0 && dHp > 0; turn++) {
    if (aTurn) {
      const isDodge = Math.random() * 100 < opp.eva;
      if (!isDodge) {
        const isCrit = Math.random() * 100 < mine.crit;
        const dmg = Math.max(5, Math.round((mine.atk - opp.def * 0.4) * rnd(0.80, 1.30) * (isCrit ? 2.0 : 1)));
        dHp = Math.max(0, dHp - dmg);
      }
    } else {
      const isDodge = Math.random() * 100 < mine.eva;
      if (!isDodge) {
        const isCrit = Math.random() * 100 < opp.crit;
        const dmg = Math.max(5, Math.round((opp.atk - mine.def * 0.4) * rnd(0.80, 1.30) * (isCrit ? 2.0 : 1)));
        aHp = Math.max(0, aHp - dmg);
      }
    }
    aTurn = !aTurn;
  }
  return aHp >= dHp;
}
function estimateWinRate(mine: CardCat, opp: CardCat, trials = 20): number {
  const mineStats = calcStats(mine);
  const oppStats = calcStats(opp);
  let wins = 0;
  for (let i = 0; i < trials; i++) if (quickSimWin(mineStats, oppStats)) wins++;
  return wins / trials;
}
function pickByTargetWinRate(mine: CardCat, candidates: CardCat[], target: number): CardCat {
  const scored = candidates
    .map(o => ({ o, diff: Math.abs(estimateWinRate(mine, o) - target) }))
    .sort((a, b) => a.diff - b.diff);
  const closePicks = scored.slice(0, Math.max(1, Math.ceil(scored.length * 0.25)));
  return closePicks[Math.floor(Math.random() * closePicks.length)].o;
}

function simulateBattle(attacker: CardCat, defender: CardCat) {
  const as = calcStats(attacker);
  const ds = calcStats(defender);
  let aHp = as.hp, dHp = ds.hp;
  const aMaxHp = as.hp, dMaxHp = ds.hp;
  const log: { turn: number; actor: string; dmg: number; aHp: number; dHp: number; isCritical: boolean; isDodge: boolean; isCounterAttack: boolean; skillName: string }[] = [];
  let turn = 0;
  const MAX_TURNS = 30;

  const SKILLS_A = attacker.card_traits?.slice(0, 3) ?? ["야생의 눈빛", "날카로운 발톱", "신비로운 시선"];
  const SKILLS_D = defender.card_traits?.slice(0, 3) ?? ["야생의 눈빛", "날카로운 발톱", "신비로운 시선"];

  let aTurn = as.spd >= ds.spd;

  while (aHp > 0 && dHp > 0 && turn < MAX_TURNS) {
    turn++;

    if (aTurn) {
      const counterBoost = aHp < aMaxHp * 0.25 ? 1.3 : 1.0;
      const isCritical = Math.random() * 100 < as.crit;
      const isDodge = Math.random() * 100 < ds.eva;
      const baseDmg = Math.max(5, Math.round((as.atk - ds.def * 0.4) * rnd(0.80, 1.30) * counterBoost));
      const dmg = isDodge ? 0 : Math.round(baseDmg * (isCritical ? 2.0 : 1.0));
      dHp = Math.max(0, dHp - dmg);
      const skillName = SKILLS_A[turn % SKILLS_A.length] ?? "공격";
      log.push({ turn, actor: attacker.name, dmg, aHp, dHp, isCritical, isDodge, isCounterAttack: counterBoost > 1, skillName });
    } else {
      const counterBoost = dHp < dMaxHp * 0.25 ? 1.3 : 1.0;
      const isCritical = Math.random() * 100 < ds.crit;
      const isDodge = Math.random() * 100 < as.eva;
      const baseDmg = Math.max(5, Math.round((ds.atk - as.def * 0.4) * rnd(0.80, 1.30) * counterBoost));
      const dmg = isDodge ? 0 : Math.round(baseDmg * (isCritical ? 2.0 : 1.0));
      aHp = Math.max(0, aHp - dmg);
      const skillName = SKILLS_D[turn % SKILLS_D.length] ?? "공격";
      log.push({ turn, actor: defender.name, dmg, aHp, dHp, isCritical, isDodge, isCounterAttack: counterBoost > 1, skillName });
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

  const { my_cat_id, mode = "auto" } = await req.json();
  if (!my_cat_id) return NextResponse.json({ error: "my_cat_id required" }, { status: 400 });

  // 내 카드 조회
  const { data: myCat } = await supabase
    .from("cats")
    .select("id,name,photo_url,caretaker_id,card_level,card_exp,card_rarity,card_name,card_traits,card_stats,battle_atk,battle_def,battle_eva,battle_crit,battle_special,battle_special2,battle_special3,battle_special4,win_streak")
    .eq("id", my_cat_id)
    .eq("caretaker_id", user.id)
    .not("card_generated_at", "is", null)
    .maybeSingle();

  if (!myCat) return NextResponse.json({ error: "cat not found" }, { status: 404 });

  // 랜덤 보스 조우 — 실제 상대 매칭 대신 고양이학대범이 등장
  const isBossEncounter = Math.random() < BOSS_ENCOUNTER_CHANCE;
  let opponent: CardCat;

  if (isBossEncounter) {
    opponent = makeBossOpponent(myCat as CardCat);
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

    // 자동전투는 항상 승률 45%를 노려 매칭(무관심 파밍 방지), 수동은 3연승부터 승률 50%로 매칭
    if (mode === "auto") {
      opponent = pickByTargetWinRate(myCat as CardCat, opponents as CardCat[], 0.45);
    } else if ((myCat.win_streak ?? 0) >= 3) {
      opponent = pickByTargetWinRate(myCat as CardCat, opponents as CardCat[], 0.50);
    } else {
      opponent = opponents[Math.floor(Math.random() * opponents.length)] as CardCat;
    }
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
  const coinsGained = result.attackerWins ? COINS_BATTLE_WIN : COINS_BATTLE_LOSE;
  const newCoins = (myProfile?.coins ?? 0) + coinsGained;
  const myNewStreak  = result.attackerWins ? (myCat.win_streak ?? 0) + 1 : 0;
  const oppNewStreak = result.attackerWins ? 0 : (opponent.win_streak ?? 0) + 1;

  await Promise.all([
    svc.from("cats").update({ card_exp: myNewExp,  card_level: computeLevel(myNewExp),  win_streak: myNewStreak  }).eq("id", myCat.id),
    isBossEncounter ? Promise.resolve() : svc.from("cats").update({ card_exp: oppNewExp, card_level: computeLevel(oppNewExp), win_streak: oppNewStreak }).eq("id", opponent.id),
    svc.from("profiles").update({ coins: newCoins }).eq("id", user.id),
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
