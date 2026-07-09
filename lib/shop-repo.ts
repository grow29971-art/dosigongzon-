// ══════════════════════════════════════════
// 도시공존 — 쇼핑몰 Repository
// Supabase products / cart_items 테이블 접근
// ══════════════════════════════════════════

import { createClient } from "@/lib/supabase/client";

export type ProductCategory = "shelter" | "heater" | "goods" | "etc";

export const CATEGORY_MAP: Record<ProductCategory, { label: string }> = {
  shelter: { label: "쉼터" },
  heater: { label: "히터" },
  goods: { label: "굿즈" },
  etc: { label: "기타" },
};

export interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  sale_price: number | null;
  category: ProductCategory;
  images: string[];
  stock: number;
  is_active: boolean;
  shipping_fee: number;
  created_at: string;
  updated_at: string;
}

export interface CartItem {
  id: string;
  user_id: string;
  product_id: string;
  quantity: number;
  created_at: string;
  product: Product;
}

// ── 판매중 상품 목록 (카테고리 필터, 전체는 undefined) ──
export async function listProducts(category?: ProductCategory): Promise<Product[]> {
  const supabase = createClient();
  let query = supabase
    .from("products")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (category) query = query.eq("category", category);

  const { data, error } = await query;
  if (error) {
    console.error("[shop-repo] listProducts failed:", error);
    throw new Error(`상품 목록을 불러올 수 없어요: ${error.message}`);
  }
  return (data ?? []) as Product[];
}

// ── 상품 상세 ──
export async function getProduct(id: string): Promise<Product | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[shop-repo] getProduct failed:", error);
    throw new Error(`상품 정보를 불러올 수 없어요: ${error.message}`);
  }
  return (data as Product | null) ?? null;
}

// ── 내 장바구니 (상품 정보 조인) ──
export async function listCartItems(): Promise<CartItem[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("cart_items")
    .select("*, product:products(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[shop-repo] listCartItems failed:", error);
    throw new Error(`장바구니를 불러올 수 없어요: ${error.message}`);
  }

  // product가 null(삭제된 상품)인 항목은 제외
  return ((data ?? []) as CartItem[]).filter((c) => c.product !== null);
}

// ── 장바구니 담기 (이미 있으면 수량 누적) ──
export async function addToCart(productId: string, quantity = 1): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요해요.");

  const { data: existing, error: fetchError } = await supabase
    .from("cart_items")
    .select("id, quantity")
    .eq("user_id", user.id)
    .eq("product_id", productId)
    .maybeSingle();

  if (fetchError) {
    console.error("[shop-repo] addToCart(fetch) failed:", fetchError);
    throw new Error(`장바구니 확인에 실패했어요: ${fetchError.message}`);
  }

  if (existing) {
    const { error } = await supabase
      .from("cart_items")
      .update({ quantity: existing.quantity + quantity })
      .eq("id", existing.id);
    if (error) {
      console.error("[shop-repo] addToCart(update) failed:", error);
      throw new Error(`장바구니 담기에 실패했어요: ${error.message}`);
    }
    return;
  }

  const { error } = await supabase
    .from("cart_items")
    .insert({ user_id: user.id, product_id: productId, quantity });
  if (error) {
    console.error("[shop-repo] addToCart(insert) failed:", error);
    throw new Error(`장바구니 담기에 실패했어요: ${error.message}`);
  }
}

// ── 장바구니 수량 변경 ──
export async function updateCartQuantity(cartItemId: string, quantity: number): Promise<void> {
  const supabase = createClient();
  if (quantity <= 0) {
    await removeFromCart(cartItemId);
    return;
  }
  const { error } = await supabase
    .from("cart_items")
    .update({ quantity })
    .eq("id", cartItemId);
  if (error) {
    console.error("[shop-repo] updateCartQuantity failed:", error);
    throw new Error(`수량 변경에 실패했어요: ${error.message}`);
  }
}

// ── 장바구니 항목 삭제 ──
export async function removeFromCart(cartItemId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("cart_items")
    .delete()
    .eq("id", cartItemId);
  if (error) {
    console.error("[shop-repo] removeFromCart failed:", error);
    throw new Error(`삭제에 실패했어요: ${error.message}`);
  }
}

// ── 배송비 포함 합계 계산 (무료배송 상품은 shipping_fee=0) ──
export function computeCartTotal(items: CartItem[]): {
  productTotal: number;
  shippingFee: number;
  grandTotal: number;
} {
  let productTotal = 0;
  let shippingFee = 0;
  for (const item of items) {
    const unitPrice = item.product.sale_price ?? item.product.price;
    productTotal += unitPrice * item.quantity;
    shippingFee = Math.max(shippingFee, item.product.shipping_fee);
  }
  return { productTotal, shippingFee, grandTotal: productTotal + shippingFee };
}
