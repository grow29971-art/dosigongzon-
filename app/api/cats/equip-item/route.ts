import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { SHOP_ITEMS, type ShopItemKey } from "@/lib/shop-config";

// 카드에 테두리 코스메틱을 끼우거나(item_key) 빼는(item_key: null) API.
// slot="border"만 지원 — 부위별 장비창(head/arm/...)은 2026-07-20 카드배틀 삭제와 함께 제거됨.
//
// box/supabase_equip_item_rpc_migration.sql의 equip_item_atomic() DB 함수 하나로
// 소유권 확인·재고 조회·카드/재고 갱신을 전부 처리. RPC가 없거나 실패하면
// 503 fail-closed — 비원자 폴백은 동시 요청으로 재고 이중 차감/복제가 가능해
// 금지 (2026-07-26 보안 패치).
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { cat_id, item_key, slot } = await req.json();
  if (!cat_id) return NextResponse.json({ error: "cat_id required" }, { status: 400 });
  if (slot !== "border") {
    return NextResponse.json({ error: "invalid_slot" }, { status: 400 });
  }
  if (item_key !== null) {
    const item = SHOP_ITEMS[item_key as ShopItemKey];
    if (!item?.borderFx) return NextResponse.json({ error: "invalid_item" }, { status: 400 });
  }

  const svc = createServiceClient();

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

  // fail-closed: RPC 미배포든 일시 오류든 비원자 경로로 강등하지 않는다.
  console.error("[cats/equip-item] equip_item_atomic RPC 실패 — fail-closed:", rpcError.code);
  return NextResponse.json({ error: "not_ready" }, { status: 503 });
}
