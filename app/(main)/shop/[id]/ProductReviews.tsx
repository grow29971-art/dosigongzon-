"use client";

// ── 상품 구매후기 섹션 ──
// 작성 자격(실구매)은 RLS가 최종 강제 — 여기서는 자격에 맞춰 버튼만 노출.

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Star, Camera, X, Trash2, PawPrint } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { sanitizeImageUrl } from "@/lib/url-validate";
import {
  listProductReviews,
  getMyReviewEligibility,
  uploadReviewImage,
  createReview,
  deleteReview,
  REVIEW_MAX_IMAGES,
  REVIEW_MAX_LENGTH,
  type ProductReview,
} from "@/lib/shop-reviews-repo";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function Stars({ value, size = 13 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`별점 ${value}점`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={size}
          fill={n <= value ? "var(--color-warning)" : "none"}
          style={{ color: n <= value ? "var(--color-warning)" : "var(--color-divider)" }}
        />
      ))}
    </span>
  );
}

export default function ProductReviews({ productId }: { productId: string }) {
  const { user } = useAuth();

  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchased, setPurchased] = useState(false);
  const [myReview, setMyReview] = useState<ProductReview | null>(null);

  const [writing, setWriting] = useState(false);
  const [rating, setRating] = useState(0);
  const [content, setContent] = useState("");
  const [photos, setPhotos] = useState<{ file: File; preview: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewerSrc, setViewerSrc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const [list, eligibility] = await Promise.all([
        listProductReviews(productId),
        getMyReviewEligibility(productId),
      ]);
      setReviews(list);
      setPurchased(eligibility.purchased);
      setMyReview(eligibility.myReview);
    } catch (e) {
      console.error("[ProductReviews] load failed:", e);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    load();
  }, [load, user?.id]);

  // 미리보기 objectURL 정리
  useEffect(() => {
    return () => photos.forEach((p) => URL.revokeObjectURL(p.preview));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const avg = reviews.length
    ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
    : 0;

  const handleAddPhotos = (files: FileList | null) => {
    if (!files) return;
    setError(null);
    const next = [...photos];
    for (const file of Array.from(files)) {
      if (next.length >= REVIEW_MAX_IMAGES) break;
      if (!file.type.startsWith("image/")) continue;
      next.push({ file, preview: URL.createObjectURL(file) });
    }
    setPhotos(next);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removePhoto = (idx: number) => {
    URL.revokeObjectURL(photos[idx].preview);
    setPhotos(photos.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (rating < 1) { setError("별점을 선택해주세요."); return; }
    if (!content.trim()) { setError("후기 내용을 입력해주세요."); return; }
    setBusy(true);
    setError(null);
    try {
      const urls: string[] = [];
      for (const p of photos) {
        urls.push(await uploadReviewImage(p.file));
      }
      await createReview({ productId, rating, content, images: urls });
      photos.forEach((p) => URL.revokeObjectURL(p.preview));
      setWriting(false);
      setRating(0);
      setContent("");
      setPhotos([]);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "후기 작성에 실패했어요.");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("후기를 삭제할까요?")) return;
    setBusy(true);
    try {
      await deleteReview(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "후기 삭제에 실패했어요.");
    } finally {
      setBusy(false);
    }
  };

  const canWrite = !!user && purchased && !myReview;

  return (
    <div className="mt-8">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-[15px] font-bold text-text-main">구매후기</h2>
          {reviews.length > 0 && (
            <span className="flex items-center gap-1 text-[13px]">
              <Star size={13} fill="var(--color-warning)" style={{ color: "var(--color-warning)" }} />
              <span className="font-bold text-text-main">{avg}</span>
              <span className="text-text-light">({reviews.length})</span>
            </span>
          )}
        </div>
        {canWrite && !writing && (
          <button
            onClick={() => setWriting(true)}
            className="text-[13px] font-bold px-3 py-1.5 rounded-xl text-white press"
            style={{ background: "var(--color-primary)" }}
          >
            후기 쓰기
          </button>
        )}
      </div>

      {/* 작성 폼 */}
      {writing && (
        <div
          className="mt-3 p-4 rounded-2xl"
          style={{ background: "var(--color-warm-white)", border: "1px solid var(--color-divider)" }}
        >
          {/* 별점 선택 */}
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => setRating(n)} aria-label={`별점 ${n}점 주기`} className="press">
                <Star
                  size={26}
                  fill={n <= rating ? "var(--color-warning)" : "none"}
                  style={{ color: n <= rating ? "var(--color-warning)" : "var(--color-divider)" }}
                />
              </button>
            ))}
          </div>

          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={REVIEW_MAX_LENGTH}
            rows={4}
            placeholder="상품은 어떠셨나요? 냥이 반응도 함께 알려주시면 다른 길집사님들께 큰 도움이 돼요 🐾"
            className="mt-3 w-full p-3 rounded-xl text-[13px] leading-relaxed resize-none outline-none"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-divider)" }}
          />

          {/* 사진 첨부 */}
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            {photos.map((p, i) => (
              <div key={p.preview} className="relative w-16 h-16 rounded-xl overflow-hidden" style={{ border: "1px solid var(--color-divider)" }}>
                {/* objectURL 미리보기 — next/image 최적화 대상 아님 */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.preview} alt={`첨부 사진 ${i + 1}`} className="w-full h-full object-cover" />
                <button
                  onClick={() => removePhoto(i)}
                  className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ background: "rgba(0,0,0,0.55)" }}
                  aria-label="사진 삭제"
                >
                  <X size={12} className="text-white" />
                </button>
              </div>
            ))}
            {photos.length < REVIEW_MAX_IMAGES && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-16 h-16 rounded-xl flex flex-col items-center justify-center gap-0.5 press"
                style={{ border: "1.5px dashed var(--color-divider)", color: "var(--color-text-light)" }}
                aria-label="사진 첨부"
              >
                <Camera size={18} />
                <span className="text-[10px] font-bold">{photos.length}/{REVIEW_MAX_IMAGES}</span>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleAddPhotos(e.target.files)}
            />
          </div>

          {error && <p className="mt-2 text-[12px] font-bold" style={{ color: "var(--color-error)" }}>{error}</p>}

          <div className="mt-3 flex gap-2">
            <button
              onClick={() => { setWriting(false); setError(null); }}
              disabled={busy}
              className="flex-1 py-2.5 rounded-xl text-[13px] font-bold"
              style={{ background: "var(--color-surface)", color: "var(--color-text-sub)", border: "1px solid var(--color-divider)" }}
            >
              취소
            </button>
            <button
              onClick={handleSubmit}
              disabled={busy}
              className="flex-[2] py-2.5 rounded-xl text-white text-[13px] font-bold press disabled:opacity-50"
              style={{ background: "var(--color-primary)" }}
            >
              {busy ? "등록 중…" : "후기 등록"}
            </button>
          </div>
        </div>
      )}

      {/* 목록 */}
      {loading ? (
        <p className="mt-4 text-[13px] text-text-light">후기를 불러오는 중…</p>
      ) : reviews.length === 0 ? (
        <div className="mt-3 py-8 flex flex-col items-center gap-2 rounded-2xl" style={{ background: "var(--color-warm-white)" }}>
          <PawPrint size={28} style={{ color: "rgba(176,92,54,0.28)" }} />
          <p className="text-[13px] text-text-light">아직 후기가 없어요. 구매하시면 첫 후기를 남길 수 있어요!</p>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          {reviews.map((r) => {
            const avatar = sanitizeImageUrl(r.author_avatar_url ?? "", "");
            const imgs = r.images.map((u) => sanitizeImageUrl(u, "")).filter((u) => u !== "");
            const mine = user?.id === r.user_id;
            return (
              <div
                key={r.id}
                className="p-4 rounded-2xl"
                style={{ background: "var(--color-surface)", border: "1px solid var(--color-divider)" }}
              >
                <div className="flex items-center gap-2.5">
                  <div className="relative w-8 h-8 rounded-full overflow-hidden shrink-0" style={{ background: "var(--color-warm-white)" }}>
                    {avatar ? (
                      <Image src={avatar} alt="" fill className="object-cover" sizes="32px" />
                    ) : (
                      <span className="w-full h-full flex items-center justify-center">
                        <PawPrint size={15} style={{ color: "rgba(176,92,54,0.4)" }} />
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-text-main truncate">{r.author_name ?? "길집사"}</p>
                    <div className="flex items-center gap-1.5">
                      <Stars value={r.rating} size={11} />
                      <span className="text-[11px] text-text-light">{formatDate(r.created_at)}</span>
                    </div>
                  </div>
                  {mine && (
                    <button
                      onClick={() => handleDelete(r.id)}
                      disabled={busy}
                      className="p-1.5 rounded-lg"
                      style={{ color: "var(--color-text-light)" }}
                      aria-label="내 후기 삭제"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>

                <p className="mt-2.5 text-[13px] text-text-sub leading-relaxed whitespace-pre-wrap">{r.content}</p>

                {imgs.length > 0 && (
                  <div className="mt-2.5 flex gap-2">
                    {imgs.map((src, i) => (
                      <button
                        key={src}
                        onClick={() => setViewerSrc(src)}
                        className="relative w-20 h-20 rounded-xl overflow-hidden shrink-0 press"
                        style={{ border: "1px solid var(--color-divider)" }}
                        aria-label={`후기 사진 ${i + 1} 크게 보기`}
                      >
                        <Image src={src} alt={`후기 사진 ${i + 1}`} fill className="object-cover" sizes="80px" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 사진 확대 뷰어 */}
      {viewerSrc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.85)" }}
          onClick={() => setViewerSrc(null)}
        >
          <button
            className="absolute top-12 right-4 w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.15)" }}
            aria-label="닫기"
          >
            <X size={20} className="text-white" />
          </button>
          <div className="relative w-full" style={{ maxWidth: 480, aspectRatio: "1 / 1" }}>
            <Image src={viewerSrc} alt="후기 사진 크게 보기" fill className="object-contain" sizes="480px" />
          </div>
        </div>
      )}
    </div>
  );
}
