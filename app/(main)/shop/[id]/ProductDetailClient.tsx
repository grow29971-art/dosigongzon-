"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, Minus, Plus, PawPrint, ShoppingBag, Truck, ShoppingCart, Coins, Heart } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { addToCart, SHOP_CATEGORIES, type Product } from "@/lib/shop-repo";
import { sanitizeImageUrl } from "@/lib/url-validate";
import { PRODUCT_DISCLOSURES, PRODUCT_DETAIL_IMAGES } from "@/lib/product-disclosure";
import { PURCHASE_REWARD_BASE_RATE, PURCHASE_REWARD_MAX_RATE } from "@/lib/points-config";
import ProductReviews from "./ProductReviews";

function formatWon(amount: number): string {
  return `${amount.toLocaleString()}원`;
}

function discountRate(price: number, salePrice: number): number {
  return Math.round(((price - salePrice) / price) * 100);
}

const BADGE_COLORS: Record<string, string> = {
  인기: "var(--color-error)",
  신상: "var(--color-primary)",
  한정: "var(--color-warning)",
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

  // 게스트도 장바구니·구매 가능 — 장바구니는 localStorage(shop-repo), 주문은 게스트 RPC.
  const handleAddToCart = async () => {
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
          className="w-9 h-9 rounded-full bg-white flex items-center justify-center press-strong"
          style={{ boxShadow: "var(--shadow-raised)" }}
          aria-label="뒤로 가기"
        >
          <ArrowLeft size={18} className="text-text-main" />
        </button>
        <span className="text-[13px] font-semibold text-text-sub">{SHOP_CATEGORIES[product.category].label}</span>
      </div>

      {/* 이미지 슬라이더 */}
      <div className="relative mx-4 mt-2">
        <div
          ref={sliderRef}
          onScroll={handleScroll}
          className="flex overflow-x-auto rounded-3xl"
          style={{ scrollSnapType: "x mandatory", aspectRatio: "1 / 1", boxShadow: "var(--shadow-fab)", scrollbarWidth: "none" }}
        >
          {images.length > 0 ? (
            images.map((src, i) => (
              <div key={i} className="relative shrink-0 w-full h-full" style={{ scrollSnapAlign: "center" }}>
                <Image src={src} alt={`${product.name} ${i + 1}`} fill className="object-cover" priority={i === 0} />
              </div>
            ))
          ) : (
            <div className="relative shrink-0 w-full h-full flex items-center justify-center" style={{ background: "var(--color-warm-white)" }}>
              <PawPrint size={64} style={{ color: "rgba(176, 92, 54,0.28)" }} />
            </div>
          )}
        </div>
        {soldOut && (
          <div className="absolute inset-0 rounded-3xl flex items-center justify-center" style={{ background: "rgba(38,42,56,0.55)" }}>
            <span className="text-white text-[17px] font-bold px-4 py-2 rounded-xl" style={{ background: "rgba(0,0,0,0.35)" }}>품절</span>
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
            className="inline-block text-[11px] font-bold px-2 py-1 rounded-lg text-white mb-2"
            style={{ background: BADGE_COLORS[product.badge] ?? "var(--color-primary)" }}
          >
            {product.badge}
          </span>
        )}
        <h1 className="text-[20px] font-bold text-text-main tracking-tight leading-snug">{product.name}</h1>
        {product.weight && <p className="text-[13px] text-text-light mt-1">{product.weight}</p>}

        <div className="mt-2.5 flex items-baseline gap-2 flex-wrap">
          {discounted && (
            <span
              className="text-[13px] font-bold px-1.5 py-0.5 rounded-md text-white"
              style={{ background: "var(--color-error)" }}
            >
              {discountRate(product.price, product.sale_price as number)}%
            </span>
          )}
          <span className="text-[24px] font-bold text-text-main">{formatWon(unitPrice)}</span>
          {discounted && <span className="text-[13px] text-text-light line-through">{formatWon(product.price)}</span>}
          {/* 전자상거래법 총액표시 — 부가세 포함 가격임을 명시 (2026-08-26 원탁회의 세무 게이트) */}
          <span className="text-[11px] text-text-light">부가세 포함</span>
        </div>

        <div className="mt-3 flex items-center gap-1.5 text-[13px] text-text-sub">
          <Truck size={14} />
          {isVirtual
            ? "배송 없음 · 후원금으로 전액 사용됩니다"
            : product.shipping_fee === 0
              ? "무료배송"
              : `배송비 ${formatWon(product.shipping_fee)}`}
        </div>
        {/* 구매 적립 안내 (2026-08-30) — 산 만큼 포인트로 돌려받는 즉각 보상. 요율은 points-config에서 관리 */}
        {!isVirtual && (
          <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[12px] font-bold"
            style={{ background: "var(--color-sage-soft)", color: "#1E8E56" }}>
            🎁 구매 시 {formatWon(Math.floor(unitPrice * PURCHASE_REWARD_BASE_RATE))} 적립
            (기본 {Math.round(PURCHASE_REWARD_BASE_RATE * 100)}% · 단골 최대 {Math.round(PURCHASE_REWARD_MAX_RATE * 100)}%)
          </div>
        )}

        {/* 후원 안내 카드 */}
        {product.is_donation && (
          <div
            className="mt-4 px-4 py-3.5 rounded-2xl"
            style={{
              background: "var(--color-primary-softer)",
              border: "1px solid rgba(176,92,54,0.2)",
            }}
          >
            <p className="text-[13px] font-bold leading-relaxed" style={{ color: "var(--color-primary-dark)" }}>
              {product.donation_percent === 100
                ? "이 후원금은 전액 길고양이를 위해 사용됩니다 💛"
                : `이 상품은 수익(이익)의 ${product.donation_percent}%가 길고양이 중성화(TNR)에 쓰여요 🐱`}
            </p>
            {/* 구매 → 수익 → 후원 미니 흐름 */}
            {product.donation_percent !== 100 && (
              <div className="mt-2.5 flex items-center justify-between">
                {[
                  { Icon: ShoppingCart, label: "구매" },
                  { Icon: Coins, label: "수익 발생" },
                  { Icon: Heart, label: "일부 후원" },
                ].map((step, i) => (
                  <div key={step.label} className="flex items-center flex-1 min-w-0">
                    <div className="flex flex-col items-center gap-0.5 flex-1 min-w-0">
                      <step.Icon size={15} style={{ color: "var(--color-primary)" }} />
                      <span className="text-[11px] font-bold truncate" style={{ color: "var(--color-primary-dark)" }}>{step.label}</span>
                    </div>
                    {i < 2 && (
                      <span className="text-[11px] shrink-0 px-0.5" style={{ color: "var(--color-text-light)" }}>→</span>
                    )}
                  </div>
                ))}
              </div>
            )}
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
              <span className="text-[15px] font-medium w-5 text-center">{quantity}</span>
              <button onClick={() => setQuantity((q) => Math.min(product.stock, q + 1))} disabled={quantity >= product.stock} className="w-6 h-6 flex items-center justify-center disabled:opacity-30" aria-label="수량 늘리기">
                <Plus size={14} />
              </button>
            </div>
            {product.stock <= 5 && (
              <span className="text-[11px] font-bold" style={{ color: "var(--color-warning)" }}>{product.stock}개 남음</span>
            )}
          </div>
        )}

        {/* 상품 설명 */}
        {product.description && (
          <div className="mt-6">
            <p className="text-[13px] text-text-sub leading-relaxed whitespace-pre-wrap">{visibleDesc}</p>
            {descLong && (
              <button
                onClick={() => setDescOpen((o) => !o)}
                className="mt-2 text-[13px] font-bold text-primary"
              >
                {descOpen ? "접기" : "더보기"}
              </button>
            )}
          </div>
        )}

        {/* 상세 이미지 — 공급사 제공 상세페이지 (세로 분할본을 이어붙여 렌더) */}
        {PRODUCT_DETAIL_IMAGES[product.id] && (
          <div className="mt-6 rounded-2xl overflow-hidden" style={{ border: "1px solid var(--color-divider)" }}>
            {PRODUCT_DETAIL_IMAGES[product.id].map((img, i) => (
              <Image
                key={img.src}
                src={img.src}
                alt={`${product.name} 상세 정보 ${i + 1}`}
                width={img.width}
                height={img.height}
                className="w-full h-auto block"
                loading="lazy"
                sizes="(max-width: 512px) 100vw, 512px"
              />
            ))}
          </div>
        )}

        {/* 상품정보 제공고시 — 전자상거래법·사료관리법 표시의무. 접힘 없이 항상 노출 */}
        {PRODUCT_DISCLOSURES[product.id] && (
          <div className="mt-6">
            <h2 className="text-[13px] font-bold text-text-main mb-2">상품정보 제공고시</h2>
            <div
              className="rounded-2xl overflow-hidden"
              style={{ border: "1px solid var(--color-divider)" }}
            >
              {PRODUCT_DISCLOSURES[product.id].rows.map((row, i) => (
                <div
                  key={row.label}
                  className="flex gap-3 px-3.5 py-2"
                  style={{ borderTop: i === 0 ? "none" : "1px solid var(--color-divider)" }}
                >
                  <span className="text-[11px] font-bold text-text-light w-[88px] shrink-0 pt-px">{row.label}</span>
                  <span
                    className="text-[11px] leading-relaxed"
                    style={{ color: row.pending ? "var(--color-text-muted)" : "var(--color-text-sub)" }}
                  >
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
            {PRODUCT_DISCLOSURES[product.id].note && (
              <p className="text-[11px] text-text-light mt-2 leading-relaxed">
                {PRODUCT_DISCLOSURES[product.id].note}
              </p>
            )}
          </div>
        )}

        {/* 구매후기 — 가상상품(후원)은 제외 */}
        {!isVirtual && <ProductReviews productId={product.id} />}
      </div>

      {/* 토스트 */}
      {toast && (
        <div
          className="fixed left-1/2 -translate-x-1/2 bottom-28 z-50 flex items-center gap-3 px-4 py-2.5 rounded-2xl text-white text-[13px] font-bold"
          style={{ background: "rgba(38,42,56,0.92)" }}
        >
          {toast.msg}
          {toast.withCartLink && (
            <Link href="/shop/cart" className="font-bold underline underline-offset-2" style={{ color: "var(--color-primary-light)" }}>
              장바구니 보기
            </Link>
          )}
        </div>
      )}

      {/* 하단 고정 바 */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        style={{ background: "var(--color-surface)", boxShadow: "var(--shadow-sheet)" }}
      >
        {soldOut ? (
          <button
            disabled
            className="w-full py-3.5 rounded-2xl text-[15px] font-bold opacity-40"
            style={{ background: "var(--color-warm-white)", color: "var(--color-text-sub)" }}
          >
            품절된 상품입니다
          </button>
        ) : isVirtual ? (
          <button
            onClick={handleBuyNow}
            disabled={busy}
            className="w-full py-3.5 rounded-2xl text-white text-[15px] font-bold press transition-transform disabled:opacity-50"
            style={{ background: "var(--color-primary)", boxShadow: "var(--shadow-primary)" }}
          >
            후원하기
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <div className="shrink-0 pr-1">
              <p className="text-[11px] text-text-light">총 금액</p>
              <p className="text-[15px] font-bold text-text-main">{formatWon(unitPrice * quantity)}</p>
            </div>
            <button
              onClick={handleAddToCart}
              disabled={busy}
              className="flex-1 py-3.5 rounded-2xl text-[13px] font-bold press transition-transform disabled:opacity-40 flex items-center justify-center gap-1.5"
              style={{ background: "var(--color-surface)", color: "var(--color-primary)", border: "1.5px solid var(--color-primary)" }}
            >
              <ShoppingBag size={15} />
              장바구니 담기
            </button>
            <button
              onClick={handleBuyNow}
              disabled={busy}
              className="flex-1 py-3.5 rounded-2xl bg-primary text-white text-[13px] font-bold press transition-transform disabled:opacity-40"
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
