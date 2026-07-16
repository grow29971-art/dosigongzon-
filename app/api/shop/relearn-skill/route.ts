import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
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

  const svc = createServiceClient();

  // 스킬 재배정은 60코인짜리 소모 — 반드시 아이템을 먼저 원자적으로 차감하고,
  // 실제로 1개가 소모된 경우에만 스킬을 바꾼다. 예전엔 재고 확인 없이 항상 스킬을
  // 갱신하고 병렬로 차감해, 재고 1개로 여러 번 리롤하거나 0개로도 리롤 가능했음.
  const { data: rpcRemaining, error: consumeErr } = await svc.rpc("consume_user_item", {
    p_user_id: user.id, p_item_key: "skill_relearn",
  });

  let remaining: number;
  if (!consumeErr && typeof rpcRemaining === "number") {
    if (rpcRemaining < 0) return NextResponse.json({ error: "no_stock" }, { status: 400 });
    remaining = rpcRemaining;
  } else {
    // RPC 미배포 폴백 — gt 가드로 최소 방어
    const { data: item } = await supabase
      .from("user_items").select("quantity")
      .eq("user_id", user.id).eq("item_key", "skill_relearn").maybeSingle();
    const qty = item?.quantity ?? 0;
    if (qty <= 0) return NextResponse.json({ error: "no_stock" }, { status: 400 });
    const { data: decRows } = await svc.from("user_items")
      .update({ quantity: qty - 1, updated_at: new Date().toISOString() })
      .eq("user_id", user.id).eq("item_key", "skill_relearn").gt("quantity", 0).select("item_key");
    if (!decRows || decRows.length === 0) return NextResponse.json({ error: "no_stock" }, { status: 400 });
    remaining = qty - 1;
  }

  const pool = SKILL_POOL[cat.card_rarity ?? "common"] ?? SKILL_POOL.common;
  const current = [cat.battle_special, cat.battle_special2, cat.battle_special3, cat.battle_special4];
  const others = current.filter((_, i) => i !== slot);

  const candidates = pool.filter(id => !others.includes(id));
  const pickPool = candidates.length > 0 ? candidates : pool;
  const newSkillId = pickPool[Math.floor(Math.random() * pickPool.length)] as SpecialSkillId;

  await svc.from("cats").update({ [SLOT_COLUMNS[slot]]: newSkillId }).eq("id", cat_id);

  return NextResponse.json({
    ok: true,
    slot,
    new_skill_id: newSkillId,
    new_skill_name: SPECIAL_SKILLS[newSkillId]?.name ?? newSkillId,
    remaining,
  });
}
