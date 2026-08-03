import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import {
  COINS_BATTLE_WIN, COINS_BATTLE_LOSE, COINS_BATTLE_DRAW,
  COINS_BOSS_WIN, COINS_BOSS_LOSE, COINS_BOSS_DRAW,
} from "@/lib/catch/ranking";
import { recordPveEncounter } from "@/lib/catch/pve-bestiary";
import { signBattleToken } from "@/lib/catch/battle-token";
import { cardLevelFromExp } from "@/lib/card-level";
import { reportError } from "@/lib/error-report";
import { CATCH_BATTLE_ENABLED } from "@/lib/catch/features";
import { rateLimit } from "@/lib/rate-limit";
import {
  BOSS_CAT_ID, makePveOpponent, calcStats, pickByTargetWinRate, simulateBattle, underdogBoost, type CardCat,
} from "@/lib/catch/battle-engine";

export const maxDuration = 15;

// 야생냥이 배틀 매칭 + 자동전투 — 냥줍 app/api/cards/battle 이식 (2026-08-04 P4).
// 스키마 치환: cards→catch_cards, profiles 게임 상태→catch_profiles.
// 코인은 city 불변식대로 increment_coins(p_user_id,p_amount) 원자 증분 단일 경로
// (냥줍의 read-modify-write 폴백은 이식하지 않음 — 절대값 쓰기 금지).
// 장착 아이템(equipped_slots) 조회는 이식하지 않음 — city 상점에 배틀 장비가 없어 항상 '{}'.

export async function POST(req: Request) {
  try {
    return await handleBattle(req);
  } catch (e) {
    reportError("catch-battle", e);
    return NextResponse.json({ error: "서버 오류가 발생했어요." }, { status: 500 });
  }
}

const MY_COLS = "id,photo_url,owner_id,species_key,card_level,card_exp,card_rarity,card_name,card_traits,card_stats,card_flavor,battle_atk,battle_def,battle_eva,battle_crit,battle_special,battle_special2,battle_special3,battle_special4,win_streak,best_win_streak,pve_win_count,pvp_wins,pvp_losses,pvp_draws,pve_losses,pve_draws,equipped_border_key";
const OPP_COLS = "id,photo_url,owner_id,species_key,card_level,card_exp,card_rarity,card_name,card_traits,card_stats,battle_atk,battle_def,battle_eva,battle_crit,battle_special,battle_special2,battle_special3,battle_special4,win_streak,pvp_wins,pvp_losses,pvp_draws,equipped_border_key";

async function handleBattle(req: Request) {
  // 배틀 미노출 중 API 잠금 — lib/catch/features.ts 단일 플래그.
  if (!CATCH_BATTLE_ENABLED) return NextResponse.json({ error: "배틀은 잠시 쉬고 있어요." }, { status: 503 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // 잘못된 body(비-JSON)는 500이 아니라 400으로
  let body: { my_card_id?: string; mode?: string; battle_type?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }
  const { my_card_id, mode = "auto", battle_type = "pve" } = body ?? {};
  if (typeof my_card_id !== "string" || !my_card_id) {
    return NextResponse.json({ error: "my_card_id required" }, { status: 400 });
  }

  // 인메모리 1차 방어 — 유저당 12회/분 (아래 DB 쿨다운의 앞단)
  if (!rateLimit(`catch-battle:${user.id}`, { max: 12, windowMs: 60_000 })) {
    return NextResponse.json({ error: "냥이가 아직 숨을 고르고 있어요. 잠시 후 다시!" }, { status: 429 });
  }

  const svc = createServiceClient();

  // 파밍 스로틀(냥줍 2026-07-16 감사 계승) — 유저당 10초 쿨다운.
  // catch_profiles.last_battle_at 컬럼 마이그레이션(supabase_catch_battle_migration.sql)
  // 전이면 조회가 실패해 조용히 통과한다(인메모리 리밋이 1차 방어를 유지).
  {
    const { data: prof, error } = await svc.from("catch_profiles")
      .select("last_battle_at").eq("user_id", user.id).maybeSingle();
    if (!error) {
      const last = prof?.last_battle_at ? new Date(prof.last_battle_at as string).getTime() : 0;
      if (Date.now() - last < 10_000) {
        return NextResponse.json({ error: "냥이가 아직 숨을 고르고 있어요. 잠시 후 다시!" }, { status: 429 });
      }
      // 행이 없으면 lazy 생성 — update만 하면 첫 유저는 스로틀이 영영 안 걸린다.
      await svc.from("catch_profiles").upsert(
        { user_id: user.id, last_battle_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );
    }
  }

  // 내 카드 조회 — RLS(본인 행)로도 읽히지만 서버 검증이므로 owner 조건을 명시.
  const { data: myCat, error: myErr } = await svc
    .from("catch_cards")
    .select(MY_COLS)
    .eq("id", my_card_id)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (myErr) {
    reportError("catch-battle:my-card", myErr, { userId: user.id });
    return NextResponse.json({ error: "배틀 준비 중이에요. 잠시 후 다시 시도해주세요." }, { status: 503 });
  }
  if (!myCat) return NextResponse.json({ error: "cat not found" }, { status: 404 });

  // PVE(기본 모드) → 야생동물/빌런 합성 상대. PVP는 실제 다른 유저 카드와 매칭.
  const isBossEncounter = battle_type === "pve";
  let opponent: CardCat;

  if (isBossEncounter) {
    opponent = makePveOpponent(myCat as unknown as CardCat);
  } else {
    // 상대 선택 — 가능하면 같은 등급으로, 없으면 인근 등급으로 확대.
    // catch_cards RLS는 본인 행만 허용 — 상대 조회는 service_role로만 가능.
    const NEARBY_RARITIES: Record<string, string[]> = {
      common: ["common", "uncommon"],
      uncommon: ["common", "uncommon", "rare"],
      rare: ["uncommon", "rare", "legendary"],
      legendary: ["rare", "legendary"],
    };
    const myRarity = myCat.card_rarity ?? "common";

    const { data: sameRarityOpponents } = await svc
      .from("catch_cards")
      .select(OPP_COLS)
      .neq("owner_id", user.id)
      .eq("card_rarity", myRarity)
      .limit(50);

    let opponents = sameRarityOpponents;
    if (!opponents || opponents.length === 0) {
      const matchRarities = NEARBY_RARITIES[myRarity] ?? ["common"];
      const { data: nearbyOpponents } = await svc
        .from("catch_cards")
        .select(OPP_COLS)
        .neq("owner_id", user.id)
        .in("card_rarity", matchRarities)
        .limit(50);
      opponents = nearbyOpponents;
    }

    // 등급 근처에도 상대가 없으면(콜드스타트) 등급 무시하고 아무 상대나 매칭.
    if (!opponents || opponents.length === 0) {
      const { data: anyOpponents } = await svc
        .from("catch_cards")
        .select(OPP_COLS)
        .neq("owner_id", user.id)
        .limit(50);
      opponents = anyOpponents;
    }

    if (!opponents || opponents.length === 0) {
      return NextResponse.json({ error: "no_opponents" }, { status: 404 });
    }

    // 승률 50%(팽팽한 접전)를 노려 매칭 — 상위 25% 후보 중 랜덤(완전 예측 방지).
    opponent = pickByTargetWinRate(myCat as unknown as CardCat, opponents as unknown as CardCat[], 0.50);
  }

  // 사진 프라이버시(냥줍 설계 유지) — 타인 photo_url은 절대 응답에 싣지 않는다.
  // city 포획 카드는 photo_url이 원래 null(종 아트)이지만, 이후 실사 기능이 붙어도
  // 이 줄이 방어선이다. species_key는 공용 카탈로그 아트 키라 노출해도 안전 — 클라가
  // 상대 카드를 종 아트로 그린다. PVE 상대의 photo_url은 /boss/·/pve/ 로컬 에셋이라 유지.
  if (!isBossEncounter) opponent.photo_url = null;

  // isBossEncounter는 "PVE 모드냐"는 뜻 — 진짜 보스(고양이학대범) 여부는 id로 판별.
  const isActualBoss = isBossEncounter && opponent.id === BOSS_CAT_ID;

  // 수동 배틀: 스탯만 반환 (시뮬레이션 없음) + 결과 기록 위조 방지 서명 토큰
  if (mode === "manual") {
    const battle_token = signBattleToken({
      myCatId: myCat.id, oppId: opponent.id, isBoss: isActualBoss, exp: Date.now() + 15 * 60 * 1000,
    });
    // 도전자 보정 — 자동전투(simulateBattle 내부)와 동일하게 수동 스탯에도 적용
    const myStats = calcStats(myCat as unknown as CardCat);
    const oppStats = calcStats(opponent);
    const mB = underdogBoost(myCat as unknown as CardCat, opponent);
    const oB = underdogBoost(opponent, myCat as unknown as CardCat);
    myStats.atk = Math.round(myStats.atk * mB.dmg); myStats.hp = Math.round(myStats.hp * mB.hp);
    oppStats.atk = Math.round(oppStats.atk * oB.dmg); oppStats.hp = Math.round(oppStats.hp * oB.hp);
    return NextResponse.json({
      my_cat: myCat,
      opponent,
      my_stats: myStats,
      opp_stats: oppStats,
      is_boss: isActualBoss,
      battle_token,
    });
  }

  // 자동 배틀 시뮬레이션
  const result = simulateBattle(myCat as unknown as CardCat, opponent);

  const winnerExp = 14, loserExp = 5, drawExp = 9;
  const myExpGained = result.isDraw ? drawExp : result.attackerWins ? winnerExp : loserExp;
  const oppExpGained = result.isDraw ? drawExp : result.attackerWins ? loserExp : winnerExp;
  const myNewExp  = (myCat.card_exp ?? 0) + myExpGained;
  const oppNewExp = (opponent.card_exp ?? 0) + oppExpGained;

  // 코인 보상은 "진짜 보스냐"로 분기 — isBossEncounter(PVE 모드 전체)로 나누면
  // 모기 한 마리 이겨도 보스급 보상이 나간다(냥줍 버그 교훈).
  const coinsGained = result.isDraw
    ? (isActualBoss ? COINS_BOSS_DRAW : COINS_BATTLE_DRAW)
    : isActualBoss
      ? (result.attackerWins ? COINS_BOSS_WIN : COINS_BOSS_LOSE)
      : (result.attackerWins ? COINS_BATTLE_WIN : COINS_BATTLE_LOSE);

  // 코인 지급 — increment_coins 원자 증분 단일 경로. 실패해도 배틀 결과는 반환하되
  // coins_total을 내리지 않는다(절대값 폴백 금지 — city 코인 불변식).
  let newCoins: number | null = null;
  {
    const rpc = await svc.rpc("increment_coins", { p_user_id: user.id, p_amount: coinsGained });
    if (!rpc.error && typeof rpc.data === "number") newCoins = rpc.data;
    else if (rpc.error) reportError("catch-battle:coins", rpc.error, { userId: user.id });
  }

  // 무승부는 승패 어느 쪽도 아니라 연승 리셋.
  const myNewStreak  = result.attackerWins ? (myCat.win_streak ?? 0) + 1 : 0;
  const oppNewStreak = result.attackerWins ? 0 : result.isDraw ? 0 : (opponent.win_streak ?? 0) + 1;
  const myNewBestStreak = Math.max(myCat.best_win_streak ?? 0, myNewStreak);
  const oppNewBestStreak = Math.max(opponent.best_win_streak ?? 0, oppNewStreak);
  // "PVE 10승" 계열은 보스든 일반 동물이든 PVE 승리 전체를 센다.
  const myNewPveWins = (myCat.pve_win_count ?? 0) + (isBossEncounter && result.attackerWins ? 1 : 0);
  const myCatRec = myCat as unknown as CardCat;
  const myNewPvpWins   = (myCatRec.pvp_wins ?? 0)   + (!isBossEncounter && result.attackerWins ? 1 : 0);
  const myNewPvpLosses = (myCatRec.pvp_losses ?? 0) + (!isBossEncounter && !result.attackerWins && !result.isDraw ? 1 : 0);
  const myNewPvpDraws  = (myCatRec.pvp_draws ?? 0)  + (!isBossEncounter && result.isDraw ? 1 : 0);
  const myNewPveLosses = (myCatRec.pve_losses ?? 0) + (isBossEncounter && !result.attackerWins && !result.isDraw ? 1 : 0);
  const myNewPveDraws  = (myCatRec.pve_draws ?? 0)  + (isBossEncounter && result.isDraw ? 1 : 0);
  const oppNewPvpWins   = (opponent.pvp_wins ?? 0)   + (!isBossEncounter && !result.attackerWins && !result.isDraw ? 1 : 0);
  const oppNewPvpLosses = (opponent.pvp_losses ?? 0) + (!isBossEncounter && result.attackerWins ? 1 : 0);
  const oppNewPvpDraws  = (opponent.pvp_draws ?? 0)  + (!isBossEncounter && result.isDraw ? 1 : 0);

  await Promise.all([
    svc.from("catch_cards").update({
      card_exp: myNewExp, card_level: cardLevelFromExp(myNewExp),
      win_streak: myNewStreak, best_win_streak: myNewBestStreak, pve_win_count: myNewPveWins,
      pvp_wins: myNewPvpWins, pvp_losses: myNewPvpLosses, pvp_draws: myNewPvpDraws,
      pve_losses: myNewPveLosses, pve_draws: myNewPveDraws,
    }).eq("id", myCat.id),
    isBossEncounter ? Promise.resolve() : svc.from("catch_cards").update({
      card_exp: oppNewExp, card_level: cardLevelFromExp(oppNewExp),
      win_streak: oppNewStreak, best_win_streak: oppNewBestStreak,
      pvp_wins: oppNewPvpWins, pvp_losses: oppNewPvpLosses, pvp_draws: oppNewPvpDraws,
    }).eq("id", opponent.id),
  ]);

  // 배틀 업적 카운터(catch_profiles.boss_defeats·best_win_streak) — 부가 기능이라
  // 컬럼 마이그레이션 전이면 조용히 생략. boss_defeats는 진짜 보스만 센다.
  try {
    const { data: bp, error: bpErr } = await svc.from("catch_profiles")
      .select("boss_defeats,best_win_streak").eq("user_id", user.id).maybeSingle();
    if (!bpErr) {
      await svc.from("catch_profiles").upsert({
        user_id: user.id,
        boss_defeats: (bp?.boss_defeats ?? 0) + (isActualBoss && result.attackerWins ? 1 : 0),
        best_win_streak: Math.max(bp?.best_win_streak ?? 0, myNewStreak),
      }, { onConflict: "user_id" });
    }
  } catch { /* 마이그레이션 전 — 생략 */ }

  // PVP 대전 기록(catch_battles — 주간 랭킹 집계 재료). 테이블 마이그레이션 전이면
  // 랭킹만 비고 배틀 자체(코인·EXP)는 정상 — 부가로 분리.
  if (!isBossEncounter) {
    const ins = await svc.from("catch_battles").insert({
      challenger_id:     user.id,
      challenger_cat_id: myCat.id,
      opponent_id:       opponent.owner_id,
      opponent_cat_id:   opponent.id,
      winner_id:         result.isDraw ? null : result.attackerWins ? user.id : opponent.owner_id,
      challenger_hp_left: result.aHp,
      opponent_hp_left:   result.dHp,
      rounds:             result.rounds,
      battle_log:         result.log,
    });
    if (ins.error && !["42P01", "PGRST205"].includes((ins.error as { code?: string }).code ?? "")) {
      reportError("catch-battle:record", ins.error, { userId: user.id });
    }
  }

  // PVE 조우 도감 진행 — 핵심 보상과 분리, 실패해도 무시.
  if (isBossEncounter) {
    try {
      await recordPveEncounter(svc, user.id, opponent.id, isActualBoss, result.attackerWins);
    } catch { /* 마이그레이션 전 — 생략 */ }
  }

  return NextResponse.json({
    my_cat: myCat,
    opponent,
    is_boss: isActualBoss,
    result: {
      winner: result.isDraw ? "draw" : result.attackerWins ? "me" : "opponent",
      my_hp_left: result.aHp,
      opp_hp_left: result.dHp,
      my_max_hp: result.aMaxHp,
      opp_max_hp: result.dMaxHp,
      rounds: result.rounds,
      log: result.log,
      exp_gained: myExpGained,
      my_new_level: cardLevelFromExp(myNewExp),
      leveled_up: cardLevelFromExp(myNewExp) > (myCat.card_level ?? 1),
      coins_gained: coinsGained,
      coins_total: newCoins,
    },
  });
}
