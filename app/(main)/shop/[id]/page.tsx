import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProductServer } from "@/lib/shop-server";
import ProductDetailClient from "./ProductDetailClient";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const product = await getProductServer(id);
  if (!product) {
    return {
      title: "상품을 찾을 수 없어요",
      robots: { index: false, follow: false },
    };
  }

  const description = (product.description ?? "").slice(0, 100) || "도시공존 쇼핑 — 길고양이를 위한 용품과 후원";
  return {
    title: `${product.name} | 도시공존 쇼핑`,
    description,
    openGraph: {
      title: `${product.name} | 도시공존 쇼핑`,
      description,
      images: product.images[0] ? [product.images[0]] : undefined, // 없으면 기본 OG 이미지 사용
    },
  };
}

export default async function ProductDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const product = await getProductServer(id);
  if (!product || !product.is_active) notFound();

  // Product 구조화 데이터 — 구글 쇼핑 탭/리치 결과 노출용
  const price = product.sale_price ?? product.price;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: (product.description ?? "").slice(0, 300),
    image: product.images?.length ? product.images : undefined,
    brand: { "@type": "Brand", name: "도시공존" },
    offers: {
      "@type": "Offer",
      url: `https://dosigongzon.com/shop/${product.id}`,
      priceCurrency: "KRW",
      price,
      availability:
        product.stock > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        // "<"를 <로 치환해 상품명/설명에 "</script>"를 심어 스크립트 컨텍스트를
        // 탈출하는 저장형 XSS를 차단 (JSON 의미는 동일)
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <ProductDetailClient product={product} />
    </>
  );
}
