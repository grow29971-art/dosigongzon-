"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ShoppingCart, ReceiptText, PawPrint, LayoutGrid,
  Fish, SprayCan, HeartPulse, ToyBrick, Home, Gift, ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  listProducts, listCartItems, SHOP_CATEGORIES,
  type Product, type ProductCategory,
} from "@/lib/shop-repo";
import { sanitizeImageUrl } from "@/lib/url-validate";
import PushOptInCard from "@/app/components/PushOptInCard";
import FundVoteCard from "@/app/components/FundVoteCard";
import FundSettlementCard from "@/app/components/FundSettlementCard";
import PageIntroModal from "@/app/components/PageIntroModal";

type FilterKey = ProductCategory | "all";

// 카테고리 아이콘 매핑 (lucide-react — 기존 라이브러리)
const CATEGORY_ICONS: Record<ProductCategory, LucideIcon> = {
  food: Fish,
  sand: SprayCan,
  health: HeartPulse,
  toy: ToyBrick,
  shelter: Home,
  goods: Gift,
};

const FILTERS: { key: FilterKey; label: string; Icon: LucideIcon }[] = [
  { key: "all", label: "전체", Icon: LayoutGrid },
  ...(Object.entries(SHOP_CATEGORIES) as [ProductCategory, (typeof SHOP_CATEGORIES)[ProductCategory]][])
    .sort((a, b) => a[1].order - b[1].order)
    .map(([key, v]) => ({ key: key as FilterKey, label: v.label, Icon: CATEGORY_ICONS[key] })),
];

function formatWon(amount: number): string {
  return `${amount.toLocaleString()}원`;
}

function discountRate(price: number, salePrice: number): number {
  return Math.round(((price - salePrice) / price) * 100);
}

/* ═══ 상품 카드 ═══ */
function ProductCard({ product }: { product: Product }) {
  const thumb = product.images[0] ? sanitizeImageUrl(product.images[0], "") : "";
  const soldOut = product.stock <= 0;
  const discounted = product.sale_price != null && product.sale_price < product.price;

  return (
    <Link href={`/shop/${product.id}`} className="block active:scale-[0.98] transition-transform">
      <div
        className="overflow-hidden h-full"
        style={{
          background: "#FFFFFF",
          borderRadius: 22,
          boxShadow: "0 6px 20px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.03)",
          border: "1px solid rgba(0,0,0,0.04)",
        }}
      >
        {/* 이미지 */}
        <div className="relative w-full" style={{ aspectRatio: "1 / 1", background: "var(--color-warm-white)" }}>
          {thumb ? (
            <Image src={thumb} alt={product.name} fill className="object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <PawPrint size={40} style={{ color: "rgba(49,130,246,0.28)" }} />
            </div>
          )}
          {product.badge && (
            <span
              className="absolute top-2 left-2 text-[9.5px] font-extrabold px-2 py-0.5 rounded-lg text-white"
              style={{ background: product.badge === "인기" ? "#E14B3C" : product.badge === "신상" ? "var(--color-primary)" : "#8B65B8" }}
            >
              {product.badge}
            </span>
          )}
          {product.shipping_fee === 0 && !product.is_virtual && (
            <span
              className="absolute top-2 right-2 text-[9px] font-extrabold px-1.5 py-0.5 rounded-md"
              style={{ background: "rgba(107,142,111,0.92)", color: "#fff" }}
            >
              무료배송
            </span>
          )}
          {soldOut && (
            <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(38,42,56,0.55)" }}>
              <span className="text-white text-[13px] font-extrabold px-3 py-1.5 rounded-xl" style={{ background: "rgba(0,0,0,0.35)" }}>
                품절
              </span>
            </div>
          )}
        </div>

        {/* 정보 */}
        <div className="px-3 py-3">
          <p className="text-[13px] font-bold text-text-main leading-snug" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {product.name}
          </p>
          {product.weight && (
            <p className="text-[10.5px] text-text-light mt-0.5">{product.weight}</p>
          )}
          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
            {discounted && (
              <span className="text-[11px] font-extrabold" style={{ color: "#E14B3C" }}>
                {discountRate(product.price, product.sale_price as number)}%
              </span>
            )}
            <span className="text-[14.5px] font-extrabold text-text-main">
              {formatWon(discounted ? (product.sale_price as number) : product.price)}
            </span>
            {discounted && (
              <span className="text-[10.5px] text-text-light line-through">{formatWon(product.price)}</span>
            )}
          </div>
          {product.is_donation ? (
            <p className="text-[10px] font-semibold mt-1.5" style={{ color: "#C9A961" }}>
              수익의 일부 후원 💛
            </p>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

/* ═══ 페이지 ═══ */
interface DonationProgress {
  total: number;
  goal: number;
  goalLabel: string;
}

export default function ShopPage() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [loading, setLoading] = useState(true);
  const [cartCount, setCartCount] = useState(0);
  const [donation, setDonation] = useState<DonationProgress | null>(null);

  // 딥링크 초기 카테고리 (?category=shelter 등) — 홈 맥락 다리에서 진입 시 자동 필터
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get("category");
    if (raw && raw in SHOP_CATEGORIES) setFilter(raw as FilterKey);
  }, []);

  // 후원 적립 현황 (진행바)
  useEffect(() => {
    fetch("/api/shop/donation-progress")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d && typeof d.total === "number") setDonation(d); })
      .catch(() => {});
  }, []);

  // 전체 상품 1회 fetch — 카테고리 필터는 클라이언트 사이드
  // TODO: 상품 50개 초과 시 서버 사이드 필터링 전환
  useEffect(() => {
    listProducts()
      .then(setProducts)
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!user) { setCartCount(0); return; }
    listCartItems()
      .then((items) => setCartCount(items.reduce((sum, i) => sum + i.quantity, 0)))
      .catch(() => setCartCount(0));
  }, [user]);

  const visible = useMemo(
    () => (filter === "all" ? products : products.filter((p) => p.category === filter)),
    [products, filter],
  );

  return (
    <div className="px-4 pt-14 pb-24">
      <PageIntroModal
        storageKey="dosigongzon_intro_shop"
        badge="쇼핑"
        headerEmoji="🛍️"
        title="사면, 아이들에게 돌아가요"
        headerBg="linear-gradient(160deg, #FFF3E0 0%, #FCE9D6 100%)"
        accent="#E8930C"
        accentDark="#B5720A"
        items={[
          { emoji: "💛", text: <>수익의 일부는 길고양이를 위해 써요. <b className="text-text-main">사용처는 함께 투표</b>로 정해요.</> },
          { emoji: "🐾", text: <>매일 돌봄 출석으로 모은 포인트를 <b className="text-text-main">1P = 1원</b> 할인으로 쓸 수 있어요.</> },
          { emoji: "🔍", text: <>모인 금액·쓰인 금액을 <b className="text-text-main">투명하게 공개</b>해요.</> },
        ]}
      />
      {/* ── 헤더 ── */}
      <div className="mb-4 px-1 flex items-end justify-between">
        <div>
          <div className="flex items-baseline gap-2 mb-1">
            <h1 className="text-[24px] font-extrabold text-text-main tracking-tight">쇼핑</h1>
            <span className="text-[11px] font-semibold text-text-light">Shop</span>
          </div>
          <p className="text-[12.5px] text-text-sub leading-relaxed">
            우리 동네 고양이를 위한 용품 · 후원
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/shop/orders"
            className="w-10 h-10 rounded-full bg-white flex items-center justify-center active:scale-90 transition-transform"
            style={{ boxShadow: "var(--shadow-raised)" }}
            aria-label="주문 내역"
          >
            <ReceiptText size={18} className="text-text-sub" />
          </Link>
          <Link
            href="/shop/cart"
            className="relative w-10 h-10 rounded-full bg-white flex items-center justify-center active:scale-90 transition-transform"
            style={{ boxShadow: "var(--shadow-raised)" }}
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

      {/* ── 후원금 투명 정산 (쇼핑 최상단) ── */}
      <FundSettlementCard />

      {/* ── 돌봄→포인트→할인 안내 띠 (탭하면 홈 주간 출석으로) ── */}
      <Link
        href="/#daily-box"
        className="mb-4 flex items-center gap-2.5 px-4 py-2.5 rounded-2xl active:scale-[0.99] transition-transform"
        style={{ background: "var(--color-primary-soft)", border: "1px solid rgba(49,130,246,0.18)" }}
      >
        <span className="text-[16px] shrink-0">🐾</span>
        <p className="text-[11.5px] font-bold leading-snug flex-1" style={{ color: "var(--color-primary-dark)" }}>
          매일 돌봄 출석하면 포인트 적립 · 쇼핑에서 <b>1P = 1원</b>으로 쓸 수 있어요
        </p>
        <ChevronRight size={15} style={{ color: "var(--color-primary)" }} className="shrink-0" />
      </Link>

      {/* ── 후원 배너 + 공동 목표 진행바 ── */}
      {/* 적립액 0원일 땐 금액 없이 문구만 (0원 노출 역효과 방지) */}
      <div
        className="mb-4 px-5 py-4 rounded-3xl"
        style={{
          background: "linear-gradient(135deg, rgba(196,126,90,0.12) 0%, rgba(232,107,140,0.10) 100%)",
          border: "1px solid rgba(196,126,90,0.18)",
        }}
      >
        <p className="text-[13.5px] font-extrabold text-text-main leading-relaxed">
          여기서 구매하시면, 수익의 일부분이
          <br />길고양이를 위해 쓰입니다 🐱
          <span className="text-[11px] font-bold text-text-light"> (사용처 투표 중)</span>
        </p>
        {/* 투명성 안내 */}
        <div
          className="mt-2.5 px-3 py-2 rounded-xl"
          style={{ background: "rgba(255,255,255,0.55)", border: "1px solid rgba(196,126,90,0.15)" }}
        >
          <p className="text-[11px] leading-[1.65] text-text-sub">
            운영자는 <b className="text-text-main">서버 유지 등 최소 마진만</b> 남기고,
            남는 수익은 아이들에게 써요. <b className="text-text-main">어디에 쓸지는 투표로</b> 정하고,
            <br />모인 금액과 쓰인 금액은 <b className="text-text-main">아래에서 투명하게</b> 공개돼요 💛
          </p>
          <p className="text-[11px] font-bold text-text-main mt-1.5 pt-1.5" style={{ borderTop: "1px solid rgba(196,126,90,0.12)" }}>
            도시공존은 특정 단체·정당과 무관하게, 오직 <b style={{ color: "var(--color-primary-dark)" }}>길집사님들과</b> 함께 만들어가요 🐾
          </p>
        </div>
        {donation && donation.total > 0 ? (
          <div className="mt-3">
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-[11.5px] font-bold text-text-sub">
                {donation.goalLabel}까지
              </span>
              <span className="text-[12px] font-extrabold" style={{ color: "#D85575" }}>
                {donation.total.toLocaleString()}원
                <span className="font-bold text-text-light"> / {donation.goal.toLocaleString()}원</span>
              </span>
            </div>
            <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ background: "rgba(232,107,140,0.15)" }}>
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, Math.max(3, (donation.total / donation.goal) * 100))}%`,
                  background: "linear-gradient(90deg, #E86B8C 0%, #D85575 100%)",
                }}
              />
            </div>
            <p className="text-[10.5px] text-text-light mt-1.5">
              {donation.total >= donation.goal
                ? "목표 달성! 사용처는 투표로 정해요 🎉"
                : "구매 하나하나가 여기 쌓여요"}
            </p>
          </div>
        ) : (
          <p className="text-[11.5px] text-text-sub mt-1">
            어디에 쓸지는 함께 투표로 정해요
          </p>
        )}
      </div>

      {/* ── 수익 사용처 투표 ── */}
      <FundVoteCard />

      {/* ── 정식 오픈 준비 중 안내 ── */}
      <div
        className="mb-4 flex items-center gap-2 px-3.5 py-2 rounded-2xl"
        style={{ background: "rgba(255,169,39,0.1)", border: "1px solid rgba(255,169,39,0.25)" }}
      >
        <span className="text-[13px] shrink-0">🚧</span>
        <p className="text-[11px] font-semibold leading-snug" style={{ color: "#A6741E" }}>
          정식 오픈 준비 중이에요. 지금은 미리보기 단계라 실제 결제·배송은 되지 않아요.
        </p>
      </div>

      {/* ── 오픈 사전알림 (푸시 옵트인 재사용, 쇼핑 전용 dismiss 키) ── */}
      <PushOptInCard
        title="정식 오픈하면 가장 먼저 알려드릴까요? 🔔"
        description="오픈 소식과 첫 혜택을 푸시로 보내드려요"
        dismissKey="dosigongzon_shop_open_optin_dismissed_at"
      />

      {/* ── 카테고리 필터 칩 ── */}
      <div className="mb-4 flex items-center gap-2 overflow-x-auto pb-1 -mx-4 px-4">
        {FILTERS.map((f) => {
          const on = filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-[12px] font-bold active:scale-95 transition-transform shrink-0"
              style={{
                background: on
                  ? "linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)"
                  : "rgba(255,255,255,0.9)",
                color: on ? "#fff" : "#666",
                boxShadow: on
                  ? "0 2px 8px rgba(49,130,246,0.35)"
                  : "0 2px 6px rgba(0,0,0,0.05)",
              }}
            >
              <f.Icon size={13} />
              {f.label}
            </button>
          );
        })}
      </div>

      {/* ── 상품 그리드 ── */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-[22px] animate-pulse" style={{ aspectRatio: "1 / 1.4", background: "var(--color-surface-alt)" }} />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center text-center pt-14">
          <span className="text-[40px] mb-3">🐾</span>
          <p className="text-[14px] font-bold text-text-main mb-1">아직 준비 중이에요</p>
          <p className="text-[12.5px] text-text-sub">곧 채워질 거예요!</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {visible.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}

      {/* ── 법적 고지 링크 ── */}
      <div className="mt-8 text-center">
        <Link
          href="/shop/policy"
          className="text-[11.5px] font-semibold text-text-light underline underline-offset-2"
        >
          쇼핑몰 이용안내 · 교환/반품/환불 규정
        </Link>
      </div>
    </div>
  );
}
