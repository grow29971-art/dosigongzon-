"use client";

// 상품 관리 (admin 전용) — 2026-09-16 「익숙한 동네앱」 리디자인:
// 카드 목록 → 구분선 리스트(상품 썸네일 8px), 편집 폼 헤어라인 섹션, 카테고리·배지 칩, 상태 회색 태그(중지=error). 토큰만.

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  Plus, Pencil, Save, X, Loader2, ImagePlus, ShoppingBag,
} from "lucide-react";
import { isCurrentUserAdmin } from "@/lib/news-repo";
import { CATEGORY_MAP, type Product, type ProductBadge, type ProductCategory } from "@/lib/shop-repo";
import {
  listAllProducts, createProduct, updateProduct, setProductActive,
  uploadProductImage, getProductCosts, setProductCost,
  MAX_PRODUCT_IMAGES, type ProductInput,
} from "@/lib/shop-admin-repo";
import UIButton from "@/app/components/ui/Button";
import UIChip from "@/app/components/ui/Chip";
import {
  AdminForbidden, AdminHeader, AdminLoading, AdminPage, AdminSection, AdminTag, EmptyState, FieldLabel,
  inputCls, inputStyle,
} from "../_ui";

const CATEGORIES = Object.keys(CATEGORY_MAP) as ProductCategory[];
const BADGES: ProductBadge[] = ["신상", "인기", "한정"];

const EMPTY_DRAFT: ProductInput = {
  name: "",
  description: null,
  price: 0,
  sale_price: null,
  category: "shelter",
  images: [],
  stock: 0,
  is_active: true,
  shipping_fee: 0,
  badge: null,
  is_donation: false,
  donation_percent: 10,
  weight: null,
  is_virtual: false,
  supplier: null,
};

function formatWon(amount: number): string {
  return `${amount.toLocaleString()}원`;
}

export default function AdminProductsPage() {
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingId, setEditingId] = useState<string | null>(null); // 'new' | product id
  const [draft, setDraft] = useState<ProductInput>(EMPTY_DRAFT);
  // 매입가 — products가 아닌 관리자 전용 product_costs 테이블 (이익 기준 후원 적립의 원천값)
  const [costs, setCosts] = useState<Map<string, number>>(new Map());
  const [draftCost, setDraftCost] = useState(0);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    isCurrentUserAdmin()
      .then(async (admin) => {
        if (cancelled) return;
        setIsAdmin(admin);
        if (admin) {
          setItems(await listAllProducts());
          setCosts(await getProductCosts());
        }
      })
      .finally(() => {
        if (cancelled) return;
        setAuthChecked(true);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const refresh = async () => {
    setItems(await listAllProducts());
    setCosts(await getProductCosts());
  };

  const handleCreate = () => {
    setDraft(EMPTY_DRAFT);
    setDraftCost(0);
    setEditingId("new");
    setError("");
  };

  const handleEdit = (p: Product) => {
    setDraft({
      name: p.name,
      description: p.description,
      price: p.price,
      sale_price: p.sale_price,
      category: p.category,
      images: p.images,
      stock: p.stock,
      is_active: p.is_active,
      shipping_fee: p.shipping_fee,
      badge: p.badge,
      is_donation: p.is_donation,
      donation_percent: p.donation_percent,
      weight: p.weight,
      is_virtual: p.is_virtual,
      supplier: p.supplier ?? null,
    });
    setDraftCost(costs.get(p.id) ?? 0);
    setEditingId(p.id);
    setError("");
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      let productId = editingId;
      if (editingId === "new") productId = (await createProduct(draft)).id;
      else if (editingId) await updateProduct(editingId, draft);
      // 매입가는 별도 테이블 — 값이 있거나 기존 값과 달라졌을 때만 저장
      if (productId && productId !== "new" && draftCost !== (costs.get(productId) ?? 0)) {
        await setProductCost(productId, draftCost);
      }
      await refresh();
      setEditingId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장에 실패했어요.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (p: Product) => {
    try {
      await setProductActive(p.id, !p.is_active);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "상태 변경에 실패했어요.");
    }
  };

  const handleImageUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const remain = MAX_PRODUCT_IMAGES - draft.images.length;
    if (remain <= 0) { setError(`이미지는 최대 ${MAX_PRODUCT_IMAGES}장까지 가능해요.`); return; }
    setUploading(true);
    setError("");
    try {
      const targets = Array.from(files).slice(0, remain);
      const urls: string[] = [];
      for (const f of targets) urls.push(await uploadProductImage(f));
      setDraft((d) => ({ ...d, images: [...d.images, ...urls] }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "이미지 업로드에 실패했어요.");
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (idx: number) => {
    setDraft((d) => ({ ...d, images: d.images.filter((_, i) => i !== idx) }));
  };

  if (!authChecked || loading) return <AdminLoading />;
  if (!isAdmin) return <AdminForbidden />;

  const numCls = `${inputCls} tabular-nums`;

  return (
    <AdminPage>
      <AdminHeader
        title="상품 관리"
        description="쇼핑몰 상품 등록·수정·재고"
        right={
          <UIButton size="sm" onClick={handleCreate}>
            <Plus size={14} /> 상품 등록
          </UIButton>
        }
      />

      {/* 편집 폼 */}
      {editingId && (
        <AdminSection
          title={editingId === "new" ? "새 상품 등록" : "상품 수정"}
          right={
            <button type="button" onClick={() => setEditingId(null)} className="w-7 h-7 flex items-center justify-center text-text-light" aria-label="닫기">
              <X size={16} />
            </button>
          }
        >
          <div className="space-y-3">
            <input
              type="text"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="상품명"
              className={inputCls}
              style={inputStyle}
              maxLength={80}
            />
            <textarea
              value={draft.description ?? ""}
              onChange={(e) => setDraft({ ...draft, description: e.target.value || null })}
              placeholder="상품 설명 (줄바꿈 지원)"
              className={`${inputCls} resize-none`}
              style={{ ...inputStyle, minHeight: 90 }}
            />
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <FieldLabel>가격 (원)</FieldLabel>
                <input
                  type="number"
                  value={draft.price}
                  onChange={(e) => setDraft({ ...draft, price: Math.max(0, parseInt(e.target.value) || 0) })}
                  className={numCls}
                  style={inputStyle}
                  min={0}
                />
              </label>
              <label className="block">
                <FieldLabel>할인가 (선택)</FieldLabel>
                <input
                  type="number"
                  value={draft.sale_price ?? ""}
                  onChange={(e) => setDraft({ ...draft, sale_price: e.target.value === "" ? null : Math.max(0, parseInt(e.target.value) || 0) })}
                  placeholder="없음"
                  className={numCls}
                  style={inputStyle}
                  min={0}
                />
              </label>
              <label className="block">
                <FieldLabel>재고</FieldLabel>
                <input
                  type="number"
                  value={draft.stock}
                  onChange={(e) => setDraft({ ...draft, stock: Math.max(0, parseInt(e.target.value) || 0) })}
                  className={numCls}
                  style={inputStyle}
                  min={0}
                />
              </label>
              <label className="block">
                <FieldLabel>배송비 (0=무료)</FieldLabel>
                <input
                  type="number"
                  value={draft.shipping_fee}
                  onChange={(e) => setDraft({ ...draft, shipping_fee: Math.max(0, parseInt(e.target.value) || 0) })}
                  className={numCls}
                  style={inputStyle}
                  min={0}
                />
              </label>
            </div>

            {/* 카테고리 */}
            <div>
              <FieldLabel>카테고리</FieldLabel>
              <div className="flex items-center gap-1.5 flex-wrap">
                {CATEGORIES.map((c) => (
                  <UIChip key={c} active={draft.category === c} onClick={() => setDraft({ ...draft, category: c })}>
                    {CATEGORY_MAP[c].label}
                  </UIChip>
                ))}
              </div>
            </div>

            {/* 배지 */}
            <div>
              <FieldLabel>배지</FieldLabel>
              <div className="flex items-center gap-1.5 flex-wrap">
                <UIChip active={draft.badge === null} onClick={() => setDraft({ ...draft, badge: null })}>없음</UIChip>
                {BADGES.map((b) => (
                  <UIChip key={b} active={draft.badge === b} onClick={() => setDraft({ ...draft, badge: b })}>
                    {b}
                  </UIChip>
                ))}
              </div>
            </div>

            {/* 후원 연계 / 가상상품 */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.is_donation}
                  onChange={(e) => setDraft({ ...draft, is_donation: e.target.checked })}
                  className="w-4 h-4 accent-primary"
                />
                <span className="text-[13px] font-semibold text-text-main">후원 연계</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.is_virtual}
                  onChange={(e) => setDraft({
                    ...draft,
                    is_virtual: e.target.checked,
                    shipping_fee: e.target.checked ? 0 : draft.shipping_fee,
                  })}
                  className="w-4 h-4 accent-primary"
                />
                <span className="text-[13px] font-semibold text-text-main">가상상품 (배송 없음)</span>
              </label>
            </div>
            {draft.is_donation && (
              <label className="block">
                <FieldLabel>후원 비율 (%) — 판매액 중 후원으로 적립되는 비율</FieldLabel>
                <input
                  type="number"
                  value={draft.donation_percent}
                  onChange={(e) => setDraft({ ...draft, donation_percent: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) })}
                  className={numCls}
                  style={inputStyle}
                  min={0}
                  max={100}
                />
              </label>
            )}

            {/* 무게 / 도매처 메모 */}
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <FieldLabel>무게/규격 (선택)</FieldLabel>
                <input
                  type="text"
                  value={draft.weight ?? ""}
                  onChange={(e) => setDraft({ ...draft, weight: e.target.value || null })}
                  placeholder="예: 2kg, 40×30cm"
                  className={inputCls}
                  style={inputStyle}
                  maxLength={30}
                />
              </label>
              <label className="block">
                <FieldLabel>도매처 메모 (관리자만 봄)</FieldLabel>
                <input
                  type="text"
                  value={draft.supplier ?? ""}
                  onChange={(e) => setDraft({ ...draft, supplier: e.target.value || null })}
                  placeholder="예: ○○상사 010-…"
                  className={inputCls}
                  style={inputStyle}
                  maxLength={100}
                />
              </label>
              <label className="block col-span-2">
                <FieldLabel>매입가 (원, 관리자만 봄)</FieldLabel>
                <input
                  type="number"
                  value={draftCost}
                  onChange={(e) => setDraftCost(Math.max(0, parseInt(e.target.value) || 0))}
                  className={numCls}
                  style={inputStyle}
                  min={0}
                />
                <span className="block text-[11px] text-text-light mt-1">
                  후원 적립 = (판매가−매입가)의 {draft.donation_percent}% — 0이면 판매액 전체가 이익으로 계산돼요
                </span>
              </label>
            </div>

            {/* 이미지 업로드 */}
            <div>
              <FieldLabel>상품 이미지 ({draft.images.length}/{MAX_PRODUCT_IMAGES})</FieldLabel>
              <div className="flex items-center gap-2 flex-wrap">
                {draft.images.map((url, i) => (
                  <div
                    key={url}
                    className="relative overflow-hidden"
                    style={{ width: 64, height: 64, borderRadius: "var(--radius-card-sm)", border: "1px solid var(--color-border)" }}
                  >
                    <Image src={url} alt="" fill className="object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ background: "rgba(0,0,0,0.55)", color: "var(--color-surface)" }}
                      aria-label="이미지 삭제"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
                {draft.images.length < MAX_PRODUCT_IMAGES && (
                  <label
                    className="flex items-center justify-center cursor-pointer text-text-light"
                    style={{ width: 64, height: 64, background: "var(--color-surface-alt)", border: "1px dashed var(--color-gray-300)", borderRadius: "var(--radius-card-sm)" }}
                  >
                    {uploading ? <Loader2 size={18} className="animate-spin" /> : <ImagePlus size={18} />}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      disabled={uploading}
                      onChange={(e) => { handleImageUpload(e.target.files); e.target.value = ""; }}
                    />
                  </label>
                )}
              </div>
            </div>

            {/* 판매 활성화 */}
            <label className="flex items-center gap-2 pt-1 cursor-pointer">
              <input
                type="checkbox"
                checked={draft.is_active}
                onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })}
                className="w-4 h-4 accent-primary"
              />
              <span className="text-[13px] font-semibold text-text-main">판매 활성화</span>
            </label>

            {error && <p className="text-[13px] font-semibold" style={{ color: "var(--color-error)" }}>{error}</p>}

            <UIButton size="lg" full onClick={handleSave} disabled={saving || uploading}>
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              {editingId === "new" ? "등록하기" : "수정 저장"}
            </UIButton>
          </div>
        </AdminSection>
      )}

      {!editingId && error && (
        <p className="text-[13px] font-semibold mb-3" style={{ color: "var(--color-error)" }}>{error}</p>
      )}

      {/* 상품 목록 */}
      <AdminSection title={`상품 ${items.length}개`} padding={false}>
        {items.length === 0 ? (
          <EmptyState>등록된 상품이 없어요. 첫 상품을 등록해보세요.</EmptyState>
        ) : (
          items.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-3 px-4 py-3 border-b border-divider last:border-b-0"
              style={{ opacity: p.is_active ? 1 : 0.55 }}
            >
              <div
                className="relative shrink-0 overflow-hidden flex items-center justify-center text-text-light"
                style={{ width: 52, height: 52, background: "var(--color-surface-alt)", borderRadius: "var(--radius-card-sm)", border: "1px solid var(--color-border)" }}
              >
                {p.images[0] ? <Image src={p.images[0]} alt="" fill className="object-cover" /> : <ShoppingBag size={18} strokeWidth={1.8} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-semibold text-text-main truncate">{p.name}</p>
                <p className="text-[13px] text-text-sub mt-0.5 tabular-nums">
                  {formatWon(p.sale_price ?? p.price)}
                  {p.sale_price != null && <span className="line-through ml-1 text-text-light">{formatWon(p.price)}</span>}
                  {" · "}재고 {p.stock} · {CATEGORY_MAP[p.category].label}
                  {p.is_donation ? ` · 후원 ${p.donation_percent}%` : ""}
                  {p.is_virtual ? " · 가상" : ""}
                  {(costs.get(p.id) ?? 0) > 0 ? ` · 매입 ${formatWon(costs.get(p.id)!)}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button type="button" onClick={() => handleToggleActive(p)} className="press" aria-label={p.is_active ? "판매 중지" : "판매 재개"}>
                  <AdminTag tone={p.is_active ? "sage" : "error"}>{p.is_active ? "판매중" : "중지됨"}</AdminTag>
                </button>
                <button
                  type="button"
                  onClick={() => handleEdit(p)}
                  className="w-8 h-8 flex items-center justify-center press text-text-sub"
                  aria-label="수정"
                >
                  <Pencil size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </AdminSection>
    </AdminPage>
  );
}
