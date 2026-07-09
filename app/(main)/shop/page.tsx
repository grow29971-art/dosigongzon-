"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ShoppingBag, ShoppingCart, ReceiptText } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { listProducts, listCartItems, CATEGORY_MAP, type Product, type ProductCategory } from "@/lib/shop-repo";
import { sanitizeImageUrl } from "@/lib/url-validate";

type FilterKey = ProductCategory | "all";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "shelter", label: CATEGORY_MAP.shelter.label },
  { key: "heater", label: CATEGORY_MAP.heater.label },
  { key: "goods", label: CATEGORY_MAP.goods.label },
];

function formatWon(amount: number): string {
  return `${amount.toLocaleString()}원`;
}

function ProductCard({ product }: { product: Product }) {
  const thumb = sanitizeImageUrl(product.images[0], "https://placehold.co/400x400?text=No+Image");
  const soldOut = product.stock <= 0;
  const discounted = product.sale_price != null && product.sale_price < product.price;

  return (
    <Link
      href={`/shop/${product.id}`}
      className="block active:scale-[0.98] transition-transform"
    >
      <div
        className="overflow-hidden"
        style={{
          background: "#FFFFFF",
          borderRadius: 22,
          boxShadow: "0 6px 20px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.03)",
          border: "1px solid rgba(0,0,0,0.04)",
        }}
      >
        <div className="relative w-full" style={{ aspectRatio: "1 / 1", background: "#F4F7FC" }}>
          <Image src={thumb} alt={product.name} fill className="object-cover" unoptimized={thumb.includes("placehold.co")} />
          {soldOut && (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ background: "rgba(38,42,56,0.55)" }}
            >
              <span className="text-white text-[13px] font-extrabold px-3 py-1.5 rounded-xl" style={{ background: "rgba(0,0,0,0.35)" }}>
                품절
              </span>
            </div>
          )}
        </div>
        <div className="px-3 py-3">
          <p className="text-[13.5px] font-bold text-text-main truncate">{product.name}</p>
          <div className="mt-1 flex items-baseline gap-1.5">
            {discounted && (
              <span className="text-[11px] text-text-light line-through">{formatWon(product.price)}</span>
            )}
            <span className="text-[14.5px] font-extrabold" style={{ color: discounted ? "#E14B3C" : "#262A38" }}>
              {formatWon(discounted ? (product.sale_price as number) : product.price)}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function ShopPage() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [loading, setLoading] = useState(true);
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    setLoading(true);
    listProducts(filter === "all" ? undefined : filter)
      .then(setProducts)
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => {
    if (!user) { setCartCount(0); return; }
    listCartItems()
      .then((items) => setCartCount(items.reduce((sum, i) => sum + i.quantity, 0)))
      .catch(() => setCartCount(0));
  }, [user]);

  return (
    <div className="px-4 pt-14 pb-24">
      {/* 헤더 */}
      <div className="mb-5 px-1 flex items-end justify-between">
        <div>
          <div className="flex items-baseline gap-2 mb-1">
            <h1 className="text-[24px] font-extrabold text-text-main tracking-tight">쇼핑</h1>
            <span className="text-[11px] font-semibold text-text-light">Shop</span>
          </div>
          <p className="text-[12.5px] text-text-sub leading-relaxed">
            우리 동네 고양이를 위한 쉼터 · 용품
          </p>
        </div>
        <div className="flex items-center gap-2">
        <Link
          href="/shop/orders"
          className="w-10 h-10 rounded-full bg-white flex items-center justify-center active:scale-90 transition-transform"
          style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
          aria-label="주문 내역"
        >
          <ReceiptText size={18} className="text-text-sub" />
        </Link>
        <Link
          href="/shop/cart"
          className="relative w-10 h-10 rounded-full bg-white flex items-center justify-center active:scale-90 transition-transform"
          style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
          aria-label="장바구니"
        >
          <ShoppingCart size={18} className="text-text-sub" />
          {cartCount > 0 && (
            <span
              className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-white text-[9px] font-extrabold flex items-center justify-center"
              style={{ background: "#E14B3C" }}
            >
              {cartCount > 99 ? "99+" : cartCount}
            </span>
          )}
        </Link>
        </div>
      </div>

      {/* 카테고리 필터 */}
      <div className="mb-4 flex items-center gap-2 overflow-x-auto">
        {FILTERS.map((f) => {
          const on = filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className="px-3.5 py-1.5 rounded-2xl text-[12px] font-bold active:scale-95 transition-transform shrink-0"
              style={{
                background: on ? "linear-gradient(135deg, #4C82BC 0%, #3E6FA8 100%)" : "rgba(255,255,255,0.9)",
                color: on ? "#fff" : "#666",
                boxShadow: on ? "0 2px 8px rgba(76,130,188,0.35)" : "0 2px 6px rgba(0,0,0,0.05)",
              }}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* 상품 그리드 */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-[22px] animate-pulse" style={{ aspectRatio: "1 / 1.35", background: "#EEF1F6" }} />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center text-center pt-14">
          <div
            className="w-16 h-16 rounded-3xl flex items-center justify-center mb-4"
            style={{ background: "linear-gradient(135deg, #f5e6d8 0%, #e8c9a8 100%)" }}
          >
            <ShoppingBag size={28} style={{ color: "#4C82BC" }} />
          </div>
          <p className="text-[14px] font-bold text-text-main mb-1">아직 등록된 상품이 없어요</p>
          <p className="text-[12.5px] text-text-sub">곧 새로운 상품으로 찾아올게요!</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
