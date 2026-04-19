// ══════════════════════════════════════════
// 도시공존 — cats Repository
// Supabase cats 테이블 + cat-photos Storage 버킷 접근
// ══════════════════════════════════════════

import { createClient } from "@/lib/supabase/client";
import { isSafeImageUrl } from "@/lib/url-validate";

export type CatGender = "male" | "female" | "unknown";
export type CatHealthStatus = "good" | "caution" | "danger";

export interface Cat {
  id: string;
  name: string;
  description: string | null;
  photo_url: string | null;
  photo_urls: string[];
  lat: number;
  lng: number;
  region: string | null;
  tags: string[];
  gender: CatGender;
  neutered: boolean | null;
  health_status: CatHealthStatus;
  caretaker_id: string | null;
  caretaker_name: string | null;
  like_count: number;
  created_at: string;
}

export const GENDER_MAP: Record<CatGender, { label: string; emoji: string }> = {
  male: { label: "수컷", emoji: "♂️" },
  female: { label: "암컷", emoji: "♀️" },
  unknown: { label: "모름", emoji: "?" },
};

export const HEALTH_MAP: Record<CatHealthStatus, { label: string; emoji: string; color: string }> = {
  good: { label: "양호", emoji: "💚", color: "#6B8E6F" },
  caution: { label: "주의", emoji: "💛", color: "#C9A961" },
  danger: { label: "위험", emoji: "❤️‍🩹", color: "#D85555" },
};

export interface CreateCatInput {
  name: string;
  description?: string;
  photo_url?: string;
  photo_urls?: string[];
  lat: number;
  lng: number;
  region?: string;
  tags?: string[];
  gender?: CatGender;
  neutered?: boolean | null;
  health_status?: CatHealthStatus;
  caretaker_name?: string;
}

// 인천 남동구청 좌표 (지도 초기 중심)
export const MAP_CENTER = {
  lat: 37.4470,
  lng: 126.7320,
};

// ══════════════════════════════════════════
// 표시 이름 폴백 (OAuth/이메일 유저 공통)
// ══════════════════════════════════════════
type UserLike = {
  user_metadata?: Record<string, unknown> | null;
  email?: string | null;
} | null | undefined;

export function getDisplayName(user: UserLike): string {
  if (!user) return "익명";
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const nickname = typeof meta.nickname === "string" ? meta.nickname : "";
  const fullName = typeof meta.full_name === "string" ? meta.full_name : "";
  const name = typeof meta.name === "string" ? meta.name : "";
  const emailLocal = user.email?.split("@")[0] ?? "";
  return nickname || fullName || name || emailLocal || "익명";
}

// ══════════════════════════════════════════
// 지도 페이지 교육용 팁 (올바른 돌봄 상식)
// ══════════════════════════════════════════

export interface CareTip {
  emoji: string;
  title: string;
  body: string;
  severity: "info" | "warn" | "danger";
}

export const CARE_TIPS: CareTip[] = [
  {
    emoji: "⚠️",
    title: "츄르 대신 닭가슴살 · 사료를",
    body: "츄르는 구내염·치아질환을 유발할 수 있어요. 무염으로 삶은 닭가슴살이나 건사료가 훨씬 안전해요.",
    severity: "danger",
  },
  {
    emoji: "🥛",
    title: "우유는 주지 마세요",
    body: "고양이 대부분은 유당불내증이 있어요. 설사·구토의 원인이 돼요. 깨끗한 물이 최고예요.",
    severity: "warn",
  },
  {
    emoji: "🐟",
    title: "참치캔은 주식이 될 수 없어요",
    body: "수은 함량이 높고 영양 불균형을 유발해요. 간식으로도 일주일에 한두 번 소량만.",
    severity: "warn",
  },
  {
    emoji: "💧",
    title: "물그릇은 매일 새로",
    body: "여름철은 2번 이상 교체. 사료보다 물이 훨씬 중요해요. 얕고 넓은 그릇을 선호해요.",
    severity: "info",
  },
  {
    emoji: "✂️",
    title: "TNR은 고양이를 위한 것",
    body: "중성화는 번식 스트레스·질병·영역 다툼을 크게 줄여요. 개체수 관리 + 개묘 복지 모두에 도움.",
    severity: "info",
  },
  {
    emoji: "🤚",
    title: "갑자기 만지지 마세요",
    body: "손을 천천히 내밀고 냄새를 맡게 해주세요. 경계심 많은 아이들은 시선을 피해주는 게 좋아요.",
    severity: "info",
  },
  {
    emoji: "🚨",
    title: "학대 목격 시 112 신고",
    body: "동물보호법상 학대는 형사처벌 대상이에요. 현장 사진·동영상은 중요한 증거가 돼요.",
    severity: "danger",
  },
  {
    emoji: "🌡️",
    title: "겨울엔 단열 쉼터를",
    body: "스티로폼 박스 + 담요로 간단히 만들 수 있어요. 입구는 작게, 바닥은 지면에서 띄워주세요.",
    severity: "info",
  },
];

// ══════════════════════════════════════════
// 위치 보호: 비로그인 유저에게는 좌표 퍼징
// ══════════════════════════════════════════

// 문자열 해시 → 0~1 범위 float 2개 (deterministic)
function hashToUnitFloats(seed: string): [number, number] {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < seed.length; i++) {
    const c = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ c, 0x85ebca6b);
  }
  // unsigned → 0~1 float
  const f1 = (h1 >>> 0) / 0xffffffff;
  const f2 = (h2 >>> 0) / 0xffffffff;
  return [f1, f2];
}

/**
 * 학대 방지를 위한 좌표 퍼징.
 * 같은 cat.id는 항상 같은 퍼징 결과를 내도록 결정적 시드 사용.
 * @param lat 원본 위도
 * @param lng 원본 경도
 * @param seed 결정적 시드 (cat.id 권장)
 * @param radiusMeters 퍼징 반경 (기본 70m)
 */
export function fuzzCoord(
  lat: number,
  lng: number,
  seed: string,
  radiusMeters = 70,
): { lat: number; lng: number } {
  const [f1, f2] = hashToUnitFloats(seed);
  // 균일 원반 분포: r = R * sqrt(u1), θ = 2π * u2
  const r = radiusMeters * Math.sqrt(f1);
  const theta = 2 * Math.PI * f2;
  const dLatMeters = r * Math.sin(theta);
  const dLngMeters = r * Math.cos(theta);
  // 1도 ≈ 111_111m (위도), 경도는 cos(lat)로 보정
  const dLat = dLatMeters / 111111;
  const dLng = dLngMeters / (111111 * Math.cos((lat * Math.PI) / 180));
  return { lat: lat + dLat, lng: lng + dLng };
}

/**
 * 뷰어 권한에 따라 실제 또는 퍼징된 좌표 반환.
 * 로그인 유저 = 정확 / 게스트 = 퍼징 70m.
 */
export function getDisplayCoord(
  cat: Pick<Cat, "id" | "lat" | "lng">,
  isLoggedIn: boolean,
): { lat: number; lng: number } {
  if (isLoggedIn) return { lat: cat.lat, lng: cat.lng };
  return fuzzCoord(cat.lat, cat.lng, cat.id, 70);
}

// ── 모든 고양이 조회 (지도 핀용) ──
export async function listCats(): Promise<Cat[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("cats")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[cats-repo] listCats failed:", error);
    throw new Error(`고양이 목록을 불러올 수 없어요: ${error.message}`);
  }

  return (data ?? []) as Cat[];
}

// ── 고양이 등록 제한 상수 (SQL 마이그레이션과 값이 일치해야 함) ──
// supabase_cats_write_limits_migration.sql 참조.
// ── 고양이 등록 (인증 필요, 레벨별 제한) ──
export async function createCat(input: CreateCatInput): Promise<Cat> {
  const supabase = createClient();

  // 현재 유저 확인
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("로그인이 필요해요.");
  }

  // 레벨별 등록 제한 계산
  const summary = await getMyActivitySummary();
  const level = computeLevel(computeScore(summary)).level;
  const perks = getLevelPerks(level);

  // 레이트리밋: 최근 24시간 등록 수 조회
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { count: dailyCount } = await supabase
    .from("cats")
    .select("*", { count: "exact", head: true })
    .eq("caretaker_id", user.id)
    .gte("created_at", oneDayAgo);

  if ((dailyCount ?? 0) >= perks.dailyCatLimit) {
    throw new Error(
      `하루에 최대 ${perks.dailyCatLimit}마리까지 등록할 수 있어요. (Lv.${level}) 레벨을 올리면 더 많이 등록할 수 있어요!`,
    );
  }

  // photo_url 검증: Storage URL 외의 값(XSS 탈출 시도 등) 차단
  const safePhotoUrl = input.photo_url
    ? (isSafeImageUrl(input.photo_url) ? input.photo_url : null)
    : null;
  if (input.photo_url && !safePhotoUrl) {
    throw new Error("사진 URL 형식이 올바르지 않아요.");
  }

  const { data, error } = await supabase
    .from("cats")
    .insert({
      ...input,
      photo_url: safePhotoUrl,
      caretaker_id: user.id,
      caretaker_name: input.caretaker_name ?? getDisplayName(user),
      tags: input.tags ?? [],
    })
    .select()
    .single();

  if (error) {
    console.error("[cats-repo] createCat failed:", error);
    throw new Error(`등록에 실패했어요: ${error.message}`);
  }

  return data as Cat;
}

// ── 클라이언트 사이드 이미지 → WebP 변환 + 리사이즈 ──
// 폰 카메라 사진(4~8MB)을 200~500KB로 압축. 서버 부담 + Storage 용량 절약.
export async function convertImageToWebp(
  file: File,
  maxDimension = 1280, // 720p — 긴 변 1280px
  quality = 0.82,
): Promise<File> {
  // 1. 이미지 로드
  const objectUrl = URL.createObjectURL(file);
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("이미지를 읽을 수 없어요."));
    image.src = objectUrl;
  });

  // 2. 리사이즈 비율 계산 (긴 변 기준 maxDimension)
  let { width, height } = img;
  if (width > maxDimension || height > maxDimension) {
    if (width >= height) {
      height = Math.round((height * maxDimension) / width);
      width = maxDimension;
    } else {
      width = Math.round((width * maxDimension) / height);
      height = maxDimension;
    }
  }

  // 3. Canvas에 그리기
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    URL.revokeObjectURL(objectUrl);
    throw new Error("Canvas 컨텍스트를 만들 수 없어요.");
  }
  // 고품질 리사이즈
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, width, height);

  // 4. WebP로 인코딩
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), "image/webp", quality);
  });

  // 5. 정리
  URL.revokeObjectURL(objectUrl);

  if (!blob) {
    throw new Error("WebP 변환에 실패했어요. 브라우저가 WebP를 지원하지 않을 수 있어요.");
  }

  // 6. File 객체로 반환
  const baseName = file.name.replace(/\.[^.]+$/, "") || "cat";
  return new File([blob], `${baseName}.webp`, { type: "image/webp" });
}

// ── 사진 업로드 (cat-photos 버킷) ──
// 클라이언트에서 WebP 변환 + 리사이즈 후 업로드.
// 반환: 공개 URL
export async function uploadCatPhoto(file: File): Promise<string> {
  const supabase = createClient();

  // 현재 유저 확인 (Storage RLS가 user 폴더 prefix를 요구함)
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("로그인이 필요해요.");
  }

  // 원본 사이즈 제한 (변환 전 — 너무 큰 파일은 메모리 폭발 방지)
  const MAX_INPUT_SIZE = 20 * 1024 * 1024; // 20MB
  if (file.size > MAX_INPUT_SIZE) {
    throw new Error("사진은 20MB 이하만 업로드 가능해요.");
  }

  // 이미지 타입 검증
  if (!file.type.startsWith("image/")) {
    throw new Error("이미지 파일만 업로드 가능해요.");
  }

  // WebP로 변환 (긴 변 1280px = 720p, 품질 0.82)
  const webpFile = await convertImageToWebp(file);

  // 파일명: {userId}/{timestamp}.webp
  const fileName = `${user.id}/${Date.now()}.webp`;

  const { error: uploadError } = await supabase.storage
    .from("cat-photos")
    .upload(fileName, webpFile, {
      cacheControl: "3600",
      upsert: false,
      contentType: "image/webp",
    });

  if (uploadError) {
    console.error("[cats-repo] uploadCatPhoto failed:", uploadError);
    throw new Error(`사진 업로드에 실패했어요: ${uploadError.message}`);
  }

  // 공개 URL 조회
  const { data: urlData } = supabase.storage
    .from("cat-photos")
    .getPublicUrl(fileName);

  return urlData.publicUrl;
}

// ══════════════════════════════════════════
// 댓글 (cat_comments)
// ══════════════════════════════════════════

export type CommentKind = "note" | "alert";

export interface CatComment {
  id: string;
  cat_id: string;
  author_id: string | null;
  author_name: string | null;
  author_avatar_url: string | null;
  author_level: number | null;
  author_title: string | null;
  body: string;
  kind: CommentKind;
  photo_url: string | null;
  like_count: number;
  dislike_count: number;
  created_at: string;
}

export type VoteValue = 1 | -1 | 0; // 0 = 투표 없음/취소

// ── 특정 고양이 댓글 조회 ──
export async function listComments(catId: string): Promise<CatComment[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("cat_comments")
    .select("*")
    .eq("cat_id", catId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[cats-repo] listComments failed:", error);
    throw new Error(`댓글을 불러올 수 없어요: ${error.message}`);
  }

  return (data ?? []) as CatComment[];
}

// ── 댓글 투표 (좋아요/싫어요/취소) ──
export async function voteComment(
  commentId: string,
  vote: VoteValue,
): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요해요.");

  if (vote === 0) {
    const { error } = await supabase
      .from("cat_comment_votes")
      .delete()
      .eq("comment_id", commentId)
      .eq("user_id", user.id);
    if (error) {
      console.error("[cats-repo] voteComment(delete) failed:", error);
      throw new Error(`투표 취소 실패: ${error.message}`);
    }
    return;
  }

  const { error } = await supabase
    .from("cat_comment_votes")
    .upsert(
      { comment_id: commentId, user_id: user.id, vote },
      { onConflict: "comment_id,user_id" },
    );
  if (error) {
    console.error("[cats-repo] voteComment(upsert) failed:", error);
    throw new Error(`투표 실패: ${error.message}`);
  }
}

// ── 내가 누른 투표들 조회 (Map<commentId, 1 | -1>) ──
export async function getMyCommentVotes(
  commentIds: string[],
): Promise<Map<string, 1 | -1>> {
  if (commentIds.length === 0) return new Map();
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Map();

  const { data, error } = await supabase
    .from("cat_comment_votes")
    .select("comment_id, vote")
    .eq("user_id", user.id)
    .in("comment_id", commentIds);

  if (error) {
    console.error("[cats-repo] getMyCommentVotes failed:", error);
    return new Map();
  }

  return new Map(
    (data ?? []).map((r: { comment_id: string; vote: number }) => [
      r.comment_id,
      r.vote as 1 | -1,
    ]),
  );
}

// ── 본인 댓글 삭제 ──
export async function deleteComment(commentId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("cat_comments")
    .delete()
    .eq("id", commentId);
  if (error) throw new Error(`삭제 실패: ${error.message}`);
}

// ── 학대 신고(alert) 2회 이상 받은 고양이 ID 목록 ──
// 지도 마커에 "학대경보" 표시 용도. 최근 48시간 이내 신고만, 최소 1건.
// 48시간 지나면 자동 해제.
export async function listAlertedCatIds(
  daysWindow = 2, // 48시간
  minCount = 1,
): Promise<Set<string>> {
  const supabase = createClient();
  const since = new Date(
    Date.now() - daysWindow * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data, error } = await supabase
    .from("cat_comments")
    .select("cat_id")
    .eq("kind", "alert")
    .gte("created_at", since);

  if (error) {
    console.error("[cats-repo] listAlertedCatIds failed:", error);
    return new Set();
  }

  // cat_id 별로 신고 건수 집계
  const counts = new Map<string, number>();
  for (const row of (data ?? []) as { cat_id: string }[]) {
    counts.set(row.cat_id, (counts.get(row.cat_id) ?? 0) + 1);
  }

  // minCount 이상인 것만 반환
  return new Set(
    [...counts.entries()]
      .filter(([, n]) => n >= minCount)
      .map(([id]) => id),
  );
}

// ══════════════════════════════════════════
// 프로필 아바타 (Supabase auth user_metadata.avatar_url)
// ══════════════════════════════════════════

// ── 아바타 파일 업로드 → 공개 URL 반환 ──
export async function uploadAvatar(file: File): Promise<string> {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요해요.");

  const MAX_INPUT_SIZE = 20 * 1024 * 1024;
  if (file.size > MAX_INPUT_SIZE) {
    throw new Error("사진은 20MB 이하만 업로드 가능해요.");
  }
  if (!file.type.startsWith("image/")) {
    throw new Error("이미지 파일만 업로드 가능해요.");
  }

  // 아바타는 작게: 512px, 품질 0.85
  const webpFile = await convertImageToWebp(file, 512, 0.85);

  const fileName = `${user.id}/avatar_${Date.now()}.webp`;

  const { error: uploadError } = await supabase.storage
    .from("cat-photos")
    .upload(fileName, webpFile, {
      cacheControl: "3600",
      upsert: false,
      contentType: "image/webp",
    });

  if (uploadError) {
    console.error("[cats-repo] uploadAvatar failed:", uploadError);
    throw new Error(`사진 업로드에 실패했어요: ${uploadError.message}`);
  }

  const { data: urlData } = supabase.storage
    .from("cat-photos")
    .getPublicUrl(fileName);

  return urlData.publicUrl;
}

// ── user_metadata.avatar_url 갱신 ──
export async function updateMyAvatar(avatarUrl: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.auth.updateUser({
    data: { avatar_url: avatarUrl },
  });
  if (error) {
    console.error("[cats-repo] updateMyAvatar failed:", error);
    throw new Error(`프로필 사진 저장에 실패했어요: ${error.message}`);
  }
}

// ── 닉네임 갱신 ──
export async function updateMyNickname(nickname: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.auth.updateUser({
    data: { nickname },
  });
  if (error) {
    console.error("[cats-repo] updateMyNickname failed:", error);
    throw new Error(`닉네임 저장에 실패했어요: ${error.message}`);
  }
}

// ── 댓글 사진 업로드 (cat-photos 버킷 재사용, comment 폴더) ──
// 인증 필요. 반환: 공개 URL
export async function uploadCommentPhoto(file: File): Promise<string> {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("로그인이 필요해요.");
  }

  const MAX_INPUT_SIZE = 20 * 1024 * 1024;
  if (file.size > MAX_INPUT_SIZE) {
    throw new Error("사진은 20MB 이하만 업로드 가능해요.");
  }
  if (!file.type.startsWith("image/")) {
    throw new Error("이미지 파일만 업로드 가능해요.");
  }

  // WebP로 변환 — 댓글은 피드용이라 더 작게 (1024px, 품질 0.8)
  const webpFile = await convertImageToWebp(file, 1024, 0.8);

  // 경로: {userId}/comment_{timestamp}.webp — 삭제 정책 {userId} prefix 유지
  const fileName = `${user.id}/comment_${Date.now()}.webp`;

  const { error: uploadError } = await supabase.storage
    .from("cat-photos")
    .upload(fileName, webpFile, {
      cacheControl: "3600",
      upsert: false,
      contentType: "image/webp",
    });

  if (uploadError) {
    console.error("[cats-repo] uploadCommentPhoto failed:", uploadError);
    throw new Error(`사진 업로드에 실패했어요: ${uploadError.message}`);
  }

  const { data: urlData } = supabase.storage
    .from("cat-photos")
    .getPublicUrl(fileName);

  return urlData.publicUrl;
}

// ── 댓글 작성 (인증 필요) ──
export async function createComment(
  catId: string,
  body: string,
  kind: CommentKind = "note",
  photoUrl: string | null = null,
): Promise<CatComment> {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("로그인이 필요해요.");
  }

  const trimmed = body.trim();
  if (!trimmed && !photoUrl) {
    throw new Error("내용이나 사진 중 하나는 있어야 해요.");
  }

  // photo_url 검증
  const safePhotoUrl = photoUrl && isSafeImageUrl(photoUrl) ? photoUrl : null;
  if (photoUrl && !safePhotoUrl) {
    throw new Error("사진 URL 형식이 올바르지 않아요.");
  }

  // 현재 레벨 스냅샷 — 활동 요약 조회 후 계산
  let authorLevel: number | null = null;
  try {
    const summary = await getMyActivitySummary();
    authorLevel = computeLevel(computeScore(summary)).level;
  } catch {
    // 요약 실패해도 일반 댓글은 진행, 경보는 아래에서 막힘
    authorLevel = null;
  }

  // 경보(alert)는 레벨 1 이상만 기록 가능 — 신규/장난 계정이 가짜 경보 난립 차단
  if (kind === "alert" && (authorLevel === null || authorLevel < 1)) {
    throw new Error(
      "경보 기록은 레벨 1 이상 유저만 남길 수 있어요. 댓글·투표 등으로 활동을 시작하면 바로 열려요.",
    );
  }

  const equippedTitle =
    (user.user_metadata?.equipped_title as string | undefined) ?? null;

  const { data, error } = await supabase
    .from("cat_comments")
    .insert({
      cat_id: catId,
      author_id: user.id,
      author_name: getDisplayName(user),
      author_avatar_url: user.user_metadata?.avatar_url ?? null,
      author_level: authorLevel,
      author_title: equippedTitle,
      body: trimmed,
      kind,
      photo_url: safePhotoUrl,
    })
    .select()
    .single();

  if (error) {
    console.error("[cats-repo] createComment failed:", error);
    throw new Error(`댓글 작성에 실패했어요: ${error.message}`);
  }

  // 푸시 알림 (고양이 주인이 본인 아닌 경우) — 실패해도 댓글 성공은 유지
  try {
    const { data: cat } = await supabase
      .from("cats")
      .select("caretaker_id, name")
      .eq("id", catId)
      .maybeSingle();
    const owner = (cat as { caretaker_id: string | null; name: string } | null) ?? null;
    if (owner?.caretaker_id && owner.caretaker_id !== user.id) {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (session?.access_token) headers["Authorization"] = `Bearer ${session.access_token}`;
      const isAlert = kind === "alert";
      fetch("/api/push/send", {
        method: "POST",
        headers,
        body: JSON.stringify({
          userId: owner.caretaker_id,
          title: isAlert ? `🚨 ${owner.name ?? "고양이"} 경보 알림` : `${owner.name ?? "고양이"}에 새 댓글`,
          body: `${getDisplayName(user)}: ${trimmed.length > 50 ? trimmed.slice(0, 50) + "…" : trimmed || "사진"}`,
          url: `/cats/${catId}`,
        }),
      }).catch(() => {});
    }
  } catch {}

  return data as CatComment;
}

// ══════════════════════════════════════════
// 마이페이지용 — 내 활동 조회
// ══════════════════════════════════════════

// ── 내가 등록한 고양이 목록 ──
export async function listMyCats(): Promise<Cat[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("cats")
    .select("*")
    .eq("caretaker_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[cats-repo] listMyCats failed:", error);
    return [];
  }
  return (data ?? []) as Cat[];
}

// ── 내가 쓴 돌봄 기록(+고양이 정보) ──
export interface CatCommentWithCat extends CatComment {
  cat: { id: string; name: string; photo_url: string | null; region: string | null } | null;
}

export async function listMyComments(limit = 20): Promise<CatCommentWithCat[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("cat_comments")
    .select("*, cat:cats(id, name, photo_url, region)")
    .eq("author_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[cats-repo] listMyComments failed:", error);
    return [];
  }
  return (data ?? []) as CatCommentWithCat[];
}

// ── 내 활동 요약 (고양이 수 · 기록 수 · 신고 수) ──
export interface MyActivitySummary {
  catCount: number;
  commentCount: number;
  alertCount: number;
  likesReceived: number;
  careLogCount: number;
  inviteCount: number; // 내가 초대해서 가입한 친구 수
}

// ── 레벨 시스템 ──
// 점수 계산: 일반 기록 1점 + 학대 신고 3점 + 고양이 등록 10점
// 집계에는 alertCount가 commentCount에 포함되어 있으므로 alertCount에는 +2점 보너스만
export interface LevelInfo {
  level: number;
  title: string;
  emoji: string;
  score: number;
  current: number;   // 현재 티어 시작 점수
  next: number | null; // 다음 티어 시작 점수 (null이면 최고 레벨)
  progress: number;  // 0~1 현재 레벨 내 진행도
}

const LEVEL_THRESHOLDS: { min: number; title: string; emoji: string }[] = [
  { min: 0,   title: "새싹 집사",   emoji: "🌱" },
  { min: 10,  title: "캣프렌드",   emoji: "🐾" },
  { min: 30,  title: "캣러버",     emoji: "🐱" },
  { min: 70,  title: "캣지기",     emoji: "🛡️" },
  { min: 150, title: "마을 지킴이", emoji: "⭐" },
  { min: 300, title: "골목 대장",   emoji: "👑" },
  { min: 600, title: "전설의 집사", emoji: "🌟" },
];

// ── 레벨별 혜택 ──
export interface LevelPerks {
  dailyCatLimit: number;      // 하루 고양이 등록 수
  aiChatPerMinute: number;    // AI 집사 분당 대화 수
  dailyPostLimit: number;     // 커뮤니티 글 하루 제한 (0=무제한)
  profileBorder: string;      // 프로필 테두리 스타일
  profileBorderColor: string; // 프로필 테두리 색상
  canUseSpecialEmoji: boolean; // 특별 이모지 사용 가능
}

export function getLevelPerks(level: number): LevelPerks {
  if (level >= 5) {
    // Lv5~7: 마을 지킴이 / 골목 대장 / 전설의 집사
    return {
      dailyCatLimit: 10,
      aiChatPerMinute: 30,
      dailyPostLimit: 0, // 무제한
      profileBorder: "3px solid",
      profileBorderColor: "#C9A961", // 골드
      canUseSpecialEmoji: true,
    };
  }
  if (level >= 3) {
    // Lv3~4: 캣러버 / 캣지기
    return {
      dailyCatLimit: 5,
      aiChatPerMinute: 20,
      dailyPostLimit: 15,
      profileBorder: "2.5px solid",
      profileBorderColor: "#A0A0A0", // 실버
      canUseSpecialEmoji: true,
    };
  }
  // Lv1~2: 새싹 집사 / 캣프렌드
  return {
    dailyCatLimit: 3,
    aiChatPerMinute: 10,
    dailyPostLimit: 5,
    profileBorder: "2px solid",
    profileBorderColor: "transparent",
    canUseSpecialEmoji: false,
  };
}

export function computeScore(summary: MyActivitySummary): number {
  // commentCount는 note+alert 합계. alert에는 추가 보너스 2점(총 3점 = 1점+2점)
  const base = summary.commentCount * 1 + summary.alertCount * 2;
  const fromCats = summary.catCount * 10;
  const fromLikes = summary.likesReceived * 2;
  const fromCareLogs = summary.careLogCount * 2; // 돌봄 일지 1건당 2점
  return base + fromCats + fromLikes + fromCareLogs;
}

// 레벨별 표시 색 (뱃지 등)
const LEVEL_COLORS = [
  "#6B8E6F", // Lv1 새싹 세이지
  "#48A59E", // Lv2 캣프렌드 틸
  "#4A7BA8", // Lv3 캣러버 블루
  "#8B65B8", // Lv4 캣지기 퍼플
  "#E88D5A", // Lv5 마을지킴이 오렌지
  "#D85555", // Lv6 골목대장 레드
  "#C9A961", // Lv7 전설의 집사 골드
];

export function getLevelColor(level: number): string {
  if (level < 1) return LEVEL_COLORS[0];
  return LEVEL_COLORS[Math.min(level - 1, LEVEL_COLORS.length - 1)];
}

export function computeLevel(score: number): LevelInfo {
  let idx = 0;
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (score >= LEVEL_THRESHOLDS[i].min) {
      idx = i;
      break;
    }
  }
  const tier = LEVEL_THRESHOLDS[idx];
  const nextTier = LEVEL_THRESHOLDS[idx + 1] ?? null;
  const progress = nextTier
    ? Math.min(1, (score - tier.min) / (nextTier.min - tier.min))
    : 1;
  return {
    level: idx + 1,
    title: tier.title,
    emoji: tier.emoji,
    score,
    current: tier.min,
    next: nextTier?.min ?? null,
    progress,
  };
}

export async function getMyActivitySummary(): Promise<MyActivitySummary> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user)
    return { catCount: 0, commentCount: 0, alertCount: 0, likesReceived: 0, careLogCount: 0, inviteCount: 0 };

  const [catsRes, commentsRes, alertsRes, likeSumRes, careLogsRes, invitesRes] = await Promise.all([
    supabase
      .from("cats")
      .select("id", { count: "exact", head: true })
      .eq("caretaker_id", user.id),
    supabase
      .from("cat_comments")
      .select("id", { count: "exact", head: true })
      .eq("author_id", user.id),
    supabase
      .from("cat_comments")
      .select("id", { count: "exact", head: true })
      .eq("author_id", user.id)
      .eq("kind", "alert"),
    supabase
      .from("cat_comments")
      .select("like_count")
      .eq("author_id", user.id),
    supabase
      .from("care_logs")
      .select("id", { count: "exact", head: true })
      .eq("author_id", user.id),
    // 내가 초대한 친구 수
    supabase
      .from("invite_events")
      .select("id", { count: "exact", head: true })
      .eq("inviter_id", user.id),
  ]);

  const likesReceived = (
    (likeSumRes.data ?? []) as { like_count: number }[]
  ).reduce((sum, r) => sum + (r.like_count ?? 0), 0);

  return {
    catCount: catsRes.count ?? 0,
    commentCount: commentsRes.count ?? 0,
    alertCount: alertsRes.count ?? 0,
    likesReceived,
    careLogCount: careLogsRes.count ?? 0,
    inviteCount: invitesRes.count ?? 0,
  };
}

// ── 고양이 정보 수정 (본인 또는 admin) ──
export async function updateCat(
  catId: string,
  input: Partial<Pick<Cat, "name" | "description" | "region" | "tags" | "photo_url" | "photo_urls" | "gender" | "neutered" | "health_status">>,
): Promise<Cat> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("cats")
    .update(input)
    .eq("id", catId)
    .select()
    .single();
  if (error) throw new Error(`수정 실패: ${error.message}`);
  return data as Cat;
}

// ── 본인이 등록한 고양이 삭제 ──
export async function deleteCat(catId: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase.from("cats").delete().eq("id", catId);

  if (error) {
    console.error("[cats-repo] deleteCat failed:", error);
    throw new Error(`삭제에 실패했어요: ${error.message}`);
  }
}

// ══════════════════════════════════════════
// 고양이 좋아요 (cat_likes)
// ══════════════════════════════════════════

// 내가 좋아요 누른 고양이 ID 목록
export async function listMyLikedCatIds(): Promise<Set<string>> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Set();

  const { data, error } = await supabase
    .from("cat_likes")
    .select("cat_id")
    .eq("user_id", user.id);

  if (error) {
    console.error("[cats-repo] listMyLikedCatIds failed:", error);
    return new Set();
  }
  return new Set(((data ?? []) as { cat_id: string }[]).map((r) => r.cat_id));
}

// 내가 좋아요 누른 고양이 전체 정보 (최근 누른 순)
export async function listMyLikedCats(limit = 50): Promise<Cat[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("cat_likes")
    .select("created_at, cats(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[cats-repo] listMyLikedCats failed:", error);
    return [];
  }

  // cats 조인 결과에서 cat 객체만 추출 (null 제외)
  const rows = (data ?? []) as { cats: Cat | null }[];
  return rows.map((r) => r.cats).filter((c): c is Cat => c !== null);
}

// 좋아요 토글: 이미 눌렀으면 취소, 아니면 추가
// 반환: { liked: 새 상태, likeCount: 최신 카운트 }
export async function toggleCatLike(catId: string): Promise<{ liked: boolean; likeCount: number }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요해요.");

  // 현재 상태 확인
  const { data: existing } = await supabase
    .from("cat_likes")
    .select("cat_id")
    .eq("cat_id", catId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    // 이미 눌러둔 상태 → 취소
    const { error } = await supabase
      .from("cat_likes")
      .delete()
      .eq("cat_id", catId)
      .eq("user_id", user.id);
    if (error) throw new Error(`좋아요 취소 실패: ${error.message}`);
  } else {
    const { error } = await supabase
      .from("cat_likes")
      .insert({ cat_id: catId, user_id: user.id });
    if (error) throw new Error(`좋아요 실패: ${error.message}`);
  }

  // 트리거가 cats.like_count 를 업데이트하므로 최신 값을 읽어옴
  const { data: catRow } = await supabase
    .from("cats")
    .select("like_count")
    .eq("id", catId)
    .maybeSingle();

  return {
    liked: !existing,
    likeCount: (catRow?.like_count as number | undefined) ?? 0,
  };
}
