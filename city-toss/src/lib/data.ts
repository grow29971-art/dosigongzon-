import { supabase } from "./supabase";

// 본 앱 lib/cats-repo.ts · lib/care-logs-repo.ts의 축소판.
// 읽기·쓰기 모두 RLS를 그대로 탄다. 미니앱은 항상 로그인 상태이므로 cats 베이스 테이블을 읽으며,
// DB 좌표는 등록 시 이미 ±444m 오프셋된 값이다(정확 좌표는 시스템에 없다 — 본 앱 위치 계약).

export interface Cat {
  id: string;
  name: string;
  description: string | null;
  photo_url: string | null;
  photo_urls: string[] | null;
  lat: number;
  lng: number;
  region: string | null;
  tags: string[] | null;
  neutered: boolean | null;
  health_status: string;
  visibility: string;
  caretaker_name: string | null;
  like_count: number;
  card_level: number;
  created_at: string;
  memorial_at?: string | null;
}

export type CareType = "feed" | "water" | "treat" | "health" | "tnr" | "hospital" | "shelter" | "other";
export const CARE_TYPES: { key: CareType; label: string }[] = [
  { key: "feed", label: "밥 줌" },
  { key: "water", label: "물 줌" },
  { key: "treat", label: "간식 줌" },
  { key: "health", label: "건강 체크" },
  { key: "shelter", label: "쉼터 관리" },
  { key: "other", label: "기타" },
];
export const CARE_LABEL: Record<string, string> = {
  feed: "밥 줌", water: "물 줌", treat: "간식 줌", health: "건강 체크",
  tnr: "TNR", hospital: "병원 방문", shelter: "쉼터 관리", other: "기타",
};

export interface CareLog {
  id: string;
  cat_id: string;
  author_id: string;
  author_name: string | null;
  care_type: CareType;
  memo: string | null;
  logged_at: string;
}

export async function listCats(): Promise<Cat[]> {
  const { data, error } = await supabase()
    .from("cats")
    .select("id,name,description,photo_url,photo_urls,lat,lng,region,tags,neutered,health_status,visibility,caretaker_name,like_count,card_level,created_at,memorial_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`고양이 목록을 불러올 수 없어요: ${error.message}`);
  return ((data ?? []) as Cat[]).filter((c) => !c.memorial_at);
}

export async function getCat(id: string): Promise<Cat | null> {
  const { data, error } = await supabase()
    .from("cats")
    .select("id,name,description,photo_url,photo_urls,lat,lng,region,tags,neutered,health_status,visibility,caretaker_name,like_count,card_level,created_at,memorial_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`고양이를 불러올 수 없어요: ${error.message}`);
  return (data as Cat | null) ?? null;
}

export async function listCareLogs(catId: string, limit = 30): Promise<CareLog[]> {
  const { data, error } = await supabase()
    .from("care_logs")
    .select("id,cat_id,author_id,author_name,care_type,memo,logged_at")
    .eq("cat_id", catId)
    .order("logged_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []) as CareLog[];
}

// 본 앱 createCareLog와 같은 컬럼·스냅샷 규칙. 도배 하드 제한은 DB 트리거가 막는다.
export async function createCareLog(input: { cat_id: string; care_type: CareType; memo?: string }): Promise<CareLog> {
  const sb = supabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error("로그인이 필요해요.");
  const meta = (user.user_metadata ?? {}) as Record<string, string | undefined>;
  const authorName = meta.nickname ?? meta.name ?? "길집사";

  const { data, error } = await sb
    .from("care_logs")
    .insert({
      cat_id: input.cat_id,
      author_id: user.id,
      author_name: authorName,
      author_avatar_url: meta.avatar_url ?? null,
      care_type: input.care_type,
      memo: input.memo?.trim() || null,
      logged_at: new Date().toISOString(),
    })
    .select("id,cat_id,author_id,author_name,care_type,memo,logged_at")
    .single();
  if (error) throw new Error(`기록을 저장하지 못했어요: ${error.message}`);
  return data as CareLog;
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}
