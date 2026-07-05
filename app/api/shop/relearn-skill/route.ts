import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as serviceClient } from "@supabase/supabase-js";
import { SKILL_POOL, SPECIAL_SKILLS, type SpecialSkillId } from "@/lib/battle-config";

const SLOT_COLUMNS = ["battle_special", "battle_special2", "battle_special3", "battle_special4"] as const;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { cat_id, slot } = await req.json();
  if (!cat_id || typeof slot !== "number" || slot < 0 || slot > 3) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { data: cat } = await supabase
    .from("cats")
    .select("id,card_rarity,battle_special,battle_special2,battle_special3,battle_special4")
    .eq("id", cat_id)
    .eq("caretaker_id", user.id)
    .not("card_generated_at", "is", null)
    .maybeSingle();

  if (!cat) return NextResponse.json({ error: "cat not found" }, { status: 404 });

  const { data: item } = await supabase
    .from("user_items")
    .select("quantity")
    .eq("user_id", user.id)
    .eq("item_key", "skill_relearn")
    .maybeSingle();

  const qty = item?.quantity ?? 0;
  if (qty <= 0) return NextResponse.json({ error: "no_stock" }, { status: 400 });

  const pool = SKILL_POOL[cat.card_rarity ?? "common"] ?? SKILL_POOL.common;
  const current = [cat.battle_special, cat.battle_special2, cat.battle_special3, cat.battle_special4];
  const others = current.filter((_, i) => i !== slot);

  const candidates = pool.filter(id => !others.includes(id));
  const pickPool = candidates.length > 0 ? candidates : pool;
  const newSkillId = pickPool[Math.floor(Math.random() * pickPool.length)] as SpecialSkillId;

  const svc = serviceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  await Promise.all([
    svc.from("cats").update({ [SLOT_COLUMNS[slot]]: newSkillId }).eq("id", cat_id),
    svc.from("user_items").update({ quantity: qty - 1, updated_at: new Date().toISOString() })
      .eq("user_id", user.id).eq("item_key", "skill_relearn"),
  ]);

  return NextResponse.json({
    ok: true,
    slot,
    new_skill_id: newSkillId,
    new_skill_name: SPECIAL_SKILLS[newSkillId]?.name ?? newSkillId,
    remaining: qty - 1,
  });
}
