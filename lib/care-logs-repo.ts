// ══════════════════════════════════════════
// 도시공존 — 돌봄 일지 (Care Logs) Repository
// Supabase public.care_logs
// ══════════════════════════════════════════

import { createClient } from "@/lib/supabase/client";
import { isSafeImageUrl } from "@/lib/url-validate";
import { convertImageToWebp } from "@/lib/cats-repo";

// ── 돌봄 유형 ──
export type CareType =
  | "feed"
  | "water"
  | "treat"
  | "health"
  | "tnr"
  | "hospital"
  | "shelter"
  | "other";

export const CARE_TYPE_MAP: Record<
  CareType,
  { label: string; emoji: string; color: string }
> = {
  feed: { label: "밥 줌", emoji: "🍚", color: "#E88D5A" },
  water: { label: "물 줌", emoji: "💧", color: "#48A59E" },
  treat: { label: "간식 줌", emoji: "🍗", color: "#E8B040" },
  health: { label: "건강 체크", emoji: "🩺", color: "#6B8E6F" },
  tnr: { label: "TNR", emoji: "✂️", color: "#8B65B8" },
  hospital: { label: "병원 방문", emoji: "🏥", color: "#D85555" },
  shelter: { label: "쉼터 관리", emoji: "🏠", color: "#4A7BA8" },
  other: { label: "기타", emoji: "📝", color: "#A38E7A" },
};

// ── 타입 ──
export interface CareLog {
  id: string;
  cat_id: string;
  author_id: string;
  author_name: string | null;
  author_avatar_url: string | null;
  care_type: CareType;
  memo: string | null;
  photo_url: string | null;
  amount: string | null;
  logged_at: string;
  created_at: string;
}

export interface CreateCareLogInput {
  cat_id: string;
  care_type: CareType;
  memo?: string;
  photo_url?: string;
  amount?: string;
  logged_at?: string; // ISO string, 기본값 now
}

export interface CareLogStats {
  total: number;
  byType: Partial<Record<CareType, number>>;
  lastLoggedAt: string | null;
  caretakerCount: number;
}

// ── 조회 ──
export async function listCareLogs(
  catId: string,
  limit = 50,
): Promise<CareLog[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("care_logs")
    .select("*")
    .eq("cat_id", catId)
    .order("logged_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[care-logs] listCareLogs failed:", error);
    return [];
  }
  return (data ?? []) as CareLog[];
}

// ── 통계 ──
export async function getCareLogStats(
  catId: string,
): Promise<CareLogStats> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("care_logs")
    .select("care_type, author_id, logged_at")
    .eq("cat_id", catId);

  if (error || !data) {
    return { total: 0, byType: {}, lastLoggedAt: null, caretakerCount: 0 };
  }

  const byType: Partial<Record<CareType, number>> = {};
  const authors = new Set<string>();
  let lastLoggedAt: string | null = null;

  for (const row of data) {
    const t = row.care_type as CareType;
    byType[t] = (byType[t] ?? 0) + 1;
    authors.add(row.author_id);
    if (!lastLoggedAt || row.logged_at > lastLoggedAt) {
      lastLoggedAt = row.logged_at;
    }
  }

  return {
    total: data.length,
    byType,
    lastLoggedAt,
    caretakerCount: authors.size,
  };
}

// ── 생성 ──
export async function createCareLog(
  input: CreateCareLogInput,
): Promise<CareLog> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요해요.");

  // photo_url 검증
  if (input.photo_url && !isSafeImageUrl(input.photo_url)) {
    throw new Error("유효하지 않은 이미지 URL이에요.");
  }

  // logged_at 검증: 미래 불가, 24시간 이내만
  if (input.logged_at) {
    const logTime = new Date(input.logged_at).getTime();
    const now = Date.now();
    if (logTime > now + 60000) throw new Error("미래 시각은 기록할 수 없어요.");
    if (now - logTime > 24 * 60 * 60 * 1000)
      throw new Error("24시간 이내 기록만 가능해요.");
  }

  // 작성자 정보 스냅샷
  const meta = user.user_metadata ?? {};
  const authorName =
    meta.nickname ?? meta.full_name ?? meta.name ?? user.email?.split("@")[0] ?? "익명";
  const authorAvatar = meta.avatar_url ?? null;

  const { data, error } = await supabase
    .from("care_logs")
    .insert({
      cat_id: input.cat_id,
      author_id: user.id,
      author_name: authorName,
      author_avatar_url: authorAvatar,
      care_type: input.care_type,
      memo: input.memo || null,
      photo_url: input.photo_url || null,
      amount: input.amount || null,
      logged_at: input.logged_at || new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error("[care-logs] createCareLog failed:", error);
    throw new Error(`기록 실패: ${error.message}`);
  }

  // 푸시 알림: 고양이 주인이 본인 아닌 경우
  try {
    const { data: cat } = await supabase
      .from("cats")
      .select("caretaker_id, name")
      .eq("id", input.cat_id)
      .maybeSingle();
    const owner = (cat as { caretaker_id: string | null; name: string } | null) ?? null;
    if (owner?.caretaker_id && owner.caretaker_id !== user.id) {
      const typeEmoji: Record<string, string> = {
        feed: "🍚", water: "💧", treat: "🍗", health: "🩺",
        tnr: "✂️", hospital: "🏥", shelter: "🏠", other: "📝",
      };
      const typeLabel = CARE_TYPE_MAP[input.care_type]?.label ?? "돌봄";
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (session?.access_token) headers["Authorization"] = `Bearer ${session.access_token}`;
      fetch("/api/push/send", {
        method: "POST",
        headers,
        body: JSON.stringify({
          userId: owner.caretaker_id,
          title: `${typeEmoji[input.care_type] ?? "📝"} ${owner.name ?? "고양이"} 돌봄 기록`,
          body: `${authorName}님이 ${typeLabel}을(를) 기록했어요${input.memo ? ` — ${input.memo.slice(0, 40)}` : ""}`,
          url: `/cats/${input.cat_id}`,
        }),
      }).catch(() => {});
    }
  } catch {}

  return data as CareLog;
}

// ── 삭제 ──
export async function deleteCareLog(logId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("care_logs")
    .delete()
    .eq("id", logId);
  if (error) {
    console.error("[care-logs] deleteCareLog failed:", error);
    throw new Error(`삭제 실패: ${error.message}`);
  }
}

// ── 사진 업로드 ──
export async function uploadCareLogPhoto(file: File): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요해요.");

  if (file.size > 20 * 1024 * 1024) throw new Error("사진은 20MB 이하만 가능해요.");
  if (!file.type.startsWith("image/")) throw new Error("이미지 파일만 가능해요.");

  const webpFile = await convertImageToWebp(file, 1024, 0.8);
  const fileName = `${user.id}/carelog_${Date.now()}.webp`;

  const { error: uploadError } = await supabase.storage
    .from("cat-photos")
    .upload(fileName, webpFile, {
      cacheControl: "3600",
      upsert: false,
      contentType: "image/webp",
    });

  if (uploadError) throw new Error(`업로드 실패: ${uploadError.message}`);

  const { data: urlData } = supabase.storage
    .from("cat-photos")
    .getPublicUrl(fileName);

  return urlData.publicUrl;
}

// ── 상대시간 포맷 ──
export function formatLogTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}일 전`;
  return new Date(dateStr).toLocaleDateString("ko-KR");
}
