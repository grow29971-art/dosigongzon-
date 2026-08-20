// ══════════════════════════════════════════
// 도시공존 — 쇼핑몰 구매후기 Repository
// 작성 자격(실구매)은 RLS가 DB에서 강제. 여기서는 UX용 사전 판정만 수행.
// ══════════════════════════════════════════

import { createClient } from "@/lib/supabase/client";
import { getDisplayName, convertImageToWebp } from "@/lib/cats-repo";
import { findAbuseViolations, formatAbuseMessage } from "@/lib/abuse-patterns";

export const REVIEW_MAX_IMAGES = 3;
export const REVIEW_MAX_LENGTH = 2000;

// 후기 작성이 허용되는 주문 상태 — 마이그레이션 RLS와 동일하게 유지
const REVIEWABLE_ORDER_STATUSES = ["paid", "preparing", "shipping", "delivered"];

export interface ProductReview {
  id: string;
  product_id: string;
  user_id: string;
  rating: number;
  content: string;
  images: string[];
  author_name: string | null;
  author_avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

// ── 상품 후기 목록 (최신순) ──
export async function listProductReviews(productId: string): Promise<ProductReview[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("product_reviews")
    .select("*")
    .eq("product_id", productId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("[shop-reviews-repo] listProductReviews failed:", error);
    throw new Error(`후기를 불러올 수 없어요: ${error.message}`);
  }
  return (data ?? []) as ProductReview[];
}

// ── 내 작성 자격 판정 (UX용 — 최종 강제는 RLS) ──
export interface ReviewEligibility {
  purchased: boolean;       // 결제 완료 이후 상태의 주문에 이 상품이 포함되어 있는가
  myReview: ProductReview | null; // 이미 작성한 후기 (있으면 작성 버튼 대신 삭제 노출)
}

export async function getMyReviewEligibility(productId: string): Promise<ReviewEligibility> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { purchased: false, myReview: null };

  const [{ data: myReview }, { data: orderItems }] = await Promise.all([
    supabase
      .from("product_reviews")
      .select("*")
      .eq("product_id", productId)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("order_items")
      .select("id, order:orders!inner(status, user_id)")
      .eq("product_id", productId)
      .eq("order.user_id", user.id)
      .in("order.status", REVIEWABLE_ORDER_STATUSES)
      .limit(1),
  ]);

  return {
    purchased: (orderItems ?? []).length > 0,
    myReview: (myReview as ProductReview | null) ?? null,
  };
}

// ── 후기 사진 업로드 (cat-photos 버킷 공유, webp 변환 → EXIF 제거) ──
export async function uploadReviewImage(file: File): Promise<string> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요해요.");
  if (file.size > 20 * 1024 * 1024) throw new Error("이미지는 20MB 이하만 가능해요.");
  if (!file.type.startsWith("image/")) throw new Error("이미지 파일만 가능해요.");

  const webpFile = await convertImageToWebp(file, 1024, 0.8);
  const fileName = `${user.id}/review_${crypto.randomUUID()}.webp`;

  const { error } = await supabase.storage
    .from("cat-photos")
    .upload(fileName, webpFile, { cacheControl: "2592000", upsert: false, contentType: "image/webp" });
  if (error) {
    console.error("[shop-reviews-repo] uploadReviewImage failed:", error);
    throw new Error(`사진 업로드에 실패했어요: ${error.message}`);
  }

  const { data: urlData } = supabase.storage.from("cat-photos").getPublicUrl(fileName);
  return urlData.publicUrl;
}

// ── 후기 작성 ──
export interface CreateReviewInput {
  productId: string;
  rating: number;      // 1~5
  content: string;
  images?: string[];   // uploadReviewImage 결과 URL
}

export async function createReview(input: CreateReviewInput): Promise<ProductReview> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요해요.");

  const content = input.content.trim();
  if (!content) throw new Error("후기 내용을 입력해주세요.");
  if (content.length > REVIEW_MAX_LENGTH) throw new Error(`후기는 ${REVIEW_MAX_LENGTH}자 이하로 작성해주세요.`);
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
    throw new Error("별점을 선택해주세요.");
  }

  // 어뷰징 검증 — 개인정보·욕설 표현 차단 (커뮤니티와 동일 기준)
  const abuse = findAbuseViolations(content);
  if (abuse.length > 0) throw new Error(formatAbuseMessage(abuse));

  const { data, error } = await supabase
    .from("product_reviews")
    .insert({
      product_id: input.productId,
      user_id: user.id,
      rating: input.rating,
      content,
      images: (input.images ?? []).slice(0, REVIEW_MAX_IMAGES),
      author_name: getDisplayName(user),
      author_avatar_url: user.user_metadata?.avatar_url ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error("[shop-reviews-repo] createReview failed:", error);
    if (error.code === "23505") throw new Error("이미 이 상품에 후기를 남기셨어요.");
    if (error.code === "42501") throw new Error("구매 이력이 있어야 후기를 남길 수 있어요.");
    throw new Error(`후기 작성에 실패했어요: ${error.message}`);
  }
  return data as ProductReview;
}

// ── 후기 삭제 (본인 또는 관리자 — RLS가 판정) ──
export async function deleteReview(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("product_reviews").delete().eq("id", id);
  if (error) {
    console.error("[shop-reviews-repo] deleteReview failed:", error);
    throw new Error(`후기 삭제에 실패했어요: ${error.message}`);
  }
}
