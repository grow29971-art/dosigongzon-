import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { SHOP_ITEMS, type ShopItemKey } from "@/lib/shop-config";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { item_key } = await req.json();
  const item = SHOP_ITEMS[item_key as ShopItemKey];
  if (!item) return NextResponse.json({ error: "invalid_item" }, { status: 400 });

  const { data: existing } = await supabase
    .from("user_items")
    .select("quantity")
    .eq("user_id", user.id)
    .eq("item_key", item.key)
    .maybeSingle();

  const qty = existing?.quantity ?? 0;
  if (qty <= 0) return NextResponse.json({ error: "no_stock" }, { status: 400 });

  const svc = createServiceClient();
  // gt("quantity", 0) 필터로 동시 요청이 겹쳐도 최소한 음수로는 안 내려가게 방어.
  // (완전한 원자적 차감은 아니라 극단적으론 재고보다 1개 더 쓰는 경쟁 상태가 이론상
  // 남지만, 배틀 소모품이라 파급력이 작아 이 정도 방어로 충분하다고 판단)
  await svc.from("user_items").update({ quantity: qty - 1, updated_at: new Date().toISOString() })
    .eq("user_id", user.id).eq("item_key", item.key).gt("quantity", 0);

  return NextResponse.json({ ok: true, remaining: qty - 1 });
}
