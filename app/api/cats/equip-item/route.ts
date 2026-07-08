import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as serviceClient } from "@supabase/supabase-js";
import { SHOP_ITEMS, BODY_SLOTS, type ShopItemKey, type BodySlot, type EquippedSlots } from "@/lib/shop-config";

// 카드에 아이템을 끼우거나(item_key) 빼는(item_key: null) API.
// slot="head"|"arm"|"body"|"leg"|"foot" — 디아블로식 부위별 장비창, 5칸 동시 장착.
// slot="border" — 테두리 코스메틱, 부위 슬롯과 별개(equipped_border_key 컬럼).
// 전부 소모품이 아니라 "보유 개수 중 1개를 이 카드에 물려두는" 방식이라
// user_items.quantity를 실제로 증감시킨다(장착=차감, 해제=반환).
// 예전엔 재고 조회·갱신을 항목마다 따로 순차 쿼리해서 최대 6번 왕복했는데,
// 관련 item_key(기존 것+새 것)를 한 번에 조회하고 쓰기 작업은 Promise.all로
// 병렬 처리해서 장착 반응 속도를 눈에 띄게 줄임.
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

  const { data: cat } = await supabase
    .from("cats")
    .select("id,caretaker_id,equipped_slots,equipped_border_key")
    .eq("id", cat_id)
    .eq("caretaker_id", user.id)
    .maybeSingle();
  if (!cat) return NextResponse.json({ error: "cat not found" }, { status: 404 });

  const svc = serviceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const currentSlots = ((cat as { equipped_slots?: EquippedSlots | null }).equipped_slots ?? {}) as EquippedSlots;
  const currentKey = isBodySlot ? (currentSlots[slot as BodySlot] ?? null) : ((cat as { equipped_border_key?: string | null }).equipped_border_key ?? null);

  const patch = isBodySlot
    ? { equipped_slots: { ...currentSlots, [slot]: item_key } }
    : { equipped_border_key: item_key };

  if (currentKey === item_key) {
    // 같은 걸 다시 누른 경우(사실상 no-op) — 재고 쿼리 없이 바로 반환
    return NextResponse.json({ ok: true, slot, item_key });
  }

  // 관련된 item_key(기존 장착템 + 새로 낄 아이템) 재고를 한 번에 조회
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
