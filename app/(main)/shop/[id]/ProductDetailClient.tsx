"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, Minus, Plus, ImageOff, ShoppingBag, Truck, Gift, Heart } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { addToCart, SHOP_CATEGORIES, type Product } from "@/lib/shop-repo";
import { sanitizeImageUrl } from "@/lib/url-validate";
import { PRODUCT_DISCLOSURES, PRODUCT_DETAIL_IMAGES } from "@/lib/product-disclosure";
import { PURCHASE_REWARD_BASE_RATE, PURCHASE_REWARD_MAX_RATE } from "@/lib/points-config";
import UIButton from "@/app/components/ui/Button";
import ProductReviews from "./ProductReviews";

function formatWon(amount: number): string {
  return `${amount.toLocaleString()}원`;
}

function discountRate(price: number, salePrice: number): number {
  return Math.round(((price - salePrice) / price) * 100);
}

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

  // 정보 행(배송·적립·후원) — 헤어라인 리스트. 후원 문구는 법정·후원율 표기라 그대로 둔다.
  // 배송기간은 상품 페이지에 명시 — PG 심사 요건(구매자가 배송기간을 인지할 수 있어야 함), policy 페이지와 동일 값.
  const infoRows: { Icon: typeof Truck; text: string }[] = [
    {
      Icon: Truck,
      text: isVirtual
        ? "배송 없음 · 후원금으로 전액 사용됩니다"
        : `${product.shipping_fee === 0 ? "무료배송" : `배송비 ${formatWon(product.shipping_fee)}`} · 결제 후 영업일 2~5일 내 발송`,
    },
    // 구매 적립 안내 (2026-08-30) — 산 만큼 포인트로 돌려받는 즉각 보상. 요율은 points-config에서 관리
    ...(!isVirtual
      ? [{
          Icon: Gift,
          text: `구매 시 ${formatWon(Math.floor(unitPrice * PURCHASE_REWARD_BASE_RATE))} 적립 (기본 ${Math.round(PURCHASE_REWARD_BASE_RATE * 100)}% · 단골 최대 ${Math.round(PURCHASE_REWARD_MAX_RATE * 100)}%)`,
        }]
      : []),
    ...(product.is_donation
      ? [{
          Icon: Heart,
          text: product.donation_percent === 100
            ? "이 후원금은 전액 길고양이를 위해 사용됩니다"
            : `이 상품은 수익(이익)의 ${product.donation_percent}%가 길고양이 중성화(TNR)에 쓰여요`,
        }]
      : []),
  ];

  return (
    <div className="pb-32">
      {/* 헤더 */}
      <div className="px-4 pt-12 pb-2 flex items-center gap-1">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 rounded-full flex items-center justify-center press-strong -ml-2"
          aria-label="뒤로 가기"
        >
          <ArrowLeft size={20} className="text-text-main" />
        </button>
        <span className="text-[13px] text-text-sub">{SHOP_CATEGORIES[product.category].label}</span>
      </div>

      {/* 이미지 슬라이더 — 풀폭 */}
      <div className="relative mt-1">
        <div
          ref={sliderRef}
          onScroll={handleScroll}
          className="flex overflow-x-auto"
          style={{ scrollSnapType: "x mandatory", aspectRatio: "1 / 1", scrollbarWidth: "none", background: "var(--color-surface-alt)" }}
        >
          {images.length > 0 ? (
            images.map((src, i) => (
              <div key={i} className="relative shrink-0 w-full h-full" style={{ scrollSnapAlign: "center" }}>
                <Image src={src} alt={`${product.name} ${i + 1}`} fill className="object-cover" priority={i === 0} />
              </div>
            ))
          ) : (
            <div className="relative shrink-0 w-full h-full flex items-center justify-center">
              <ImageOff size={40} style={{ color: "var(--color-text-muted)" }} />
            </div>
          )}
        </div>
        {soldOut && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.45)" }}>
            <span className="text-white text-[17px] font-semibold">품절</span>
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
                  background: i === activeImage ? "white" : "rgba(255,255,255,0.55)",
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
            className="inline-block text-[11px] font-medium px-1.5 py-0.5 mb-2"
            style={{ background: "var(--color-surface)", color: "var(--color-text-sub)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-square)" }}
          >
            {product.badge}
          </span>
        )}
        <h1 className="text-[20px] font-bold text-text-main tracking-tight leading-snug">{product.name}</h1>
        {product.weight && <p className="text-[13px] text-text-light mt-1">{product.weight}</p>}

        <div className="mt-2.5 flex items-baseline gap-2 flex-wrap">
          {discounted && (
            <span className="text-[17px] font-bold" style={{ color: "var(--color-error)" }}>
              {discountRate(product.price, product.sale_price as number)}%
            </span>
          )}
          <span className="text-[24px] font-bold text-text-main">{formatWon(unitPrice)}</span>
          {discounted && <span className="text-[13px] text-text-light line-through">{formatWon(product.price)}</span>}
          {/* 전자상거래법 총액표시 — 부가세 포함 가격임을 명시 (2026-08-26 원탁회의 세무 게이트) */}
          <span className="text-[11px] text-text-light">부가세 포함</span>
        </div>

        {/* 배송·적립·후원 — 헤어라인 행 */}
        <div className="mt-4" style={{ borderTop: "1px solid var(--color-divider)", borderBottom: "1px solid var(--color-divider)" }}>
          {infoRows.map(({ Icon, text }, i) => (
            <div
              key={i}
              className="flex items-start gap-2.5 py-2.5 text-[13px] text-text-sub leading-relaxed"
              style={{ borderTop: i === 0 ? "none" : "1px solid var(--color-divider)" }}
            >
              <Icon size={16} className="shrink-0 mt-0.5 text-text-light" />
              <span>{text}</span>
            </div>
          ))}
        </div>

        {/* 수량 선택 — 가상상품 제외 */}
        {!isVirtual && !soldOut && (
          <div className="mt-4 flex items-center gap-3">
            <span className="text-[13px] font-semibold text-text-main">수량</span>
            <div
              className="flex items-center gap-3 px-2 py-1"
              style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-input)" }}
            >
              <button onClick={() => setQuantity((q) => Math.max(1, q - 1))} disabled={quantity <= 1} className="w-7 h-7 flex items-center justify-center disabled:opacity-30" aria-label="수량 줄이기">
                <Minus size={14} />
              </button>
              <span className="text-[15px] font-medium w-5 text-center tabular-nums">{quantity}</span>
              <button onClick={() => setQuantity((q) => Math.min(product.stock, q + 1))} disabled={quantity >= product.stock} className="w-7 h-7 flex items-center justify-center disabled:opacity-30" aria-label="수량 늘리기">
                <Plus size={14} />
              </button>
            </div>
            {product.stock <= 5 && (
              <span className="text-[11px]" style={{ color: "var(--color-warning)" }}>{product.stock}개 남음</span>
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
                className="mt-2 text-[13px] font-semibold text-primary"
              >
                {descOpen ? "접기" : "더보기"}
              </button>
            )}
          </div>
        )}

        {/* 상세 이미지 — 공급사 제공 상세페이지 (세로 분할본을 이어붙여 렌더) */}
        {PRODUCT_DETAIL_IMAGES[product.id] && (
          <div className="mt-6 overflow-hidden" style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-card-sm)" }}>
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
            <h2 className="text-[15px] font-bold text-text-main mb-2">상품정보 제공고시</h2>
            <div style={{ borderTop: "1px solid var(--color-divider)" }}>
              {PRODUCT_DISCLOSURES[product.id].rows.map((row) => (
                <div
                  key={row.label}
                  className="flex gap-3 py-2"
                  style={{ borderBottom: "1px solid var(--color-divider)" }}
                >
                  <span className="text-[11px] text-text-light w-[88px] shrink-0 pt-px">{row.label}</span>
                  <span
                    className="text-[11px] leading-relaxed"
                    style={{ color: row.pending ? "var(--color-text-light)" : "var(--color-text-sub)" }}
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
          className="fixed left-1/2 -translate-x-1/2 bottom-28 z-50 flex items-center gap-3 px-4 py-2.5 text-white text-[13px] font-medium"
          style={{ background: "rgba(25,25,25,0.92)", borderRadius: "var(--radius-card-sm)", boxShadow: "var(--shadow-raised)" }}
        >
          {toast.msg}
          {toast.withCartLink && (
            <Link href="/shop/cart" className="font-semibold underline underline-offset-2 text-white">
              장바구니 보기
            </Link>
          )}
        </div>
      )}

      {/* 하단 고정 바 */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        style={{ background: "var(--color-surface)", borderTop: "1px solid var(--color-border)" }}
      >
        {soldOut ? (
          <UIButton variant="secondary" size="lg" full disabled>
            품절된 상품입니다
          </UIButton>
        ) : isVirtual ? (
          <UIButton size="lg" full onClick={handleBuyNow} disabled={busy}>
            후원하기
          </UIButton>
        ) : (
          <div className="flex items-center gap-2">
            <div className="shrink-0 pr-1">
              <p className="text-[11px] text-text-light">총 금액</p>
              <p className="text-[15px] font-bold text-text-main tabular-nums">{formatWon(unitPrice * quantity)}</p>
            </div>
            <UIButton variant="secondary" size="lg" className="flex-1" onClick={handleAddToCart} disabled={busy}>
              <ShoppingBag size={16} />
              장바구니 담기
            </UIButton>
            <UIButton size="lg" className="flex-1" onClick={handleBuyNow} disabled={busy}>
              바로 구매
            </UIButton>
          </div>
        )}
      </div>
    </div>
  );
}
