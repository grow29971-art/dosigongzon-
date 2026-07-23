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
import { PRODUCT_PUBLIC_COLUMNS } from "@/lib/shop-repo";
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
// supplier(도매처 메모)가 anon/authenticated에서 REVOKE되므로,
// 관리자 목록은 service_role 서버 라우트를 경유해 supplier까지 읽는다.
export async function listAllProducts(): Promise<Product[]> {
  await requireAdmin();
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch("/api/admin/products", {
    headers: session?.access_token
      ? { Authorization: `Bearer ${session.access_token}` }
      : {},
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({} as { error?: string }));
    console.error("[shop-admin-repo] listAllProducts failed:", res.status, err);
    throw new Error(`상품 목록을 불러올 수 없어요: ${err.error ?? res.status}`);
  }
  const { products } = (await res.json()) as { products: Product[] };
  return products ?? [];
}

// ── 상품 등록 ──
export async function createProduct(input: ProductInput): Promise<Product> {
  await requireAdmin();
  validateProductInput(input);
  const supabase = createClient();
  // 반환은 supplier 제외 공개컬럼만 — authenticated는 supplier SELECT 권한이 없음.
  const { data, error } = await supabase
    .from("products")
    .insert(input)
    .select(PRODUCT_PUBLIC_COLUMNS)
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
  // 반환은 supplier 제외 공개컬럼만 — authenticated는 supplier SELECT 권한이 없음.
  const { data, error } = await supabase
    .from("products")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(PRODUCT_PUBLIC_COLUMNS)
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
export async function listAllOrders(status?: OrderStatus): Promise<OrderWithItems[]> {
  await requireAdmin();
  const supabase = createClient();
  let query = supabase
    .from("orders")
    .select("*, items:order_items(*)")
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) {
    console.error("[shop-admin-repo] listAllOrders failed:", error);
    throw new Error(`주문 목록을 불러올 수 없어요: ${error.message}`);
  }
  return (data ?? []) as OrderWithItems[];
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

  const { error } = await supabase
    .from("orders")
    .update({ ...changes, updated_at: new Date().toISOString() })
    .eq("id", order.id);

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
