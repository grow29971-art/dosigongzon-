import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as serviceClient } from "@supabase/supabase-js";
import { generateBattleStats, RARITY_CARE_THRESHOLD, RARITY_UPGRADE_TARGET } from "@/lib/battle-config";
import { TITLES, FLAVORS } from "@/lib/battle-card-titles";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { cat_id } = await req.json();
  if (!cat_id) return NextResponse.json({ upgraded: false });

  const { data: cat } = await supabase
    .from("cats")
    .select("id, name, card_rarity, card_generated_at")
    .eq("id", cat_id)
    .maybeSingle();

  if (!cat?.card_generated_at || cat.card_rarity === "legendary") {
    return NextResponse.json({ upgraded: false });
  }

  const threshold = RARITY_CARE_THRESHOLD[cat.card_rarity];
  if (!threshold) return NextResponse.json({ upgraded: false });

  // 총 돌봄 횟수 집계
  const { count } = await supabase
    .from("care_logs")
    .select("id", { count: "exact", head: true })
    .eq("cat_id", cat_id);

  const careCount = count ?? 0;
  if (careCount < threshold) {
    return NextResponse.json({ upgraded: false, care_count: careCount, threshold });
  }

  // 등급 승급
  const newRarity = RARITY_UPGRADE_TARGET[cat.card_rarity] ?? cat.card_rarity;
  const oldRarity = cat.card_rarity;
  const battleStats = generateBattleStats(newRarity);

  // 칭호 풀에서 새 카드 이름 생성
  const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
  const titlePool = TITLES[newRarity as keyof typeof TITLES] ?? TITLES.common;
  const flavorPool = FLAVORS[newRarity as keyof typeof FLAVORS] ?? FLAVORS.common;
  const newCardName = `${pick(titlePool)} ${cat.name}`;

  const svc = serviceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  await svc.from("cats").update({
    card_rarity: newRarity,
    card_name: newCardName,
    card_flavor: pick(flavorPool),
    ...battleStats,
  }).eq("id", cat_id);

  return NextResponse.json({
    upgraded: true,
    old_rarity: oldRarity,
    new_rarity: newRarity,
    new_card_name: newCardName,
    care_count: careCount,
  });
}
