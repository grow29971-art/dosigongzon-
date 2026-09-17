"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ShoppingCart, ReceiptText, PawPrint, LayoutGrid,
  Fish, SprayCan, HeartPulse, ToyBrick, Home, Gift, Heart, ImageOff,
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
import UIListRow from "@/app/components/ui/ListRow";

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

/* ═══ 상품 카드 — 당근 매물식: 8px 둥근 사각 사진 + 아래 글자, 테두리·그림자 없음 ═══ */
// wished/onToggleWish: 오픈 전 찜 (2026-07-21 쇼핑 동선 회의 — 결제 하드락 중 완결 행동)
function ProductCard({ product, wished, onToggleWish }: { product: Product; wished: boolean; onToggleWish: (id: string) => void }) {
  const thumb = product.images[0] ? sanitizeImageUrl(product.images[0], "") : "";
  const soldOut = product.stock <= 0;
  const discounted = product.sale_price != null && product.sale_price < product.price;

  return (
    <Link href={`/shop/${product.id}`} className="block press">
      {/* 이미지 */}
      <div
        className="relative w-full overflow-hidden"
        style={{ aspectRatio: "1 / 1", background: "var(--color-surface-alt)", borderRadius: "var(--radius-card-sm)" }}
      >
        {thumb ? (
          <Image src={thumb} alt={product.name} fill className="object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <ImageOff size={28} style={{ color: "var(--color-text-muted)" }} />
          </div>
        )}
        {product.badge && (
          <span
            className="absolute top-2 left-2 text-[11px] font-medium px-1.5 py-0.5"
            style={{ background: "var(--color-surface)", color: "var(--color-text-sub)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-square)" }}
          >
            {product.badge}
          </span>
        )}
        {soldOut && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.45)" }}>
            <span className="text-white text-[13px] font-semibold">품절</span>
          </div>
        )}
        {/* 찜 — Link 내부라 preventDefault로 상세 이동 차단 */}
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleWish(product.id); }}
          aria-label={wished ? "찜 해제" : "찜하기"}
          className="absolute bottom-2 right-2 z-10 w-8 h-8 rounded-full flex items-center justify-center press-strong"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <Heart size={15} fill={wished ? "var(--color-like)" : "none"} style={{ color: wished ? "var(--color-like)" : "var(--color-text-light)" }} />
        </button>
      </div>

      {/* 정보 */}
      <div className="pt-2 px-0.5">
        <p className="text-[13px] text-text-main leading-snug" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {product.name}
        </p>
        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
          {discounted && (
            <span className="text-[13px] font-bold" style={{ color: "var(--color-error)" }}>
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
        <p className="text-[11px] text-text-light mt-0.5">
          {[
            product.weight,
            product.shipping_fee === 0 && !product.is_virtual ? "무료배송" : null,
            product.is_donation ? "수익 일부 후원" : null,
          ].filter(Boolean).join(" · ")}
        </p>
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

  // 상품이 있는 카테고리만 칩으로 노출 — 빈 카테고리를 눌러 "준비 중"만 보는 동선 차단.
  // 카테고리가 하나뿐이면 칩 줄 자체를 숨긴다("전체" 하나는 필터가 아니라 장식).
  const availableFilters = useMemo(() => {
    const present = new Set(products.map((p) => p.category));
    const cats = FILTERS.filter((f) => f.key !== "all" && present.has(f.key as ProductCategory));
    return cats.length >= 2 ? [FILTERS[0], ...cats] : [];
  }, [products]);

  // 딥링크로 들어온 카테고리에 상품이 없으면 전체로 되돌림
  useEffect(() => {
    if (loading || filter === "all") return;
    if (!availableFilters.some((f) => f.key === filter)) setFilter("all");
  }, [loading, filter, availableFilters]);

  return (
    <div className="px-4 pt-14 pb-24">
      <PageIntroModal
        storageKey="dosigongzon_intro_shop"
        badge="쇼핑"
        headerEmoji=""
        title="사면, 아이들에게 돌아가요"
        items={[
          { emoji: "", text: <>수익(이익)의 <b className="text-text-main">10%</b>는 길고양이 <b className="text-text-main">중성화(TNR)</b>에 써요. 모인 금액과 쓴 금액은 그대로 공개돼요.</> },
          { emoji: "", text: <>매일 돌봄 기록으로 모은 포인트를 <b className="text-text-main">1P = 1원</b> 할인으로 쓸 수 있어요.</> },
          { emoji: "", text: <>모인 금액·쓰인 금액을 <b className="text-text-main">투명하게 공개</b>해요.</> },
        ]}
      />
      {/* ── 헤더 ── */}
      <div className="mb-4 px-1 flex items-end justify-between">
        <div>
          <h1 className="text-[24px] font-bold text-text-main tracking-tight mb-1">쇼핑</h1>
          <p className="text-[13px] text-text-sub leading-relaxed">
            길집사님들이 실제로 쓰는 것만 골라 들여오고 있어요
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Link
            href="/shop/orders"
            className="w-10 h-10 rounded-full flex items-center justify-center press-strong"
            aria-label="주문 내역"
          >
            <ReceiptText size={20} className="text-text-sub" />
          </Link>
          <Link
            href="/shop/cart"
            className="relative w-10 h-10 rounded-full flex items-center justify-center press-strong"
            aria-label="장바구니"
          >
            <ShoppingCart size={20} className="text-text-sub" />
            {cartCount > 0 && (
              <span
                className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 rounded-full text-white text-[9px] font-semibold flex items-center justify-center"
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

      {/* 포인트 안내 시트 — 첫 진입 1회 자동, 아래 행 탭으로 재열람 (2026-08-30) */}
      <PointsGuideSheet />

      {/* ── 포인트 안내 행 (탭하면 포인트 안내 시트 열림) ── */}
      <div className="mb-4" style={{ borderTop: "1px solid var(--color-divider)", borderBottom: "1px solid var(--color-divider)" }}>
        <UIListRow
          icon={<PawPrint size={20} />}
          title="포인트, 어떻게 모으고 쓰나요?"
          subtitle="돌봄·구매로 적립 → 1P = 1원 할인"
          onClick={() => window.dispatchEvent(new CustomEvent("open-points-guide"))}
          divider={false}
        />
      </div>

      {/* ── 후원 안내 + 공동 목표 진행바 ── */}
      {/* 적립액 0원일 땐 금액 없이 문구만 (0원 노출 역효과 방지) */}
      <div
        className="mb-4 px-4 py-4"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-card)" }}
      >
        <p className="text-[15px] font-semibold text-text-main leading-snug">
          여기서 사면 수익(이익)의 10%가 길고양이 중성화(TNR)에 쓰여요
        </p>
        <p className="text-[13px] text-text-sub leading-relaxed mt-1.5">
          어차피 사는 사료·용품이잖아요. 얼마가 모였고 얼마를 썼는지는 아래에 그대로 공개돼요.
        </p>
        <p className="text-[13px] text-text-sub leading-relaxed mt-1">
          도시공존은 특정 단체·정당과 무관하게, 오직 길집사님들과 함께 만들어가요.
        </p>
        {donation && donation.total > 0 ? (
          <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--color-divider)" }}>
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-[13px] text-text-sub">{donation.goalLabel}까지</span>
              <span className="text-[13px] font-bold text-text-main tabular-nums">
                {donation.total.toLocaleString()}원
                <span className="font-normal text-text-light"> / {donation.goal.toLocaleString()}원</span>
              </span>
            </div>
            <div className="w-full h-2 rounded-sm overflow-hidden" style={{ background: "var(--color-gray-200)" }}>
              <div
                className="h-full rounded-sm transition-all"
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
          <p className="text-[11px] text-text-light mt-2">첫 구매가 첫 후원이 돼요</p>
        )}
      </div>

      {/* ── 정식 오픈 준비 중 안내 — 실수 주문 우려 차단을 위해 결제 불가를 명시 ── */}
      <div
        className="mb-4 flex items-start gap-3 px-4 py-3.5"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-card)" }}
      >
        <Construction size={20} className="shrink-0 mt-0.5 text-text-sub" />
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-text-main leading-snug">정식 오픈을 준비하고 있어요</p>
          <p className="text-[13px] text-text-sub mt-0.5 leading-relaxed">
            지금은 구경과 찜만 가능하고 결제는 열리지 않아요.
          </p>
        </div>
      </div>

      {/* ── 오픈 사전알림 (푸시 옵트인 재사용, 쇼핑 전용 dismiss 키) ── */}
      <PushOptInCard
        title="정식 오픈하면 가장 먼저 알려드릴까요?"
        description="오픈 소식과 첫 혜택을 푸시로 보내드려요"
        dismissKey="dosigongzon_shop_open_optin_dismissed_at"
      />

      {/* ── 카테고리 필터 칩 (상품 있는 카테고리 2개 이상일 때만) ── */}
      {availableFilters.length > 0 && (
        <div className="mb-4 flex items-center gap-2 overflow-x-auto pb-1 -mx-4 px-4">
          {availableFilters.map((f) => {
            const on = filter === f.key;
            return (
              <UIChip key={f.key} onClick={() => setFilter(f.key)} active={on} icon={<f.Icon size={13} />}>
                {f.label}
              </UIChip>
            );
          })}
        </div>
      )}

      {/* ── 상품 그리드 ── */}
      {loading ? (
        <div className="grid grid-cols-2 gap-x-3 gap-y-5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse" style={{ aspectRatio: "1 / 1.4", background: "var(--color-surface-alt)", borderRadius: "var(--radius-card-sm)" }} />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center text-center pt-14">
          <PawPrint size={32} className="mb-3" style={{ color: "var(--color-text-muted)" }} />
          <p className="text-[13px] text-text-sub">아직 준비 중이에요</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-3 gap-y-5">
          {visible.map((p) => (
            <ProductCard key={p.id} product={p} wished={wish.includes(p.id)} onToggleWish={(id) => setWish(toggleWishlist(id))} />
          ))}
        </div>
      )}

      {/* ── 법적 고지 링크 ── */}
      <div className="mt-8 text-center">
        <Link
          href="/shop/policy"
          className="text-[11px] text-text-light underline underline-offset-2"
        >
          쇼핑몰 이용안내 · 교환/반품/환불 규정
        </Link>
      </div>

      {/* ── 사업자정보 푸터 — 전자상거래법 표시의무 + 토스페이먼츠 심사 요건("홈페이지 하단 기재") ── */}
      <div className="mt-4 text-center text-[11px] leading-relaxed" style={{ color: "var(--color-text-light)" }}>
        <p>도시공존 · 대표 김성우 · 사업자등록번호 793-16-02886</p>
        <p>사업장 소재지: 인천광역시 검단구 원당대로820번길 35, 초롱마을 13동 401호 (당하동)</p>
        <p>전화 010-7790-2997 · grow29971@gmail.com</p>
        <p>통신판매업 신고번호 제2026-인천검단-0207호</p>
      </div>
    </div>
  );
}
