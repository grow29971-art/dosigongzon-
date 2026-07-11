"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  ArrowLeft, Plus, Pencil, Save, X, Loader2, Shield, ImagePlus, Trash2,
} from "lucide-react";
import { isCurrentUserAdmin } from "@/lib/news-repo";
import { CATEGORY_MAP, type Product, type ProductCategory } from "@/lib/shop-repo";
import {
  listAllProducts, createProduct, updateProduct, setProductActive,
  uploadProductImage, MAX_PRODUCT_IMAGES, type ProductInput,
} from "@/lib/shop-admin-repo";

const CATEGORIES = Object.keys(CATEGORY_MAP) as ProductCategory[];

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
};

function formatWon(amount: number): string {
  return `${amount.toLocaleString()}원`;
}

export default function AdminProductsPage() {
  const router = useRouter();

  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingId, setEditingId] = useState<string | null>(null); // 'new' | product id
  const [draft, setDraft] = useState<ProductInput>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    isCurrentUserAdmin()
      .then(async (admin) => {
        if (cancelled) return;
        setIsAdmin(admin);
        if (admin) setItems(await listAllProducts());
      })
      .finally(() => {
        if (cancelled) return;
        setAuthChecked(true);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const refresh = async () => setItems(await listAllProducts());

  const handleCreate = () => {
    setDraft(EMPTY_DRAFT);
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
    });
    setEditingId(p.id);
    setError("");
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      if (editingId === "new") await createProduct(draft);
      else if (editingId) await updateProduct(editingId, draft);
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
        <Shield size={40} className="mx-auto text-text-light mb-3" strokeWidth={1.5} />
        <p className="text-[14px] font-bold text-text-main mb-1">관리자 전용 페이지예요</p>
        <Link href="/mypage" className="inline-block mt-4 text-[13px] font-bold text-primary">
          마이페이지로 돌아가기
        </Link>
      </div>
    );
  }

  const inputStyle = {
    background: "var(--color-warm-white)",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.05)",
  } as const;

  return (
    <div className="px-4 pt-12 pb-24">
      <div className="flex items-center gap-2 mb-5">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 rounded-full bg-white flex items-center justify-center active:scale-90"
          style={{ boxShadow: "var(--shadow-raised)" }}
          aria-label="뒤로 가기"
        >
          <ArrowLeft size={18} className="text-text-main" />
        </button>
        <h1 className="text-[17px] font-extrabold text-text-main">상품 관리</h1>
        <button
          onClick={handleCreate}
          className="ml-auto flex items-center gap-1 px-3 py-2 rounded-2xl bg-primary text-white text-[12px] font-extrabold active:scale-95 transition-transform"
        >
          <Plus size={14} strokeWidth={3} /> 상품 등록
        </button>
      </div>

      {/* 편집 폼 */}
      {editingId && (
        <div
          className="mb-5 p-4"
          style={{ background: "#fff", borderRadius: "var(--radius-card)", boxShadow: "0 6px 20px rgba(0,0,0,0.08)", border: "1.5px solid rgba(49,130,246,0.3)" }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[13.5px] font-extrabold text-text-main">
              {editingId === "new" ? "새 상품 등록" : "상품 수정"}
            </span>
            <button onClick={() => setEditingId(null)} aria-label="닫기">
              <X size={18} className="text-text-sub" />
            </button>
          </div>

          <div className="space-y-2.5">
            <input
              type="text"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="상품명"
              className="w-full px-3 py-2.5 text-[13px] outline-none"
              style={inputStyle}
              maxLength={80}
            />
            <textarea
              value={draft.description ?? ""}
              onChange={(e) => setDraft({ ...draft, description: e.target.value || null })}
              placeholder="상품 설명 (줄바꿈 지원)"
              className="w-full px-3 py-2.5 text-[13px] outline-none resize-none"
              style={{ ...inputStyle, minHeight: 90 }}
            />
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-[11px] font-bold text-text-sub">가격 (원)</span>
                <input
                  type="number"
                  value={draft.price}
                  onChange={(e) => setDraft({ ...draft, price: Math.max(0, parseInt(e.target.value) || 0) })}
                  className="w-full px-3 py-2.5 text-[13px] outline-none mt-1"
                  style={inputStyle}
                  min={0}
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-bold text-text-sub">할인가 (선택)</span>
                <input
                  type="number"
                  value={draft.sale_price ?? ""}
                  onChange={(e) => setDraft({ ...draft, sale_price: e.target.value === "" ? null : Math.max(0, parseInt(e.target.value) || 0) })}
                  placeholder="없음"
                  className="w-full px-3 py-2.5 text-[13px] outline-none mt-1"
                  style={inputStyle}
                  min={0}
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-bold text-text-sub">재고</span>
                <input
                  type="number"
                  value={draft.stock}
                  onChange={(e) => setDraft({ ...draft, stock: Math.max(0, parseInt(e.target.value) || 0) })}
                  className="w-full px-3 py-2.5 text-[13px] outline-none mt-1"
                  style={inputStyle}
                  min={0}
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-bold text-text-sub">배송비 (0=무료)</span>
                <input
                  type="number"
                  value={draft.shipping_fee}
                  onChange={(e) => setDraft({ ...draft, shipping_fee: Math.max(0, parseInt(e.target.value) || 0) })}
                  className="w-full px-3 py-2.5 text-[13px] outline-none mt-1"
                  style={inputStyle}
                  min={0}
                />
              </label>
            </div>

            {/* 카테고리 */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setDraft({ ...draft, category: c })}
                  className="px-3 py-1.5 rounded-xl text-[11.5px] font-bold"
                  style={{
                    background: draft.category === c ? "var(--color-primary)" : "var(--color-warm-white)",
                    color: draft.category === c ? "#fff" : "var(--color-text-sub)",
                  }}
                >
                  {CATEGORY_MAP[c].label}
                </button>
              ))}
            </div>

            {/* 이미지 업로드 */}
            <div>
              <span className="text-[11px] font-bold text-text-sub">
                상품 이미지 ({draft.images.length}/{MAX_PRODUCT_IMAGES})
              </span>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {draft.images.map((url, i) => (
                  <div key={url} className="relative rounded-xl overflow-hidden" style={{ width: 64, height: 64 }}>
                    <Image src={url} alt="" fill className="object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ background: "rgba(0,0,0,0.55)" }}
                      aria-label="이미지 삭제"
                    >
                      <X size={12} color="#fff" />
                    </button>
                  </div>
                ))}
                {draft.images.length < MAX_PRODUCT_IMAGES && (
                  <label
                    className="flex items-center justify-center rounded-xl cursor-pointer"
                    style={{ width: 64, height: 64, background: "var(--color-warm-white)", border: "1.5px dashed rgba(0,0,0,0.15)" }}
                  >
                    {uploading
                      ? <Loader2 size={18} className="animate-spin text-text-light" />
                      : <ImagePlus size={18} className="text-text-light" />}
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
            <label className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                checked={draft.is_active}
                onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })}
              />
              <span className="text-[12.5px] font-bold text-text-main">판매 활성화</span>
            </label>

            {error && <p className="text-[12px] font-bold" style={{ color: "#D85555" }}>{error}</p>}

            <button
              onClick={handleSave}
              disabled={saving || uploading}
              className="w-full py-3 rounded-2xl bg-primary text-white text-[13.5px] font-extrabold disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              {editingId === "new" ? "등록하기" : "수정 저장"}
            </button>
          </div>
        </div>
      )}

      {!editingId && error && (
        <p className="text-[12px] font-bold mb-3" style={{ color: "#D85555" }}>{error}</p>
      )}

      {/* 상품 목록 */}
      {items.length === 0 ? (
        <p className="text-center text-[13px] text-text-sub pt-10">등록된 상품이 없어요. 첫 상품을 등록해보세요!</p>
      ) : (
        <div className="space-y-2">
          {items.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-3 p-3"
              style={{ background: "#fff", borderRadius: "var(--radius-card-sm)", boxShadow: "var(--shadow-card)", border: "1px solid rgba(0,0,0,0.04)", opacity: p.is_active ? 1 : 0.55 }}
            >
              <div className="relative shrink-0 rounded-xl overflow-hidden" style={{ width: 52, height: 52, background: "var(--color-warm-white)" }}>
                {p.images[0] && <Image src={p.images[0]} alt="" fill className="object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-text-main truncate">{p.name}</p>
                <p className="text-[11.5px] text-text-sub mt-0.5">
                  {formatWon(p.sale_price ?? p.price)}
                  {p.sale_price != null && <span className="line-through ml-1 text-text-light">{formatWon(p.price)}</span>}
                  {" · "}재고 {p.stock} · {CATEGORY_MAP[p.category].label}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => handleToggleActive(p)}
                  className="px-2 py-1 rounded-lg text-[10px] font-extrabold"
                  style={{
                    background: p.is_active ? "rgba(107,142,111,0.12)" : "rgba(216,85,85,0.1)",
                    color: p.is_active ? "#6B8E6F" : "#D85555",
                  }}
                >
                  {p.is_active ? "판매중" : "중지됨"}
                </button>
                <button
                  onClick={() => handleEdit(p)}
                  className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: "var(--color-warm-white)" }}
                  aria-label="수정"
                >
                  <Pencil size={14} className="text-text-sub" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
