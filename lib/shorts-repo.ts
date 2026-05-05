// ══════════════════════════════════════════
// 도시공존 — 숏폼 영상(shorts) Repository
// Supabase public.shorts + storage 'shorts' 버킷
// 패턴: tips-repo.ts 와 동일 (createClient + requireAdmin)
// 운영자만 업로드, 모두가 읽기 (RLS 이중 방어)
// ══════════════════════════════════════════

import { createClient } from "@/lib/supabase/client";
import { createAnonClient } from "@/lib/supabase/anon";
import { requireAdmin } from "@/lib/admin-guard";
import { isSafeImageUrl, isSafeHttpUrl } from "@/lib/url-validate";

// ── 타입 ──
export interface Short {
  id: string;
  title: string;
  description: string | null;
  // mp4 직접 업로드 (Storage) — YouTube 임베드 시 null 가능
  video_url: string | null;
  // YouTube 임베드 (둘 중 하나는 반드시 채워져 있음 — DB CHECK 제약)
  youtube_url: string | null;
  youtube_video_id: string | null;
  // 원작자 채널 정보 (저작권 출처 표기 — YouTube 임베드일 때만 의미 있음)
  youtube_channel_name: string | null;
  youtube_channel_url: string | null;
  thumbnail_url: string | null;
  duration_sec: number | null;
  width: number | null;
  height: number | null;
  view_count: number;
  like_count: number;
  sort_order: number;
  pinned: boolean;
  published: boolean;
  created_by: string | null;
  published_at: string;
  created_at: string;
  updated_at: string;
}

export type ShortInput = Omit<
  Short,
  "id" | "view_count" | "like_count" | "created_by" | "created_at" | "updated_at"
>;

// ── YouTube URL 파서 ──
// 지원 포맷:
//   https://www.youtube.com/shorts/VIDEO_ID
//   https://youtube.com/shorts/VIDEO_ID
//   https://m.youtube.com/shorts/VIDEO_ID
//   https://youtu.be/VIDEO_ID
//   https://www.youtube.com/watch?v=VIDEO_ID
//   https://www.youtube.com/embed/VIDEO_ID
const YT_ID_RE = /^[A-Za-z0-9_-]{11}$/;

export function parseYouTubeId(url: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  // 이미 11자 ID만 들어온 경우
  if (YT_ID_RE.test(trimmed)) return trimmed;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\.|^m\./, "");
  if (host !== "youtube.com" && host !== "youtu.be") return null;

  let id: string | null = null;
  if (host === "youtu.be") {
    id = parsed.pathname.replace(/^\//, "").split("/")[0] || null;
  } else {
    // youtube.com — /shorts/<id>, /embed/<id>, /watch?v=<id>
    const path = parsed.pathname.replace(/\/+$/, "");
    const shortsMatch = path.match(/^\/shorts\/([^/]+)/);
    const embedMatch = path.match(/^\/embed\/([^/]+)/);
    if (shortsMatch) id = shortsMatch[1];
    else if (embedMatch) id = embedMatch[1];
    else if (path === "/watch") id = parsed.searchParams.get("v");
  }
  if (!id || !YT_ID_RE.test(id)) return null;
  return id;
}

export function youTubeThumbnailUrl(videoId: string): string {
  // hqdefault: 480×360 — 항상 존재. maxresdefault는 일부 영상에 없음.
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

export function youTubeEmbedUrl(videoId: string): string {
  // 파라미터:
  //   playsinline=1   - iOS 인라인 재생
  //   mute=1          - 자동재생 위해 음소거 (첫 인터랙션 후 unMute 전송)
  //   controls=0      - 컨트롤바 숨김 (우리 UI로 대체)
  //   modestbranding=1- 유튜브 로고 최소화
  //   rel=0           - 끝났을 때 관련영상 표시 X
  //   enablejsapi=1   - postMessage로 play/pause/mute/이벤트 구독
  // ⚠ autoplay 의도적 제외 — 30개 iframe이 동시에 자동재생되면 소리가 겹치는 문제 발생.
  //    대신 IntersectionObserver + iframe.onLoad 시점에 보이는 카드만 postMessage로 재생.
  // ⚠ loop도 제외 — onStateChange=0(ENDED) 받아 다음 영상으로 자동 스크롤하기 위해.
  const params = new URLSearchParams({
    playsinline: "1",
    mute: "1",
    controls: "0",
    modestbranding: "1",
    rel: "0",
    enablejsapi: "1",
  });
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}

const STORAGE_BUCKET = "shorts";
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_THUMB_SIZE = 5 * 1024 * 1024;  // 5MB
const ALLOWED_VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

// ── 입력 검증 ──
function validateShortInput(input: Partial<ShortInput>): void {
  if (input.title !== undefined && (!input.title.trim() || input.title.length > 200)) {
    throw new Error("제목은 1~200자 사이여야 해요.");
  }
  if (input.description != null && input.description.length > 2000) {
    throw new Error("설명은 2000자 이내로 적어주세요.");
  }
  if (input.video_url !== undefined && input.video_url !== null && input.video_url !== "" && !isSafeHttpUrl(input.video_url)) {
    throw new Error("영상 URL 형식이 올바르지 않아요.");
  }
  if (input.youtube_url !== undefined && input.youtube_url !== null && input.youtube_url !== "" && !isSafeHttpUrl(input.youtube_url)) {
    throw new Error("YouTube URL 형식이 올바르지 않아요.");
  }
  if (
    input.youtube_video_id !== undefined
    && input.youtube_video_id !== null
    && input.youtube_video_id !== ""
    && !YT_ID_RE.test(input.youtube_video_id)
  ) {
    throw new Error("YouTube 영상 ID가 올바르지 않아요.");
  }
  if (input.thumbnail_url && !isSafeImageUrl(input.thumbnail_url)) {
    throw new Error("썸네일 URL 형식이 올바르지 않아요.");
  }
  if (
    input.youtube_channel_url !== undefined
    && input.youtube_channel_url !== null
    && input.youtube_channel_url !== ""
    && !isSafeHttpUrl(input.youtube_channel_url)
  ) {
    throw new Error("채널 URL 형식이 올바르지 않아요.");
  }
  if (input.youtube_channel_name != null && input.youtube_channel_name.length > 100) {
    throw new Error("채널 이름은 100자 이내로 적어주세요.");
  }
}

// ── 읽기 (서버: anon, RSC/ISR용) ──
export async function listPublishedShortsServer(limit = 30): Promise<Short[]> {
  try {
    const supabase = createAnonClient();
    const { data, error } = await supabase
      .from("shorts")
      .select("*")
      .eq("published", true)
      .order("pinned", { ascending: false })
      .order("sort_order", { ascending: false })
      .order("published_at", { ascending: false })
      .limit(limit);
    if (error) {
      console.error("[shorts-repo] listPublishedShortsServer failed:", error);
      return [];
    }
    return (data ?? []) as Short[];
  } catch (err) {
    console.error("[shorts-repo] listPublishedShortsServer threw:", err);
    return [];
  }
}

export async function getPublishedShortServer(id: string): Promise<Short | null> {
  if (!id) return null;
  try {
    const supabase = createAnonClient();
    const { data, error } = await supabase
      .from("shorts")
      .select("*")
      .eq("id", id)
      .eq("published", true)
      .maybeSingle();
    if (error) {
      console.error("[shorts-repo] getPublishedShortServer failed:", error);
      return null;
    }
    return (data ?? null) as Short | null;
  } catch (err) {
    console.error("[shorts-repo] getPublishedShortServer threw:", err);
    return null;
  }
}

// ── 읽기 (클라이언트: 어드민 페이지) ──
export async function listAllShorts(): Promise<Short[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("shorts")
    .select("*")
    .order("pinned", { ascending: false })
    .order("sort_order", { ascending: false })
    .order("published_at", { ascending: false });
  if (error) {
    console.error("[shorts-repo] listAllShorts failed:", error);
    return [];
  }
  return (data ?? []) as Short[];
}

// ── 시청자 식별자 (localStorage UUID, admin 통계용) ──
const VIEWER_ID_KEY = "dosigongzon_shorts_viewer_id_v1";

function getOrCreateViewerId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = localStorage.getItem(VIEWER_ID_KEY);
    if (!id) {
      id = (typeof crypto !== "undefined" && "randomUUID" in crypto)
        ? crypto.randomUUID()
        : `vid-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(VIEWER_ID_KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}

// ── 조회수/좋아요 (RPC, 누구나 호출 가능) ──
export async function incrementShortView(id: string): Promise<void> {
  if (!id) return;
  try {
    const supabase = createAnonClient();
    const viewerId = getOrCreateViewerId();
    // v2: view_count 증가 + 고유 시청자 기록 (admin 통계용)
    await supabase.rpc("increment_short_view_v2", {
      p_id: id,
      p_viewer_id: viewerId,
    });
  } catch (err) {
    console.error("[shorts-repo] incrementShortView failed:", err);
  }
}

// ── 어드민 통계 — 총 시청자 수 / 누적 시청 편수 / view_count 합계 ──
export interface ShortsAdminStats {
  totalViewers: number;       // 고유 시청자 수
  totalViewPairs: number;     // (시청자, 영상) 쌍 = 누적 시청 편수
  totalViewCount: number;     // view_count 합계
}

export async function getShortsAdminStats(): Promise<ShortsAdminStats> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("shorts_admin_stats");
  if (error) {
    console.error("[shorts-repo] getShortsAdminStats failed:", error);
    return { totalViewers: 0, totalViewPairs: 0, totalViewCount: 0 };
  }
  const row = Array.isArray(data) ? data[0] : data;
  return {
    totalViewers: Number(row?.total_viewers ?? 0),
    totalViewPairs: Number(row?.total_view_pairs ?? 0),
    totalViewCount: Number(row?.total_view_count ?? 0),
  };
}

export async function incrementShortLike(id: string): Promise<void> {
  if (!id) return;
  try {
    const supabase = createAnonClient();
    await supabase.rpc("increment_short_like", { p_id: id });
  } catch (err) {
    console.error("[shorts-repo] incrementShortLike failed:", err);
  }
}

// ── 쓰기 (admin RLS) ──
export async function createShort(input: ShortInput): Promise<Short> {
  const adminId = await requireAdmin();
  validateShortInput(input);

  const supabase = createClient();
  const { data, error } = await supabase
    .from("shorts")
    .insert({ ...input, created_by: adminId })
    .select()
    .single();
  if (error) {
    console.error("[shorts-repo] createShort failed:", error);
    throw new Error(`영상 등록 실패: ${error.message}`);
  }
  return data as Short;
}

export async function updateShort(id: string, input: Partial<ShortInput>): Promise<Short> {
  await requireAdmin();
  validateShortInput(input);

  const supabase = createClient();
  const { data, error } = await supabase
    .from("shorts")
    .update(input)
    .eq("id", id)
    .select()
    .single();
  if (error) {
    console.error("[shorts-repo] updateShort failed:", error);
    throw new Error(`영상 수정 실패: ${error.message}`);
  }
  return data as Short;
}

export async function deleteShort(id: string): Promise<void> {
  await requireAdmin();
  const supabase = createClient();

  // 1) Storage 객체 삭제 시도 (URL에서 키 추출 — 실패해도 DB 삭제는 진행)
  try {
    const { data: row } = await supabase
      .from("shorts")
      .select("video_url, thumbnail_url")
      .eq("id", id)
      .maybeSingle();
    const keys: string[] = [];
    const videoKey = extractStorageKey(row?.video_url ?? null);
    const thumbKey = extractStorageKey(row?.thumbnail_url ?? null);
    if (videoKey) keys.push(videoKey);
    if (thumbKey) keys.push(thumbKey);
    if (keys.length > 0) {
      await supabase.storage.from(STORAGE_BUCKET).remove(keys);
    }
  } catch (err) {
    console.warn("[shorts-repo] storage cleanup skipped:", err);
  }

  const { error } = await supabase.from("shorts").delete().eq("id", id);
  if (error) {
    console.error("[shorts-repo] deleteShort failed:", error);
    throw new Error(`영상 삭제 실패: ${error.message}`);
  }
}

// ── 영상/썸네일 업로드 (admin 전용) ──
export async function uploadShortVideo(file: File): Promise<string> {
  const adminId = await requireAdmin();

  if (file.size > MAX_VIDEO_SIZE) {
    throw new Error("영상은 50MB 이하만 업로드 가능해요. 720p · 30초 이내 권장.");
  }
  if (!ALLOWED_VIDEO_TYPES.has(file.type)) {
    throw new Error("mp4 · webm · mov 형식만 지원해요.");
  }

  const supabase = createClient();
  const ext = file.name.split(".").pop()?.toLowerCase() || "mp4";
  const fileName = `${adminId}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(fileName, file, {
      cacheControl: "31536000",
      upsert: false,
      contentType: file.type,
    });
  if (uploadError) {
    console.error("[shorts-repo] uploadShortVideo failed:", uploadError);
    throw new Error(`영상 업로드 실패: ${uploadError.message}`);
  }

  const { data: urlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(fileName);
  return urlData.publicUrl;
}

export async function uploadShortThumbnail(file: File): Promise<string> {
  const adminId = await requireAdmin();

  if (file.size > MAX_THUMB_SIZE) {
    throw new Error("썸네일은 5MB 이하만 가능해요.");
  }
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error("jpg · png · webp 형식만 지원해요.");
  }

  const supabase = createClient();
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const fileName = `${adminId}/thumb-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(fileName, file, {
      cacheControl: "31536000",
      upsert: false,
      contentType: file.type,
    });
  if (uploadError) {
    console.error("[shorts-repo] uploadShortThumbnail failed:", uploadError);
    throw new Error(`썸네일 업로드 실패: ${uploadError.message}`);
  }

  const { data: urlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(fileName);
  return urlData.publicUrl;
}

// public URL → storage object key 추출 (delete 시 정리용)
function extractStorageKey(publicUrl: string | null): string | null {
  if (!publicUrl) return null;
  const marker = `/storage/v1/object/public/${STORAGE_BUCKET}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  return publicUrl.slice(idx + marker.length);
}
