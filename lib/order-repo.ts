// ══════════════════════════════════════════
// 도시공존 — 주문 Repository
// Supabase orders / order_items 테이블 접근
// ══════════════════════════════════════════

import { createClient } from "@/lib/supabase/client";
import { computeCartTotal, type CartItem, type Product } from "@/lib/shop-repo";
import { enforceUserActionLimit } from "@/lib/rate-limit";
import { PAYMENT_ENABLED, PAYMENT_DISABLED_MESSAGE } from "@/lib/payments-config";

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
  user_id: string | null;       // 게스트 주문은 null
  guest_token?: string | null;  // 게스트 주문 접근 비밀키(회원 주문은 null)
  order_number: string;
  status: OrderStatus;
  total_amount: number;
  shipping_fee: number;
  payment_amount: number;
  // 배송지 — 가상(후원) 상품 전용 주문은 배송이 없어 null
  recipient_name: string | null;
  recipient_phone: string | null;
  recipient_address: string | null;
  recipient_address_detail: string | null;
  postal_code: string | null;
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
  donation_amount: number; // 주문 시점 후원 적립액 스냅샷
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

// ── 장바구니 전체가 가상(후원) 상품인지 — 배송지 생략 가능 여부 ──
export function isVirtualOnlyCart(items: CartItem[]): boolean {
  return items.length > 0 && items.every((i) => i.product.is_virtual);
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
// shipping=null은 가상(후원) 상품 전용 주문 — 배송지 없이 생성.
export async function createOrderFromCart(
  items: CartItem[],
  shipping: ShippingInput | null,
  pointsUsed: number = 0,
): Promise<Order> {
  // 통신판매업 신고 완료 전 실화폐 결제 하드락 — 주문 생성 자체를 막아 결제창이 안 열리게.
  // (최종 방어는 /api/payment/confirm 서버 관문. 코인 구매는 이 경로가 아니라 무관.)
  if (!PAYMENT_ENABLED) throw new Error(PAYMENT_DISABLED_MESSAGE);

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요해요.");
  if (items.length === 0) throw new Error("주문할 상품이 없어요.");
  if (!shipping && !isVirtualOnlyCart(items)) {
    throw new Error("실물 상품 주문에는 배송지가 필요해요.");
  }

  // 포인트 검증 (1차 — 최종 검증·차감은 결제 승인 API에서 서버가 수행)
  if (!Number.isInteger(pointsUsed) || pointsUsed < 0) {
    throw new Error("포인트 사용액이 올바르지 않아요.");
  }
  if (pointsUsed > 0 && items.some((i) => i.product.is_virtual || i.product.is_donation)) {
    // 후원/가상 상품은 포인트 사용 불가 — 실입금 없는 후원 집계 왜곡 방지
    throw new Error("후원 상품에는 포인트를 사용할 수 없어요.");
  }

  // 주문 도배 방지 — 분당 5건, 일당 30건 (결제창 이탈 재시도는 여유 있게 허용)
  await enforceUserActionLimit(supabase, {
    table: "orders",
    userColumn: "user_id",
    userId: user.id,
    perMinute: 5,
    perDay: 30,
    label: "주문",
  });

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

  // 포인트는 최종 결제액이 100원(토스 최소 결제) 미만이 되지 않는 선까지만
  if (pointsUsed > 0 && grandTotal - pointsUsed < 100) {
    throw new Error("포인트 사용 후 결제 금액은 100원 이상이어야 해요.");
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      user_id: user.id,
      order_number: generateOrderNumber(),
      status: "pending",
      total_amount: productTotal,
      shipping_fee: shippingFee,
      payment_amount: grandTotal - pointsUsed,
      // 마이그레이션 전 배포 호환: 컬럼은 포인트 사용 시에만 포함
      ...(pointsUsed > 0 ? { points_used: pointsUsed } : {}),
      recipient_name: shipping?.recipient_name ?? null,
      recipient_phone: shipping?.recipient_phone ?? null,
      recipient_address: shipping?.recipient_address ?? null,
      recipient_address_detail: shipping?.recipient_address_detail ?? null,
      postal_code: shipping?.postal_code ?? null,
      memo: shipping?.memo?.trim() || null,
    })
    .select()
    .single();

  if (orderError) {
    console.error("[order-repo] createOrder failed:", orderError);
    throw new Error(`주문 생성에 실패했어요: ${orderError.message}`);
  }

  const created = order as Order;

  // 주문 시점 상품 스냅샷 저장 (후원 적립액 포함 — 이후 비율 변경과 무관하게 고정)
  const snapshots = items.map((item) => {
    const unitPrice = item.product.sale_price ?? item.product.price;
    const subtotal = unitPrice * item.quantity;
    const donationAmount = item.product.is_donation
      ? Math.floor((subtotal * item.product.donation_percent) / 100)
      : 0;
    return {
      order_id: created.id,
      product_id: item.product_id,
      product_name: item.product.name,
      product_price: unitPrice,
      quantity: item.quantity,
      subtotal,
      donation_amount: donationAmount,
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

// ══════════════════════════════════════════
// 게스트(비로그인) 주문 — SECURITY DEFINER RPC 경유
// 서버가 금액·재고 재계산해 pending 주문 생성. 게스트는 order_number+guest_token으로만 접근.
// ══════════════════════════════════════════

export interface GuestOrderResult {
  order_id: string;
  order_number: string;
  guest_token: string;
  payment_amount: number;
}

// 이 기기에서 만든 게스트 주문 기억 (order_number+token) — "게스트 주문 조회"용
const GUEST_ORDERS_KEY = "dosigongzon_guest_orders";

function rememberGuestOrder(orderNumber: string, guestToken: string): void {
  try {
    const raw = localStorage.getItem(GUEST_ORDERS_KEY);
    const list: { order_number: string; guest_token: string }[] = raw ? JSON.parse(raw) : [];
    if (!list.some((o) => o.order_number === orderNumber)) {
      list.unshift({ order_number: orderNumber, guest_token: guestToken });
      localStorage.setItem(GUEST_ORDERS_KEY, JSON.stringify(list.slice(0, 50)));
    }
  } catch { /* 무시 */ }
}

export function listRememberedGuestOrders(): { order_number: string; guest_token: string }[] {
  try {
    const raw = localStorage.getItem(GUEST_ORDERS_KEY);
    return raw ? (JSON.parse(raw) as { order_number: string; guest_token: string }[]) : [];
  } catch {
    return [];
  }
}

// ── 게스트 주문 생성 ──
export async function createGuestOrder(
  items: CartItem[],
  shipping: ShippingInput | null,
): Promise<GuestOrderResult> {
  if (!PAYMENT_ENABLED) throw new Error(PAYMENT_DISABLED_MESSAGE);
  if (items.length === 0) throw new Error("주문할 상품이 없어요.");
  if (!shipping && !isVirtualOnlyCart(items)) {
    throw new Error("실물 상품 주문에는 배송지가 필요해요.");
  }

  const supabase = createClient();
  const p_items = items.map((i) => ({ product_id: i.product_id, quantity: i.quantity }));
  const p_shipping = shipping
    ? {
        recipient_name: shipping.recipient_name,
        recipient_phone: shipping.recipient_phone,
        recipient_address: shipping.recipient_address,
        recipient_address_detail: shipping.recipient_address_detail ?? "",
        postal_code: shipping.postal_code,
        memo: shipping.memo ?? "",
      }
    : null;

  const { data, error } = await supabase.rpc("create_guest_order", { p_items, p_shipping });
  if (error) throw new Error(error.message);
  const res = data as GuestOrderResult;
  rememberGuestOrder(res.order_number, res.guest_token);
  return res;
}

// ── 게스트 주문 조회 (order_number + token 일치 시에만) ──
export async function getGuestOrder(orderNumber: string, guestToken: string): Promise<OrderWithItems | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_guest_order", {
    p_order_number: orderNumber,
    p_guest_token: guestToken,
  });
  if (error) throw new Error(error.message);
  if (!data) return null;
  const parsed = data as { order: Order | null; items: OrderItem[] };
  if (!parsed.order) return null;
  return { ...parsed.order, items: parsed.items ?? [] };
}

// ── 게스트 주문 취소 (결제 전 pending만) ──
export async function cancelGuestOrder(orderNumber: string, guestToken: string): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("cancel_guest_order", {
    p_order_number: orderNumber,
    p_guest_token: guestToken,
  });
  if (error) throw new Error(error.message);
  return Boolean(data);
}
