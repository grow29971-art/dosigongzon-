"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ShoppingCart, ReceiptText, PawPrint, LayoutGrid,
  Fish, SprayCan, HeartPulse, ToyBrick, Home, Gift, ChevronRight, Heart,
  Construction,
  type LucideIcon,
} from "lucide-react";
import { readWishlist, toggleWishlist } from "@/lib/wishlist";
import { useAuth } from "@/lib/auth-context";
import {
  listProducts, listCartItems, SHOP_CATEGORIES,
  type Product, type ProductCategory,
} from "@/lib/shop-repo";
import { sanitizeImageUrl } from "@/lib/url-validate";
import PushOptInCard from "@/app/components/PushOptInCard";
import FundSettlementCard from "@/app/components/FundSettlementCard";
import PageIntroModal from "@/app/components/PageIntroModal";
import PointsGuideSheet from "@/app/components/PointsGuideSheet";
import UIChip from "@/app/components/ui/Chip";

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
// wished/onToggleWish: 오픈 전 찜 (2026-07-21 쇼핑 동선 회의 — 결제 하드락 중 완결 행동)
function ProductCard({ product, wished, onToggleWish }: { product: Product; wished: boolean; onToggleWish: (id: string) => void }) {
  const thumb = product.images[0] ? sanitizeImageUrl(product.images[0], "") : "";
  const soldOut = product.stock <= 0;
  const discounted = product.sale_price != null && product.sale_price < product.price;

  return (
    <Link href={`/shop/${product.id}`} className="block press transition-transform">
      <div
        className="overflow-hidden h-full"
        style={{
          background: "var(--color-surface)",
          borderRadius: "var(--radius-card)",
          boxShadow: "var(--shadow-card)",
          border: "1px solid var(--color-divider)",
        }}
      >
        {/* 이미지 */}
        <div className="relative w-full" style={{ aspectRatio: "1 / 1", background: "var(--color-warm-white)" }}>
          {thumb ? (
            <Image src={thumb} alt={product.name} fill className="object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <PawPrint size={40} style={{ color: "rgba(176, 92, 54,0.28)" }} />
            </div>
          )}
          {product.badge && (
            <span
              className="absolute top-2 left-2 text-[11px] font-bold px-2 py-0.5 rounded-lg text-white"
              style={{ background: product.badge === "인기" ? "var(--color-error)" : product.badge === "신상" ? "var(--color-primary)" : "var(--color-warning)" }}
            >
              {product.badge}
            </span>
          )}
          {product.shipping_fee === 0 && !product.is_virtual && (
            <span
              className="absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded-md"
              style={{ background: "rgba(34,163,102,0.92)", color: "#fff" }}
            >
              무료배송
            </span>
          )}
          {soldOut && (
            <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(38,42,56,0.55)" }}>
              <span className="text-white text-[13px] font-bold px-3 py-1.5 rounded-xl" style={{ background: "rgba(0,0,0,0.35)" }}>
                품절
              </span>
            </div>
          )}
          {/* 찜 — Link 내부라 preventDefault로 상세 이동 차단 */}
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleWish(product.id); }}
            aria-label={wished ? "찜 해제" : "찜하기"}
            className="absolute bottom-2 right-2 z-10 w-9 h-9 rounded-full flex items-center justify-center press-strong transition-transform"
            style={{ background: "rgba(255,255,255,0.94)", boxShadow: "var(--shadow-raised)" }}
          >
            <Heart size={16} fill={wished ? "var(--color-like)" : "none"} style={{ color: wished ? "var(--color-like)" : "var(--color-text-light)" }} />
          </button>
        </div>

        {/* 정보 */}
        <div className="px-3 py-3">
          <p className="text-[13px] font-medium text-text-main leading-snug" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {product.name}
          </p>
          {product.weight && (
            <p className="text-[11px] text-text-light mt-0.5">{product.weight}</p>
          )}
          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
            {discounted && (
              <span className="text-[11px] font-medium" style={{ color: "var(--color-error)" }}>
                {discountRate(product.price, product.sale_price as number)}%
              </span>
            )}
            <span className="text-[15px] font-bold text-text-main">
              {formatWon(discounted ? (product.sale_price as number) : product.price)}
            </span>
            {discounted && (
              <span className="text-[11px] text-text-light line-through">{formatWon(product.price)}</span>
            )}
          </div>
          {product.is_donation ? (
            <p className="text-[11px] font-semibold mt-1.5" style={{ color: "var(--color-warning)" }}>
              수익의 일부 후원
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
  const [wish, setWish] = useState<string[]>([]);

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
    setWish(readWishlist());
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
        headerBg="linear-gradient(160deg, var(--color-care-soft) 0%, #FCE9D6 100%)"
        accent="#E8930C"
        accentDark="#B5720A"
        items={[
          { emoji: "💛", text: <>수익(이익)의 <b className="text-text-main">10%</b>는 길고양이 <b className="text-text-main">중성화(TNR)</b>에 써요. 모인 금액과 쓴 금액은 그대로 공개돼요.</> },
          { emoji: "🐾", text: <>매일 돌봄 기록으로 모은 포인트를 <b className="text-text-main">1P = 1원</b> 할인으로 쓸 수 있어요.</> },
          { emoji: "🔍", text: <>모인 금액·쓰인 금액을 <b className="text-text-main">투명하게 공개</b>해요.</> },
        ]}
      />
      {/* ── 헤더 ── */}
      <div className="mb-4 px-1 flex items-end justify-between">
        <div>
          <div className="flex items-baseline gap-2 mb-1">
            <h1 className="text-[24px] font-bold text-text-main tracking-tight">쇼핑</h1>
          </div>
          <p className="text-[13px] text-text-sub leading-relaxed">
            길집사님들이 실제로 쓰는 것만 골라 들여오고 있어요
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/shop/orders"
            className="w-10 h-10 rounded-full bg-white flex items-center justify-center press-strong transition-transform"
            style={{ boxShadow: "var(--shadow-raised)" }}
            aria-label="주문 내역"
          >
            <ReceiptText size={18} className="text-text-sub" />
          </Link>
          <Link
            href="/shop/cart"
            className="relative w-10 h-10 rounded-full bg-white flex items-center justify-center press-strong transition-transform"
            style={{ boxShadow: "var(--shadow-raised)" }}
            aria-label="장바구니"
          >
            <ShoppingCart size={18} className="text-text-sub" />
            {cartCount > 0 && (
              <span
                className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-white text-[9px] font-bold flex items-center justify-center"
                style={{ background: "var(--color-error)" }}
              >
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            )}
          </Link>
        </div>
      </div>

      {/* ── 후원금 투명 정산 (쇼핑 최상단) ── */}
      <FundSettlementCard />

      {/* 포인트 안내 시트 — 첫 진입 1회 자동, 아래 띠 탭으로 재열람 (2026-08-30) */}
      <PointsGuideSheet />

      {/* ── 포인트 안내 띠 (탭하면 포인트 안내 시트 열림) ── */}
      <button
        type="button"
        onClick={() => window.dispatchEvent(new CustomEvent("open-points-guide"))}
        className="mb-4 w-full flex items-center gap-2.5 px-4 py-2.5 rounded-2xl press transition-transform text-left"
        style={{ background: "var(--color-primary-soft)", border: "1px solid rgba(176, 92, 54,0.18)" }}
      >
        <PawPrint size={16} className="shrink-0" style={{ color: "var(--color-primary)" }} />
        <p className="text-[11px] font-bold leading-snug flex-1" style={{ color: "var(--color-primary-dark)" }}>
          포인트 어떻게 모으고 쓰나요? · 돌봄·구매로 적립 → <b>1P = 1원</b> 할인
        </p>
        <ChevronRight size={15} style={{ color: "var(--color-primary)" }} className="shrink-0" />
      </button>

      {/* ── 후원 배너 + 공동 목표 진행바 ── */}
      {/* 적립액 0원일 땐 금액 없이 문구만 (0원 노출 역효과 방지) */}
      <div
        className="mb-4 px-5 py-4 rounded-3xl"
        style={{
          background: "rgba(201,124,82,0.12)",
          border: "1px solid rgba(201,124,82,0.18)",
        }}
      >
        <p className="text-[13px] font-bold text-text-main leading-relaxed">
          여기서 사면 <b style={{ color: "var(--color-primary-dark)" }}>수익(이익)의 10%</b>가
          <br />길고양이 <b style={{ color: "var(--color-primary-dark)" }}>중성화(TNR)</b>에 쓰여요
        </p>
        {/* 투명성 안내 */}
        <div
          className="mt-2.5 px-3 py-2 rounded-xl"
          style={{ background: "rgba(255,255,255,0.55)", border: "1px solid rgba(201,124,82,0.15)" }}
        >
          <p className="text-[11px] leading-[1.65] text-text-sub">
            어차피 사는 사료·용품이잖아요.
            <br />얼마가 모였고 얼마를 썼는지는 <b className="text-text-main">아래에 그대로 공개</b>돼요
          </p>
          <p className="text-[11px] font-bold text-text-main mt-1.5 pt-1.5" style={{ borderTop: "1px solid rgba(201,124,82,0.12)" }}>
            도시공존은 특정 단체·정당과 무관하게, 오직 <b style={{ color: "var(--color-primary-dark)" }}>길집사님들과</b> 함께 만들어가요
          </p>
        </div>
        {donation && donation.total > 0 ? (
          <div className="mt-3">
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-[11px] font-bold text-text-sub">
                {donation.goalLabel}까지
              </span>
              <span className="text-[13px] font-bold" style={{ color: "var(--color-primary-dark)" }}>
                {donation.total.toLocaleString()}원
                <span className="font-bold text-text-light"> / {donation.goal.toLocaleString()}원</span>
              </span>
            </div>
            <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ background: "rgba(176,92,54,0.15)" }}>
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, Math.max(3, (donation.total / donation.goal) * 100))}%`,
                  background: "var(--color-primary)",
                }}
              />
            </div>
            <p className="text-[11px] text-text-light mt-1.5">
              {donation.total >= donation.goal
                ? "목표 달성! 중성화 지원에 쓰여요"
                : "구매 하나하나가 여기 쌓여요"}
            </p>
          </div>
        ) : (
          // 헤드라인에서 이미 용도를 말했으니 여기서는 반복하지 않는다
          <p className="text-[11px] text-text-sub mt-1">
            첫 구매가 첫 후원이 돼요
          </p>
        )}
      </div>

      {/* ── 정식 오픈 준비 중 안내 — 실수 주문 우려 차단을 위해 크게, 결제 불가를 명시 ── */}
      <div
        className="mb-4 flex items-start gap-3 px-4 py-3.5 rounded-2xl"
        style={{ background: "rgba(255,169,39,0.12)", border: "1.5px solid rgba(255,169,39,0.4)" }}
      >
        <Construction size={22} className="shrink-0 mt-0.5" style={{ color: "var(--color-warning)" }} />
        <div className="min-w-0">
          <p className="text-[15px] font-bold leading-snug" style={{ color: "#8A5A0A" }}>
            정식 오픈을 준비하고 있어요
          </p>
          <p className="text-[13px] font-semibold mt-1 leading-relaxed" style={{ color: "#8A5A0A" }}>
            지금은 <b>구경과 찜만 가능</b>하고 결제는 열리지 않아요.
            실수로 주문될 걱정은 안 하셔도 돼요. 준비되면 알려드릴게요!
          </p>
        </div>
      </div>

      {/* ── 오픈 사전알림 (푸시 옵트인 재사용, 쇼핑 전용 dismiss 키) ── */}
      <PushOptInCard
        title="정식 오픈하면 가장 먼저 알려드릴까요?"
        description="오픈 소식과 첫 혜택을 푸시로 보내드려요"
        dismissKey="dosigongzon_shop_open_optin_dismissed_at"
      />

      {/* ── 카테고리 필터 칩 ── */}
      <div className="mb-4 flex items-center gap-2 overflow-x-auto pb-1 -mx-4 px-4">
        {FILTERS.map((f) => {
          const on = filter === f.key;
          return (
            <UIChip key={f.key} onClick={() => setFilter(f.key)} active={on} icon={<f.Icon size={13} />}>
              {f.label}
            </UIChip>
          );
        })}
      </div>

      {/* ── 상품 그리드 ── */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-[var(--radius-card)] animate-pulse" style={{ aspectRatio: "1 / 1.4", background: "var(--color-surface-alt)" }} />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center text-center pt-14">
          <PawPrint size={40} className="mb-3" style={{ color: "var(--color-text-muted)" }} />
          <p className="text-[15px] font-bold text-text-main mb-1">아직 준비 중이에요</p>
          <p className="text-[13px] text-text-sub">곧 채워질 거예요!</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {visible.map((p) => (
            <ProductCard key={p.id} product={p} wished={wish.includes(p.id)} onToggleWish={(id) => setWish(toggleWishlist(id))} />
          ))}
        </div>
      )}

      {/* ── 법적 고지 링크 ── */}
      <div className="mt-8 text-center">
        <Link
          href="/shop/policy"
          className="text-[11px] font-semibold text-text-light underline underline-offset-2"
        >
          쇼핑몰 이용안내 · 교환/반품/환불 규정
        </Link>
      </div>

      {/* ── 사업자정보 푸터 — 전자상거래법 표시의무 + 토스페이먼츠 심사 요건("홈페이지 하단 기재") ── */}
      <div className="mt-4 text-center text-[10px] leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
        <p>도시공존 · 대표 김성우 · 사업자등록번호 793-16-02886</p>
        <p>인천광역시 검단구 원당대로820번길 35, 초롱마을 13동 401호 (당하동)</p>
        <p>전화 010-7790-2997 · grow29971@gmail.com</p>
        <p>통신판매업 신고번호 제2026-인천검단-0207호</p>
      </div>
    </div>
  );
}
