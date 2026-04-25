"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Send, ImagePlus, X, Loader2, PawPrint, ArrowRight } from "lucide-react";
import type { PostCategory } from "@/lib/types";
import { CATEGORY_MAP } from "@/lib/types";
import { createPost } from "@/lib/posts-repo";
import { uploadCatPhoto } from "@/lib/cats-repo";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";

const CATEGORIES = Object.entries(CATEGORY_MAP) as [PostCategory, typeof CATEGORY_MAP[PostCategory]][];

const MAX_IMAGES = 4;

export default function WritePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [category, setCategory] = useState<PostCategory>("free");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  // 첫 글 안내 — 등록한 고양이 0마리이면 부드러운 권유 (강제 차단 X)
  const [hasNoCats, setHasNoCats] = useState(false);
  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    supabase
      .from("cats")
      .select("id", { head: true, count: "exact" })
      .eq("caretaker_id", user.id)
      .then((res: { count: number | null }) => {
        if ((res.count ?? 0) === 0) setHasNoCats(true);
      });
  }, [user]);

  const canSubmit = title.trim().length > 0 && content.trim().length > 0 && !uploading;

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;

    if (!user) {
      setUploadError("사진 업로드는 로그인이 필요해요.");
      return;
    }

    const remaining = MAX_IMAGES - imageUrls.length;
    if (remaining <= 0) {
      setUploadError(`사진은 최대 ${MAX_IMAGES}장까지 첨부할 수 있어요.`);
      return;
    }

    const toUpload = files.slice(0, remaining);
    setUploading(true);
    setUploadError("");
    try {
      const urls: string[] = [];
      for (const file of toUpload) {
        const url = await uploadCatPhoto(file);
        urls.push(url);
      }
      setImageUrls((prev) => [...prev, ...urls]);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "사진 업로드 실패");
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (url: string) => {
    setImageUrls((prev) => prev.filter((u) => u !== url));
  };

  const [submitError, setSubmitError] = useState("");

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;

    if (!user) {
      setSubmitError("로그인이 필요해요.");
      return;
    }

    setSubmitting(true);
    setSubmitError("");
    try {
      await createPost({
        category,
        title: title.trim(),
        content: content.trim(),
        images: imageUrls,
      });
      router.push("/community");
    } catch (err) {
      setSubmitting(false);
      setSubmitError(err instanceof Error ? err.message : "게시글 작성 실패");
    }
  };

  return (
    <div className="pb-24">
      {/* ── 헤더 ── */}
      <div className="flex items-center justify-between px-4 pt-14 pb-3">
        <button onClick={() => router.back()} className="p-2 -ml-2 active:scale-90 transition-transform">
          <ArrowLeft size={24} className="text-text-main" />
        </button>
        <h1 className="text-lg font-bold text-text-main">글쓰기</h1>
        <div className="w-16" />
      </div>

      <div className="px-5 space-y-5">
        {/* 첫 글 안내 — 동네 고양이 0마리 유저에게 부드러운 권유 */}
        {hasNoCats && (
          <div
            className="rounded-2xl p-4"
            style={{
              background: "linear-gradient(135deg, #FFF8F2 0%, #FCEFD9 100%)",
              border: "1.5px solid rgba(196,126,90,0.25)",
            }}
          >
            <div className="flex items-start gap-2.5">
              <div
                className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #C47E5A 0%, #A8684A 100%)" }}
              >
                <PawPrint size={17} color="#fff" strokeWidth={2.3} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12.5px] font-extrabold text-text-main leading-tight mb-1">
                  첫 동네 고양이부터 등록해보세요
                </p>
                <p className="text-[11px] text-text-sub leading-relaxed">
                  지도에 한 마리 등록한 후 글을 쓰면 동네 캣맘들이 더 잘 알아봐요.
                  글은 지금도 쓸 수 있지만, 등록 먼저면 답글·반응이 훨씬 빨라요.
                </p>
                <Link
                  href="/map"
                  className="inline-flex items-center gap-1 mt-2 text-[11.5px] font-extrabold"
                  style={{ color: "#A8684A" }}
                >
                  지도로 가서 등록하기
                  <ArrowRight size={11} />
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* ── 카테고리 선택 ── */}
        <div>
          <label className="text-[13px] font-bold text-text-sub mb-2 block">카테고리</label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map(([key, info]) => (
              <button
                key={key}
                onClick={() => setCategory(key)}
                className={`px-3.5 py-2 rounded-full text-[13px] font-semibold border transition-all ${
                  category === key
                    ? "text-white border-transparent"
                    : "bg-white text-text-sub border-border"
                }`}
                style={category === key ? { backgroundColor: info.color } : {}}
              >
                {info.emoji} {info.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── 제목 ── */}
        <div>
          <label className="text-[13px] font-bold text-text-sub mb-2 block">제목</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="제목을 입력하세요"
            maxLength={50}
            className="w-full px-4 py-3.5 rounded-2xl border border-border bg-white text-[15px] text-text-main placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors"
          />
          <p className="text-[11px] text-text-muted text-right mt-1">{title.length}/50</p>
        </div>

        {/* ── 내용 ── */}
        <div>
          <label className="text-[13px] font-bold text-text-sub mb-2 block">내용</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="내용을 입력하세요. 길고양이를 위한 정보를 공유해주세요."
            maxLength={2000}
            rows={8}
            className="w-full px-4 py-3.5 rounded-2xl border border-border bg-white text-[15px] text-text-main placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors resize-none leading-relaxed"
          />
          <p className="text-[11px] text-text-muted text-right mt-1">{content.length}/2000</p>
        </div>

        {/* ── 사진 첨부 ── */}
        <div>
          <label className="text-[13px] font-bold text-text-sub mb-2 block">
            사진 <span className="text-text-muted font-normal">(최대 {MAX_IMAGES}장)</span>
          </label>

          <div className="grid grid-cols-4 gap-2">
            {imageUrls.map((url) => (
              <div key={url} className="relative aspect-square">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt=""
                  className="w-full h-full object-cover rounded-xl"
                  style={{ border: "1px solid #E3DCD3" }}
                />
                <button
                  type="button"
                  onClick={() => removeImage(url)}
                  className="absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center active:scale-90"
                  style={{ backgroundColor: "rgba(0,0,0,0.6)", color: "#fff" }}
                  aria-label="사진 제거"
                >
                  <X size={12} strokeWidth={3} />
                </button>
              </div>
            ))}

            {imageUrls.length < MAX_IMAGES && (
              <label
                className="flex flex-col items-center justify-center aspect-square rounded-xl cursor-pointer active:scale-[0.97] transition-transform"
                style={{
                  backgroundColor: "#F6F1EA",
                  border: "1.5px dashed #C9BDAA",
                  color: "#A38E7A",
                }}
              >
                {uploading ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <>
                    <ImagePlus size={20} className="mb-0.5" />
                    <span className="text-[10px] font-semibold">
                      {imageUrls.length}/{MAX_IMAGES}
                    </span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  disabled={uploading}
                  onChange={handleImageSelect}
                />
              </label>
            )}
          </div>

          {uploadError && (
            <p className="text-[11px] mt-2" style={{ color: "#B84545" }}>
              {uploadError}
            </p>
          )}
          {!user && (
            <p className="text-[11px] text-text-muted mt-2">
              사진 업로드는 로그인이 필요해요.
            </p>
          )}
        </div>

        {submitError && (
          <div
            className="rounded-2xl px-4 py-3"
            style={{ backgroundColor: "#FBEAEA" }}
          >
            <p className="text-[13px] font-semibold" style={{ color: "#B84545" }}>
              {submitError}
            </p>
          </div>
        )}
      </div>

      {/* ── 하단 등록 버튼 ── */}
      <div
        className="fixed left-0 right-0 z-30 px-5 py-3 bg-white/95 backdrop-blur-md border-t border-divider"
        style={{ bottom: "5rem" }}
      >
        <button
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          className={`w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-[15px] font-bold transition-all active:scale-[0.97] ${
            canSubmit
              ? "bg-primary text-white"
              : "bg-border text-text-muted"
          }`}
          style={canSubmit ? { boxShadow: "0 6px 20px rgba(196,126,90,0.3)" } : undefined}
        >
          {submitting ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Send size={18} />
          )}
          {submitting ? "등록 중..." : "등록하기"}
        </button>
      </div>
    </div>
  );
}
