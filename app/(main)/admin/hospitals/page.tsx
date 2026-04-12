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
  Shield,
  Pin,
  MapPin,
  Phone,
  Clock,
  Stethoscope,
} from "lucide-react";
import { isCurrentUserAdmin } from "@/lib/news-repo";
import {
  listRescueHospitals,
  createRescueHospital,
  updateRescueHospital,
  deleteRescueHospital,
  groupByCityDistrict,
  type RescueHospital,
  type RescueHospitalInput,
} from "@/lib/hospitals-repo";

const EMPTY: RescueHospitalInput = {
  name: "",
  city: "",
  district: "",
  address: null,
  phone: null,
  hours: null,
  note: null,
  tags: [],
  pinned: false,
  lat: null,
  lng: null,
};

export default function AdminHospitalsPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [items, setItems] = useState<RescueHospital[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<RescueHospitalInput>(EMPTY);
  const [tagsInput, setTagsInput] = useState(""); // 쉼표 구분 입력용
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([isCurrentUserAdmin(), listRescueHospitals()])
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
    const list = await listRescueHospitals();
    setItems(list);
  };

  const handleCreate = () => {
    setDraft(EMPTY);
    setTagsInput("");
    setEditingId("new");
    setError("");
  };

  const handleEdit = (item: RescueHospital) => {
    setDraft({
      name: item.name,
      city: item.city,
      district: item.district,
      address: item.address,
      phone: item.phone,
      hours: item.hours,
      note: item.note,
      tags: item.tags,
      pinned: item.pinned,
      lat: item.lat,
      lng: item.lng,
    });
    setTagsInput(item.tags.join(", "));
    setEditingId(item.id);
    setError("");
  };

  const handleCancel = () => {
    setEditingId(null);
    setDraft(EMPTY);
    setTagsInput("");
    setError("");
  };

  const handleSave = async () => {
    if (!draft.name.trim() || !draft.city.trim() || !draft.district.trim()) {
      setError("병원명, 시/도, 시/군/구는 필수예요.");
      return;
    }
    setSaving(true);
    setError("");
    // 쉼표 구분 태그 파싱
    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const payload: RescueHospitalInput = { ...draft, tags };

    try {
      if (editingId === "new") {
        await createRescueHospital(payload);
      } else if (editingId) {
        await updateRescueHospital(editingId, payload);
      }
      await refresh();
      handleCancel();
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: RescueHospital) => {
    if (!confirm(`"${item.name}" 을(를) 삭제할까요?`)) return;
    try {
      await deleteRescueHospital(item.id);
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
        <Shield size={40} className="mx-auto text-text-light mb-3" strokeWidth={1.5} />
        <p className="text-[14px] font-bold text-text-main mb-1">
          관리자 전용 페이지예요
        </p>
        <Link
          href="/mypage"
          className="inline-block mt-4 text-[13px] font-bold text-primary"
        >
          마이페이지로 돌아가기
        </Link>
      </div>
    );
  }

  const groups = groupByCityDistrict(items);

  return (
    <div className="px-4 pt-14 pb-24">
      {/* 헤더 */}
      <div className="mb-5">
        <button
          onClick={() => router.push("/mypage")}
          className="flex items-center gap-1 text-[12px] font-semibold text-text-sub mb-3 active:scale-95 transition-transform"
        >
          <ArrowLeft size={14} />
          마이페이지
        </button>
        <div className="flex items-end justify-between">
          <div>
            <div className="flex items-baseline gap-2 mb-1">
              <h1 className="text-[22px] font-extrabold text-text-main tracking-tight">
                병원 관리
              </h1>
              <span className="text-[10px] font-semibold text-text-light">
                Admin · Hospitals
              </span>
            </div>
            <p className="text-[12px] text-text-sub">
              구조동물 치료 도움병원을 추가·수정·삭제할 수 있어요
            </p>
          </div>
          <button
            onClick={handleCreate}
            className="w-11 h-11 rounded-2xl bg-primary flex items-center justify-center active:scale-95 transition-transform"
            style={{ boxShadow: "0 6px 14px rgba(196,126,90,0.35)" }}
            aria-label="새 병원 추가"
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
            borderRadius: 20,
            boxShadow: "0 8px 24px rgba(196,126,90,0.14), 0 1px 3px rgba(0,0,0,0.03)",
            border: "1.5px solid rgba(196,126,90,0.2)",
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[14px] font-extrabold text-text-main">
              {editingId === "new" ? "새 병원 추가" : "병원 수정"}
            </h2>
            <button
              onClick={handleCancel}
              className="w-7 h-7 rounded-lg flex items-center justify-center active:scale-90"
              style={{ backgroundColor: "#EEE8E0" }}
            >
              <X size={13} style={{ color: "#A38E7A" }} strokeWidth={3} />
            </button>
          </div>

          <Label required>병원명</Label>
          <Input
            value={draft.name}
            onChange={(v) => setDraft((d) => ({ ...d, name: v }))}
            placeholder="예: 인천냥이 동물병원"
          />

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label required>시/도</Label>
              <Input
                value={draft.city}
                onChange={(v) => setDraft((d) => ({ ...d, city: v }))}
                placeholder="예: 인천광역시"
              />
            </div>
            <div>
              <Label required>시/군/구</Label>
              <Input
                value={draft.district}
                onChange={(v) => setDraft((d) => ({ ...d, district: v }))}
                placeholder="예: 남동구"
              />
            </div>
          </div>

          <Label>상세 주소</Label>
          <Input
            value={draft.address ?? ""}
            onChange={(v) => setDraft((d) => ({ ...d, address: v || null }))}
            placeholder="예: 인천광역시 남동구 구월동 123-45"
          />

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>전화번호</Label>
              <Input
                value={draft.phone ?? ""}
                onChange={(v) => setDraft((d) => ({ ...d, phone: v || null }))}
                placeholder="예: 032-123-4567"
              />
            </div>
            <div>
              <Label>영업시간</Label>
              <Input
                value={draft.hours ?? ""}
                onChange={(v) => setDraft((d) => ({ ...d, hours: v || null }))}
                placeholder="예: 09:00 ~ 20:00"
              />
            </div>
          </div>

          <Label>태그 (쉼표로 구분)</Label>
          <Input
            value={tagsInput}
            onChange={setTagsInput}
            placeholder="예: TNR 협력, 24시 응급, 길고양이 할인"
          />

          <Label>특이사항 · 메모</Label>
          <textarea
            value={draft.note ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value || null }))}
            rows={3}
            placeholder="구조자/캣맘에게 도움될 정보 (할인 조건, 응급 대응 가능 시간 등)"
            className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none mb-3 resize-none"
            style={{
              backgroundColor: "#F6F1EA",
              color: "#2A2A28",
              border: "1px solid #E3DCD3",
            }}
          />

          <label className="flex items-center gap-2 mb-3 cursor-pointer">
            <input
              type="checkbox"
              checked={draft.pinned}
              onChange={(e) => setDraft((d) => ({ ...d, pinned: e.target.checked }))}
              className="w-4 h-4 accent-primary"
            />
            <span className="text-[12px] font-semibold text-text-sub flex items-center gap-1">
              <Pin size={11} /> 추천 병원으로 상단 고정
            </span>
          </label>

          {error && (
            <p className="text-[11px] mb-2" style={{ color: "#B84545" }}>
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-primary text-white text-[13px] font-bold disabled:opacity-40 active:scale-[0.97] transition-all"
            >
              {saving ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Save size={14} />
              )}
              저장
            </button>
            <button
              onClick={handleCancel}
              disabled={saving}
              className="px-5 py-2.5 rounded-xl text-[13px] font-bold"
              style={{
                backgroundColor: "#EEE8E0",
                color: "#A38E7A",
              }}
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 병원 목록 (시/군별 그루핑) */}
      {items.length === 0 ? (
        <div
          className="py-10 text-center"
          style={{
            background: "#FFFFFF",
            borderRadius: 16,
            border: "1px solid rgba(0,0,0,0.04)",
          }}
        >
          <Stethoscope
            size={36}
            strokeWidth={1.2}
            className="text-text-light mx-auto mb-2"
          />
          <p className="text-[13px] text-text-sub">
            아직 등록된 병원이 없어요. + 버튼으로 추가하세요.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <section key={group.city}>
              <div className="flex items-center gap-2 mb-2 px-1">
                <div
                  className="w-1 h-4 rounded-full"
                  style={{ backgroundColor: "#C47E5A" }}
                />
                <h2 className="text-[13px] font-extrabold text-text-main tracking-tight">
                  {group.city}
                </h2>
              </div>
              <div className="space-y-3">
                {group.districts.map((d) => (
                  <div key={d.district}>
                    <h3 className="text-[11px] font-bold text-text-sub mb-1.5 px-1">
                      {d.district}
                    </h3>
                    <div className="space-y-1.5">
                      {d.hospitals.map((h) => (
                        <div
                          key={h.id}
                          className="p-3"
                          style={{
                            background: "#FFFFFF",
                            borderRadius: 14,
                            boxShadow: h.pinned
                              ? "0 4px 14px rgba(196,126,90,0.12), 0 1px 2px rgba(0,0,0,0.02)"
                              : "0 2px 8px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)",
                            border: h.pinned
                              ? "1.5px solid rgba(196,126,90,0.25)"
                              : "1px solid rgba(0,0,0,0.04)",
                          }}
                        >
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                {h.pinned && (
                                  <Pin size={10} style={{ color: "#C47E5A" }} />
                                )}
                                <p className="text-[13px] font-extrabold text-text-main truncate">
                                  {h.name}
                                </p>
                              </div>
                              {h.address && (
                                <p className="text-[11px] text-text-light truncate">
                                  {h.address}
                                </p>
                              )}
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <button
                                onClick={() => handleEdit(h)}
                                className="w-7 h-7 rounded-lg flex items-center justify-center"
                                style={{ backgroundColor: "#EEE8E0" }}
                                aria-label="수정"
                              >
                                <Pencil size={12} style={{ color: "#C47E5A" }} strokeWidth={2.3} />
                              </button>
                              <button
                                onClick={() => handleDelete(h)}
                                className="w-7 h-7 rounded-lg flex items-center justify-center"
                                style={{ backgroundColor: "#FBEAEA" }}
                                aria-label="삭제"
                              >
                                <Trash2 size={12} style={{ color: "#D85555" }} strokeWidth={2.3} />
                              </button>
                            </div>
                          </div>
                          {h.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {h.tags.map((t) => (
                                <span
                                  key={t}
                                  className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                                  style={{ backgroundColor: "#F6F1EA", color: "#8B6F5A" }}
                                >
                                  {t}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══ 공통 작은 컴포넌트 ═══ */
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
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2 rounded-xl text-[13px] outline-none mb-1"
      style={{
        backgroundColor: "#F6F1EA",
        color: "#2A2A28",
        border: "1px solid #E3DCD3",
      }}
    />
  );
}
