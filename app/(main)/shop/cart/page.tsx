"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import LoginRequired from "@/app/components/LoginRequired";
import {
  listCartItems, updateCartQuantity, removeFromCart, computeCartTotal,
  type CartItem,
} from "@/lib/shop-repo";
import { sanitizeImageUrl } from "@/lib/url-validate";

function formatWon(amount: number): string {
  return `${amount.toLocaleString()}원`;
}

export default function CartPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = () => {
    setLoading(true);
    listCartItems()
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!user) return;
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (!authLoading && !user) {
    return <LoginRequired from="/shop/cart" title="장바구니는 로그인 후 이용할 수 있어요" description="담아둔 상품을 안전하게 보관하려면 로그인이 필요해요." />;
  }

  const handleQuantity = async (item: CartItem, delta: number) => {
    const next = Math.max(1, Math.min(item.product.stock, item.quantity + delta));
    if (next === item.quantity) return;
    setBusyId(item.id);
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, quantity: next } : i)));
    try {
      await updateCartQuantity(item.id, next);
    } finally {
      setBusyId(null);
    }
  };

  const handleRemove = async (item: CartItem) => {
    setBusyId(item.id);
    try {
      await removeFromCart(item.id);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    } finally {
      setBusyId(null);
    }
  };

  const { productTotal, shippingFee, grandTotal } = computeCartTotal(items);

  return (
    <div className="pb-32">
      <div className="px-4 pt-12 pb-2 flex items-center gap-2">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 rounded-full bg-white flex items-center justify-center active:scale-90"
          style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}
          aria-label="뒤로 가기"
        >
          <ArrowLeft size={18} className="text-text-main" />
        </button>
        <h1 className="text-[16px] font-extrabold text-text-main">장바구니</h1>
      </div>

      {loading ? (
        <div className="px-4 mt-4 space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-2xl animate-pulse" style={{ height: 96, background: "#F2F4F6" }} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center text-center pt-14 px-6">
          <div
            className="w-16 h-16 rounded-3xl flex items-center justify-center mb-4"
            style={{ background: "linear-gradient(135deg, #f5e6d8 0%, #e8c9a8 100%)" }}
          >
            <ShoppingBag size={28} style={{ color: "#3182F6" }} />
          </div>
          <p className="text-[14px] font-bold text-text-main mb-1">장바구니가 비어있습니다</p>
          <p className="text-[12.5px] text-text-sub mb-6">담아둔 상품이 아직 없어요</p>
          <Link
            href="/shop"
            className="px-5 py-2.5 rounded-2xl bg-primary text-white text-[13px] font-bold active:scale-95 transition-transform"
          >
            쇼핑하러가기
          </Link>
        </div>
      ) : (
        <div className="px-4 mt-3 space-y-2.5">
          {items.map((item) => {
            const unitPrice = item.product.sale_price ?? item.product.price;
            const thumb = sanitizeImageUrl(item.product.images[0], "https://placehold.co/200x200?text=No+Image");
            return (
              <div
                key={item.id}
                className="flex items-center gap-3 p-3"
                style={{ background: "#FFFFFF", borderRadius: 18, boxShadow: "0 2px 8px rgba(0,0,0,0.03), 0 1px 2px rgba(0,0,0,0.02)", border: "1px solid rgba(0,0,0,0.04)" }}
              >
                <Link href={`/shop/${item.product.id}`} className="relative shrink-0 rounded-xl overflow-hidden" style={{ width: 64, height: 64 }}>
                  <Image src={thumb} alt={item.product.name} fill className="object-cover" unoptimized={thumb.includes("placehold.co")} />
                </Link>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-text-main truncate">{item.product.name}</p>
                  <p className="text-[12px] text-text-sub mt-0.5">{formatWon(unitPrice)}</p>
                  <div className="mt-1.5 flex items-center gap-2 px-2 py-1 rounded-xl w-fit" style={{ background: "#F9FAFB" }}>
                    <button onClick={() => handleQuantity(item, -1)} disabled={busyId === item.id} className="w-5 h-5 flex items-center justify-center disabled:opacity-30">
                      <Minus size={12} />
                    </button>
                    <span className="text-[12px] font-extrabold w-4 text-center">{item.quantity}</span>
                    <button onClick={() => handleQuantity(item, 1)} disabled={busyId === item.id || item.quantity >= item.product.stock} className="w-5 h-5 flex items-center justify-center disabled:opacity-30">
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <button onClick={() => handleRemove(item)} disabled={busyId === item.id} aria-label="삭제">
                    <Trash2 size={16} className="text-text-light" />
                  </button>
                  <span className="text-[13px] font-extrabold text-text-main">{formatWon(unitPrice * item.quantity)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {items.length > 0 && (
        <div
          className="fixed bottom-0 left-0 right-0 z-40 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          style={{ background: "#fff", boxShadow: "0 -4px 16px rgba(20,40,70,0.08)" }}
        >
          <div className="flex items-center justify-between text-[12px] text-text-sub mb-1">
            <span>상품금액</span>
            <span>{formatWon(productTotal)}</span>
          </div>
          <div className="flex items-center justify-between text-[12px] text-text-sub mb-2">
            <span>배송비</span>
            <span>{shippingFee > 0 ? formatWon(shippingFee) : "무료"}</span>
          </div>
          <div className="flex items-center justify-between text-[15px] font-extrabold text-text-main mb-3">
            <span>결제예정금액</span>
            <span>{formatWon(grandTotal)}</span>
          </div>
          <button
            onClick={() => router.push("/shop/checkout")}
            className="w-full py-3.5 rounded-2xl bg-primary text-white text-[14px] font-extrabold active:scale-[0.98] transition-transform"
            style={{ boxShadow: "0 6px 20px rgba(49,130,246,0.3)" }}
          >
            주문하기
          </button>
        </div>
      )}
    </div>
  );
}
