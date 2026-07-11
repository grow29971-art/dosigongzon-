"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, Minus, Plus, PawPrint, ShoppingBag, Truck } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { addToCart, SHOP_CATEGORIES, type Product } from "@/lib/shop-repo";
import { sanitizeImageUrl } from "@/lib/url-validate";

function formatWon(amount: number): string {
  return `${amount.toLocaleString()}원`;
}

function discountRate(price: number, salePrice: number): number {
  return Math.round(((price - salePrice) / price) * 100);
}

const BADGE_COLORS: Record<string, string> = {
  인기: "#E14B3C",
  신상: "var(--color-primary)",
  한정: "#8B65B8",
};

export default function ProductDetailClient({ product }: { product: Product }) {
  const router = useRouter();
  const { user } = useAuth();

  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; withCartLink: boolean } | null>(null);
  const [descOpen, setDescOpen] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const sliderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const soldOut = product.stock <= 0;
  const discounted = product.sale_price != null && product.sale_price < product.price;
  const unitPrice = discounted ? (product.sale_price as number) : product.price;
  const isVirtual = product.is_virtual;
  const images = product.images
    .map((u) => sanitizeImageUrl(u, ""))
    .filter((u) => u !== "");

  const descLines = (product.description ?? "").split("\n");
  const descLong = descLines.length > 5;
  const visibleDesc = descOpen || !descLong ? product.description : descLines.slice(0, 5).join("\n");

  // 스와이프 슬라이더 — scroll-snap 위치로 활성 dot 계산
  const handleScroll = () => {
    const el = sliderRef.current;
    if (!el) return;
    setActiveImage(Math.round(el.scrollLeft / el.clientWidth));
  };

  const requireLogin = (): boolean => {
    if (user) return true;
    router.push(`/login?next=${encodeURIComponent(`/shop/${product.id}`)}`);
    return false;
  };

  const handleAddToCart = async () => {
    if (!requireLogin()) return;
    setBusy(true);
    try {
      await addToCart(product.id, quantity);
      setToast({ msg: "장바구니에 담았습니다", withCartLink: true });
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : "장바구니 담기에 실패했어요", withCartLink: false });
    } finally {
      setBusy(false);
    }
  };

  const handleBuyNow = async () => {
    if (!requireLogin()) return;
    setBusy(true);
    try {
      await addToCart(product.id, isVirtual ? 1 : quantity);
      router.push("/shop/checkout");
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : "주문 준비에 실패했어요", withCartLink: false });
      setBusy(false);
    }
  };

  return (
    <div className="pb-32">
      {/* 헤더 */}
      <div className="px-4 pt-12 pb-2 flex items-center gap-2">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 rounded-full bg-white flex items-center justify-center active:scale-90"
          style={{ boxShadow: "var(--shadow-raised)" }}
          aria-label="뒤로 가기"
        >
          <ArrowLeft size={18} className="text-text-main" />
        </button>
        <span className="text-[12px] font-semibold text-text-sub">{SHOP_CATEGORIES[product.category].label}</span>
      </div>

      {/* 이미지 슬라이더 */}
      <div className="relative mx-4 mt-2">
        <div
          ref={sliderRef}
          onScroll={handleScroll}
          className="flex overflow-x-auto rounded-3xl"
          style={{ scrollSnapType: "x mandatory", aspectRatio: "1 / 1", boxShadow: "0 10px 28px rgba(0,0,0,0.12)", scrollbarWidth: "none" }}
        >
          {images.length > 0 ? (
            images.map((src, i) => (
              <div key={i} className="relative shrink-0 w-full h-full" style={{ scrollSnapAlign: "center" }}>
                <Image src={src} alt={`${product.name} ${i + 1}`} fill className="object-cover" priority={i === 0} />
              </div>
            ))
          ) : (
            <div className="relative shrink-0 w-full h-full flex items-center justify-center" style={{ background: "var(--color-warm-white)" }}>
              <PawPrint size={64} style={{ color: "rgba(49,130,246,0.28)" }} />
            </div>
          )}
        </div>
        {soldOut && (
          <div className="absolute inset-0 rounded-3xl flex items-center justify-center" style={{ background: "rgba(38,42,56,0.55)" }}>
            <span className="text-white text-[16px] font-extrabold px-4 py-2 rounded-xl" style={{ background: "rgba(0,0,0,0.35)" }}>품절</span>
          </div>
        )}
        {images.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {images.map((_, i) => (
              <span
                key={i}
                className="rounded-full transition-all"
                style={{
                  width: i === activeImage ? 16 : 6,
                  height: 6,
                  background: i === activeImage ? "#fff" : "rgba(255,255,255,0.55)",
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* 상품 정보 */}
      <div className="px-4 mt-5">
        {product.badge && (
          <span
            className="inline-block text-[10.5px] font-extrabold px-2 py-1 rounded-lg text-white mb-2"
            style={{ background: BADGE_COLORS[product.badge] ?? "var(--color-primary)" }}
          >
            {product.badge}
          </span>
        )}
        <h1 className="text-[19px] font-extrabold text-text-main tracking-tight leading-snug">{product.name}</h1>
        {product.weight && <p className="text-[12px] text-text-light mt-1">{product.weight}</p>}

        <div className="mt-2.5 flex items-baseline gap-2 flex-wrap">
          {discounted && (
            <span
              className="text-[12px] font-extrabold px-1.5 py-0.5 rounded-md text-white"
              style={{ background: "#E14B3C" }}
            >
              {discountRate(product.price, product.sale_price as number)}%
            </span>
          )}
          <span className="text-[23px] font-extrabold text-text-main">{formatWon(unitPrice)}</span>
          {discounted && <span className="text-[13px] text-text-light line-through">{formatWon(product.price)}</span>}
        </div>

        <div className="mt-3 flex items-center gap-1.5 text-[12px] text-text-sub">
          <Truck size={14} />
          {isVirtual
            ? "배송 없음 · 후원금으로 전액 사용됩니다"
            : product.shipping_fee === 0
              ? "무료배송 📦"
              : `배송비 ${formatWon(product.shipping_fee)}`}
        </div>

        {/* 후원 안내 카드 */}
        {product.is_donation && (
          <div
            className="mt-4 px-4 py-3.5 rounded-2xl"
            style={{
              background: product.donation_percent === 100 ? "rgba(232,107,140,0.08)" : "rgba(201,169,97,0.1)",
              border: `1px solid ${product.donation_percent === 100 ? "rgba(232,107,140,0.2)" : "rgba(201,169,97,0.25)"}`,
            }}
          >
            <p className="text-[12.5px] font-bold leading-relaxed" style={{ color: product.donation_percent === 100 ? "#D85575" : "#A8834A" }}>
              {product.donation_percent === 100
                ? "이 후원금은 전액 길고양이를 위해 사용됩니다 💛"
                : `이 상품 수익의 ${product.donation_percent}%는 길고양이 쉼터 설치에 사용됩니다 🐱`}
            </p>
          </div>
        )}

        {/* 수량 선택 — 가상상품 제외 */}
        {!isVirtual && !soldOut && (
          <div className="mt-5 flex items-center gap-3">
            <span className="text-[13px] font-bold text-text-main">수량</span>
            <div className="flex items-center gap-3 px-3 py-1.5 rounded-2xl" style={{ background: "var(--color-warm-white)" }}>
              <button onClick={() => setQuantity((q) => Math.max(1, q - 1))} disabled={quantity <= 1} className="w-6 h-6 flex items-center justify-center disabled:opacity-30" aria-label="수량 줄이기">
                <Minus size={14} />
              </button>
              <span className="text-[14px] font-extrabold w-5 text-center">{quantity}</span>
              <button onClick={() => setQuantity((q) => Math.min(product.stock, q + 1))} disabled={quantity >= product.stock} className="w-6 h-6 flex items-center justify-center disabled:opacity-30" aria-label="수량 늘리기">
                <Plus size={14} />
              </button>
            </div>
            {product.stock <= 5 && (
              <span className="text-[11.5px] font-bold" style={{ color: "#E88D5A" }}>{product.stock}개 남음</span>
            )}
          </div>
        )}

        {/* 상품 설명 */}
        {product.description && (
          <div className="mt-6">
            <p className="text-[13.5px] text-text-sub leading-relaxed whitespace-pre-wrap">{visibleDesc}</p>
            {descLong && (
              <button
                onClick={() => setDescOpen((o) => !o)}
                className="mt-2 text-[12.5px] font-bold text-primary"
              >
                {descOpen ? "접기" : "더보기"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* 토스트 */}
      {toast && (
        <div
          className="fixed left-1/2 -translate-x-1/2 bottom-28 z-50 flex items-center gap-3 px-4 py-2.5 rounded-2xl text-white text-[13px] font-bold"
          style={{ background: "rgba(38,42,56,0.92)" }}
        >
          {toast.msg}
          {toast.withCartLink && (
            <Link href="/shop/cart" className="font-extrabold underline underline-offset-2" style={{ color: "#9CC5F0" }}>
              장바구니 보기
            </Link>
          )}
        </div>
      )}

      {/* 하단 고정 바 */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        style={{ background: "#fff", boxShadow: "0 -4px 16px rgba(20,40,70,0.08)" }}
      >
        {soldOut ? (
          <button
            disabled
            className="w-full py-3.5 rounded-2xl text-[14px] font-extrabold opacity-40"
            style={{ background: "var(--color-warm-white)", color: "var(--color-text-sub)" }}
          >
            품절된 상품입니다
          </button>
        ) : isVirtual ? (
          <button
            onClick={handleBuyNow}
            disabled={busy}
            className="w-full py-3.5 rounded-2xl text-white text-[14.5px] font-extrabold active:scale-[0.98] transition-transform disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #E86B8C 0%, #D85575 100%)", boxShadow: "0 6px 20px rgba(232,107,140,0.35)" }}
          >
            후원하기 💛
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <div className="shrink-0 pr-1">
              <p className="text-[10px] text-text-light">총 금액</p>
              <p className="text-[15px] font-extrabold text-text-main">{formatWon(unitPrice * quantity)}</p>
            </div>
            <button
              onClick={handleAddToCart}
              disabled={busy}
              className="flex-1 py-3.5 rounded-2xl text-[13.5px] font-extrabold active:scale-[0.98] transition-transform disabled:opacity-40 flex items-center justify-center gap-1.5"
              style={{ background: "#fff", color: "var(--color-primary)", border: "1.5px solid var(--color-primary)" }}
            >
              <ShoppingBag size={15} />
              장바구니 담기
            </button>
            <button
              onClick={handleBuyNow}
              disabled={busy}
              className="flex-1 py-3.5 rounded-2xl bg-primary text-white text-[13.5px] font-extrabold active:scale-[0.98] transition-transform disabled:opacity-40"
              style={{ boxShadow: "var(--shadow-primary)" }}
            >
              바로 구매
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
