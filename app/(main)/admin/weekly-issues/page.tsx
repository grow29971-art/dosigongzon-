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

const EMPTY_DRAFT: WeeklyIssueInput = {
  emoji: null,
  title: "",
  body: null,
  week_start: getCurrentMondayKST(),
  external_url: null,
  external_label: null,
};

export default function AdminWeeklyIssuesPage() {
  const router = useRouter();

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
        <p className="text-[12px] text-text-sub">접근 권한이 없어요.</p>
        <Link
          href="/mypage"
          className="inline-block mt-4 text-[13px] font-bold text-primary"
        >
          마이페이지로 돌아가기
        </Link>
      </div>
    );
  }

  return (
    <div className="px-4 pt-14 pb-24">
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
              <h1 className="text-[22px] font-extrabold text-text-main tracking-tight">
                이번 주 이슈
              </h1>
              <span className="text-[10px] font-semibold text-text-light">
                Weekly Issues
              </span>
            </div>
            <p className="text-[12px] text-text-sub">
              최근 7일 이내 시작한 이슈가 홈 화면에 노출돼요
            </p>
          </div>
          <button
            onClick={handleCreate}
            className="w-11 h-11 rounded-full bg-primary flex items-center justify-center active:scale-95 transition-transform"
            style={{ boxShadow: "var(--shadow-primary)" }}
            aria-label="새 이슈 작성"
          >
            <Plus size={20} color="#fff" strokeWidth={2.5} />
          </button>
        </div>
      </div>

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
              {editingId === "new" ? "새 이슈 작성" : "이슈 수정"}
            </h2>
            <button
              onClick={handleCancel}
              className="w-7 h-7 rounded-lg flex items-center justify-center active:scale-90"
              style={{ backgroundColor: "#EEE8E0" }}
            >
              <X size={13} style={{ color: "#A38E7A" }} strokeWidth={3} />
            </button>
          </div>

          <Label>이모지 (선택)</Label>
          <Input
            value={draft.emoji ?? ""}
            onChange={(v) => setDraft((d) => ({ ...d, emoji: v || null }))}
            placeholder="예: 🐾"
          />

          <Label required>제목</Label>
          <Input
            value={draft.title}
            onChange={(v) => setDraft((d) => ({ ...d, title: v }))}
            placeholder="예: 종로구 길고양이 급식소 봄맞이 정비"
          />

          <Label>설명</Label>
          <textarea
            value={draft.body ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value || null }))}
            rows={3}
            placeholder="간단한 안내 (줄바꿈 유지됨)"
            className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none mb-3 resize-none"
            style={{
              backgroundColor: "#F6F1EA",
              color: "#2A2A28",
              border: "1px solid #E3DCD3",
            }}
          />

          <Label required>주 시작 날짜 (보통 월요일)</Label>
          <input
            type="date"
            value={draft.week_start}
            onChange={(e) =>
              setDraft((d) => ({ ...d, week_start: e.target.value }))
            }
            className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none mb-3"
            style={{
              backgroundColor: "#F6F1EA",
              color: "#2A2A28",
              border: "1px solid #E3DCD3",
            }}
          />

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>외부 링크 URL</Label>
              <Input
                value={draft.external_url ?? ""}
                onChange={(v) => setDraft((d) => ({ ...d, external_url: v || null }))}
                placeholder="https://..."
              />
            </div>
            <div>
              <Label>링크 라벨</Label>
              <Input
                value={draft.external_label ?? ""}
                onChange={(v) => setDraft((d) => ({ ...d, external_label: v || null }))}
                placeholder="예: 자세히 보기"
              />
            </div>
          </div>

          {error && (
            <p className="text-[11px] mb-2" style={{ color: "#B84545" }}>
              {error}
            </p>
          )}

          <div className="flex gap-2 mt-2">
            <button
              onClick={handleSave}
              disabled={saving}
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

      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="card p-6 text-center text-[13px] text-text-sub">
            아직 등록된 이슈가 없어요.
          </div>
        ) : (
          items.map((item) => {
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
              .toISOString()
              .slice(0, 10);
            const isLive = item.week_start >= sevenDaysAgo;
            return (
              <div
                key={item.id}
                className="p-4"
                style={{
                  background: "#FFFFFF",
                  borderRadius: 18,
                  boxShadow: "0 4px 14px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)",
                  border: "1px solid rgba(0,0,0,0.04)",
                }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-[22px] shrink-0"
                    style={{
                      background: "linear-gradient(135deg, #F0F4F8 0%, #DCE4EE 100%)",
                    }}
                  >
                    {item.emoji ?? <CalendarClock size={20} style={{ color: "#5B7A8F" }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-md"
                        style={{
                          color: isLive ? "#5B7A8F" : "#A38E7A",
                          backgroundColor: isLive ? "#E5E8ED" : "#EEE8E0",
                        }}
                      >
                        {isLive ? "노출 중" : "지난 이슈"}
                      </span>
                      <span className="text-[10px] text-text-light">
                        · 주 시작 {item.week_start}
                      </span>
                    </div>
                    <p className="text-[14px] font-extrabold text-text-main leading-tight">
                      {item.title}
                    </p>
                    {item.body && (
                      <p className="text-[11px] text-text-sub mt-0.5 line-clamp-2">
                        {item.body}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-1.5 mt-3 pt-3 border-t border-divider">
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
            );
          })
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
