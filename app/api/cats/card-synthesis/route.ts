import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as serviceClient } from "@supabase/supabase-js";

const SYNTHESIS_COST: Record<string, number> = {
  common:   300,
  uncommon: 600,
  rare:     1200,
};
const NEXT_RARITY: Record<string, string> = {
  common:   "uncommon",
  uncommon: "rare",
  rare:     "legendary",
};

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { cat_id } = await req.json();
  if (!cat_id) return NextResponse.json({ error: "cat_id required" }, { status: 400 });

  const { data: cat } = await supabase
    .from("cats")
    .select("id,card_rarity,card_exp,card_level")
    .eq("id", cat_id)
    .eq("caretaker_id", user.id)
    .not("card_generated_at", "is", null)
    .maybeSingle();

  if (!cat) return NextResponse.json({ error: "cat not found" }, { status: 404 });
  if (cat.card_rarity === "legendary") return NextResponse.json({ error: "already_legendary" }, { status: 400 });

  const cost = SYNTHESIS_COST[cat.card_rarity ?? "common"] ?? 300;
  if ((cat.card_exp ?? 0) < cost) {
    return NextResponse.json({ error: "insufficient_exp", need: cost, have: cat.card_exp }, { status: 400 });
  }

  const newRarity = NEXT_RARITY[cat.card_rarity ?? "common"];
  const newExp    = (cat.card_exp ?? 0) - cost;

  const svc = serviceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  await svc.from("cats").update({ card_rarity: newRarity, card_exp: newExp }).eq("id", cat_id);

  return NextResponse.json({ ok: true, new_rarity: newRarity, exp_remaining: newExp });
}
