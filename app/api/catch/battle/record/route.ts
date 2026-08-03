import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import {
  COINS_BATTLE_WIN, COINS_BATTLE_LOSE, COINS_BATTLE_DRAW,
  COINS_BOSS_WIN, COINS_BOSS_LOSE, COINS_BOSS_DRAW,
} from "@/lib/catch/ranking";
import { recordPveEncounter } from "@/lib/catch/pve-bestiary";
import { verifyBattleToken } from "@/lib/catch/battle-token";
import { cardLevelFromExp } from "@/lib/card-level";
import { reportError } from "@/lib/error-report";
import { CATCH_BATTLE_ENABLED } from "@/lib/catch/features";

// 수동 배틀 결과 기록 — 냥줍 app/api/cards/battle/record 이식 (2026-08-04 P4).
// 스키마 치환: cards→catch_cards, battle_tokens_used→catch_battle_tokens_used,
// profiles 배틀 카운터→catch_profiles. 코인은 increment_coins 단일 경로.

export async function POST(req: Request) {
  try {
    return await handleRecord(req);
  } catch (e) {
    reportError("catch-battle-record", e);
    return NextResponse.json({ error: "서버 오류가 발생했어요." }, { status: 500 });
  }
}

async function handleRecord(req: Request) {
  if (!CATCH_BATTLE_ENABLED) return NextResponse.json({ error: "배틀은 잠시 쉬고 있어요." }, { status: 503 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: {
    my_cat_id?: string; opp_cat_id?: string; opp_owner_id?: string;
    winner?: string; rounds?: number; my_hp_left?: number; opp_hp_left?: number;
    battle_token?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }
  const { my_cat_id, opp_cat_id, opp_owner_id, winner, rounds, my_hp_left, opp_hp_left, battle_token } = body ?? {};

  // 결과 위조 방지 — 매칭 API(/api/catch/battle)가 발급한 서명 토큰 검증.
  const tokenPayload = verifyBattleToken(battle_token);
  if (!tokenPayload || tokenPayload.myCatId !== my_cat_id || tokenPayload.oppId !== opp_cat_id) {
    return NextResponse.json({ error: "invalid_battle_token" }, { status: 400 });
  }
  // is_boss는 토큰에 서버가 직접 서명해둔 값만 신뢰.
  const is_boss = tokenPayload.isBoss;
  const isPveEncounter = Boolean(is_boss) || String(opp_cat_id ?? "").startsWith("pve-");
  const isDraw = winner === "draw";
  const iWon = winner === "me";

  const svc = createServiceClient();

  const { data: myCat } = await svc
    .from("catch_cards").select("id,card_exp,card_level,owner_id,win_streak,best_win_streak,pve_win_count,pvp_wins,pvp_losses,pvp_draws,pve_losses,pve_draws")
    .eq("id", my_cat_id).eq("owner_id", user.id).maybeSingle();

  if (!myCat) return NextResponse.json({ error: "cat not found" }, { status: 404 });

  const { data: oppCat } = await svc
    .from("catch_cards").select("id,owner_id,card_exp,card_level,win_streak,best_win_streak,pvp_wins,pvp_losses,pvp_draws")
    .eq("id", opp_cat_id).maybeSingle();

  // 1회용 토큰 소비 — 같은 battle_token 재제출(replay) 파밍 차단.
  // jti를 PK로 INSERT: 충돌(23505)이면 이미 쓰인 토큰. INSERT가 원자적 락이라
  // 동시 재제출도 1건만 통과. 보상 지급 *전에* 소비해야 replay가 막힌다.
  const consume = await svc.from("catch_battle_tokens_used").insert({ jti: tokenPayload.jti, user_id: user.id });
  if (consume.error) {
    if (consume.error.code === "23505") {
      return NextResponse.json({ error: "already_recorded" }, { status: 409 });
    }
    // 테이블 없음(마이그레이션 전) 등 — 보상이 걸린 보안 게이트라 조용한 통과 대신 안전 거절
    const missing = ["42P01", "PGRST205"].includes((consume.error as { code?: string }).code ?? "");
    reportError("catch-battle-record:token-consume", consume.error, { userId: user.id });
    return NextResponse.json(
      { error: missing ? "배틀 기록을 준비 중이에요. (box/supabase_catch_battle_migration.sql 실행 필요)" : "기록에 실패했어요. 다시 시도해주세요." },
      { status: missing ? 503 : 500 },
    );
  }

  const winnerExp = 15, loserExp = 6, drawExp = 10;
  const myExpGained = isDraw ? drawExp : iWon ? winnerExp : loserExp;
  const oppExpGained = isDraw ? drawExp : iWon ? loserExp : winnerExp;
  const myNewExp = (myCat.card_exp ?? 0) + myExpGained;
  const oppNewExp = oppCat ? ((oppCat.card_exp ?? 0) + oppExpGained) : 0;

  const coinsGained = isDraw
    ? (is_boss ? COINS_BOSS_DRAW : COINS_BATTLE_DRAW)
    : is_boss
      ? (iWon ? COINS_BOSS_WIN : COINS_BOSS_LOSE)
      : (iWon ? COINS_BATTLE_WIN : COINS_BATTLE_LOSE);

  // 코인 지급 — increment_coins 원자 증분 단일 경로 (절대값 폴백 금지).
  let newCoins: number | null = null;
  {
    const rpc = await svc.rpc("increment_coins", { p_user_id: user.id, p_amount: coinsGained });
    if (!rpc.error && typeof rpc.data === "number") newCoins = rpc.data;
    else if (rpc.error) reportError("catch-battle-record:coins", rpc.error, { userId: user.id });
  }

  // 무승부는 이긴 것도 아니라서 연승 리셋
  const myNewStreak  = iWon ? (myCat.win_streak ?? 0) + 1 : 0;
  const oppNewStreak = iWon ? 0 : isDraw ? 0 : (oppCat?.win_streak ?? 0) + 1;
  const myNewBestStreak = Math.max(myCat.best_win_streak ?? 0, myNewStreak);
  const oppNewBestStreak = Math.max(oppCat?.best_win_streak ?? 0, oppNewStreak);
  const myNewPveWins = (myCat.pve_win_count ?? 0) + (isPveEncounter && iWon ? 1 : 0);

  const myPatch = isPveEncounter
    ? {
        pve_losses: (myCat.pve_losses ?? 0) + (!iWon && !isDraw ? 1 : 0),
        pve_draws: (myCat.pve_draws ?? 0) + (isDraw ? 1 : 0),
      }
    : {
        pvp_wins: (myCat.pvp_wins ?? 0) + (iWon ? 1 : 0),
        pvp_losses: (myCat.pvp_losses ?? 0) + (!iWon && !isDraw ? 1 : 0),
        pvp_draws: (myCat.pvp_draws ?? 0) + (isDraw ? 1 : 0),
      };

  await Promise.all([
    svc.from("catch_cards").update({
      card_exp: myNewExp, card_level: cardLevelFromExp(myNewExp),
      win_streak: myNewStreak, best_win_streak: myNewBestStreak, pve_win_count: myNewPveWins,
      ...myPatch,
    }).eq("id", my_cat_id),
    oppCat && !isPveEncounter ? svc.from("catch_cards").update({
      card_exp: oppNewExp, card_level: cardLevelFromExp(oppNewExp),
      win_streak: oppNewStreak, best_win_streak: oppNewBestStreak,
      pvp_wins: (oppCat.pvp_wins ?? 0) + (!iWon && !isDraw ? 1 : 0),
      pvp_losses: (oppCat.pvp_losses ?? 0) + (iWon ? 1 : 0),
      pvp_draws: (oppCat.pvp_draws ?? 0) + (isDraw ? 1 : 0),
    }).eq("id", opp_cat_id) : Promise.resolve(),
    // oppCat이 없으면(보스/PVE 합성 상대) FK 제약 위반이 나므로 대전 기록을 건너뜀
    oppCat && !isPveEncounter ? svc.from("catch_battles").insert({
      challenger_id: user.id,
      challenger_cat_id: my_cat_id,
      // 클라 값(opp_owner_id)이 아니라 DB에서 읽은 실제 소유자를 기록 — 랭킹 위조 방지
      opponent_id: oppCat.owner_id,
      opponent_cat_id: opp_cat_id,
      winner_id: isDraw ? null : iWon ? user.id : oppCat.owner_id,
      challenger_hp_left: typeof my_hp_left === "number" ? my_hp_left : 0,
      opponent_hp_left: typeof opp_hp_left === "number" ? opp_hp_left : 0,
      rounds: typeof rounds === "number" ? rounds : 0,
      battle_log: [],
    }) : Promise.resolve(),
  ]);
  void opp_owner_id; // 클라 제공 값은 신뢰하지 않음(위 opponent_id 주석)

  // 배틀 업적 카운터 — 부가, 실패 무시
  try {
    const { data: bp, error: bpErr } = await svc.from("catch_profiles")
      .select("boss_defeats,best_win_streak").eq("user_id", user.id).maybeSingle();
    if (!bpErr) {
      await svc.from("catch_profiles").upsert({
        user_id: user.id,
        boss_defeats: (bp?.boss_defeats ?? 0) + (is_boss && iWon ? 1 : 0),
        best_win_streak: Math.max(bp?.best_win_streak ?? 0, myNewStreak),
      }, { onConflict: "user_id" });
    }
  } catch { /* 마이그레이션 전 — 생략 */ }

  // PVE 조우 도감 진행 — 핵심 보상과 분리
  if (isPveEncounter) {
    try {
      await recordPveEncounter(svc, user.id, String(opp_cat_id ?? ""), Boolean(is_boss), iWon);
    } catch { /* 실패해도 핵심 보상엔 영향 없음 */ }
  }

  return NextResponse.json({
    exp_gained: myExpGained,
    my_new_exp: myNewExp,
    my_new_level: cardLevelFromExp(myNewExp),
    leveled_up: cardLevelFromExp(myNewExp) > (myCat.card_level ?? 1),
    coins_gained: coinsGained,
    coins_total: newCoins,
  });
}
