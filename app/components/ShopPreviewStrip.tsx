"use client";

// 홈 쇼핑 프리뷰 스트립 — 2026-07-21 쇼핑 동선 회의 채택안 (추가 전용, 삭제 없음)
// 배치: 케어 섹션(다마고치·내 아이들) 뒤 — 코어퍼널(돌봄) 위계를 침범하지 않는다.
// 결제 하드락 기간이라 CTA는 구매가 아닌 찜(♡, localStorage). 상품 없으면 렌더 안 함.
// 롤백: HomeAuthed의 SHOW_SHOP_PREVIEW 플래그 한 줄.

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Heart, ChevronRight, PawPrint } from "lucide-react";
import { listProducts, type Product } from "@/lib/shop-repo";
import { readWishlist, toggleWishlist } from "@/lib/wishlist";
import { sanitizeImageUrl } from "@/lib/url-validate";

export default function ShopPreviewStrip() {
  const [products, setProducts] = useState<Product[]>([]);
  const [wish, setWish] = useState<string[]>([]);

  useEffect(() => {
    listProducts()
      .then((all) => {
        // 실물 상품만, "인기" 배지 우선 → 최신순(이미 정렬됨) 상위 6개
        const sorted = all
          .filter((p) => !p.is_virtual)
          .sort((a, b) => (b.badge === "인기" ? 1 : 0) - (a.badge === "인기" ? 1 : 0));
        setProducts(sorted.slice(0, 6));
      })
      .catch(() => {});
    setWish(readWishlist());
  }, []);

  if (products.length === 0) return null;

  const toggle = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setWish(toggleWishlist(id));
  };

  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-3 px-1">
        <h2 className="text-[17px] font-extrabold text-text-main tracking-tight">
          곧 열리는 상점 🛍️
        </h2>
        <Link
          href="/shop"
          className="flex items-center gap-0.5 text-[12px] font-bold"
          style={{ color: "var(--color-primary)" }}
        >
          전체보기 <ChevronRight size={13} />
        </Link>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-1 -mx-5 px-5 no-scrollbar" style={{ scrollSnapType: "x mandatory" }}>
        {products.map((p) => {
          const thumb = p.images[0] ? sanitizeImageUrl(p.images[0], "") : "";
          const price = p.sale_price != null && p.sale_price < p.price ? p.sale_price : p.price;
          const wished = wish.includes(p.id);
          return (
            <Link
              key={p.id}
              href={`/shop/${p.id}`}
              className="shrink-0 w-[124px] active:scale-[0.97] transition-transform"
              style={{ scrollSnapAlign: "start" }}
            >
              <div
                className="relative w-full overflow-hidden"
                style={{ aspectRatio: "1 / 1", borderRadius: "var(--radius-card-sm)", background: "var(--color-surface)", boxShadow: "var(--shadow-card)" }}
              >
                {thumb ? (
                  <Image src={thumb} alt={p.name} fill className="object-cover" sizes="124px" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <PawPrint size={26} style={{ color: "var(--color-primary-soft)" }} />
                  </div>
                )}
                <button
                  type="button"
                  onClick={(e) => toggle(e, p.id)}
                  aria-label={wished ? "찜 해제" : "찜하기"}
                  className="absolute bottom-1.5 right-1.5 w-8 h-8 rounded-full flex items-center justify-center active:scale-90 transition-transform"
                  style={{ background: "rgba(255,255,255,0.92)", boxShadow: "0 1px 5px rgba(0,0,0,0.12)" }}
                >
                  <Heart
                    size={15}
                    fill={wished ? "#E14B6A" : "none"}
                    style={{ color: wished ? "#E14B6A" : "var(--color-text-light)" }}
                  />
                </button>
              </div>
              <p className="text-[11.5px] font-bold text-text-main mt-1.5 leading-snug truncate">{p.name}</p>
              <p className="text-[12px] font-extrabold text-text-main">{price.toLocaleString()}원</p>
            </Link>
          );
        })}
      </div>

      <p className="text-[10.5px] text-text-light mt-1.5 px-1">
        아직 오픈 전이에요 — 찜해두시면 오픈 소식을 가장 먼저 알려드릴게요
      </p>
    </div>
  );
}
