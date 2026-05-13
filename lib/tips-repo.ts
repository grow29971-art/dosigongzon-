// ══════════════════════════════════════════
// 도시공존 — 꿀팁게시판(tips) Repository
// Supabase public.tips + public.admins
// 패턴: news-repo.ts 와 동일 (createClient + requireAdmin)
// ══════════════════════════════════════════

import { createClient } from "@/lib/supabase/client";
import { createAnonClient } from "@/lib/supabase/anon";
import { requireAdmin } from "@/lib/admin-guard";
import { isSafeImageUrl, isSafeHttpUrl } from "@/lib/url-validate";
import { convertImageToWebp } from "@/lib/cats-repo";
import { sanitizeTipBody, extractTextFromHtml } from "@/lib/html-sanitize";

// ── 타입 ──
export interface Tip {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  body: string;
  thumbnail_url: string | null;
  tags: string[];
  source_url: string | null;
  source_label: string | null;
  featured: boolean;
  pinned: boolean;
  view_count: number;
  published: boolean;
  published_at: string;
  created_at: string;
  updated_at: string;
}

export type TipInput = Omit<Tip, "id" | "created_at" | "updated_at" | "view_count">;

// ── 슬러그 검증 ──
const SAFE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isSafeSlug(raw: unknown): raw is string {
  if (typeof raw !== "string") return false;
  if (raw.length < 1 || raw.length > 120) return false;
  return SAFE_SLUG.test(raw);
}

/** 제목에서 슬러그 자동 생성. 한글은 transliterate 안 하고 그냥 영숫자/하이픈만 추출 */
export function suggestSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 80) || `tip-${Date.now()}`;
}

// ── 입력 검증 ──
function validateTipInput(input: Partial<TipInput>): void {
  if (input.slug !== undefined && !isSafeSlug(input.slug)) {
    throw new Error("슬러그는 영소문자/숫자/하이픈만 사용 가능해요 (예: my-tip-1).");
  }
  if (input.thumbnail_url && !isSafeImageUrl(input.thumbnail_url)) {
    throw new Error("썸네일 URL 형식이 올바르지 않아요.");
  }
  if (input.source_url && !isSafeHttpUrl(input.source_url)) {
    throw new Error("출처 링크는 http(s) URL만 허용돼요.");
  }
  if (input.title !== undefined && (!input.title || input.title.length > 200)) {
    throw new Error("제목은 1~200자 사이여야 해요.");
  }
}

// ── 읽기 (서버: anon 클라이언트, RSC/ISR용) ──
export async function listPublishedTipsServer(limit = 50): Promise<Tip[]> {
  try {
    const supabase = createAnonClient();
    const { data, error } = await supabase
      .from("tips")
      .select("*")
      .eq("published", true)
      .order("pinned", { ascending: false })
      .order("published_at", { ascending: false })
      .limit(limit);
    if (error) {
      console.error("[tips-repo] listPublishedTipsServer failed:", error);
      return [];
    }
    return (data ?? []) as Tip[];
  } catch (err) {
    console.error("[tips-repo] listPublishedTipsServer threw:", err);
    return [];
  }
}

export async function getTipBySlugServer(slug: string): Promise<Tip | null> {
  if (!isSafeSlug(slug)) return null;
  try {
    const supabase = createAnonClient();
    const { data, error } = await supabase
      .from("tips")
      .select("*")
      .eq("slug", slug)
      .eq("published", true)
      .maybeSingle();
    if (error) {
      console.error("[tips-repo] getTipBySlugServer failed:", error);
      return null;
    }
    return (data ?? null) as Tip | null;
  } catch (err) {
    console.error("[tips-repo] getTipBySlugServer threw:", err);
    return null;
  }
}

/** 같은 태그를 공유하는 다른 글 추천 */
export async function getRelatedTipsServer(currentSlug: string, tags: string[], limit = 3): Promise<Tip[]> {
  if (tags.length === 0) return [];
  try {
    const supabase = createAnonClient();
    const { data, error } = await supabase
      .from("tips")
      .select("*")
      .eq("published", true)
      .neq("slug", currentSlug)
      .overlaps("tags", tags)
      .order("published_at", { ascending: false })
      .limit(limit);
    if (error) {
      console.error("[tips-repo] getRelatedTipsServer failed:", error);
      return [];
    }
    return (data ?? []) as Tip[];
  } catch (err) {
    console.error("[tips-repo] getRelatedTipsServer threw:", err);
    return [];
  }
}

/** sitemap용 — 발행된 모든 슬러그 + updated_at */
export async function listAllPublishedSlugsServer(): Promise<Array<{ slug: string; updated_at: string }>> {
  try {
    const supabase = createAnonClient();
    const { data, error } = await supabase
      .from("tips")
      .select("slug, updated_at")
      .eq("published", true);
    if (error) return [];
    return (data ?? []) as Array<{ slug: string; updated_at: string }>;
  } catch {
    return [];
  }
}

// ── 읽기 (클라이언트: 어드민 페이지에서 사용) ──
export async function listAllTips(): Promise<Tip[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tips")
    .select("*")
    .order("pinned", { ascending: false })
    .order("published_at", { ascending: false });
  if (error) {
    console.error("[tips-repo] listAllTips failed:", error);
    return [];
  }
  return (data ?? []) as Tip[];
}

export async function getTipById(id: string): Promise<Tip | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tips")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("[tips-repo] getTipById failed:", error);
    return null;
  }
  return (data ?? null) as Tip | null;
}

// ── 조회수 증가 (RPC, 누구나 호출 가능) ──
export async function incrementTipView(slug: string): Promise<void> {
  if (!isSafeSlug(slug)) return;
  try {
    const supabase = createAnonClient();
    await supabase.rpc("increment_tip_view", { p_slug: slug });
  } catch (err) {
    // 실패해도 사용자 경험에 영향 없음
    console.error("[tips-repo] incrementTipView failed:", err);
  }
}

// ── 쓰기 (admin RLS) ──
export async function createTip(input: TipInput): Promise<Tip> {
  await requireAdmin();
  validateTipInput(input);

  // body sanitize + description 자동 추출
  const sanitizedBody = sanitizeTipBody(input.body);
  const description = input.description?.trim() || extractTextFromHtml(sanitizedBody, 160);

  const supabase = createClient();
  const { data, error } = await supabase
    .from("tips")
    .insert({
      ...input,
      body: sanitizedBody,
      description,
      tags: input.tags ?? [],
    })
    .select()
    .single();
  if (error) {
    console.error("[tips-repo] createTip failed:", error);
    if (error.code === "23505") {
      throw new Error("이미 존재하는 슬러그예요. 다른 이름으로 바꿔주세요.");
    }
    throw new Error(`꿀팁 작성 실패: ${error.message}`);
  }
  return data as Tip;
}

export async function updateTip(id: string, input: Partial<TipInput>): Promise<Tip> {
  await requireAdmin();
  validateTipInput(input);

  const patch: Record<string, unknown> = { ...input };
  if (typeof input.body === "string") {
    patch.body = sanitizeTipBody(input.body);
    if (!input.description) {
      patch.description = extractTextFromHtml(patch.body as string, 160);
    }
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("tips")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) {
    console.error("[tips-repo] updateTip failed:", error);
    if (error.code === "23505") {
      throw new Error("이미 존재하는 슬러그예요.");
    }
    throw new Error(`꿀팁 수정 실패: ${error.message}`);
  }
  return data as Tip;
}

export async function deleteTip(id: string): Promise<void> {
  await requireAdmin();
  const supabase = createClient();
  const { error } = await supabase.from("tips").delete().eq("id", id);
  if (error) {
    console.error("[tips-repo] deleteTip failed:", error);
    throw new Error(`꿀팁 삭제 실패: ${error.message}`);
  }
}

// ── 이미지 업로드 (admin 전용, cat-photos 버킷 공유) ──
export async function uploadTipImage(file: File): Promise<string> {
  const adminId = await requireAdmin();
  const supabase = createClient();

  const MAX_INPUT_SIZE = 20 * 1024 * 1024;
  if (file.size > MAX_INPUT_SIZE) {
    throw new Error("이미지는 20MB 이하만 업로드 가능해요.");
  }
  if (!file.type.startsWith("image/")) {
    throw new Error("이미지 파일만 업로드 가능해요.");
  }

  const webpFile = await convertImageToWebp(file);
  const fileName = `${adminId}/tips-${Date.now()}.webp`;

  const { error: uploadError } = await supabase.storage
    .from("cat-photos")
    .upload(fileName, webpFile, {
      cacheControl: "2592000",
      upsert: false,
      contentType: "image/webp",
    });
  if (uploadError) {
    console.error("[tips-repo] uploadTipImage failed:", uploadError);
    throw new Error(`이미지 업로드에 실패했어요: ${uploadError.message}`);
  }

  const { data: urlData } = supabase.storage.from("cat-photos").getPublicUrl(fileName);
  return urlData.publicUrl;
}
