"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Pencil, Trash2, Save, X, Loader2, Shield, ImagePlus } from "lucide-react";
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

const COLORS = [
  { label: "갈색", value: "#C47E5A" },
  { label: "초록", value: "#6B8E6F" },
  { label: "빨강", value: "#D85555" },
  { label: "파랑", value: "#4A7BA8" },
  { label: "보라", value: "#8B65B8" },
  { label: "주황", value: "#E88D5A" },
  { label: "민트", value: "#48A59E" },
  { label: "골드", value: "#C9A961" },
];

const EMPTY: PharmacyGuideInput = {
  name: "", brand: null, category: "", color: "#C47E5A",
  image_url: null, description: "", usage_info: null, tip: null, price: null, sort_order: 0,
};

export default function AdminPharmacyGuidePage() {
  const router = useRouter();
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

  if (!authChecked || loading) return <div className="flex justify-center pt-20"><Loader2 size={28} className="animate-spin text-primary" /></div>;
  if (!isAdmin) return (
    <div className="px-5 pt-20 text-center">
      <Shield size={40} className="mx-auto text-text-light mb-3" strokeWidth={1.5} />
      <p className="text-[14px] font-bold text-text-main mb-1">관리자 전용 페이지예요</p>
      <Link href="/mypage" className="text-[13px] font-bold text-primary mt-4 inline-block">마이페이지로 돌아가기</Link>
    </div>
  );

  return (
    <div className="px-4 pt-14 pb-24">
      {/* 헤더 */}
      <div className="mb-5">
        <button onClick={() => router.push("/mypage")} className="flex items-center gap-1 text-[12px] font-semibold text-text-sub mb-3 active:scale-95 transition-transform">
          <ArrowLeft size={14} /> 마이페이지
        </button>
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-[22px] font-extrabold text-text-main tracking-tight">약품 가이드 관리</h1>
            <p className="text-[12px] text-text-sub">약품·영양제 정보를 추가·수정·삭제</p>
          </div>
          <button onClick={handleCreate} className="w-11 h-11 rounded-2xl bg-primary flex items-center justify-center active:scale-95 transition-transform" style={{ boxShadow: "0 6px 14px rgba(196,126,90,0.35)" }}>
            <Plus size={20} color="#fff" strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* 편집 폼 */}
      {editingId && (
        <div className="mb-5 p-4" style={{ background: "#FFFFFF", borderRadius: 20, boxShadow: "0 8px 24px rgba(196,126,90,0.14)", border: "1.5px solid rgba(196,126,90,0.2)" }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[14px] font-extrabold text-text-main">{editingId === "new" ? "새 약품 추가" : "약품 수정"}</h2>
            <button onClick={handleCancel} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#EEE8E0" }}>
              <X size={13} style={{ color: "#A38E7A" }} strokeWidth={3} />
            </button>
          </div>

          {/* 이미지 업로드 */}
          <label className="block text-[11px] font-bold text-text-sub mb-1 mt-2">이미지</label>
          <div className="mb-3">
            {draft.image_url ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={draft.image_url} alt="" className="w-full aspect-[16/9] rounded-xl object-cover" style={{ border: "1px solid #E3DCD3" }} />
                <button type="button" onClick={() => setDraft((d) => ({ ...d, image_url: null }))} className="absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.6)", color: "#fff" }}>
                  <X size={16} strokeWidth={3} />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center aspect-[16/9] rounded-xl cursor-pointer" style={{ backgroundColor: "#F6F1EA", border: "1.5px dashed #C9BDAA", color: "#A38E7A" }}>
                {uploading ? <Loader2 size={22} className="animate-spin mb-1" /> : <><ImagePlus size={24} className="mb-1" /><span className="text-[12px] font-semibold">이미지 선택</span></>}
                <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={handleImageSelect} />
              </label>
            )}
          </div>

          {/* 필드 */}
          <Field label="제품명 *" value={draft.name} onChange={(v) => setDraft((d) => ({ ...d, name: v }))} placeholder="예: 뉴트리플러스겔" />
          <Field label="브랜드" value={draft.brand ?? ""} onChange={(v) => setDraft((d) => ({ ...d, brand: v || null }))} placeholder="예: Virbac" />
          <Field label="카테고리 *" value={draft.category} onChange={(v) => setDraft((d) => ({ ...d, category: v }))} placeholder="예: 종합 영양제" />

          <label className="block text-[11px] font-bold text-text-sub mb-1 mt-2">색상</label>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {COLORS.map((c) => (
              <button key={c.value} onClick={() => setDraft((d) => ({ ...d, color: c.value }))}
                className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all"
                style={{ backgroundColor: draft.color === c.value ? c.value : `${c.value}18`, color: draft.color === c.value ? "#fff" : c.value }}>
                {c.label}
              </button>
            ))}
          </div>

          <label className="block text-[11px] font-bold text-text-sub mb-1 mt-2">설명 *</label>
          <textarea value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} rows={4} placeholder="성분, 효능 등 상세 설명" className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none mb-1 resize-none" style={{ backgroundColor: "#F6F1EA", border: "1px solid #E3DCD3" }} />

          <Field label="사용법" value={draft.usage_info ?? ""} onChange={(v) => setDraft((d) => ({ ...d, usage_info: v || null }))} placeholder="투여 방법, 횟수" />
          <Field label="💡 팁" value={draft.tip ?? ""} onChange={(v) => setDraft((d) => ({ ...d, tip: v || null }))} placeholder="주의사항이나 꿀팁" />
          <Field label="가격대" value={draft.price ?? ""} onChange={(v) => setDraft((d) => ({ ...d, price: v || null }))} placeholder="예: 15,000~20,000원" />
          <Field label="정렬 순서" value={String(draft.sort_order)} onChange={(v) => setDraft((d) => ({ ...d, sort_order: parseInt(v) || 0 }))} placeholder="0이 가장 위" />

          {error && <p className="text-[11px] mb-2" style={{ color: "#B84545" }}>{error}</p>}

          <div className="flex gap-2 mt-3">
            <button onClick={handleSave} disabled={saving || uploading} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-primary text-white text-[13px] font-bold disabled:opacity-40 active:scale-[0.97] transition-all">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} 저장
            </button>
            <button onClick={handleCancel} disabled={saving} className="px-5 py-2.5 rounded-xl text-[13px] font-bold" style={{ backgroundColor: "#EEE8E0", color: "#A38E7A" }}>취소</button>
          </div>
        </div>
      )}

      {/* 목록 */}
      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="card p-6 text-center text-[13px] text-text-sub">등록된 약품이 없어요.</div>
        ) : items.map((item) => (
          <div key={item.id} className="p-4" style={{ background: "#FFFFFF", borderRadius: 18, boxShadow: "0 4px 14px rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.04)" }}>
            <div className="flex items-start gap-3">
              {item.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.image_url} alt="" className="w-16 h-16 rounded-xl object-cover shrink-0" />
              ) : (
                <div className="w-16 h-16 rounded-xl shrink-0 flex items-center justify-center" style={{ background: `${item.color}18` }}>
                  <span className="text-[10px] font-bold" style={{ color: item.color }}>{item.category}</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md" style={{ color: "#fff", backgroundColor: item.color }}>{item.category}</span>
                  {item.brand && <span className="text-[10px] text-text-light">{item.brand}</span>}
                </div>
                <p className="text-[14px] font-extrabold text-text-main leading-tight truncate">{item.name}</p>
                {item.price && <p className="text-[11px] mt-0.5" style={{ color: item.color }}>{item.price}</p>}
              </div>
            </div>
            <div className="flex gap-1.5 mt-3 pt-3 border-t border-divider">
              <button onClick={() => handleEdit(item)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-bold" style={{ backgroundColor: "#EEE8E0", color: "#C47E5A" }}>
                <Pencil size={12} /> 수정
              </button>
              <button onClick={() => handleDelete(item)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-bold" style={{ backgroundColor: "#FBEAEA", color: "#D85555" }}>
                <Trash2 size={12} /> 삭제
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <>
      <label className="block text-[11px] font-bold text-text-sub mb-1 mt-2">{label}</label>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-3 py-2 rounded-xl text-[13px] outline-none mb-1" style={{ backgroundColor: "#F6F1EA", border: "1px solid #E3DCD3" }} />
    </>
  );
}
