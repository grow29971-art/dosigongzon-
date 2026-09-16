"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Send, ImagePlus, X, Loader2, PawPrint, ArrowRight } from "lucide-react";
import type { PostCategory } from "@/lib/types";
import { CATEGORY_MAP } from "@/lib/types";
import { createPost } from "@/lib/posts-repo";
import { uploadCatPhoto } from "@/lib/cats-repo";
import { listMyActivityRegions } from "@/lib/activity-regions-repo";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import UIChip from "@/app/components/ui/Chip";

const CATEGORIES = Object.entries(CATEGORY_MAP) as [PostCategory, typeof CATEGORY_MAP[PostCategory]][];

const MAX_IMAGES = 4;

// 돌봄 부탁 글 양식 — 위치는 쪽지로만(안전 계약). 빈 내용일 때만 자동 채움.
const SITTER_TEMPLATE = `📅 기간: 예) 9/1(월)~9/5(금) 아침 1회
🐱 아이들: 예) 2마리 · 사료는 제가 준비해둘게요
🙏 부탁: 밥·물만 부탁드려요
※ 정확한 밥자리 위치는 공개글 대신 쪽지로만 알려드려요`;

export default function WritePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [category, setCategory] = useState<PostCategory>("free");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  // 돌봄 부탁 전용 — 동네(동 단위). posts.region으로 저장돼 동네 매칭 푸시에 쓰인다.
  const [region, setRegion] = useState("");
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

  // 글감 프롬프트에서 넘어온 카테고리·제목 프리필 (window 사용 — Suspense 불필요)
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const cat = sp.get("category");
      if (cat && cat in CATEGORY_MAP) setCategory(cat as PostCategory);
      const t = sp.get("t");
      if (t) setTitle(t.slice(0, 50));
      const c = sp.get("content");
      if (c) setContent(c.slice(0, 500));
    } catch {
      /* ignore */
    }
  }, []);

  // 돌봄 부탁 선택 시: 빈 내용이면 양식 자동 채움 + 활동 지역으로 동네 프리필
  useEffect(() => {
    if (category !== "sitter") return;
    setContent((prev) => (prev.trim() === "" ? SITTER_TEMPLATE : prev));
    if (region === "" && user) {
      listMyActivityRegions()
        .then((regions) => {
          const primary = regions.find((r) => r.is_primary) ?? regions[0];
          if (primary?.name) setRegion((prev) => (prev === "" ? primary.name : prev));
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, user]);

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
      const post = await createPost({
        category,
        title: title.trim(),
        content: content.trim(),
        images: imageUrls,
        region: category === "sitter" ? region.trim() || undefined : undefined,
      });
      // 돌봄 부탁 — 같은 동네 활동 이웃에게 푸시 (fire-and-forget, 실패해도 글은 등록됨)
      if (category === "sitter" && post?.id) {
        try {
          const supabase = createClient();
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.access_token) {
            fetch("/api/posts/sitter-notify", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({ postId: post.id }),
            }).catch(() => {});
          }
        } catch { /* 무시 */ }
      }
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
        <button onClick={() => router.back()} className="p-2 -ml-2 press-strong transition-transform">
          <ArrowLeft size={24} className="text-text-main" />
        </button>
        <h1 className="text-lg font-bold text-text-main">글쓰기</h1>
        <div className="w-16" />
      </div>

      <div className="px-5 space-y-5">
        {/* 첫 글 안내 — 동네 고양이 0마리 유저에게 부드러운 권유 */}
        {hasNoCats && (
          <div
            className="p-4"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-card)",
            }}
          >
            <div className="flex items-start gap-3">
              <PawPrint size={20} strokeWidth={1.8} className="shrink-0 mt-0.5 text-text-sub" />
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-semibold text-text-main leading-tight mb-1">
                  첫 동네 고양이부터 등록해보세요
                </p>
                <p className="text-[13px] text-text-sub leading-relaxed">
                  지도에 한 마리 등록하고 글을 쓰면 동네 길집사들이 더 잘 알아봐요.
                </p>
                <Link
                  href="/map"
                  className="inline-flex items-center gap-1 mt-2 text-[13px] font-semibold"
                  style={{ color: "var(--color-primary)" }}
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
          <label className="text-[13px] font-semibold text-text-sub mb-2 block">카테고리</label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map(([key, info]) => (
              <UIChip
                key={key}
                active={category === key}
                activeColor={key === "emergency" ? "var(--color-error)" : undefined}
                onClick={() => setCategory(key)}
              >
                {info.label}
              </UIChip>
            ))}
          </div>
        </div>

        {/* 돌봄 부탁 — 동네 입력 + 안전 안내 (2026-08-29 PMF 개편) */}
        {category === "sitter" && (
          <div>
            <div
              className="p-4 mb-3"
              style={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-card)",
              }}
            >
              <p className="text-[15px] font-semibold text-text-main leading-tight mb-1">
                같은 동네 이웃에게 알림이 가요
              </p>
              <p className="text-[13px] text-text-sub leading-relaxed">
                아래 동네를 적으면 그 동네에서 활동하는 이웃에게 부탁 알림이 전달돼요.
                <b> 정확한 밥자리 위치는 글 대신 쪽지로만</b> 주고받아 주세요.
              </p>
            </div>
            <label className="text-[13px] font-semibold text-text-sub mb-2 block">동네 (동 단위)</label>
            <input
              type="text"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="예) 행궁동"
              maxLength={20}
              className="w-full px-4 py-3.5 rounded-lg border border-border bg-surface text-[15px] text-text-main placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors"
            />
          </div>
        )}

        {/* 긴급 글 ↔ 확인서 연결 — 신고·민원 글에 증빙을 붙이도록 (2026-08-29 PMF 개편) */}
        {category === "emergency" && (
          <div
            className="p-4"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-card)",
            }}
          >
            <p className="text-[15px] font-semibold text-text-main leading-tight mb-1">
              신고·민원 글에는 돌봄 활동 확인서를 함께 내세요
            </p>
            <p className="text-[13px] text-text-sub leading-relaxed">
              쌓인 돌봄 기록이 신고·민원 대응의 근거가 돼요.
            </p>
            {/* 사실적시 명예훼손 예방 안내 (2026-08-29 법률감사 Low) */}
            <p className="text-[13px] leading-relaxed mt-2 pt-2" style={{ color: "var(--color-error)", borderTop: "1px solid var(--color-divider)" }}>
              특정인을 지목할 땐 실명·얼굴·차량번호를 가리고, 확인되지 않은 내용은 &ldquo;의혹/제보&rdquo;로
              표현해 주세요. 확정적으로 단정하면 사실이어도 명예훼손이 될 수 있어요.
            </p>
            <div className="flex gap-3 mt-2">
              <Link
                href="/mypage/report"
                className="text-[13px] font-semibold"
                style={{ color: "var(--color-primary)" }}
              >
                내 확인서 열기 →
              </Link>
              <Link
                href="/protection/emergency-guide"
                className="text-[13px] font-semibold"
                style={{ color: "var(--color-primary)" }}
              >
                응급 대응 가이드 →
              </Link>
            </div>
          </div>
        )}

        {/* ── 제목 ── */}
        <div>
          <label className="text-[13px] font-semibold text-text-sub mb-2 block">제목</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={category === "sitter" ? "예) 9/1~9/5 아침 밥자리 대타 구해요" : "제목을 입력하세요"}
            maxLength={50}
            className="w-full px-4 py-3.5 rounded-lg border border-border bg-surface text-[15px] text-text-main placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors"
          />
          <p className="text-[11px] text-text-muted text-right mt-1">{title.length}/50</p>
        </div>

        {/* ── 내용 ── */}
        <div>
          <label className="text-[13px] font-semibold text-text-sub mb-2 block">내용</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="내용을 입력하세요. 길고양이를 위한 정보를 공유해주세요."
            maxLength={2000}
            rows={8}
            className="w-full px-4 py-3.5 rounded-lg border border-border bg-surface text-[15px] text-text-main placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors resize-none leading-relaxed"
          />
          <p className="text-[11px] text-text-muted text-right mt-1">{content.length}/2000</p>
        </div>

        {/* ── 사진 첨부 ── */}
        <div>
          <label className="text-[13px] font-semibold text-text-sub mb-2 block">
            사진 <span className="text-text-muted font-normal">(최대 {MAX_IMAGES}장)</span>
          </label>

          <div className="grid grid-cols-4 gap-2">
            {imageUrls.map((url) => (
              <div key={url} className="relative aspect-square">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt=""
                  className="w-full h-full object-cover rounded-lg"
                  style={{ border: "1px solid var(--color-border)" }}
                />
                <button
                  type="button"
                  onClick={() => removeImage(url)}
                  className="absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center press-strong"
                  style={{ backgroundColor: "rgba(0,0,0,0.6)", color: "var(--color-surface)" }}
                  aria-label="사진 제거"
                >
                  <X size={12} strokeWidth={3} />
                </button>
              </div>
            ))}

            {imageUrls.length < MAX_IMAGES && (
              <label
                className="flex flex-col items-center justify-center aspect-square rounded-lg cursor-pointer press-strong transition-transform"
                style={{
                  backgroundColor: "var(--color-surface)",
                  border: "1px dashed var(--color-gray-300)",
                  color: "var(--color-text-light)",
                }}
              >
                {uploading ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <>
                    <ImagePlus size={20} className="mb-0.5" />
                    <span className="text-[11px] font-semibold">
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
            <p className="text-[11px] mt-2" style={{ color: "var(--color-error)" }}>
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
            className="px-4 py-3"
            style={{ backgroundColor: "var(--color-error-soft)", borderRadius: "var(--radius-card-sm)" }}
          >
            <p className="text-[13px] font-semibold" style={{ color: "var(--color-error)" }}>
              {submitError}
            </p>
          </div>
        )}
      </div>

      {/* ── 하단 등록 버튼 ── */}
      <div
        className="fixed left-0 right-0 z-30 px-5 py-3 border-t border-divider"
        style={{ bottom: "5rem", background: "var(--color-surface)" }}
      >
        <button
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          className={`w-full flex items-center justify-center gap-2 py-4 rounded-lg text-[15px] font-semibold transition-all press-strong ${
            canSubmit
              ? "bg-primary text-surface"
              : "bg-gray-100 text-text-muted"
          }`}
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
