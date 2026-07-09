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

  return <ProductDetailClient product={product} />;
}
