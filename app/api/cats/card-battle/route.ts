import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as serviceClient } from "@supabase/supabase-js";

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
  battle_atk: number | null;
  battle_def: number | null;
  battle_eva: number | null;
  battle_crit: number | null;
}

// 등급별 HP 보너스: 일반→레전드로 갈수록 체력이 두껍게
const RARITY_HP_BONUS: Record<string, number> = { common:0, uncommon:50, rare:105, legendary:175 };

function calcStats(cat: CardCat) {
  const lv = cat.card_level ?? 1;
  const s = cat.card_stats ?? { cuteness: 50, wildness: 50, sociability: 50, mysteriousness: 50 };
  const hpBonus = RARITY_HP_BONUS[cat.card_rarity ?? "common"] ?? 0;
  const baseAtk = cat.battle_atk ?? Math.round(s.wildness * 0.8 + 20);
  const baseDef = cat.battle_def ?? Math.round(s.mysteriousness * 0.5 + 15);
  return {
    hp:   Math.round(s.cuteness * 1.8 + s.wildness * 0.9) + 135 + hpBonus + (lv - 1) * 19,
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
      const baseDmg = Math.max(5, Math.round((as.atk - ds.def * 0.4) * rnd(0.85, 1.2) * counterBoost));
      const dmg = isDodge ? 0 : Math.round(baseDmg * (isCritical ? 1.8 : 1.0));
      dHp = Math.max(0, dHp - dmg);
      const skillName = SKILLS_A[turn % SKILLS_A.length] ?? "공격";
      log.push({ turn, actor: attacker.name, dmg, aHp, dHp, isCritical, isDodge, isCounterAttack: counterBoost > 1, skillName });
    } else {
      const counterBoost = dHp < dMaxHp * 0.25 ? 1.3 : 1.0;
      const isCritical = Math.random() * 100 < ds.crit;
      const isDodge = Math.random() * 100 < as.eva;
      const baseDmg = Math.max(5, Math.round((ds.atk - as.def * 0.4) * rnd(0.85, 1.2) * counterBoost));
      const dmg = isDodge ? 0 : Math.round(baseDmg * (isCritical ? 1.8 : 1.0));
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
    .select("id,name,photo_url,caretaker_id,card_level,card_exp,card_rarity,card_name,card_traits,card_stats,battle_atk,battle_def,battle_eva,battle_crit")
    .eq("id", my_cat_id)
    .eq("caretaker_id", user.id)
    .not("card_generated_at", "is", null)
    .maybeSingle();

  if (!myCat) return NextResponse.json({ error: "cat not found" }, { status: 404 });

  // 상대 랜덤 선택 (같은 희귀도 또는 인근 등급, 내 고양이 제외)
  const rarities: Record<string, string[]> = {
    common: ["common", "uncommon"],
    uncommon: ["common", "uncommon", "rare"],
    rare: ["uncommon", "rare", "legendary"],
    legendary: ["rare", "legendary"],
  };
  const matchRarities = rarities[myCat.card_rarity ?? "common"] ?? ["common"];

  const { data: opponents } = await supabase
    .from("cats")
    .select("id,name,photo_url,caretaker_id,card_level,card_exp,card_rarity,card_name,card_traits,card_stats,battle_atk,battle_def,battle_eva,battle_crit")
    .neq("caretaker_id", user.id)
    .in("card_rarity", matchRarities)
    .not("card_generated_at", "is", null)
    .limit(50);

  if (!opponents || opponents.length === 0) {
    return NextResponse.json({ error: "no_opponents" }, { status: 404 });
  }

  const opponent = opponents[Math.floor(Math.random() * opponents.length)] as CardCat;

  // 수동 배틀: 스탯만 반환 (시뮬레이션 없음)
  if (mode === "manual") {
    return NextResponse.json({
      my_cat: myCat,
      opponent,
      my_stats: calcStats(myCat as CardCat),
      opp_stats: calcStats(opponent),
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

  await Promise.all([
    svc.from("cats").update({ card_exp: myNewExp,  card_level: computeLevel(myNewExp)  }).eq("id", myCat.id),
    svc.from("cats").update({ card_exp: oppNewExp, card_level: computeLevel(oppNewExp) }).eq("id", opponent.id),
    svc.from("card_battles").insert({
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
    },
  });
}
