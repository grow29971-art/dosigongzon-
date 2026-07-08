import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as serviceClient } from "@supabase/supabase-js";
import { SHOP_ITEMS, BODY_SLOTS, type ShopItemKey, type BodySlot } from "@/lib/shop-config";

// 카드에 아이템을 끼우거나(item_key) 빼는(item_key: null) API.
// slot="head"|"arm"|"body"|"leg"|"foot" — 디아블로식 부위별 장비창, 5칸 동시 장착.
// slot="border" — 테두리 코스메틱, 부위 슬롯과 별개(equipped_border_key 컬럼).
//
// box/supabase_equip_item_rpc_migration.sql의 equip_item_atomic() DB 함수 하나로
// 소유권 확인·재고 조회·카드/재고 갱신을 전부 처리 — 예전엔 이걸 API 라우트에서
// 여러 번 나눠 왕복해서(최소 3~4번) 반응이 느렸는데, 왕복을 1번으로 줄임.
// RPC가 아직 없으면(마이그레이션 전) 예전 방식(여러 쿼리)으로 자동 폴백.
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { cat_id, item_key, slot } = await req.json();
  if (!cat_id) return NextResponse.json({ error: "cat_id required" }, { status: 400 });
  const isBodySlot = BODY_SLOTS.includes(slot as BodySlot);
  if (!isBodySlot && slot !== "border") {
    return NextResponse.json({ error: "invalid_slot" }, { status: 400 });
  }
  if (item_key !== null) {
    const item = SHOP_ITEMS[item_key as ShopItemKey];
    const ok = isBodySlot ? item?.bodySlot === slot : !!item?.borderFx;
    if (!ok) return NextResponse.json({ error: "invalid_item" }, { status: 400 });
  }

  const svc = serviceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: rpcData, error: rpcError } = await svc.rpc("equip_item_atomic", {
    p_user_id: user.id,
    p_cat_id: cat_id,
    p_slot: slot,
    p_item_key: item_key,
  });

  if (!rpcError) {
    const result = rpcData as { ok?: boolean; error?: string; slot?: string; item_key?: string | null };
    if (result?.error === "cat_not_found") return NextResponse.json({ error: "cat not found" }, { status: 404 });
    if (result?.error === "no_stock") return NextResponse.json({ error: "no_stock" }, { status: 400 });
    return NextResponse.json({ ok: true, slot, item_key });
  }

  // RPC가 아직 배포 전(box/supabase_equip_item_rpc_migration.sql 미실행)이면
  // 이전 다단계 방식으로 조용히 폴백 — 기능은 그대로, 속도만 느림.
  const { data: cat } = await supabase
    .from("cats")
    .select("id,caretaker_id,equipped_slots,equipped_border_key")
    .eq("id", cat_id)
    .eq("caretaker_id", user.id)
    .maybeSingle();
  if (!cat) return NextResponse.json({ error: "cat not found" }, { status: 404 });

  type EquippedSlotsLoose = Record<string, string | null>;
  const currentSlots = ((cat as { equipped_slots?: EquippedSlotsLoose | null }).equipped_slots ?? {}) as EquippedSlotsLoose;
  const currentKey = isBodySlot ? (currentSlots[slot as BodySlot] ?? null) : ((cat as { equipped_border_key?: string | null }).equipped_border_key ?? null);

  const patch = isBodySlot
    ? { equipped_slots: { ...currentSlots, [slot]: item_key } }
    : { equipped_border_key: item_key };

  if (currentKey === item_key) {
    return NextResponse.json({ ok: true, slot, item_key });
  }

  const keysToCheck = Array.from(new Set([currentKey, item_key].filter((k): k is string => !!k)));
  const { data: ownedRows } = keysToCheck.length > 0
    ? await svc.from("user_items").select("item_key,quantity").eq("user_id", user.id).in("item_key", keysToCheck)
    : { data: [] as { item_key: string; quantity: number }[] };
  const ownedMap = new Map(((ownedRows ?? []) as { item_key: string; quantity: number }[]).map((r) => [r.item_key, r.quantity]));

  if (item_key && (ownedMap.get(item_key) ?? 0) < 1) {
    return NextResponse.json({ error: "no_stock" }, { status: 400 });
  }

  const jobs: PromiseLike<unknown>[] = [
    svc.from("cats").update(patch).eq("id", cat_id),
  ];
  if (currentKey) {
    const prevQty = ownedMap.get(currentKey) ?? 0;
    jobs.push(svc.from("user_items").upsert(
      { user_id: user.id, item_key: currentKey, quantity: prevQty + 1, updated_at: new Date().toISOString() },
      { onConflict: "user_id,item_key" },
    ));
  }
  if (item_key) {
    const qty = ownedMap.get(item_key) ?? 0;
    jobs.push(svc.from("user_items").update({ quantity: qty - 1, updated_at: new Date().toISOString() })
      .eq("user_id", user.id).eq("item_key", item_key));
  }

  await Promise.all(jobs);

  return NextResponse.json({ ok: true, slot, item_key });
}
