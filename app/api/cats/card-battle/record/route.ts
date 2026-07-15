import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { COINS_BATTLE_WIN, COINS_BATTLE_LOSE, COINS_BATTLE_DRAW, COINS_BOSS_WIN, COINS_BOSS_LOSE, COINS_BOSS_DRAW } from "@/lib/shop-config";
import { recordPveEncounter } from "@/lib/pve-bestiary";
import { verifyBattleToken } from "@/lib/battle-token";

function computeLevel(exp: number) {
  const thresholds = [0, 90, 210, 380, 610, 900, 1260, 1690, 2200, 2800];
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (exp >= thresholds[i]) return i + 1;
  }
  return 1;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { my_cat_id, opp_cat_id, opp_caretaker_id, winner, rounds, my_hp_left, opp_hp_left, battle_token } = await req.json();

  // 결과 위조 방지 — 매칭 API(/api/cats/card-battle)가 발급한 서명 토큰이 없거나,
  // 서명이 안 맞거나, 만료됐거나, 이 요청의 my_cat_id/opp_cat_id와 토큰 속 값이
  // 다르면 거절한다. 이게 없으면 클라이언트가 아무 opp_cat_id(다른 유저의 실제
  // 카드 포함)나 넣어서 코인·경험치를 무한 파밍하거나 남의 카드 전적을 조작할 수 있었음.
  const tokenPayload = verifyBattleToken(battle_token);
  if (!tokenPayload || tokenPayload.myCatId !== my_cat_id || tokenPayload.oppId !== opp_cat_id) {
    return NextResponse.json({ error: "invalid_battle_token" }, { status: 400 });
  }
  // is_boss는 토큰에 서버가 직접 서명해둔 값만 신뢰 — 클라이언트가 보낸 is_boss는 안 씀
  // (안 그러면 일반 PVP 승리를 "보스 격퇴"로 속여 보상을 더 받을 수 있었음).
  const is_boss = tokenPayload.isBoss;
  // "PVE 10승" 배지처럼 일반 동물 승리도 세야 하는 값은 opp_cat_id가 "pve-" 접두사를
  // 갖는지(합성 PVE 상대인지)로 따로 판별한다 — PVP는 실제 cat UUID라 여기 안 걸림.
  const isPveEncounter = Boolean(is_boss) || String(opp_cat_id ?? "").startsWith("pve-");
  const isDraw = winner === "draw";
  const iWon = winner === "me";

  const { data: myCat } = await supabase
    .from("cats").select("id,card_exp,card_level,caretaker_id,win_streak,best_win_streak,pve_win_count")
    .eq("id", my_cat_id).eq("caretaker_id", user.id).maybeSingle();

  if (!myCat) return NextResponse.json({ error: "cat not found" }, { status: 404 });

  const { data: oppCat } = await supabase
    .from("cats").select("id,card_exp,card_level,win_streak,best_win_streak")
    .eq("id", opp_cat_id).maybeSingle();

  const svc = createServiceClient();

  const winnerExp = 15, loserExp = 6, drawExp = 10;
  const myExpGained = isDraw ? drawExp : iWon ? winnerExp : loserExp;
  const oppExpGained = isDraw ? drawExp : iWon ? loserExp : winnerExp;
  const myNewExp = (myCat.card_exp ?? 0) + myExpGained;
  const oppNewExp = oppCat ? ((oppCat.card_exp ?? 0) + oppExpGained) : 0;

  const { data: myProfile } = await svc.from("profiles").select("coins").eq("id", user.id).maybeSingle();
  const myCoinsNow = myProfile?.coins ?? 0;
  const coinsGained = isDraw
    ? (is_boss ? COINS_BOSS_DRAW : COINS_BATTLE_DRAW)
    : is_boss
      ? (iWon ? COINS_BOSS_WIN : COINS_BOSS_LOSE)
      : (iWon ? COINS_BATTLE_WIN : COINS_BATTLE_LOSE);
  const newCoins = Math.max(0, myCoinsNow + coinsGained);
  // 무승부는 이긴 것도 아니라서 연승 기록은 그대로 끊김(0으로)
  const myNewStreak  = iWon ? (myCat.win_streak ?? 0) + 1 : 0;
  const oppNewStreak = iWon ? 0 : isDraw ? 0 : (oppCat?.win_streak ?? 0) + 1;
  // 카드 훈장(성장 스티커)용 all-time 기록 — win_streak과 달리 지더라도 절대 줄어들지 않는다.
  const myNewBestStreak = Math.max(myCat.best_win_streak ?? 0, myNewStreak);
  const oppNewBestStreak = Math.max(oppCat?.best_win_streak ?? 0, oppNewStreak);
  const myNewPveWins = (myCat.pve_win_count ?? 0) + (isPveEncounter && iWon ? 1 : 0);

  // 배틀 타이틀 카운터 — 코인 지급과 완전히 분리된 쿼리 (마이그레이션 전이어도 코인엔 영향 없음)
  const { data: battleProfile } = await svc.from("profiles").select("boss_defeats,best_win_streak").eq("id", user.id).maybeSingle();
  const newBossDefeats = (battleProfile?.boss_defeats ?? 0) + (is_boss && iWon ? 1 : 0);
  const newBestStreak = Math.max(battleProfile?.best_win_streak ?? 0, myNewStreak);

  await Promise.all([
    svc.from("cats").update({ card_exp: myNewExp, card_level: computeLevel(myNewExp), win_streak: myNewStreak, best_win_streak: myNewBestStreak, pve_win_count: myNewPveWins }).eq("id", my_cat_id),
    oppCat && svc.from("cats").update({ card_exp: oppNewExp, card_level: computeLevel(oppNewExp), win_streak: oppNewStreak, best_win_streak: oppNewBestStreak }).eq("id", opp_cat_id),
    svc.from("profiles").update({ coins: newCoins }).eq("id", user.id),
    svc.from("profiles").update({ boss_defeats: newBossDefeats, best_win_streak: newBestStreak }).eq("id", user.id),
    // oppCat이 없으면(보스 조우 등 DB에 없는 상대) FK 제약 위반이 나므로 기록을 건너뜀
    oppCat ? svc.from("card_battles").insert({
      challenger_id: user.id,
      challenger_cat_id: my_cat_id,
      opponent_id: opp_caretaker_id ?? user.id,
      opponent_cat_id: opp_cat_id,
      winner_id: isDraw ? null : iWon ? user.id : (opp_caretaker_id ?? user.id),
      challenger_hp_left: my_hp_left ?? 0,
      opponent_hp_left: opp_hp_left ?? 0,
      rounds: rounds ?? 0,
      battle_log: [],
    }) : Promise.resolve(),
  ]);

  // 도감(컬렉션) 진행률 — 위 코인/경험치 지급과 완전히 분리해서 처리, PVP는 대상 아님
  // (마이그레이션 전이면 recordPveEncounter가 던지는 에러를 여기서만 조용히 무시).
  if (isPveEncounter) {
    try {
      await recordPveEncounter(svc, user.id, String(opp_cat_id ?? ""), Boolean(is_boss), iWon);
    } catch { /* 마이그레이션 전이면 여기서만 조용히 무시 */ }
  }

  // PVP/PVE 승·패·무 전적 — box/supabase_battle_record_draw_migration.sql 실행 전이면
  // 이 업데이트만 조용히 실패하고 위 핵심 보상(코인·경험치·연승)엔 전혀 영향 없음.
  try {
    const { data: myRec } = await svc.from("cats").select("pvp_wins,pvp_losses,pvp_draws,pve_losses,pve_draws").eq("id", my_cat_id).maybeSingle();
    const myPatch = isPveEncounter
      ? {
          pve_losses: (myRec?.pve_losses ?? 0) + (!iWon && !isDraw ? 1 : 0),
          pve_draws: (myRec?.pve_draws ?? 0) + (isDraw ? 1 : 0),
        }
      : {
          pvp_wins: (myRec?.pvp_wins ?? 0) + (iWon ? 1 : 0),
          pvp_losses: (myRec?.pvp_losses ?? 0) + (!iWon && !isDraw ? 1 : 0),
          pvp_draws: (myRec?.pvp_draws ?? 0) + (isDraw ? 1 : 0),
        };
    const jobs: PromiseLike<unknown>[] = [svc.from("cats").update(myPatch).eq("id", my_cat_id)];
    if (oppCat && !isPveEncounter) {
      const { data: oppRec } = await svc.from("cats").select("pvp_wins,pvp_losses,pvp_draws").eq("id", opp_cat_id).maybeSingle();
      jobs.push(svc.from("cats").update({
        pvp_wins: (oppRec?.pvp_wins ?? 0) + (!iWon && !isDraw ? 1 : 0),
        pvp_losses: (oppRec?.pvp_losses ?? 0) + (iWon ? 1 : 0),
        pvp_draws: (oppRec?.pvp_draws ?? 0) + (isDraw ? 1 : 0),
      }).eq("id", opp_cat_id));
    }
    await Promise.all(jobs);
  } catch { /* 마이그레이션 전이면 조용히 무시 */ }

  return NextResponse.json({
    exp_gained: myExpGained,
    my_new_exp: myNewExp,
    my_new_level: computeLevel(myNewExp),
    leveled_up: computeLevel(myNewExp) > (myCat.card_level ?? 1),
    coins_gained: coinsGained,
    coins_total: newCoins,
  });
}
