import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { SHOP_ITEMS, type ShopItemKey } from "@/lib/shop-config";

// box/supabase_shop_buy_rpc_migration.sql의 buy_shop_item_atomic() DB 함수로
// 코인 검증·차감·아이템 지급을 하나의 트랜잭션(행 잠금)으로 처리 — 예전엔
// 이걸 별도 쿼리로 나눠서 처리해서 동시 구매 요청 시 코인보다 많은 아이템을
// 살 수 있는 경쟁 상태가 있었음. RPC가 아직 없으면(마이그레이션 전) 이전
// 방식으로 자동 폴백(기능은 그대로, 경쟁 상태 방지만 빠짐).
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { item_key } = await req.json();
  const item = SHOP_ITEMS[item_key as ShopItemKey];
  if (!item) return NextResponse.json({ error: "invalid_item" }, { status: 400 });

  const svc = createServiceClient();

  const { data: rpcData, error: rpcError } = await svc.rpc("buy_shop_item_atomic", {
    p_user_id: user.id,
    p_item_key: item.key,
    p_price: item.price,
  });

  if (!rpcError) {
    const result = rpcData as { ok?: boolean; error?: string; need?: number; have?: number; coins?: number; item_key?: string; quantity?: number };
    if (result?.error === "insufficient_coins") {
      return NextResponse.json({ error: "insufficient_coins", need: result.need, have: result.have }, { status: 400 });
    }
    if (result?.error) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true, coins: result.coins, item_key: result.item_key, quantity: result.quantity });
  }

  // RPC 미배포 시(마이그레이션 전) 이전 다단계 방식으로 폴백
  const { data: profile } = await supabase
    .from("profiles")
    .select("coins")
    .eq("id", user.id)
    .maybeSingle();

  const coins = profile?.coins ?? 0;
  if (coins < item.price) {
    return NextResponse.json({ error: "insufficient_coins", need: item.price, have: coins }, { status: 400 });
  }

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
