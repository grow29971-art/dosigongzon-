import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as serviceClient } from "@supabase/supabase-js";
import { SHOP_ITEMS, type ShopItemKey } from "@/lib/shop-config";

// 카드에 장착 아이템을 끼우거나(item_key) 빼는(item_key: null) API.
// 장착 아이템은 소모품이 아니라 "보유 개수 중 1개를 이 카드에 물려두는" 방식이라
// user_items.quantity를 실제로 증감시킨다(장착=차감, 해제=반환).
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { cat_id, item_key } = await req.json();
  if (!cat_id) return NextResponse.json({ error: "cat_id required" }, { status: 400 });
  if (item_key !== null && !SHOP_ITEMS[item_key as ShopItemKey]?.equip) {
    return NextResponse.json({ error: "invalid_item" }, { status: 400 });
  }

  const { data: cat } = await supabase
    .from("cats")
    .select("id,caretaker_id,equipped_item_key")
    .eq("id", cat_id)
    .eq("caretaker_id", user.id)
    .maybeSingle();
  if (!cat) return NextResponse.json({ error: "cat not found" }, { status: 404 });

  const svc = serviceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const currentKey = (cat as { equipped_item_key?: string | null }).equipped_item_key ?? null;

  // 장착 시도인데 이미 보유 수량이 없으면 거절
  if (item_key) {
    const { data: owned } = await svc
      .from("user_items")
      .select("quantity")
      .eq("user_id", user.id)
      .eq("item_key", item_key)
      .maybeSingle();
    const qty = (owned as { quantity?: number } | null)?.quantity ?? 0;
    if (qty < 1) return NextResponse.json({ error: "no_stock" }, { status: 400 });
  }

  // 기존 장착템이 있었으면 반환(재고 +1)
  if (currentKey) {
    const { data: prevOwned } = await svc
      .from("user_items").select("quantity").eq("user_id", user.id).eq("item_key", currentKey).maybeSingle();
    const prevQty = (prevOwned as { quantity?: number } | null)?.quantity ?? 0;
    await svc.from("user_items").upsert(
      { user_id: user.id, item_key: currentKey, quantity: prevQty + 1, updated_at: new Date().toISOString() },
      { onConflict: "user_id,item_key" },
    );
  }

  // 새 아이템 장착이면 재고 -1
  if (item_key) {
    const { data: owned } = await svc
      .from("user_items").select("quantity").eq("user_id", user.id).eq("item_key", item_key).maybeSingle();
    const qty = (owned as { quantity?: number } | null)?.quantity ?? 0;
    await svc.from("user_items").update({ quantity: qty - 1, updated_at: new Date().toISOString() })
      .eq("user_id", user.id).eq("item_key", item_key);
  }

  const { error: updateError } = await svc.from("cats").update({ equipped_item_key: item_key }).eq("id", cat_id);
  if (updateError) {
    return NextResponse.json({ error: "migration_needed", detail: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, equipped_item_key: item_key });
}
