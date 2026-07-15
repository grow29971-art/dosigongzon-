import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { generateBattleStats } from "@/lib/battle-config";
import { TITLES, FLAVORS } from "@/lib/battle-card-titles";

// 등급 승급에 필요한 최소 레벨 (일반Lv5→희귀, 희귀Lv10→레어, 레어Lv15→레전드)
const LEVEL_GATE: Record<string, number> = {
  common:   5,
  uncommon: 10,
  rare:     15,
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
    .select("id,name,card_rarity,card_exp,card_level")
    .eq("id", cat_id)
    .eq("caretaker_id", user.id)
    .not("card_generated_at", "is", null)
    .maybeSingle();

  if (!cat) return NextResponse.json({ error: "cat not found" }, { status: 404 });
  if (cat.card_rarity === "legendary") return NextResponse.json({ error: "already_legendary" }, { status: 400 });

  const needLevel = LEVEL_GATE[cat.card_rarity ?? "common"] ?? 5;
  if ((cat.card_level ?? 1) < needLevel) {
    return NextResponse.json({ error: "insufficient_level", need: needLevel, have: cat.card_level }, { status: 400 });
  }

  const newRarity = NEXT_RARITY[cat.card_rarity ?? "common"];
  const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
  const battleStats = generateBattleStats(newRarity);
  const titlePool  = TITLES[newRarity as keyof typeof TITLES] ?? TITLES.common;
  const flavorPool = FLAVORS[newRarity as keyof typeof FLAVORS] ?? FLAVORS.common;
  const newCardName = `${pick(titlePool)} ${cat.name}`;

  const svc = createServiceClient();

  // 레벨·경험치는 그대로 유지, 등급/이름/전투 스탯만 다음 단계로 갱신
  await svc.from("cats").update({
    card_rarity: newRarity,
    card_name: newCardName,
    card_flavor: pick(flavorPool),
    ...battleStats,
  }).eq("id", cat_id);

  return NextResponse.json({ ok: true, new_rarity: newRarity, new_card_name: newCardName });
}
