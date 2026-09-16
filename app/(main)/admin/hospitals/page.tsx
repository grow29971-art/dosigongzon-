"use client";

// 병원 관리 (admin 전용) — 2026-09-16 「익숙한 동네앱」 리디자인:
// 카드 목록 → 시/군별 헤어라인 섹션 + 구분선 리스트, 편집 폼 헤어라인 섹션, 회색 태그, 원형 FAB → 헤더 버튼. 토큰만.

import { useEffect, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  Loader2,
  Pin,
  Stethoscope,
  RefreshCw,
  Database,
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
import { createClient } from "@/lib/supabase/client";
import UIButton from "@/app/components/ui/Button";
import {
  AdminForbidden, AdminHeader, AdminLoading, AdminPage, AdminSection, AdminTag, FieldLabel, HairlineButton,
  inputCls, inputStyle,
} from "../_ui";

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
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [items, setItems] = useState<RescueHospital[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<RescueHospitalInput>(EMPTY);
  const [tagsInput, setTagsInput] = useState(""); // 쉼표 구분 입력용
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // ── 공공데이터 동기화 ──
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

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

  const handleSync = async () => {
    if (!confirm("전국 동물병원 공공데이터를 동기화할까요?\n카카오 검색 API로 전국을 탐색합니다. (1~2분 소요)")) return;
    setSyncing(true);
    setSyncResult(null);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/admin/sync-hospitals", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
      });
      const data = await res.json();
      if (!res.ok) {
        setSyncResult(`오류: ${data.error}`);
      } else {
        setSyncResult(data.message);
        await refresh();
      }
    } catch (err) {
      setSyncResult(`동기화 실패: ${err instanceof Error ? err.message : "알 수 없는 오류"}`);
    } finally {
      setSyncing(false);
    }
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

  if (!authChecked || loading) return <AdminLoading />;
  if (!isAdmin) return <AdminForbidden />;

  const groups = groupByCityDistrict(items);
  const syncFailed = !!syncResult && (syncResult.startsWith("오류") || syncResult.startsWith("동기화 실패"));

  return (
    <AdminPage>
      <AdminHeader
        title="병원 관리"
        description="구조동물 치료 도움병원을 추가·수정·삭제할 수 있어요"
        back="/mypage"
        backLabel="마이페이지"
        right={
          <div className="flex gap-1.5 shrink-0">
            <HairlineButton
              onClick={handleSync}
              disabled={syncing}
              icon={syncing ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />}
              aria-label="공공데이터 동기화"
            >
              동기화
            </HairlineButton>
            <UIButton size="sm" onClick={handleCreate}>
              <Plus size={14} /> 추가
            </UIButton>
          </div>
        }
      />

      {/* 동기화 상태 */}
      {(syncing || syncResult) && (
        <p
          className="mb-3 flex items-center gap-2 text-[13px] font-semibold"
          style={{ color: syncing ? "var(--color-text-sub)" : syncFailed ? "var(--color-error)" : "var(--color-sage)" }}
        >
          {syncing ? (
            <>
              <RefreshCw size={14} className="animate-spin" />
              전국 동물병원 검색 중... (1~2분 소요)
            </>
          ) : (
            <>
              <Database size={14} />
              {syncResult}
            </>
          )}
        </p>
      )}

      {/* 편집 폼 */}
      {editingId && (
        <AdminSection
          title={editingId === "new" ? "새 병원 추가" : "병원 수정"}
          right={
            <button type="button" onClick={handleCancel} className="w-7 h-7 flex items-center justify-center text-text-light" aria-label="닫기">
              <X size={16} />
            </button>
          }
        >
          <FieldLabel>병원명 *</FieldLabel>
          <Input
            value={draft.name}
            onChange={(v) => setDraft((d) => ({ ...d, name: v }))}
            placeholder="예: 인천냥이 동물병원"
          />

          <div className="grid grid-cols-2 gap-2">
            <div>
              <FieldLabel>시/도 *</FieldLabel>
              <Input
                value={draft.city}
                onChange={(v) => setDraft((d) => ({ ...d, city: v }))}
                placeholder="예: 인천광역시"
              />
            </div>
            <div>
              <FieldLabel>시/군/구 *</FieldLabel>
              <Input
                value={draft.district}
                onChange={(v) => setDraft((d) => ({ ...d, district: v }))}
                placeholder="예: 남동구"
              />
            </div>
          </div>

          <FieldLabel>상세 주소</FieldLabel>
          <Input
            value={draft.address ?? ""}
            onChange={(v) => setDraft((d) => ({ ...d, address: v || null }))}
            placeholder="예: 인천광역시 남동구 구월동 123-45"
          />

          <div className="grid grid-cols-2 gap-2">
            <div>
              <FieldLabel>전화번호</FieldLabel>
              <Input
                value={draft.phone ?? ""}
                onChange={(v) => setDraft((d) => ({ ...d, phone: v || null }))}
                placeholder="예: 032-123-4567"
              />
            </div>
            <div>
              <FieldLabel>영업시간</FieldLabel>
              <Input
                value={draft.hours ?? ""}
                onChange={(v) => setDraft((d) => ({ ...d, hours: v || null }))}
                placeholder="예: 09:00 ~ 20:00"
              />
            </div>
          </div>

          <FieldLabel>태그 (쉼표로 구분)</FieldLabel>
          <Input
            value={tagsInput}
            onChange={setTagsInput}
            placeholder="예: TNR 협력, 24시 응급, 길고양이 할인"
          />

          <FieldLabel>특이사항 · 메모</FieldLabel>
          <textarea
            value={draft.note ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value || null }))}
            rows={3}
            placeholder="구조자/길집사에게 도움될 정보 (할인 조건, 응급 대응 가능 시간 등)"
            className={`${inputCls} mb-3 resize-none`}
            style={inputStyle}
          />

          <label className="flex items-center gap-2 mb-3 cursor-pointer">
            <input
              type="checkbox"
              checked={draft.pinned}
              onChange={(e) => setDraft((d) => ({ ...d, pinned: e.target.checked }))}
              className="w-4 h-4 accent-primary"
            />
            <span className="text-[13px] font-semibold text-text-sub flex items-center gap-1">
              <Pin size={11} /> 추천 병원으로 상단 고정
            </span>
          </label>

          {error && (
            <p className="text-[13px] mb-2" style={{ color: "var(--color-error)" }}>{error}</p>
          )}

          <div className="flex gap-2">
            <UIButton onClick={handleSave} disabled={saving} className="flex-1">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              저장
            </UIButton>
            <UIButton variant="secondary" onClick={handleCancel} disabled={saving}>취소</UIButton>
          </div>
        </AdminSection>
      )}

      {/* 병원 목록 (시/군별 그루핑) */}
      {items.length === 0 ? (
        <AdminSection>
          <div className="py-8 text-center">
            <Stethoscope size={36} strokeWidth={1.2} className="text-text-light mx-auto mb-2" />
            <p className="text-[13px] text-text-sub">아직 등록된 병원이 없어요. 추가 버튼으로 등록하세요.</p>
          </div>
        </AdminSection>
      ) : (
        groups.map((group) => (
          <AdminSection key={group.city} title={group.city} padding={false}>
            {group.districts.map((d) => (
              <div key={d.district}>
                <p className="px-4 pt-3 pb-1 text-[13px] font-semibold text-text-light">{d.district}</p>
                {d.hospitals.map((h) => (
                  <div key={h.id} className="px-4 py-3 border-b border-divider last:border-b-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          {h.pinned && <Pin size={12} className="shrink-0 text-primary" />}
                          <p className="text-[15px] font-semibold text-text-main truncate">{h.name}</p>
                        </div>
                        {h.address && (
                          <p className="text-[13px] text-text-light truncate mt-0.5">{h.address}</p>
                        )}
                        {h.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {h.tags.map((t) => (
                              <AdminTag key={t}>{t}</AdminTag>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleEdit(h)}
                          className="w-8 h-8 flex items-center justify-center press text-text-sub"
                          aria-label="수정"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(h)}
                          className="w-8 h-8 flex items-center justify-center press text-text-light"
                          aria-label="삭제"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </AdminSection>
        ))
      )}
    </AdminPage>
  );
}

/* ═══ 공통 작은 컴포넌트 ═══ */
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
      className={`${inputCls} mb-3`}
      style={inputStyle}
    />
  );
}
