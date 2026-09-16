"use client";

// 이번 주 이슈 관리 (admin 전용) — 2026-09-16 「익숙한 동네앱」 리디자인:
// 카드 목록 → 구분선 리스트(회색 선 아이콘, 이모지 렌더 제거 — 입력 필드는 데이터라 유지), 편집 폼 헤어라인 섹션. 토큰만.

import { useEffect, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  Loader2,
  CalendarClock,
} from "lucide-react";
import { isCurrentUserAdmin } from "@/lib/news-repo";
import {
  listAllWeeklyIssues,
  createWeeklyIssue,
  updateWeeklyIssue,
  deleteWeeklyIssue,
  getCurrentMondayKST,
  type WeeklyIssue,
  type WeeklyIssueInput,
} from "@/lib/weekly-issues-repo";
import UIButton from "@/app/components/ui/Button";
import {
  AdminForbidden, AdminHeader, AdminLoading, AdminPage, AdminSection, AdminTag, EmptyState, FieldLabel,
  inputCls, inputStyle,
} from "../_ui";

const EMPTY_DRAFT: WeeklyIssueInput = {
  emoji: null,
  title: "",
  body: null,
  week_start: getCurrentMondayKST(),
  external_url: null,
  external_label: null,
};

export default function AdminWeeklyIssuesPage() {
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [items, setItems] = useState<WeeklyIssue[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<WeeklyIssueInput>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([isCurrentUserAdmin(), listAllWeeklyIssues()])
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
    const list = await listAllWeeklyIssues();
    setItems(list);
  };

  const handleCreate = () => {
    setDraft({ ...EMPTY_DRAFT, week_start: getCurrentMondayKST() });
    setEditingId("new");
    setError("");
  };

  const handleEdit = (item: WeeklyIssue) => {
    setDraft({
      emoji: item.emoji,
      title: item.title,
      body: item.body,
      week_start: item.week_start,
      external_url: item.external_url,
      external_label: item.external_label,
    });
    setEditingId(item.id);
    setError("");
  };

  const handleCancel = () => {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setError("");
  };

  const handleSave = async () => {
    if (!draft.title.trim()) {
      setError("제목은 필수예요.");
      return;
    }
    if (!draft.week_start) {
      setError("주 시작 날짜를 정해주세요.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (editingId === "new") {
        await createWeeklyIssue(draft);
      } else if (editingId) {
        await updateWeeklyIssue(editingId, draft);
      }
      await refresh();
      handleCancel();
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: WeeklyIssue) => {
    if (!confirm(`"${item.title}" 삭제할까요?`)) return;
    try {
      await deleteWeeklyIssue(item.id);
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
        title="이번 주 이슈"
        description="최근 7일 이내 시작한 이슈가 홈 화면에 노출돼요"
        right={
          <UIButton size="sm" onClick={handleCreate}>
            <Plus size={14} /> 새 이슈
          </UIButton>
        }
      />

      {editingId && (
        <AdminSection
          title={editingId === "new" ? "새 이슈 작성" : "이슈 수정"}
          right={
            <button type="button" onClick={handleCancel} className="w-7 h-7 flex items-center justify-center text-text-light" aria-label="닫기">
              <X size={16} />
            </button>
          }
        >
          <FieldLabel>이모지 (선택)</FieldLabel>
          <Input
            value={draft.emoji ?? ""}
            onChange={(v) => setDraft((d) => ({ ...d, emoji: v || null }))}
            placeholder="홈 화면 이슈 카드에 표시"
          />

          <FieldLabel>제목 *</FieldLabel>
          <Input
            value={draft.title}
            onChange={(v) => setDraft((d) => ({ ...d, title: v }))}
            placeholder="예: 종로구 길고양이 급식소 봄맞이 정비"
          />

          <FieldLabel>설명</FieldLabel>
          <textarea
            value={draft.body ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value || null }))}
            rows={3}
            placeholder="간단한 안내 (줄바꿈 유지됨)"
            className={`${inputCls} mb-3 resize-none`}
            style={inputStyle}
          />

          <FieldLabel>주 시작 날짜 (보통 월요일) *</FieldLabel>
          <input
            type="date"
            value={draft.week_start}
            onChange={(e) =>
              setDraft((d) => ({ ...d, week_start: e.target.value }))
            }
            className={`${inputCls} mb-3`}
            style={inputStyle}
          />

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
              <FieldLabel>링크 라벨</FieldLabel>
              <Input
                value={draft.external_label ?? ""}
                onChange={(v) => setDraft((d) => ({ ...d, external_label: v || null }))}
                placeholder="예: 자세히 보기"
              />
            </div>
          </div>

          {error && (
            <p className="text-[13px] mb-2" style={{ color: "var(--color-error)" }}>{error}</p>
          )}

          <div className="flex gap-2 mt-1">
            <UIButton onClick={handleSave} disabled={saving} className="flex-1">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              저장
            </UIButton>
            <UIButton variant="secondary" onClick={handleCancel} disabled={saving}>취소</UIButton>
          </div>
        </AdminSection>
      )}

      <AdminSection title={`이슈 ${items.length}개`} padding={false}>
        {items.length === 0 ? (
          <EmptyState>아직 등록된 이슈가 없어요.</EmptyState>
        ) : (
          items.map((item) => {
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
              .toISOString()
              .slice(0, 10);
            const isLive = item.week_start >= sevenDaysAgo;
            return (
              <div key={item.id} className="flex items-start gap-3 px-4 py-3 border-b border-divider last:border-b-0">
                <CalendarClock size={20} className="shrink-0 mt-0.5 text-text-sub" strokeWidth={1.8} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                    <AdminTag tone={isLive ? "sage" : "neutral"}>{isLive ? "노출 중" : "지난 이슈"}</AdminTag>
                    <span className="text-[13px] text-text-light tabular-nums">· 주 시작 {item.week_start}</span>
                  </div>
                  <p className="text-[15px] font-semibold text-text-main leading-tight">{item.title}</p>
                  {item.body && (
                    <p className="text-[13px] text-text-sub mt-0.5 line-clamp-2">{item.body}</p>
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
