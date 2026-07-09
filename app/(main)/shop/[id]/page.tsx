"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, Minus, Plus, ShoppingBag, Truck } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { getProduct, addToCart, CATEGORY_MAP, type Product } from "@/lib/shop-repo";
import { sanitizeImageUrl } from "@/lib/url-validate";

function formatWon(amount: number): string {
  return `${amount.toLocaleString()}원`;
}

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!id) return;
    getProduct(id)
      .then((p) => setProduct(p))
      .catch(() => setProduct(null))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2000);
    return () => clearTimeout(t);
  }, [toast]);

  if (loading) {
    return <div className="px-4 pt-14"><div className="rounded-[22px] animate-pulse" style={{ aspectRatio: "1 / 1", background: "#EEF1F6" }} /></div>;
  }

  if (!product) {
    return (
      <div className="px-5 pt-20 pb-24 flex flex-col items-center text-center">
        <p className="text-[14px] font-bold text-text-main mb-4">상품을 찾을 수 없어요</p>
        <button
          onClick={() => router.push("/shop")}
          className="px-5 py-2.5 rounded-2xl bg-primary text-white text-[13px] font-bold"
        >
          쇼핑으로 돌아가기
        </button>
      </div>
    );
  }

  const soldOut = product.stock <= 0;
  const discounted = product.sale_price != null && product.sale_price < product.price;
  const unitPrice = discounted ? (product.sale_price as number) : product.price;
  const images = product.images.length > 0
    ? product.images.map((u) => sanitizeImageUrl(u, "https://placehold.co/600x600?text=No+Image"))
    : ["https://placehold.co/600x600?text=No+Image"];

  const handleQuantity = (delta: number) => {
    setQuantity((q) => Math.max(1, Math.min(product.stock, q + delta)));
  };

  const handleAddToCart = async (goToCart: boolean) => {
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(`/shop/${product.id}`)}`);
      return;
    }
    setBusy(true);
    try {
      await addToCart(product.id, quantity);
      if (goToCart) {
        router.push("/shop/cart");
      } else {
        setToast("장바구니에 담았어요");
      }
    } catch (e) {
      setToast(e instanceof Error ? e.message : "장바구니 담기에 실패했어요");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pb-28">
      {/* 헤더 */}
      <div className="px-4 pt-12 pb-2 flex items-center gap-2">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 rounded-full bg-white flex items-center justify-center active:scale-90"
          style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}
          aria-label="뒤로 가기"
        >
          <ArrowLeft size={18} className="text-text-main" />
        </button>
        <span className="text-[12px] font-semibold text-text-sub">{CATEGORY_MAP[product.category].label}</span>
      </div>

      {/* 이미지 */}
      <div className="relative mx-4 mt-2 rounded-3xl overflow-hidden" style={{ aspectRatio: "1 / 1", boxShadow: "0 10px 28px rgba(0,0,0,0.12)" }}>
        <Image
          src={images[activeImage]}
          alt={product.name}
          fill
          className="object-cover"
          unoptimized={images[activeImage].includes("placehold.co")}
          priority
        />
        {soldOut && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(38,42,56,0.55)" }}>
            <span className="text-white text-[16px] font-extrabold px-4 py-2 rounded-xl" style={{ background: "rgba(0,0,0,0.35)" }}>품절</span>
          </div>
        )}
      </div>
      {images.length > 1 && (
        <div className="flex gap-2 px-4 mt-3 overflow-x-auto">
          {images.map((src, i) => (
            <button
              key={i}
              onClick={() => setActiveImage(i)}
              className="relative shrink-0 rounded-xl overflow-hidden"
              style={{ width: 56, height: 56, border: i === activeImage ? "2px solid #4C82BC" : "2px solid transparent" }}
            >
              <Image src={src} alt="" fill className="object-cover" unoptimized={src.includes("placehold.co")} />
            </button>
          ))}
        </div>
      )}

      {/* 정보 */}
      <div className="px-4 mt-5">
        <h1 className="text-[19px] font-extrabold text-text-main tracking-tight">{product.name}</h1>
        <div className="mt-2 flex items-baseline gap-2">
          {discounted && <span className="text-[13px] text-text-light line-through">{formatWon(product.price)}</span>}
          <span className="text-[22px] font-extrabold" style={{ color: discounted ? "#E14B3C" : "#262A38" }}>
            {formatWon(unitPrice)}
          </span>
        </div>

        <div className="mt-3 flex items-center gap-1.5 text-[12px] text-text-sub">
          <Truck size={14} />
          {product.shipping_fee > 0 ? `배송비 ${formatWon(product.shipping_fee)}` : "무료배송"}
        </div>

        {product.description && (
          <p className="mt-5 text-[13.5px] text-text-sub leading-relaxed whitespace-pre-wrap">
            {product.description}
          </p>
        )}

        {/* 수량 선택 */}
        {!soldOut && (
          <div className="mt-6 flex items-center gap-3">
            <span className="text-[13px] font-bold text-text-main">수량</span>
            <div className="flex items-center gap-3 px-3 py-1.5 rounded-2xl" style={{ background: "#F4F7FC" }}>
              <button onClick={() => handleQuantity(-1)} disabled={quantity <= 1} className="w-6 h-6 flex items-center justify-center disabled:opacity-30">
                <Minus size={14} />
              </button>
              <span className="text-[14px] font-extrabold w-5 text-center">{quantity}</span>
              <button onClick={() => handleQuantity(1)} disabled={quantity >= product.stock} className="w-6 h-6 flex items-center justify-center disabled:opacity-30">
                <Plus size={14} />
              </button>
            </div>
            <span className="text-[11.5px] text-text-light">재고 {product.stock}개</span>
          </div>
        )}
      </div>

      {/* 토스트 */}
      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-24 z-50 px-4 py-2.5 rounded-2xl text-white text-[13px] font-bold" style={{ background: "rgba(38,42,56,0.92)" }}>
          {toast}
        </div>
      )}

      {/* 하단 고정 버튼 */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex gap-2"
        style={{ background: "#fff", boxShadow: "0 -4px 16px rgba(20,40,70,0.08)" }}
      >
        <button
          onClick={() => handleAddToCart(false)}
          disabled={soldOut || busy}
          className="flex-1 py-3.5 rounded-2xl text-[14px] font-extrabold active:scale-[0.98] transition-transform disabled:opacity-40 flex items-center justify-center gap-1.5"
          style={{ background: "#F4F7FC", color: "#262A38" }}
        >
          <ShoppingBag size={16} />
          {soldOut ? "품절" : "장바구니"}
        </button>
        <button
          onClick={() => handleAddToCart(true)}
          disabled={soldOut || busy}
          className="flex-1 py-3.5 rounded-2xl bg-primary text-white text-[14px] font-extrabold active:scale-[0.98] transition-transform disabled:opacity-40"
          style={{ boxShadow: "0 6px 20px rgba(76,130,188,0.3)" }}
        >
          {soldOut ? "품절" : "바로 구매"}
        </button>
      </div>
    </div>
  );
}
