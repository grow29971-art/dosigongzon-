"use client";

// 꿀팁게시판 관리 (admin 전용) — 2026-09-16 「익숙한 동네앱」 리디자인:
// 카드 목록 → 구분선 리스트(썸네일 8px), 편집 폼 헤어라인 섹션, 회색 태그, 헤어라인 버튼. 토큰만.

import { useEffect, useState } from "react";
import Link from "next/link";
import {
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
  FileText,
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
import UIButton from "@/app/components/ui/Button";
import {
  AdminForbidden, AdminHeader, AdminLoading, AdminPage, AdminSection, AdminTag, EmptyState, FieldLabel,
  inputCls, inputStyle,
} from "../_ui";

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

  if (!authChecked || loading) return <AdminLoading />;
  if (!isAdmin) return <AdminForbidden />;

  return (
    <AdminPage>
      <AdminHeader
        title="꿀팁게시판 관리"
        description="정보글을 작성·발행·수정할 수 있어요"
        right={
          <UIButton size="sm" onClick={handleCreate}>
            <Plus size={14} /> 새 꿀팁
          </UIButton>
        }
      />

      {/* 편집 폼 */}
      {editingId && (
        <AdminSection
          title={editingId === "new" ? "새 꿀팁 작성" : "꿀팁 수정"}
          right={
            <button type="button" onClick={handleCancel} className="w-7 h-7 flex items-center justify-center text-text-light" aria-label="닫기">
              <X size={16} />
            </button>
          }
        >
          {/* 제목 */}
          <FieldLabel>제목 *</FieldLabel>
          <Input
            value={draft.title}
            onChange={handleTitleChange}
            placeholder="예: TNR 신청 절차 5분 정리"
          />

          {/* 슬러그 (URL) */}
          <FieldLabel>슬러그 (URL 끝부분, 영소문자/숫자/하이픈) *</FieldLabel>
          <Input
            value={draft.slug}
            onChange={handleSlugChange}
            placeholder="tnr-application-guide"
          />
          {draft.slug && (
            <p className="text-[13px] text-text-light -mt-2 mb-3">→ /tips/{draft.slug}</p>
          )}

          {/* 한 줄 설명 (description) */}
          <FieldLabel>한 줄 설명 (SEO meta)</FieldLabel>
          <Input
            value={draft.description ?? ""}
            onChange={(v) => setDraft((d) => ({ ...d, description: v || null }))}
            placeholder="비워두면 본문 첫 단락에서 자동 추출돼요"
          />

          {/* 썸네일 */}
          <FieldLabel>썸네일 이미지</FieldLabel>
          <div className="mb-3">
            {draft.thumbnail_url ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={draft.thumbnail_url}
                  alt=""
                  className="w-full aspect-[16/9] object-cover"
                  style={{ borderRadius: "var(--radius-card-sm)", border: "1px solid var(--color-border)" }}
                />
                <button
                  type="button"
                  onClick={handleImageClear}
                  className="absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center press"
                  style={{ backgroundColor: "rgba(0,0,0,0.6)", color: "var(--color-surface)" }}
                  aria-label="이미지 제거"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <label
                className="flex flex-col items-center justify-center aspect-[16/9] cursor-pointer text-text-light"
                style={{ backgroundColor: "var(--color-surface-alt)", border: "1px dashed var(--color-gray-300)", borderRadius: "var(--radius-card-sm)" }}
              >
                {uploadingImage ? (
                  <>
                    <Loader2 size={22} className="animate-spin mb-1" />
                    <span className="text-[13px] font-semibold">업로드 중...</span>
                  </>
                ) : (
                  <>
                    <ImagePlus size={24} className="mb-1" />
                    <span className="text-[13px] font-semibold">이미지 선택</span>
                    <span className="text-[11px] mt-0.5">JPG/PNG · 20MB 이하</span>
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
          <FieldLabel>태그 (쉼표로 구분)</FieldLabel>
          <Input
            value={tagsInput}
            onChange={handleTagsChange}
            placeholder="예: TNR, 길집사, 겨울철 돌봄"
          />

          {/* 본문 */}
          <FieldLabel>본문 (HTML 가능 — h2/h3, p, ul, ol, blockquote, a, img, code 등) *</FieldLabel>
          <textarea
            value={draft.body}
            onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
            rows={14}
            placeholder={`<h2>들어가며</h2>\n<p>...</p>\n<h2>본론</h2>\n<ul><li>...</li></ul>`}
            className={`${inputCls} text-[13px] mb-1 resize-y font-mono`}
            style={{ ...inputStyle, minHeight: 280 }}
          />
          <p className="text-[13px] text-text-light mb-3">
            &lt;script&gt; · &lt;iframe&gt; · on* 핸들러는 자동 제거돼요
          </p>

          {/* 출처 */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <FieldLabel>출처 URL</FieldLabel>
              <Input
                value={draft.source_url ?? ""}
                onChange={(v) => setDraft((d) => ({ ...d, source_url: v || null }))}
                placeholder="https://..."
              />
            </div>
            <div>
              <FieldLabel>출처 표시명</FieldLabel>
              <Input
                value={draft.source_label ?? ""}
                onChange={(v) => setDraft((d) => ({ ...d, source_label: v || null }))}
                placeholder="예: OO 블로그"
              />
            </div>
          </div>

          {/* 발행 옵션 */}
          <div className="flex items-center gap-4 mb-3">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={draft.published}
                onChange={(e) => setDraft((d) => ({ ...d, published: e.target.checked }))}
                className="w-4 h-4 accent-primary"
              />
              <span className="text-[13px] font-semibold text-text-sub">발행</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={draft.featured}
                onChange={(e) => setDraft((d) => ({ ...d, featured: e.target.checked }))}
                className="w-4 h-4 accent-primary"
              />
              <span className="text-[13px] font-semibold text-text-sub flex items-center gap-0.5">
                <Sparkles size={11} /> 추천
              </span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={draft.pinned}
                onChange={(e) => setDraft((d) => ({ ...d, pinned: e.target.checked }))}
                className="w-4 h-4 accent-primary"
              />
              <span className="text-[13px] font-semibold text-text-sub flex items-center gap-0.5">
                <Pin size={11} /> 고정
              </span>
            </label>
          </div>

          {/* 발행일 */}
          <FieldLabel>발행일</FieldLabel>
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
            className={`${inputCls} mb-3`}
            style={inputStyle}
          />

          {error && (
            <p className="text-[13px] mb-2" style={{ color: "var(--color-error)" }}>{error}</p>
          )}

          <div className="flex gap-2">
            <UIButton onClick={handleSave} disabled={saving || uploadingImage} className="flex-1">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              저장
            </UIButton>
            <UIButton variant="secondary" onClick={handleCancel} disabled={saving}>취소</UIButton>
          </div>
        </AdminSection>
      )}

      {/* 글 목록 */}
      <AdminSection title={`꿀팁 ${items.length}개`} padding={false}>
        {items.length === 0 ? (
          <EmptyState>아직 등록된 꿀팁이 없어요.</EmptyState>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="flex items-start gap-3 px-4 py-3 border-b border-divider last:border-b-0"
              style={{ opacity: item.published ? 1 : 0.6 }}
            >
              {item.thumbnail_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.thumbnail_url}
                  alt=""
                  className="w-14 h-14 object-cover shrink-0"
                  style={{ borderRadius: "var(--radius-card-sm)", border: "1px solid var(--color-border)" }}
                />
              ) : (
                <div
                  className="w-14 h-14 shrink-0 flex items-center justify-center text-text-light"
                  style={{ background: "var(--color-surface-alt)", borderRadius: "var(--radius-card-sm)" }}
                >
                  <FileText size={20} strokeWidth={1.8} />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                  {!item.published && <AdminTag>초안</AdminTag>}
                  {item.featured && (
                    <span className="text-[11px] font-semibold text-primary flex items-center gap-0.5">
                      <Sparkles size={10} /> 추천
                    </span>
                  )}
                  {item.pinned && (
                    <span className="text-[11px] font-semibold text-primary flex items-center gap-0.5">
                      <Pin size={10} /> 고정
                    </span>
                  )}
                  <span className="text-[11px] text-text-light truncate">· /{item.slug}</span>
                </div>
                <p className="text-[15px] font-semibold text-text-main leading-tight truncate">{item.title}</p>
                {item.description && (
                  <p className="text-[13px] text-text-sub mt-0.5 truncate">{item.description}</p>
                )}
                {item.tags.length > 0 && (
                  <p className="text-[13px] text-text-light mt-0.5 truncate">
                    {item.tags.map((t) => `#${t}`).join(" ")}
                  </p>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                <Link
                  href={`/tips/${item.slug}`}
                  target="_blank"
                  className="w-8 h-8 flex items-center justify-center press text-text-sub"
                  aria-label="보기"
                >
                  <ExternalLink size={14} />
                </Link>
                <button
                  type="button"
                  onClick={() => handleEdit(item)}
                  className="w-8 h-8 flex items-center justify-center press text-text-sub"
                  aria-label="수정"
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(item)}
                  className="w-8 h-8 flex items-center justify-center press text-text-light"
                  aria-label="삭제"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </AdminSection>
    </AdminPage>
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
      className={`${inputCls} mb-3 disabled:cursor-not-allowed`}
      style={inputStyle}
    />
  );
}
