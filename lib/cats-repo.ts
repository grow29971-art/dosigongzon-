// ══════════════════════════════════════════
// 도시공존 — cats Repository
// Supabase cats 테이블 + cat-photos Storage 버킷 접근
// ══════════════════════════════════════════

import { createClient } from "@/lib/supabase/client";

export interface Cat {
  id: string;
  name: string;
  description: string | null;
  photo_url: string | null;
  lat: number;
  lng: number;
  region: string | null;
  tags: string[];
  caretaker_id: string | null;
  caretaker_name: string | null;
  created_at: string;
}

export interface CreateCatInput {
  name: string;
  description?: string;
  photo_url?: string;
  lat: number;
  lng: number;
  region?: string;
  tags?: string[];
  caretaker_name?: string;
}

// 인천 남동구청 좌표 (지도 초기 중심)
export const MAP_CENTER = {
  lat: 37.4470,
  lng: 126.7320,
};

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

// ── 고양이 등록 (인증 필요) ──
export async function createCat(input: CreateCatInput): Promise<Cat> {
  const supabase = createClient();

  // 현재 유저 확인
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("로그인이 필요해요.");
  }

  const { data, error } = await supabase
    .from("cats")
    .insert({
      ...input,
      caretaker_id: user.id,
      caretaker_name: input.caretaker_name ?? user.user_metadata?.nickname ?? "익명",
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
async function convertImageToWebp(
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
  body: string;
  kind: CommentKind;
  created_at: string;
}

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

// ── 댓글 작성 (인증 필요) ──
export async function createComment(
  catId: string,
  body: string,
  kind: CommentKind = "note",
): Promise<CatComment> {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("로그인이 필요해요.");
  }

  const trimmed = body.trim();
  if (!trimmed) {
    throw new Error("내용을 입력해주세요.");
  }

  const { data, error } = await supabase
    .from("cat_comments")
    .insert({
      cat_id: catId,
      author_id: user.id,
      author_name: user.user_metadata?.nickname ?? "익명",
      body: trimmed,
      kind,
    })
    .select()
    .single();

  if (error) {
    console.error("[cats-repo] createComment failed:", error);
    throw new Error(`댓글 작성에 실패했어요: ${error.message}`);
  }

  return data as CatComment;
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
