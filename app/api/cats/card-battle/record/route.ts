import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as serviceClient } from "@supabase/supabase-js";

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

  const { my_cat_id, opp_cat_id, opp_caretaker_id, winner, rounds, my_hp_left, opp_hp_left } = await req.json();

  const { data: myCat } = await supabase
    .from("cats").select("id,card_exp,card_level,caretaker_id")
    .eq("id", my_cat_id).eq("caretaker_id", user.id).maybeSingle();

  if (!myCat) return NextResponse.json({ error: "cat not found" }, { status: 404 });

  const { data: oppCat } = await supabase
    .from("cats").select("id,card_exp,card_level")
    .eq("id", opp_cat_id).maybeSingle();

  const svc = serviceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const winnerExp = 15, loserExp = 6;
  const iWon = winner === "me";
  const myNewExp = (myCat.card_exp ?? 0) + (iWon ? winnerExp : loserExp);
  const oppNewExp = oppCat ? ((oppCat.card_exp ?? 0) + (iWon ? loserExp : winnerExp)) : 0;

  await Promise.all([
    svc.from("cats").update({ card_exp: myNewExp, card_level: computeLevel(myNewExp) }).eq("id", my_cat_id),
    oppCat && svc.from("cats").update({ card_exp: oppNewExp, card_level: computeLevel(oppNewExp) }).eq("id", opp_cat_id),
    svc.from("card_battles").insert({
      challenger_id: user.id,
      challenger_cat_id: my_cat_id,
      opponent_id: opp_caretaker_id ?? user.id,
      opponent_cat_id: opp_cat_id,
      winner_id: iWon ? user.id : (opp_caretaker_id ?? user.id),
      challenger_hp_left: my_hp_left ?? 0,
      opponent_hp_left: opp_hp_left ?? 0,
      rounds: rounds ?? 0,
      battle_log: [],
    }),
  ]);

  return NextResponse.json({
    exp_gained: iWon ? winnerExp : loserExp,
    my_new_exp: myNewExp,
    my_new_level: computeLevel(myNewExp),
    leveled_up: computeLevel(myNewExp) > (myCat.card_level ?? 1),
  });
}
