// ══════════════════════════════════════════
// 도시공존 — 뉴스(소식 & 일정) Repository
// Supabase public.news + public.admins
// ══════════════════════════════════════════

import { createClient } from "@/lib/supabase/client";

export type NewsBadgeType = "event" | "tnr" | "law" | "notice" | "urgent";

export interface NewsItem {
  id: string;
  badge_type: NewsBadgeType;
  title: string;
  description: string | null;
  image_url: string | null;
  date_label: string | null;
  dday: string | null;
  body: string | null;
  external_url: string | null;
  external_label: string | null;
  pinned: boolean;
  created_at: string;
  updated_at: string;
}

// 배지 타입별 프리셋 (색상/그라데이션/한국어 라벨)
export const BADGE_PRESETS: Record<
  NewsBadgeType,
  { label: string; color: string; bg: string; gradient: string }
> = {
  event: {
    label: "행사",
    color: "#C47E5A",
    bg: "#EEE8E0",
    gradient: "linear-gradient(135deg, #EEE8E0 0%, #E5DCCF 100%)",
  },
  tnr: {
    label: "TNR",
    color: "#6B8E6F",
    bg: "#E8ECE5",
    gradient: "linear-gradient(135deg, #E8ECE5 0%, #D6DCD2 100%)",
  },
  law: {
    label: "법령",
    color: "#7A6B8E",
    bg: "#EAE6E8",
    gradient: "linear-gradient(135deg, #EAE6E8 0%, #DCD6D9 100%)",
  },
  notice: {
    label: "공지",
    color: "#5B7A8F",
    bg: "#E5E8ED",
    gradient: "linear-gradient(135deg, #E5E8ED 0%, #D6DBE2 100%)",
  },
  urgent: {
    label: "긴급",
    color: "#D85555",
    bg: "#FBEAEA",
    gradient: "linear-gradient(135deg, #FBEAEA 0%, #F0D6D6 100%)",
  },
};

// ── 읽기 ──
export async function listNews(): Promise<NewsItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("news")
    .select("*")
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[news-repo] listNews failed:", error);
    return [];
  }
  return (data ?? []) as NewsItem[];
}

export async function getNewsById(id: string): Promise<NewsItem | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("news")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[news-repo] getNewsById failed:", error);
    return null;
  }
  return (data ?? null) as NewsItem | null;
}

// ── 쓰기 (admin RLS) ──
export type NewsInput = Omit<NewsItem, "id" | "created_at" | "updated_at">;

export async function createNews(input: NewsInput): Promise<NewsItem> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("news")
    .insert(input)
    .select()
    .single();

  if (error) {
    console.error("[news-repo] createNews failed:", error);
    throw new Error(`뉴스 작성 실패: ${error.message}`);
  }
  return data as NewsItem;
}

export async function updateNews(
  id: string,
  input: Partial<NewsInput>,
): Promise<NewsItem> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("news")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[news-repo] updateNews failed:", error);
    throw new Error(`뉴스 수정 실패: ${error.message}`);
  }
  return data as NewsItem;
}

export async function deleteNews(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("news").delete().eq("id", id);

  if (error) {
    console.error("[news-repo] deleteNews failed:", error);
    throw new Error(`뉴스 삭제 실패: ${error.message}`);
  }
}

// ── 관리자 체크 ──
export async function isCurrentUserAdmin(): Promise<boolean> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data, error } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[news-repo] isCurrentUserAdmin failed:", error);
    return false;
  }
  return !!data;
}
