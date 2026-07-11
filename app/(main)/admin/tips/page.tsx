"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  Loader2,
  Pin,
  ImagePlus,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import {
  listAllTips,
  createTip,
  updateTip,
  deleteTip,
  uploadTipImage,
  suggestSlug,
  type Tip,
  type TipInput,
} from "@/lib/tips-repo";
import { isCurrentUserAdmin } from "@/lib/news-repo";
import { revalidateTips } from "./actions";

const EMPTY_DRAFT: TipInput = {
  slug: "",
  title: "",
  description: null,
  body: "",
  thumbnail_url: null,
  tags: [],
  source_url: null,
  source_label: null,
  featured: false,
  pinned: false,
  published: true,
  published_at: new Date().toISOString(),
};

export default function AdminTipsPage() {
  const router = useRouter();

  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [items, setItems] = useState<Tip[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<TipInput>(EMPTY_DRAFT);
  const [tagsInput, setTagsInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState("");
  const [autoSlug, setAutoSlug] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([isCurrentUserAdmin(), listAllTips()])
      .then(([admin, list]) => {
        if (cancelled) return;
        setIsAdmin(admin);
        setItems(list);
      })
      .finally(() => {
        if (cancelled) return;
        setAuthChecked(true);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = async () => {
    const list = await listAllTips();
    setItems(list);
  };

  const handleCreate = () => {
    setDraft({ ...EMPTY_DRAFT, published_at: new Date().toISOString() });
    setTagsInput("");
    setEditingId("new");
    setAutoSlug(true);
    setError("");
  };

  const handleEdit = (item: Tip) => {
    setDraft({
      slug: item.slug,
      title: item.title,
      description: item.description,
      body: item.body,
      thumbnail_url: item.thumbnail_url,
      tags: item.tags,
      source_url: item.source_url,
      source_label: item.source_label,
      featured: item.featured,
      pinned: item.pinned,
      published: item.published,
      published_at: item.published_at,
    });
    setTagsInput(item.tags.join(", "));
    setEditingId(item.id);
    setAutoSlug(false);
    setError("");
  };

  const handleCancel = () => {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setTagsInput("");
    setError("");
  };

  const handleTitleChange = (v: string) => {
    setDraft((d) => {
      const patch: Partial<TipInput> = { title: v };
      if (autoSlug && editingId === "new") {
        patch.slug = suggestSlug(v);
      }
      return { ...d, ...patch };
    });
  };

  const handleSlugChange = (v: string) => {
    setAutoSlug(false);
    setDraft((d) => ({ ...d, slug: v }));
  };

  const handleTagsChange = (v: string) => {
    setTagsInput(v);
    const parsed = v
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s.length <= 30);
    setDraft((d) => ({ ...d, tags: parsed }));
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingImage(true);
    setError("");
    try {
      const url = await uploadTipImage(file);
      setDraft((d) => ({ ...d, thumbnail_url: url }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "이미지 업로드 실패");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleImageClear = () => {
    setDraft((d) => ({ ...d, thumbnail_url: null }));
  };

  const handleSave = async () => {
    if (!draft.title.trim()) {
      setError("제목은 필수예요.");
      return;
    }
    if (!draft.slug.trim()) {
      setError("슬러그(URL)는 필수예요.");
      return;
    }
    if (!draft.body.trim()) {
      setError("본문은 필수예요.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (editingId === "new") {
        await createTip(draft);
      } else if (editingId) {
        await updateTip(editingId, draft);
      }
      // ISR 캐시 즉시 무효화 — /tips 와 해당 글 새로고침
      await revalidateTips(draft.slug).catch(() => {});
      await refresh();
      handleCancel();
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: Tip) => {
    if (!confirm(`"${item.title}" 삭제할까요?`)) return;
    try {
      await deleteTip(item.id);
      await revalidateTips(item.slug).catch(() => {});
      await refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "삭제 실패");
    }
  };

  if (!authChecked || loading) {
    return (
      <div className="flex justify-center pt-20">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="px-5 pt-20 text-center">
        <p className="text-[14px] font-bold text-text-main mb-1">관리자 전용 페이지예요</p>
        <Link href="/mypage" className="inline-block mt-4 text-[13px] font-bold text-primary">
          마이페이지로
        </Link>
      </div>
    );
  }

  return (
    <div className="px-4 pt-14 pb-24">
      {/* 헤더 */}
      <div className="mb-5">
        <button
          onClick={() => router.push("/admin")}
          className="flex items-center gap-1 text-[12px] font-semibold text-text-sub mb-3 active:scale-95 transition-transform"
        >
          <ArrowLeft size={14} />
          관리자
        </button>
        <div className="flex items-end justify-between">
          <div>
            <div className="flex items-baseline gap-2 mb-1">
              <h1 className="text-[22px] font-extrabold text-text-main tracking-tight flex items-center gap-1.5">
                <Sparkles size={18} className="text-primary" />
                꿀팁게시판 관리
              </h1>
            </div>
            <p className="text-[12px] text-text-sub">정보글을 작성·발행·수정할 수 있어요</p>
          </div>
          <button
            onClick={handleCreate}
            className="w-11 h-11 rounded-full bg-primary flex items-center justify-center active:scale-95 transition-transform"
            style={{ boxShadow: "var(--shadow-primary)" }}
            aria-label="새 꿀팁 작성"
          >
            <Plus size={20} color="#fff" strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* 편집 폼 */}
      {editingId && (
        <div
          className="mb-5 p-4"
          style={{
            background: "#FFFFFF",
            borderRadius: "var(--radius-card)",
            boxShadow: "0 8px 24px rgba(49,130,246,0.14), 0 1px 3px rgba(0,0,0,0.03)",
            border: "1.5px solid rgba(49,130,246,0.2)",
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[14px] font-extrabold text-text-main">
              {editingId === "new" ? "새 꿀팁 작성" : "꿀팁 수정"}
            </h2>
            <button
              onClick={handleCancel}
              className="w-7 h-7 rounded-lg flex items-center justify-center active:scale-90"
              style={{ backgroundColor: "#EEE8E0" }}
            >
              <X size={13} style={{ color: "#A38E7A" }} strokeWidth={3} />
            </button>
          </div>

          {/* 제목 */}
          <Label required>제목</Label>
          <Input
            value={draft.title}
            onChange={handleTitleChange}
            placeholder="예: TNR 신청 절차 5분 정리"
          />

          {/* 슬러그 (URL) */}
          <Label required>슬러그 (URL 끝부분, 영소문자/숫자/하이픈)</Label>
          <Input
            value={draft.slug}
            onChange={handleSlugChange}
            placeholder="tnr-application-guide"
          />
          {draft.slug && (
            <p className="text-[10.5px] text-text-light mb-2 -mt-0.5">
              → /tips/{draft.slug}
            </p>
          )}

          {/* 한 줄 설명 (description) */}
          <Label>한 줄 설명 (SEO meta)</Label>
          <Input
            value={draft.description ?? ""}
            onChange={(v) => setDraft((d) => ({ ...d, description: v || null }))}
            placeholder="비워두면 본문 첫 단락에서 자동 추출돼요"
          />

          {/* 썸네일 */}
          <Label>썸네일 이미지</Label>
          <div className="mb-3">
            {draft.thumbnail_url ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={draft.thumbnail_url}
                  alt=""
                  className="w-full aspect-[16/9] rounded-xl object-cover"
                  style={{ border: "1px solid #E3DCD3" }}
                />
                <button
                  type="button"
                  onClick={handleImageClear}
                  className="absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center active:scale-90"
                  style={{ backgroundColor: "rgba(0,0,0,0.6)", color: "#fff" }}
                  aria-label="이미지 제거"
                >
                  <X size={16} strokeWidth={3} />
                </button>
              </div>
            ) : (
              <label
                className="flex flex-col items-center justify-center aspect-[16/9] rounded-xl cursor-pointer active:scale-[0.99] transition-transform"
                style={{
                  backgroundColor: "#F6F1EA",
                  border: "1.5px dashed #C9BDAA",
                  color: "#A38E7A",
                }}
              >
                {uploadingImage ? (
                  <>
                    <Loader2 size={22} className="animate-spin mb-1" />
                    <span className="text-[12px] font-semibold">업로드 중...</span>
                  </>
                ) : (
                  <>
                    <ImagePlus size={24} className="mb-1" />
                    <span className="text-[12px] font-semibold">이미지 선택</span>
                    <span className="text-[10px] mt-0.5">JPG/PNG · 20MB 이하</span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploadingImage}
                  onChange={handleImageSelect}
                />
              </label>
            )}
          </div>

          {/* 태그 */}
          <Label>태그 (쉼표로 구분)</Label>
          <Input
            value={tagsInput}
            onChange={handleTagsChange}
            placeholder="예: TNR, 케어테이커, 겨울철 돌봄"
          />

          {/* 본문 */}
          <Label required>본문 (HTML 가능 — h2/h3, p, ul, ol, blockquote, a, img, code 등)</Label>
          <textarea
            value={draft.body}
            onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
            rows={14}
            placeholder={`<h2>들어가며</h2>\n<p>...</p>\n<h2>본론</h2>\n<ul><li>...</li></ul>`}
            className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none mb-3 resize-y"
            style={{
              backgroundColor: "#F6F1EA",
              color: "#2A2A28",
              border: "1px solid #E3DCD3",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
              minHeight: 280,
            }}
          />
          <p className="text-[10.5px] text-text-light -mt-2 mb-2">
            ⚠️ &lt;script&gt; · &lt;iframe&gt; · on* 핸들러는 자동 제거돼요
          </p>

          {/* 출처 */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>출처 URL</Label>
              <Input
                value={draft.source_url ?? ""}
                onChange={(v) => setDraft((d) => ({ ...d, source_url: v || null }))}
                placeholder="https://..."
              />
            </div>
            <div>
              <Label>출처 표시명</Label>
              <Input
                value={draft.source_label ?? ""}
                onChange={(v) => setDraft((d) => ({ ...d, source_label: v || null }))}
                placeholder="예: OO 블로그"
              />
            </div>
          </div>

          {/* 발행 옵션 */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            <label className="flex items-center gap-1.5 cursor-pointer p-2 rounded-lg" style={{ background: "#F6F1EA" }}>
              <input
                type="checkbox"
                checked={draft.published}
                onChange={(e) => setDraft((d) => ({ ...d, published: e.target.checked }))}
                className="w-4 h-4 accent-primary"
              />
              <span className="text-[11.5px] font-semibold text-text-sub">발행</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer p-2 rounded-lg" style={{ background: "#F6F1EA" }}>
              <input
                type="checkbox"
                checked={draft.featured}
                onChange={(e) => setDraft((d) => ({ ...d, featured: e.target.checked }))}
                className="w-4 h-4 accent-primary"
              />
              <span className="text-[11.5px] font-semibold text-text-sub flex items-center gap-0.5">
                <Sparkles size={10} /> 추천
              </span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer p-2 rounded-lg" style={{ background: "#F6F1EA" }}>
              <input
                type="checkbox"
                checked={draft.pinned}
                onChange={(e) => setDraft((d) => ({ ...d, pinned: e.target.checked }))}
                className="w-4 h-4 accent-primary"
              />
              <span className="text-[11.5px] font-semibold text-text-sub flex items-center gap-0.5">
                <Pin size={10} /> 고정
              </span>
            </label>
          </div>

          {/* 발행일 */}
          <Label>발행일</Label>
          <input
            type="datetime-local"
            value={draft.published_at ? draft.published_at.slice(0, 16) : ""}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                published_at: e.target.value
                  ? new Date(e.target.value).toISOString()
                  : new Date().toISOString(),
              }))
            }
            className="w-full px-3 py-2 rounded-xl text-[13px] outline-none mb-3"
            style={{
              backgroundColor: "#F6F1EA",
              color: "#2A2A28",
              border: "1px solid #E3DCD3",
            }}
          />

          {error && (
            <p className="text-[11px] mb-2" style={{ color: "#B84545" }}>
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving || uploadingImage}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-primary text-white text-[13px] font-bold disabled:opacity-40 active:scale-[0.97] transition-all"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              저장
            </button>
            <button
              onClick={handleCancel}
              disabled={saving}
              className="px-5 py-2.5 rounded-xl text-[13px] font-bold"
              style={{ backgroundColor: "#EEE8E0", color: "#A38E7A" }}
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 글 목록 */}
      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="card p-6 text-center text-[13px] text-text-sub">
            아직 등록된 꿀팁이 없어요.
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="p-4"
              style={{
                background: "#FFFFFF",
                borderRadius: 18,
                boxShadow: "0 4px 14px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)",
                border: "1px solid rgba(0,0,0,0.04)",
                opacity: item.published ? 1 : 0.6,
              }}
            >
              <div className="flex items-start gap-3">
                {item.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.thumbnail_url}
                    alt=""
                    className="w-16 h-16 rounded-xl object-cover shrink-0"
                  />
                ) : (
                  <div
                    className="w-16 h-16 rounded-xl shrink-0 flex items-center justify-center"
                    style={{ background: "#F2EBE0" }}
                  >
                    <Sparkles size={20} className="text-primary opacity-60" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                    {!item.published && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-text-muted text-white">
                        초안
                      </span>
                    )}
                    {item.featured && (
                      <span className="text-[10px] font-bold text-primary flex items-center gap-0.5">
                        <Sparkles size={10} /> 추천
                      </span>
                    )}
                    {item.pinned && (
                      <span className="text-[10px] font-bold text-primary flex items-center gap-0.5">
                        <Pin size={10} /> 고정
                      </span>
                    )}
                    <span className="text-[10px] text-text-light">· /{item.slug}</span>
                  </div>
                  <p className="text-[14px] font-extrabold text-text-main leading-tight truncate">
                    {item.title}
                  </p>
                  {item.description && (
                    <p className="text-[11px] text-text-sub mt-0.5 truncate">
                      {item.description}
                    </p>
                  )}
                  {item.tags.length > 0 && (
                    <p className="text-[10px] text-text-light mt-0.5 truncate">
                      {item.tags.map((t) => `#${t}`).join(" ")}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-1.5 mt-3 pt-3 border-t border-divider">
                <Link
                  href={`/tips/${item.slug}`}
                  target="_blank"
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-bold"
                  style={{ backgroundColor: "#F2EBE0", color: "#8B6F4E" }}
                >
                  <ExternalLink size={12} /> 보기
                </Link>
                <button
                  onClick={() => handleEdit(item)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-bold"
                  style={{ backgroundColor: "#EEE8E0", color: "var(--color-primary)" }}
                >
                  <Pencil size={12} /> 수정
                </button>
                <button
                  onClick={() => handleDelete(item)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-bold"
                  style={{ backgroundColor: "#FBEAEA", color: "#D85555" }}
                >
                  <Trash2 size={12} /> 삭제
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function Label({
  children,
  required,
}: {
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="block text-[11px] font-bold text-text-sub mb-1 mt-2">
      {children}
      {required && <span className="text-primary ml-0.5">*</span>}
    </label>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full px-3 py-2 rounded-xl text-[13px] outline-none mb-1 disabled:opacity-50 disabled:cursor-not-allowed"
      style={{
        backgroundColor: "#F6F1EA",
        color: "#2A2A28",
        border: "1px solid #E3DCD3",
      }}
    />
  );
}
