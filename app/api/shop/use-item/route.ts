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

  const svc = createServiceClient();
  // 원자적 소모 — DB 조건부 증분 후 남은 수량 반환(consume_user_item). 동시 요청이
  // 같은 재고를 두 번 쓰던 레이스 차단. RPC 미배포(42883) 시 기존 gt-가드 방식 폴백.
  const { data: rpcRemaining, error: consumeErr } = await svc.rpc("consume_user_item", {
    p_user_id: user.id, p_item_key: item.key,
  });
  if (!consumeErr && typeof rpcRemaining === "number") {
    if (rpcRemaining < 0) return NextResponse.json({ error: "no_stock" }, { status: 400 });
    return NextResponse.json({ ok: true, remaining: rpcRemaining });
  }

  const { data: existing } = await supabase
    .from("user_items").select("quantity")
    .eq("user_id", user.id).eq("item_key", item.key).maybeSingle();
  const qty = existing?.quantity ?? 0;
  if (qty <= 0) return NextResponse.json({ error: "no_stock" }, { status: 400 });
  await svc.from("user_items").update({ quantity: qty - 1, updated_at: new Date().toISOString() })
    .eq("user_id", user.id).eq("item_key", item.key).gt("quantity", 0);

  return NextResponse.json({ ok: true, remaining: qty - 1 });
}
