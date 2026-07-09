// ══════════════════════════════════════════
// 서버 사이드 상품 조회 (RSC 전용) — 상세 페이지 SEO 메타데이터용
// ══════════════════════════════════════════

import { createClient } from "@/lib/supabase/server";
import type { Product } from "@/lib/shop-repo";

export async function getProductServer(id: string): Promise<Product | null> {
  // UUID 형식이 아니면 즉시 null (400 회피)
  if (!/^[0-9a-fA-F-]{32,36}$/.test(id)) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[shop-server] getProductServer failed:", error);
    return null;
  }
  return (data as Product | null) ?? null;
}
