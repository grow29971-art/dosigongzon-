// ══════════════════════════════════════════
// 도시공존 — 쇼핑몰 Repository
// Supabase products / cart_items 테이블 접근
// ══════════════════════════════════════════

import { createClient } from "@/lib/supabase/client";

export type ProductCategory =
  | "food" | "sand" | "health" | "toy" | "shelter" | "goods";

export type ProductBadge = "신상" | "인기" | "한정";

// 카테고리 상수 — 아이콘은 UI 컴포넌트 쪽(lucide-react)에서 매핑
export const SHOP_CATEGORIES: Record<
  ProductCategory,
  { label: string; order: number; description: string }
> = {
  food:    { label: "사료·간식",   order: 1, description: "길고양이와 집고양이를 위한 사료·간식" },
  sand:    { label: "모래·위생",   order: 2, description: "모래, 배변패드, 탈취·위생용품" },
  health:  { label: "건강·케어",   order: 3, description: "영양제, 세정제, 건강관리 용품" },
  toy:     { label: "장난감·용품", order: 4, description: "장난감, 스크래쳐, 캣타워" },
  shelter: { label: "급식·쉼터",   order: 5, description: "야외 급식도구와 쉼터 용품" },
  goods:   { label: "굿즈",        order: 6, description: "도시공존 자체 브랜드 굿즈" },
};

// 하위 호환 별칭 (admin 페이지 등에서 사용)
export const CATEGORY_MAP = SHOP_CATEGORIES;

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
  badge: ProductBadge | null;
  is_donation: boolean;
  donation_percent: number;
  weight: string | null;
  supplier?: string | null; // 도매처 메모 — 클라이언트 조회에서 제외 (아래 컬럼 목록 참조)
  is_virtual: boolean;      // 가상상품(후원) — 배송 없음
  created_at: string;
  updated_at: string;
}

// 클라이언트에 내려도 되는 컬럼 목록 — supplier(도매처 메모)는 의도적으로 제외.
// select("*") 금지: 새 민감 컬럼이 생겨도 자동 노출되지 않게 명시적으로 관리.
export const PRODUCT_PUBLIC_COLUMNS =
  "id, name, description, price, sale_price, category, images, stock, is_active, shipping_fee, badge, is_donation, donation_percent, weight, is_virtual, created_at, updated_at";

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
    .select(PRODUCT_PUBLIC_COLUMNS)
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
    .select(PRODUCT_PUBLIC_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[shop-repo] getProduct failed:", error);
    throw new Error(`상품 정보를 불러올 수 없어요: ${error.message}`);
  }
  return (data as Product | null) ?? null;
}

// ══════════════════════════════════════════
// 게스트(비로그인) 장바구니 — localStorage. 로그인 유저는 서버 cart_items 사용.
// 게스트 CartItem은 id=product_id(합성), user_id="guest"로 채운다.
// ══════════════════════════════════════════
const GUEST_CART_KEY = "dosigongzon_guest_cart";

interface GuestCartEntry { product_id: string; quantity: number }

function readGuestCart(): GuestCartEntry[] {
  try {
    const raw = localStorage.getItem(GUEST_CART_KEY);
    return raw ? (JSON.parse(raw) as GuestCartEntry[]) : [];
  } catch {
    return [];
  }
}

function writeGuestCart(list: GuestCartEntry[]): void {
  try {
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify(list.filter((e) => e.quantity > 0)));
  } catch { /* 무시 */ }
}

export function clearGuestCart(): void {
  try { localStorage.removeItem(GUEST_CART_KEY); } catch { /* 무시 */ }
}

// ── 내 장바구니 (상품 정보 조인) — 로그인=서버, 비로그인=localStorage ──
export async function listCartItems(): Promise<CartItem[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    // 게스트: localStorage 항목 → 현재 상품 정보 조인
    const entries = readGuestCart();
    if (entries.length === 0) return [];
    const ids = entries.map((e) => e.product_id);
    const { data, error } = await supabase
      .from("products")
      .select(PRODUCT_PUBLIC_COLUMNS)
      .in("id", ids)
      .eq("is_active", true);
    if (error) {
      console.error("[shop-repo] listCartItems(guest) failed:", error);
      throw new Error(`장바구니를 불러올 수 없어요: ${error.message}`);
    }
    const prodMap = new Map(((data ?? []) as Product[]).map((p) => [p.id, p]));
    return entries
      .filter((e) => prodMap.has(e.product_id))
      .map((e) => ({
        id: e.product_id,
        user_id: "guest",
        product_id: e.product_id,
        quantity: e.quantity,
        created_at: "",
        product: prodMap.get(e.product_id)!,
      }));
  }

  const { data, error } = await supabase
    .from("cart_items")
    .select(`*, product:products(${PRODUCT_PUBLIC_COLUMNS})`)
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

  if (!user) {
    // 게스트: localStorage 누적
    const list = readGuestCart();
    const idx = list.findIndex((e) => e.product_id === productId);
    if (idx >= 0) list[idx].quantity += quantity;
    else list.push({ product_id: productId, quantity });
    writeGuestCart(list);
    return;
  }

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

// ── 장바구니 수량 변경 (게스트는 cartItemId=product_id) ──
export async function updateCartQuantity(cartItemId: string, quantity: number): Promise<void> {
  const supabase = createClient();
  if (quantity <= 0) {
    await removeFromCart(cartItemId);
    return;
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const list = readGuestCart();
    const idx = list.findIndex((e) => e.product_id === cartItemId);
    if (idx >= 0) { list[idx].quantity = quantity; writeGuestCart(list); }
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

// ── 장바구니 항목 삭제 (게스트는 cartItemId=product_id) ──
export async function removeFromCart(cartItemId: string): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    writeGuestCart(readGuestCart().filter((e) => e.product_id !== cartItemId));
    return;
  }
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
