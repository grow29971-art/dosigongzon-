import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as serviceClient } from "@supabase/supabase-js";
import { SHOP_ITEMS, type ShopItemKey } from "@/lib/shop-config";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { item_key } = await req.json();
  const item = SHOP_ITEMS[item_key as ShopItemKey];
  if (!item) return NextResponse.json({ error: "invalid_item" }, { status: 400 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("coins")
    .eq("id", user.id)
    .maybeSingle();

  const coins = profile?.coins ?? 0;
  if (coins < item.price) {
    return NextResponse.json({ error: "insufficient_coins", need: item.price, have: coins }, { status: 400 });
  }

  const svc = serviceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: existing } = await svc
    .from("user_items")
    .select("quantity")
    .eq("user_id", user.id)
    .eq("item_key", item.key)
    .maybeSingle();

  const newQty = (existing?.quantity ?? 0) + 1;
  const newCoins = coins - item.price;

  await Promise.all([
    svc.from("profiles").update({ coins: newCoins }).eq("id", user.id),
    svc.from("user_items").upsert(
      { user_id: user.id, item_key: item.key, quantity: newQty, updated_at: new Date().toISOString() },
      { onConflict: "user_id,item_key" },
    ),
  ]);

  return NextResponse.json({ ok: true, coins: newCoins, item_key: item.key, quantity: newQty });
}
