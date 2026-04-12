import { createClient } from "@/lib/supabase/client";
import { requireAdmin } from "@/lib/admin-guard";

export interface PharmacyGuideItem {
  id: string;
  name: string;
  brand: string | null;
  category: string;
  color: string;
  image_url: string | null;
  description: string;
  usage_info: string | null;
  tip: string | null;
  price: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type PharmacyGuideInput = Omit<PharmacyGuideItem, "id" | "created_at" | "updated_at">;

export async function listPharmacyGuideItems(): Promise<PharmacyGuideItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("pharmacy_guide_items")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[pharmacy-guide-repo] list failed:", error);
    return [];
  }
  return (data ?? []) as PharmacyGuideItem[];
}

export async function createPharmacyGuideItem(input: PharmacyGuideInput): Promise<PharmacyGuideItem> {
  await requireAdmin();
  const supabase = createClient();
  const { data, error } = await supabase
    .from("pharmacy_guide_items")
    .insert(input)
    .select()
    .single();

  if (error) throw new Error(`추가 실패: ${error.message}`);
  return data as PharmacyGuideItem;
}

export async function updatePharmacyGuideItem(id: string, input: Partial<PharmacyGuideInput>): Promise<PharmacyGuideItem> {
  await requireAdmin();
  const supabase = createClient();
  const { data, error } = await supabase
    .from("pharmacy_guide_items")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`수정 실패: ${error.message}`);
  return data as PharmacyGuideItem;
}

export async function deletePharmacyGuideItem(id: string): Promise<void> {
  await requireAdmin();
  const supabase = createClient();
  const { error } = await supabase.from("pharmacy_guide_items").delete().eq("id", id);
  if (error) throw new Error(`삭제 실패: ${error.message}`);
}

export async function uploadGuideImage(file: File): Promise<string> {
  await requireAdmin();
  const supabase = createClient();

  if (file.size > 10 * 1024 * 1024) throw new Error("10MB 이하만 업로드 가능해요.");
  if (!file.type.startsWith("image/")) throw new Error("이미지 파일만 가능해요.");

  const fileName = `guide/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${file.name.split(".").pop()}`;
  const { error } = await supabase.storage
    .from("cat-photos")
    .upload(fileName, file, { cacheControl: "3600", upsert: false });

  if (error) throw new Error(`업로드 실패: ${error.message}`);

  const { data: urlData } = supabase.storage.from("cat-photos").getPublicUrl(fileName);
  return urlData.publicUrl;
}
