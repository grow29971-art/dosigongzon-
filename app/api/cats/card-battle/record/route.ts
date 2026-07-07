import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as serviceClient } from "@supabase/supabase-js";
import { COINS_BATTLE_WIN, COINS_BATTLE_LOSE, COINS_BOSS_WIN, COINS_BOSS_LOSE } from "@/lib/shop-config";

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

  const { my_cat_id, opp_cat_id, opp_caretaker_id, winner, rounds, my_hp_left, opp_hp_left, is_boss } = await req.json();

  const { data: myCat } = await supabase
    .from("cats").select("id,card_exp,card_level,caretaker_id,win_streak,best_win_streak,pve_win_count")
    .eq("id", my_cat_id).eq("caretaker_id", user.id).maybeSingle();

  if (!myCat) return NextResponse.json({ error: "cat not found" }, { status: 404 });

  const { data: oppCat } = await supabase
    .from("cats").select("id,card_exp,card_level,win_streak,best_win_streak")
    .eq("id", opp_cat_id).maybeSingle();

  const svc = serviceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const winnerExp = 15, loserExp = 6;
  const iWon = winner === "me";
  const myNewExp = (myCat.card_exp ?? 0) + (iWon ? winnerExp : loserExp);
  const oppNewExp = oppCat ? ((oppCat.card_exp ?? 0) + (iWon ? loserExp : winnerExp)) : 0;

  const { data: myProfile } = await svc.from("profiles").select("coins").eq("id", user.id).maybeSingle();
  const myCoinsNow = myProfile?.coins ?? 0;
  const coinsGained = is_boss
    ? (iWon ? COINS_BOSS_WIN : COINS_BOSS_LOSE)
    : (iWon ? COINS_BATTLE_WIN : COINS_BATTLE_LOSE);
  const newCoins = Math.max(0, myCoinsNow + coinsGained);
  const myNewStreak  = iWon ? (myCat.win_streak ?? 0) + 1 : 0;
  const oppNewStreak = iWon ? 0 : (oppCat?.win_streak ?? 0) + 1;
  // 카드 훈장(성장 스티커)용 all-time 기록 — win_streak과 달리 지더라도 절대 줄어들지 않는다.
  const myNewBestStreak = Math.max(myCat.best_win_streak ?? 0, myNewStreak);
  const oppNewBestStreak = Math.max(oppCat?.best_win_streak ?? 0, oppNewStreak);
  const myNewPveWins = (myCat.pve_win_count ?? 0) + (is_boss && iWon ? 1 : 0);

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
      winner_id: iWon ? user.id : (opp_caretaker_id ?? user.id),
      challenger_hp_left: my_hp_left ?? 0,
      opponent_hp_left: opp_hp_left ?? 0,
      rounds: rounds ?? 0,
      battle_log: [],
    }) : Promise.resolve(),
  ]);

  // 도감(컬렉션) 진행률 — box/supabase_pve_bestiary_migration.sql 실행 전이면 컬럼이 없어
  // 이 블록만 조용히 실패하고 넘어간다(위 코인/경험치 지급과 완전히 분리).
  try {
    const pveKey = is_boss ? "boss" : String(opp_cat_id ?? "").replace(/^pve-/, "");
    if (pveKey) {
      const { data: bestiary } = await svc.from("profiles").select("pve_seen_keys,pve_defeated_keys").eq("id", user.id).maybeSingle();
      const seenSet = new Set(bestiary?.pve_seen_keys ?? []);
      const defeatedSet = new Set(bestiary?.pve_defeated_keys ?? []);
      seenSet.add(pveKey);
      if (iWon) defeatedSet.add(pveKey);
      await svc.from("profiles").update({ pve_seen_keys: Array.from(seenSet), pve_defeated_keys: Array.from(defeatedSet) }).eq("id", user.id);
    }
  } catch { /* 마이그레이션 전이면 여기서만 조용히 무시 */ }

  return NextResponse.json({
    exp_gained: iWon ? winnerExp : loserExp,
    my_new_exp: myNewExp,
    my_new_level: computeLevel(myNewExp),
    leveled_up: computeLevel(myNewExp) > (myCat.card_level ?? 1),
    coins_gained: coinsGained,
    coins_total: newCoins,
  });
}
