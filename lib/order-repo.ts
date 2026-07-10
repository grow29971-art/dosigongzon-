// ══════════════════════════════════════════
// 도시공존 — 주문 Repository
// Supabase orders / order_items 테이블 접근
// ══════════════════════════════════════════

import { createClient } from "@/lib/supabase/client";
import { computeCartTotal, type CartItem, type Product } from "@/lib/shop-repo";

export type OrderStatus =
  | "pending" | "paid" | "preparing" | "shipping"
  | "delivered" | "cancelled" | "refunded";

export const ORDER_STATUS_MAP: Record<OrderStatus, { label: string; color: string }> = {
  pending:   { label: "결제대기",   color: "#8B95A1" },
  paid:      { label: "결제완료",   color: "#3182F6" },
  preparing: { label: "상품준비중", color: "#E88D5A" },
  shipping:  { label: "배송중",     color: "#E88D5A" },
  delivered: { label: "배송완료",   color: "#6B8E6F" },
  cancelled: { label: "주문취소",   color: "#D85555" },
  refunded:  { label: "환불완료",   color: "#D85555" },
};

export interface Order {
  id: string;
  user_id: string;
  order_number: string;
  status: OrderStatus;
  total_amount: number;
  shipping_fee: number;
  payment_amount: number;
  recipient_name: string;
  recipient_phone: string;
  recipient_address: string;
  recipient_address_detail: string | null;
  postal_code: string;
  payment_key: string | null;
  payment_method: string | null;
  paid_at: string | null;
  tracking_number: string | null;
  memo: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  product_price: number;
  quantity: number;
  subtotal: number;
  created_at: string;
}

export interface ShippingInput {
  recipient_name: string;
  recipient_phone: string;
  recipient_address: string;
  recipient_address_detail?: string;
  postal_code: string;
  memo?: string;
}

// ── 주문번호 생성: DS-yyyyMMdd-XXXX (4자리 영숫자) ──
export function generateOrderNumber(): string {
  const now = new Date();
  const kst = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const ymd = [
    kst.getFullYear(),
    String(kst.getMonth() + 1).padStart(2, "0"),
    String(kst.getDate()).padStart(2, "0"),
  ].join("");
  // 혼동되기 쉬운 문자(0/O, 1/I/L) 제외
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let suffix = "";
  const rand = crypto.getRandomValues(new Uint8Array(4));
  for (let i = 0; i < 4; i++) suffix += chars[rand[i] % chars.length];
  return `DS-${ymd}-${suffix}`;
}

// ── 주문 생성 (장바구니 → orders + order_items 스냅샷, status: pending) ──
// 결제 승인은 STEP 5의 /api/payment/confirm에서 처리. 여기서는 재고를 차감하지 않음.
export async function createOrderFromCart(
  items: CartItem[],
  shipping: ShippingInput,
): Promise<Order> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요해요.");
  if (items.length === 0) throw new Error("주문할 상품이 없어요.");

  // 주문 직전 재고 재확인 — 장바구니에 담아둔 사이 품절될 수 있음
  const productIds = items.map((i) => i.product_id);
  const { data: fresh, error: stockError } = await supabase
    .from("products")
    .select("id, name, stock, is_active")
    .in("id", productIds);
  if (stockError) {
    console.error("[order-repo] stock check failed:", stockError);
    throw new Error(`재고 확인에 실패했어요: ${stockError.message}`);
  }
  const freshMap = new Map(
    ((fresh ?? []) as Pick<Product, "id" | "name" | "stock" | "is_active">[]).map((p) => [p.id, p]),
  );
  for (const item of items) {
    const p = freshMap.get(item.product_id);
    if (!p || !p.is_active) throw new Error(`"${item.product.name}"은(는) 판매가 종료됐어요.`);
    if (p.stock < item.quantity) {
      throw new Error(`"${p.name}" 재고가 부족해요. (남은 수량: ${p.stock}개)`);
    }
  }

  const { productTotal, shippingFee, grandTotal } = computeCartTotal(items);

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      user_id: user.id,
      order_number: generateOrderNumber(),
      status: "pending",
      total_amount: productTotal,
      shipping_fee: shippingFee,
      payment_amount: grandTotal,
      recipient_name: shipping.recipient_name,
      recipient_phone: shipping.recipient_phone,
      recipient_address: shipping.recipient_address,
      recipient_address_detail: shipping.recipient_address_detail ?? null,
      postal_code: shipping.postal_code,
      memo: shipping.memo?.trim() || null,
    })
    .select()
    .single();

  if (orderError) {
    console.error("[order-repo] createOrder failed:", orderError);
    throw new Error(`주문 생성에 실패했어요: ${orderError.message}`);
  }

  const created = order as Order;

  // 주문 시점 상품 스냅샷 저장
  const snapshots = items.map((item) => {
    const unitPrice = item.product.sale_price ?? item.product.price;
    return {
      order_id: created.id,
      product_id: item.product_id,
      product_name: item.product.name,
      product_price: unitPrice,
      quantity: item.quantity,
      subtotal: unitPrice * item.quantity,
    };
  });
  const { error: itemsError } = await supabase.from("order_items").insert(snapshots);
  if (itemsError) {
    console.error("[order-repo] order_items insert failed:", itemsError);
    // 스냅샷 실패 시 빈 주문이 남지 않게 주문도 취소 처리
    await supabase.from("orders").delete().eq("id", created.id);
    throw new Error(`주문 상품 저장에 실패했어요: ${itemsError.message}`);
  }

  return created;
}

// ══════════════════════════════════════════
// 주문 조회 (주문 내역 페이지용)
// ══════════════════════════════════════════

export interface OrderWithItems extends Order {
  items: OrderItem[];
}

// ── 내 주문 목록 (최신순, 아이템 포함) ──
export async function listMyOrders(): Promise<OrderWithItems[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("orders")
    .select("*, items:order_items(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[order-repo] listMyOrders failed:", error);
    throw new Error(`주문 내역을 불러올 수 없어요: ${error.message}`);
  }
  return (data ?? []) as OrderWithItems[];
}

// ── 주문 상세 (본인 것만 — RLS가 보장) ──
export async function getMyOrder(orderId: string): Promise<OrderWithItems | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("orders")
    .select("*, items:order_items(*)")
    .eq("id", orderId)
    .maybeSingle();

  if (error) {
    console.error("[order-repo] getMyOrder failed:", error);
    throw new Error(`주문 정보를 불러올 수 없어요: ${error.message}`);
  }
  return (data as OrderWithItems | null) ?? null;
}

// ── 주문 대표 상품명: "스마트 쉼터 외 2건" 형식 ──
export function orderDisplayName(items: OrderItem[]): string {
  if (items.length === 0) return "주문 상품";
  const first = items[0].product_name;
  return items.length > 1 ? `${first} 외 ${items.length - 1}건` : first;
}
