"use client";

// 뉴스 관리 (admin 전용) — 2026-09-16 「익숙한 동네앱」 리디자인:
// 카드 목록 → 구분선 리스트(썸네일 8px, 그라디언트 폴백 제거), 카테고리 칩, 편집 폼 헤어라인 섹션, 회색 태그. 토큰만.

import { useEffect, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  Loader2,
  Pin,
  ImagePlus,
  Newspaper,
} from "lucide-react";
import {
  listNews,
  createNews,
  updateNews,
  deleteNews,
  uploadNewsImage,
  isCurrentUserAdmin,
  BADGE_PRESETS,
  resolveDdayLabel,
  type NewsItem,
  type NewsBadgeType,
  type NewsInput,
} from "@/lib/news-repo";
import UIButton from "@/app/components/ui/Button";
import UIChip from "@/app/components/ui/Chip";
import {
  AdminForbidden, AdminHeader, AdminLoading, AdminPage, AdminSection, AdminTag, EmptyState, FieldLabel,
  inputCls, inputStyle,
} from "../_ui";

const BADGE_TYPES: NewsBadgeType[] = ["event", "tnr", "law", "notice", "urgent"];

const EMPTY_DRAFT: NewsInput = {
  badge_type: "notice",
  title: "",
  description: null,
  image_url: null,
  date_label: null,
  dday: null,
  event_date: null,
  body: null,
  external_url: null,
  external_label: null,
  pinned: false,
  source_url: null,
  source_name: null,
  auto_imported: false,
};

export default function AdminNewsPage() {
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  // 편집 모드: null=닫힘, 'new'=새로 만들기, string=해당 id 편집
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<NewsInput>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState("");

  // 권한 + 데이터 로드
  useEffect(() => {
    let cancelled = false;
    Promise.all([isCurrentUserAdmin(), listNews()])
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
    const list = await listNews();
    setItems(list);
  };

  const handleCreate = () => {
    setDraft(EMPTY_DRAFT);
    setEditingId("new");
    setError("");
  };

  const handleEdit = (item: NewsItem) => {
    setDraft({
      badge_type: item.badge_type,
      title: item.title,
      description: item.description,
      image_url: item.image_url,
      date_label: item.date_label,
      dday: item.dday,
      event_date: item.event_date,
      body: item.body,
      external_url: item.external_url,
      external_label: item.external_label,
      pinned: item.pinned,
      source_url: item.source_url,
      source_name: item.source_name,
      auto_imported: item.auto_imported,
    });
    setEditingId(item.id);
    setError("");
  };

  const handleCancel = () => {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setError("");
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // 같은 파일 재선택 허용
    if (!file) return;
    setUploadingImage(true);
    setError("");
    try {
      const url = await uploadNewsImage(file);
      setDraft((d) => ({ ...d, image_url: url }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "이미지 업로드 실패");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleImageClear = () => {
    setDraft((d) => ({ ...d, image_url: null }));
  };

  const handleSave = async () => {
    if (!draft.title.trim()) {
      setError("제목은 필수예요.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (editingId === "new") {
        await createNews(draft);
      } else if (editingId) {
        await updateNews(editingId, draft);
      }
      await refresh();
      handleCancel();
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: NewsItem) => {
    if (!confirm(`"${item.title}" 삭제할까요?`)) return;
    try {
      await deleteNews(item.id);
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
        title="뉴스 관리"
        description="홈 화면 소식 & 일정을 수정·추가·삭제할 수 있어요"
        back="/mypage"
        backLabel="마이페이지"
        right={
          <UIButton size="sm" onClick={handleCreate}>
            <Plus size={14} /> 새 소식
          </UIButton>
        }
      />

      {/* 편집 폼 */}
      {editingId && (
        <AdminSection
          title={editingId === "new" ? "새 소식 작성" : "소식 수정"}
          right={
            <button type="button" onClick={handleCancel} className="w-7 h-7 flex items-center justify-center text-text-light" aria-label="닫기">
              <X size={16} />
            </button>
          }
        >
          {/* 배지 타입 */}
          <FieldLabel>카테고리</FieldLabel>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {BADGE_TYPES.map((t) => (
              <UIChip key={t} active={draft.badge_type === t} onClick={() => setDraft((d) => ({ ...d, badge_type: t }))}>
                {BADGE_PRESETS[t].label}
              </UIChip>
            ))}
          </div>

          {/* 제목 */}
          <FieldLabel>제목 *</FieldLabel>
          <Input
            value={draft.title}
            onChange={(v) => setDraft((d) => ({ ...d, title: v }))}
            placeholder="소식 제목"
          />

          {/* 설명 */}
          <FieldLabel>한 줄 설명</FieldLabel>
          <Input
            value={draft.description ?? ""}
            onChange={(v) => setDraft((d) => ({ ...d, description: v || null }))}
            placeholder="카드 아래 작게 표시돼요"
          />

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

          {/* 날짜 표시 + 이벤트 날짜(자동 D-Day) */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <FieldLabel>날짜 표시</FieldLabel>
              <Input
                value={draft.date_label ?? ""}
                onChange={(v) => setDraft((d) => ({ ...d, date_label: v || null }))}
                placeholder="예: 5월 15일"
              />
            </div>
            <div>
              <FieldLabel>이벤트 날짜 (자동 D-Day)</FieldLabel>
              <input
                type="date"
                value={draft.event_date ?? ""}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, event_date: e.target.value || null }))
                }
                className={`${inputCls} mb-3`}
                style={inputStyle}
              />
            </div>
          </div>

          {/* D-Day 수동 폴백 (이벤트 날짜 없을 때만 사용됨) */}
          <div>
            <FieldLabel>
              D-Day 수동 입력 {draft.event_date ? "— 비활성 (이벤트 날짜가 우선)" : "(폴백용)"}
            </FieldLabel>
            <Input
              value={draft.dday ?? ""}
              onChange={(v) => setDraft((d) => ({ ...d, dday: v || null }))}
              placeholder={draft.event_date
                ? "이벤트 날짜가 있어 자동 계산됩니다"
                : "예: 상시모집 · 시행중 (D-숫자는 자동 갱신 안 되니 위 날짜를 쓰세요)"}
              disabled={!!draft.event_date}
            />
            {draft.event_date && draft.dday && (
              <p className="text-[13px] -mt-2 mb-3" style={{ color: "var(--color-warning)" }}>
                이벤트 날짜가 우선 표시돼요. 위 수동 입력값은 무시됩니다.
              </p>
            )}
          </div>

          {/* 본문 */}
          <FieldLabel>본문</FieldLabel>
          <textarea
            value={draft.body ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value || null }))}
            rows={6}
            placeholder="상세 내용 (줄바꿈 유지됨)"
            className={`${inputCls} mb-3 resize-none`}
            style={inputStyle}
          />

          {/* 외부 링크 */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <FieldLabel>외부 링크 URL</FieldLabel>
              <Input
                value={draft.external_url ?? ""}
                onChange={(v) => setDraft((d) => ({ ...d, external_url: v || null }))}
                placeholder="https://..."
              />
            </div>
            <div>
              <FieldLabel>외부 링크 라벨</FieldLabel>
              <Input
                value={draft.external_label ?? ""}
                onChange={(v) => setDraft((d) => ({ ...d, external_label: v || null }))}
                placeholder="예: 공식 홈페이지"
              />
            </div>
          </div>

          {/* 상단 고정 */}
          <label className="flex items-center gap-2 mb-3 cursor-pointer">
            <input
              type="checkbox"
              checked={draft.pinned}
              onChange={(e) => setDraft((d) => ({ ...d, pinned: e.target.checked }))}
              className="w-4 h-4 accent-primary"
            />
            <span className="text-[13px] font-semibold text-text-sub flex items-center gap-1">
              <Pin size={11} /> 상단 고정
            </span>
          </label>

          {error && (
            <p className="text-[13px] mb-2" style={{ color: "var(--color-error)" }}>{error}</p>
          )}

          {/* 액션 버튼 */}
          <div className="flex gap-2">
            <UIButton onClick={handleSave} disabled={saving || uploadingImage} className="flex-1">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              저장
            </UIButton>
            <UIButton variant="secondary" onClick={handleCancel} disabled={saving}>취소</UIButton>
          </div>
        </AdminSection>
      )}

      {/* 뉴스 목록 */}
      <AdminSection title={`소식 ${items.length}개`} padding={false}>
        {items.length === 0 ? (
          <EmptyState>아직 등록된 소식이 없어요.</EmptyState>
        ) : (
          items.map((item) => {
            const preset = BADGE_PRESETS[item.badge_type];
            const ddayLabel = resolveDdayLabel(item);
            return (
              <div key={item.id} className="flex items-start gap-3 px-4 py-3 border-b border-divider last:border-b-0">
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
                    <Newspaper size={20} strokeWidth={1.8} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                    <AdminTag tone={item.badge_type === "urgent" ? "error" : "neutral"}>{preset.label}</AdminTag>
                    {item.pinned && (
                      <span className="text-[11px] font-semibold text-primary flex items-center gap-0.5">
                        <Pin size={10} /> 고정
                      </span>
                    )}
                    {item.auto_imported && <AdminTag>자동수집</AdminTag>}
                    {ddayLabel && <span className="text-[11px] text-text-light">· {ddayLabel}</span>}
                  </div>
                  <p className="text-[15px] font-semibold text-text-main leading-tight truncate">{item.title}</p>
                  {item.description && (
                    <p className="text-[13px] text-text-sub mt-0.5 truncate">{item.description}</p>
                  )}
                  {item.auto_imported && item.source_name && (
                    <p className="text-[13px] text-text-light mt-0.5 truncate">출처: {item.source_name}</p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
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
            );
          })
        )}
      </AdminSection>
    </AdminPage>
  );
}

/* ═══ 공통 작은 컴포넌트 ═══ */
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
