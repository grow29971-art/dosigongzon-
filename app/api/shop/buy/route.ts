import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { SHOP_ITEMS, type ShopItemKey } from "@/lib/shop-config";

// box/supabase_shop_buy_rpc_migration.sql의 buy_shop_item_atomic() DB 함수로
// 코인 검증·차감·아이템 지급을 하나의 트랜잭션(행 잠금)으로 처리.
// RPC가 없거나 실패하면 503 fail-closed — 비원자 폴백은 동시 요청으로
// 코인 초과 구매가 가능한 경쟁 상태를 되살리므로 금지 (2026-07-26 보안 패치).
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

  // fail-closed: RPC 미배포(42883/PGRST202)든 일시 오류든 비원자 경로로 강등하지 않는다.
  console.error("[shop/buy] buy_shop_item_atomic RPC 실패 — fail-closed:", rpcError.code);
  return NextResponse.json({ error: "not_ready" }, { status: 503 });
}
