"use client";

// 약품 가이드 관리 (admin 전용) — 2026-09-16 「익숙한 동네앱」 리디자인:
// 카드 목록 → 구분선 리스트(썸네일 8px), 편집 폼 → 헤어라인 섹션, 장식색(항목 색 선택) 제거.
// color 필드는 기존 값 보존(새 항목은 primary 토큰) — 공개 페이지는 색을 쓰지 않는다.

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Save, X, Loader2, ImagePlus, Pill } from "lucide-react";
import { isCurrentUserAdmin } from "@/lib/news-repo";
import {
  listPharmacyGuideItems,
  createPharmacyGuideItem,
  updatePharmacyGuideItem,
  deletePharmacyGuideItem,
  uploadGuideImage,
  type PharmacyGuideItem,
  type PharmacyGuideInput,
} from "@/lib/pharmacy-guide-repo";
import UIButton from "@/app/components/ui/Button";
import {
  AdminForbidden, AdminHeader, AdminLoading, AdminPage, AdminSection, AdminTag, EmptyState, FieldLabel,
  HairlineButton, inputCls, inputStyle,
} from "../_ui";

const EMPTY: PharmacyGuideInput = {
  name: "", brand: null, category: "", color: "var(--color-primary)",
  image_url: null, description: "", usage_info: null, tip: null, price: null, sort_order: 0,
};

export default function AdminPharmacyGuidePage() {
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [items, setItems] = useState<PharmacyGuideItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PharmacyGuideInput>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([isCurrentUserAdmin(), listPharmacyGuideItems()])
      .then(([admin, list]) => { setIsAdmin(admin); setItems(list); })
      .finally(() => { setAuthChecked(true); setLoading(false); });
  }, []);

  const refresh = async () => { setItems(await listPharmacyGuideItems()); };

  const handleCreate = () => { setDraft(EMPTY); setEditingId("new"); setError(""); };
  const handleEdit = (item: PharmacyGuideItem) => {
    setDraft({
      name: item.name, brand: item.brand, category: item.category, color: item.color,
      image_url: item.image_url, description: item.description, usage_info: item.usage_info,
      tip: item.tip, price: item.price, sort_order: item.sort_order,
    });
    setEditingId(item.id);
    setError("");
  };
  const handleCancel = () => { setEditingId(null); setDraft(EMPTY); setError(""); };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true); setError("");
    try {
      const url = await uploadGuideImage(file);
      setDraft((d) => ({ ...d, image_url: url }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "이미지 업로드 실패");
    } finally { setUploading(false); }
  };

  const handleSave = async () => {
    if (!draft.name.trim() || !draft.category.trim() || !draft.description.trim()) {
      setError("제품명, 카테고리, 설명은 필수예요.");
      return;
    }
    setSaving(true); setError("");
    try {
      if (editingId === "new") await createPharmacyGuideItem(draft);
      else if (editingId) await updatePharmacyGuideItem(editingId, draft);
      await refresh();
      handleCancel();
    } catch (err) { setError(err instanceof Error ? err.message : "저장 실패"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (item: PharmacyGuideItem) => {
    if (!confirm(`"${item.name}" 삭제할까요?`)) return;
    try { await deletePharmacyGuideItem(item.id); await refresh(); }
    catch (err) { alert(err instanceof Error ? err.message : "삭제 실패"); }
  };

  if (!authChecked || loading) return <AdminLoading />;
  if (!isAdmin) return <AdminForbidden />;

  return (
    <AdminPage>
      <AdminHeader
        title="약품 가이드 관리"
        description="약품·영양제 정보를 추가·수정·삭제"
        back="/mypage"
        backLabel="마이페이지"
        right={
          <UIButton size="sm" onClick={handleCreate}>
            <Plus size={14} /> 추가
          </UIButton>
        }
      />

      {/* 편집 폼 */}
      {editingId && (
        <AdminSection
          title={editingId === "new" ? "새 약품 추가" : "약품 수정"}
          right={
            <button type="button" onClick={handleCancel} className="w-7 h-7 flex items-center justify-center text-text-light" aria-label="닫기">
              <X size={16} />
            </button>
          }
        >
          {/* 이미지 업로드 */}
          <FieldLabel>이미지</FieldLabel>
          <div className="mb-3">
            {draft.image_url ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={draft.image_url}
                  alt=""
                  className="w-full aspect-[16/9] object-cover"
                  style={{ borderRadius: "var(--radius-card-sm)", border: "1px solid var(--color-border)" }}
                />
                <button
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, image_url: null }))}
                  className="absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center"
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
                {uploading ? <Loader2 size={22} className="animate-spin mb-1" /> : <><ImagePlus size={24} className="mb-1" /><span className="text-[13px] font-semibold">이미지 선택</span></>}
                <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={handleImageSelect} />
              </label>
            )}
          </div>

          {/* 필드 */}
          <Field label="제품명 *" value={draft.name} onChange={(v) => setDraft((d) => ({ ...d, name: v }))} placeholder="예: 뉴트리플러스겔" />
          <Field label="브랜드" value={draft.brand ?? ""} onChange={(v) => setDraft((d) => ({ ...d, brand: v || null }))} placeholder="예: Virbac" />
          <Field label="카테고리 *" value={draft.category} onChange={(v) => setDraft((d) => ({ ...d, category: v }))} placeholder="예: 종합 영양제" />

          <FieldLabel>설명 *</FieldLabel>
          <textarea
            value={draft.description}
            onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            rows={4}
            placeholder="성분, 효능 등 상세 설명"
            className={`${inputCls} mb-3 resize-none`}
            style={inputStyle}
          />

          <Field label="사용법" value={draft.usage_info ?? ""} onChange={(v) => setDraft((d) => ({ ...d, usage_info: v || null }))} placeholder="투여 방법, 횟수" />
          <Field label="팁" value={draft.tip ?? ""} onChange={(v) => setDraft((d) => ({ ...d, tip: v || null }))} placeholder="주의사항이나 꿀팁" />
          <Field label="가격대" value={draft.price ?? ""} onChange={(v) => setDraft((d) => ({ ...d, price: v || null }))} placeholder="예: 15,000~20,000원" />
          <Field label="정렬 순서" value={String(draft.sort_order)} onChange={(v) => setDraft((d) => ({ ...d, sort_order: parseInt(v) || 0 }))} placeholder="0이 가장 위" />

          {error && <p className="text-[13px] mb-2" style={{ color: "var(--color-error)" }}>{error}</p>}

          <div className="flex gap-2 mt-1">
            <UIButton onClick={handleSave} disabled={saving || uploading} className="flex-1">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} 저장
            </UIButton>
            <UIButton variant="secondary" onClick={handleCancel} disabled={saving}>취소</UIButton>
          </div>
        </AdminSection>
      )}

      {/* 목록 */}
      <AdminSection title={`약품 ${items.length}개`} padding={false}>
        {items.length === 0 ? (
          <EmptyState>등록된 약품이 없어요.</EmptyState>
        ) : items.map((item) => (
          <div key={item.id} className="px-4 py-3 border-b border-divider last:border-b-0">
            <div className="flex items-center gap-3">
              {item.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.image_url}
                  alt=""
                  className="w-14 h-14 object-cover shrink-0"
                  style={{ borderRadius: "var(--radius-card-sm)", border: "1px solid var(--color-border)" }}
                />
              ) : (
                <div
                  className="w-14 h-14 shrink-0 flex items-center justify-center text-text-light"
                  style={{ background: "var(--color-surface-alt)", borderRadius: "var(--radius-card-sm)" }}
                >
                  <Pill size={20} strokeWidth={1.8} />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <AdminTag>{item.category}</AdminTag>
                  {item.brand && <span className="text-[11px] text-text-light">{item.brand}</span>}
                </div>
                <p className="text-[15px] font-semibold text-text-main leading-tight truncate">{item.name}</p>
                {item.price && <p className="text-[13px] text-text-sub mt-0.5 tabular-nums">{item.price}</p>}
              </div>
              <div className="flex gap-1 shrink-0">
                <HairlineButton onClick={() => handleEdit(item)} icon={<Pencil size={12} />}>수정</HairlineButton>
                <HairlineButton tone="error" onClick={() => handleDelete(item)} icon={<Trash2 size={12} />}>삭제</HairlineButton>
              </div>
            </div>
          </div>
        ))}
      </AdminSection>
    </AdminPage>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="mb-3">
      <FieldLabel>{label}</FieldLabel>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={inputCls}
        style={inputStyle}
      />
    </div>
  );
}
