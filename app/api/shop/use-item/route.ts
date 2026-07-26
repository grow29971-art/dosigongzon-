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
  // 같은 재고를 두 번 쓰는 레이스 차단. RPC가 없거나 실패하면 503 fail-closed —
  // 비원자 폴백(read-then-write)은 중복 사용을 허용하므로 금지 (2026-07-26 보안 패치).
  const { data: rpcRemaining, error: consumeErr } = await svc.rpc("consume_user_item", {
    p_user_id: user.id, p_item_key: item.key,
  });
  if (!consumeErr && typeof rpcRemaining === "number") {
    if (rpcRemaining < 0) return NextResponse.json({ error: "no_stock" }, { status: 400 });
    return NextResponse.json({ ok: true, remaining: rpcRemaining });
  }

  console.error("[shop/use-item] consume_user_item RPC 실패 — fail-closed:", consumeErr?.code ?? "bad_return");
  return NextResponse.json({ error: "not_ready" }, { status: 503 });
}
