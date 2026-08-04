// ══════════════════════════════════════════
// 도시공존 — 쇼핑몰 관리자 Repository
// 상품 등록/수정 + 주문 상태 관리 (admins 전용)
// RLS(products_write_admin / orders_update_admin)에 더해
// requireAdmin()으로 코드 레벨 이중 확인.
// ══════════════════════════════════════════

import { createClient } from "@/lib/supabase/client";
import { requireAdmin } from "@/lib/admin-guard";
import { convertImageToWebp } from "@/lib/cats-repo";
import { isSafeImageUrl } from "@/lib/url-validate";
import type { Product, ProductBadge, ProductCategory } from "@/lib/shop-repo";
import type { OrderStatus, OrderWithItems } from "@/lib/order-repo";

export interface ProductInput {
  name: string;
  description: string | null;
  price: number;
  sale_price: number | null;
  category: ProductCategory;
  images: string[];
  stock: number;
  is_active: boolean;
  shipping_fee: number;
  badge: ProductBadge | null;
  is_donation: boolean;
  donation_percent: number;
  weight: string | null;
  is_virtual: boolean;
  supplier: string | null; // 도매처 메모 — 관리자 전용 (클라이언트 조회 컬럼에서 제외됨)
}

export const MAX_PRODUCT_IMAGES = 5;

function validateProductInput(input: ProductInput): void {
  if (!input.name.trim()) throw new Error("상품명을 입력해주세요.");
  if (!Number.isInteger(input.price) || input.price < 0) throw new Error("가격은 0 이상 정수여야 해요.");
  if (input.sale_price !== null) {
    if (!Number.isInteger(input.sale_price) || input.sale_price < 0) throw new Error("할인가는 0 이상 정수여야 해요.");
    if (input.sale_price >= input.price) throw new Error("할인가는 원가보다 낮아야 해요.");
  }
  if (!Number.isInteger(input.stock) || input.stock < 0) throw new Error("재고는 0 이상 정수여야 해요.");
  if (!Number.isInteger(input.shipping_fee) || input.shipping_fee < 0) throw new Error("배송비는 0 이상 정수여야 해요.");
  if (!Number.isInteger(input.donation_percent) || input.donation_percent < 0 || input.donation_percent > 100) {
    throw new Error("후원 비율은 0~100 사이 정수여야 해요.");
  }
  if (input.is_virtual && input.shipping_fee > 0) throw new Error("가상(배송 없음) 상품은 배송비가 0이어야 해요.");
  if (input.images.length > MAX_PRODUCT_IMAGES) throw new Error(`이미지는 최대 ${MAX_PRODUCT_IMAGES}장까지 가능해요.`);
  for (const url of input.images) {
    if (!isSafeImageUrl(url)) throw new Error("이미지 URL 형식이 올바르지 않아요.");
  }
}

// ── 전체 상품 목록 (판매중지 포함) ──
export async function listAllProducts(): Promise<Product[]> {
  await requireAdmin();
  const supabase = createClient();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[shop-admin-repo] listAllProducts failed:", error);
    throw new Error(`상품 목록을 불러올 수 없어요: ${error.message}`);
  }
  return (data ?? []) as Product[];
}

// ── 상품 등록 ──
export async function createProduct(input: ProductInput): Promise<Product> {
  await requireAdmin();
  validateProductInput(input);
  const supabase = createClient();
  const { data, error } = await supabase
    .from("products")
    .insert(input)
    .select()
    .single();

  if (error) {
    console.error("[shop-admin-repo] createProduct failed:", error);
    throw new Error(`상품 등록에 실패했어요: ${error.message}`);
  }
  return data as Product;
}

// ── 상품 수정 ──
export async function updateProduct(id: string, input: ProductInput): Promise<Product> {
  await requireAdmin();
  validateProductInput(input);
  const supabase = createClient();
  const { data, error } = await supabase
    .from("products")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[shop-admin-repo] updateProduct failed:", error);
    throw new Error(`상품 수정에 실패했어요: ${error.message}`);
  }
  return data as Product;
}

// ── 판매 상태 토글 (소프트 삭제 = is_active false) ──
export async function setProductActive(id: string, isActive: boolean): Promise<void> {
  await requireAdmin();
  const supabase = createClient();
  const { error } = await supabase
    .from("products")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    console.error("[shop-admin-repo] setProductActive failed:", error);
    throw new Error(`상태 변경에 실패했어요: ${error.message}`);
  }
}

// ── 상품 이미지 업로드 (cat-photos 버킷 재사용, product_ prefix) ──
export async function uploadProductImage(file: File): Promise<string> {
  const adminId = await requireAdmin();
  const supabase = createClient();

  const MAX_INPUT_SIZE = 20 * 1024 * 1024;
  if (file.size > MAX_INPUT_SIZE) throw new Error("이미지는 20MB 이하만 업로드 가능해요.");
  if (!file.type.startsWith("image/")) throw new Error("이미지 파일만 업로드 가능해요.");

  const webpFile = await convertImageToWebp(file);
  const fileName = `${adminId}/product_${crypto.randomUUID()}.webp`;

  const { error: uploadError } = await supabase.storage
    .from("cat-photos")
    .upload(fileName, webpFile, {
      cacheControl: "2592000",
      upsert: false,
      contentType: "image/webp",
    });

  if (uploadError) {
    console.error("[shop-admin-repo] uploadProductImage failed:", uploadError);
    throw new Error(`이미지 업로드에 실패했어요: ${uploadError.message}`);
  }

  const { data: urlData } = supabase.storage
    .from("cat-photos")
    .getPublicUrl(fileName);
  return urlData.publicUrl;
}

// ══════════════════════════════════════════
// 주문 관리
// ══════════════════════════════════════════

// ── 전체 주문 목록 (상태 필터, admin RLS로 전체 조회 가능) ──
// 관리자 계정 하나가 탈취되면 이 함수가 전 고객의 이름·전화·주소를 한 번에 넘겨준다.
// 상한을 두어 단일 요청으로 전체 주소록이 빠져나가지 않게 한다. 더 오래된 주문은
// 상태 필터로 좁혀 보는 것이 정상 운영 동선이다. (2026-08-04 보안)
const ADMIN_ORDER_PAGE_SIZE = 200;

export async function listAllOrders(status?: OrderStatus): Promise<OrderWithItems[]> {
  await requireAdmin();
  const supabase = createClient();
  let query = supabase
    .from("orders")
    .select("*, items:order_items(*)")
    .order("created_at", { ascending: false })
    .limit(ADMIN_ORDER_PAGE_SIZE);

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) {
    console.error("[shop-admin-repo] listAllOrders failed:", error.code);
    throw new Error("주문 목록을 불러올 수 없어요.");
  }
  return (data ?? []) as OrderWithItems[];
}

// ── 열린 환불 요청 목록 (심사 대기 / 토스 실패 / 처리 중단) ──
// 마이그레이션 전(order_refunds 미생성)이면 조용히 빈 목록을 돌려준다.
export interface AdminRefundRequest {
  id: string;
  order_id: string;
  status: "requested" | "approved" | "failed";
  kind: "full" | "partial";
  amount: number;
  reason_code: string;
  reason_note: string | null;
  return_shipping_fee: number;
  created_at: string;
  order: {
    id: string;
    order_number: string;
    status: OrderStatus;
    payment_amount: number;
    recipient_name: string | null;
  } | null;
}

export async function listOpenRefunds(): Promise<AdminRefundRequest[]> {
  await requireAdmin();
  const supabase = createClient();
  const { data, error } = await supabase
    .from("order_refunds")
    .select("id, order_id, status, kind, amount, reason_code, reason_note, return_shipping_fee, created_at, order:orders(id, order_number, status, payment_amount, recipient_name)")
    .in("status", ["requested", "approved", "failed"])
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[shop-admin-repo] listOpenRefunds failed:", error);
    return [];
  }
  return (data ?? []) as unknown as AdminRefundRequest[];
}

// 재고 복구가 필요한 전환: 결제 후 상태 → 취소/환불
const STOCK_RESTORE_FROM: OrderStatus[] = ["paid", "preparing", "shipping"];

// ── 주문 상태/운송장 변경 ──
// paid 이후 상태에서 취소/환불로 바꾸면 재고를 복구.
// (실 결제 환불은 STEP 5 토스 연동 후 /api/payment/cancel에서 처리 —
//  그 전까지는 상태 관리 + 재고 복구만 담당)
export async function updateOrderAdmin(
  order: OrderWithItems,
  changes: { status?: OrderStatus; tracking_number?: string | null },
): Promise<void> {
  await requireAdmin();
  const supabase = createClient();

  // 배송 시각 기록 — 청약철회 "받은 날부터 7일"의 기산점. 이미 기록돼 있으면 보존.
  // 배송중을 건너뛰고 바로 배송완료로 바꾸면 shipped_at도 함께 채운다.
  const now = new Date().toISOString();
  const timestamps: { shipped_at?: string; delivered_at?: string } = {};
  if (changes.status === "shipping" && order.status !== "shipping" && !order.shipped_at) {
    timestamps.shipped_at = now;
  }
  if (changes.status === "delivered" && order.status !== "delivered") {
    if (!order.shipped_at) timestamps.shipped_at = now;
    if (!order.delivered_at) timestamps.delivered_at = now;
  }

  let { error } = await supabase
    .from("orders")
    .update({ ...changes, ...timestamps, updated_at: now })
    .eq("id", order.id);

  // 마이그레이션 전(shipped_at/delivered_at 컬럼 없음)이면 시각 없이 재시도
  if (error && (error.code === "PGRST204" || error.code === "42703")) {
    ({ error } = await supabase
      .from("orders")
      .update({ ...changes, updated_at: now })
      .eq("id", order.id));
  }

  if (error) {
    console.error("[shop-admin-repo] updateOrderAdmin failed:", error);
    throw new Error(`주문 변경에 실패했어요: ${error.message}`);
  }

  // 취소/환불 전환 시 재고 복구
  const toAborted = changes.status === "cancelled" || changes.status === "refunded";
  if (toAborted && STOCK_RESTORE_FROM.includes(order.status)) {
    for (const item of order.items) {
      if (!item.product_id) continue;
      const { data: p } = await supabase
        .from("products")
        .select("stock")
        .eq("id", item.product_id)
        .maybeSingle();
      if (!p) continue;
      const { error: stockError } = await supabase
        .from("products")
        .update({ stock: (p.stock as number) + item.quantity })
        .eq("id", item.product_id);
      if (stockError) {
        console.error("[shop-admin-repo] stock restore failed:", stockError);
      }
    }
  }
}
