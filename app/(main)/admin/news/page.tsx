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
  ImagePlus,
} from "lucide-react";
import {
  listNews,
  createNews,
  updateNews,
  deleteNews,
  uploadNewsImage,
  isCurrentUserAdmin,
  BADGE_PRESETS,
  type NewsItem,
  type NewsBadgeType,
  type NewsInput,
} from "@/lib/news-repo";

const BADGE_TYPES: NewsBadgeType[] = ["event", "tnr", "law", "notice", "urgent"];

const EMPTY_DRAFT: NewsInput = {
  badge_type: "notice",
  title: "",
  description: null,
  image_url: null,
  date_label: null,
  dday: null,
  body: null,
  external_url: null,
  external_label: null,
  pinned: false,
};

export default function AdminNewsPage() {
  const router = useRouter();

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
      body: item.body,
      external_url: item.external_url,
      external_label: item.external_label,
      pinned: item.pinned,
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
                뉴스 관리
              </h1>
              <span className="text-[10px] font-semibold text-text-light">
                Admin · News
              </span>
            </div>
            <p className="text-[12px] text-text-sub">
              홈 화면 소식 & 일정을 수정·추가·삭제할 수 있어요
            </p>
          </div>
          <button
            onClick={handleCreate}
            className="w-11 h-11 rounded-2xl bg-primary flex items-center justify-center active:scale-95 transition-transform"
            style={{ boxShadow: "0 6px 14px rgba(196,126,90,0.35)" }}
            aria-label="새 소식 작성"
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
              {editingId === "new" ? "새 소식 작성" : "소식 수정"}
            </h2>
            <button
              onClick={handleCancel}
              className="w-7 h-7 rounded-lg flex items-center justify-center active:scale-90"
              style={{ backgroundColor: "#EEE8E0" }}
            >
              <X size={13} style={{ color: "#A38E7A" }} strokeWidth={3} />
            </button>
          </div>

          {/* 배지 타입 */}
          <Label>카테고리</Label>
          <div className="grid grid-cols-5 gap-1.5 mb-3">
            {BADGE_TYPES.map((t) => {
              const preset = BADGE_PRESETS[t];
              const active = draft.badge_type === t;
              return (
                <button
                  key={t}
                  onClick={() => setDraft((d) => ({ ...d, badge_type: t }))}
                  className="py-2 rounded-lg text-[11px] font-bold transition-all"
                  style={{
                    backgroundColor: active ? preset.color : preset.bg,
                    color: active ? "#fff" : preset.color,
                    border: `1.5px solid ${active ? preset.color : "transparent"}`,
                  }}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          {/* 제목 */}
          <Label required>제목</Label>
          <Input
            value={draft.title}
            onChange={(v) => setDraft((d) => ({ ...d, title: v }))}
            placeholder="소식 제목"
          />

          {/* 설명 */}
          <Label>한 줄 설명</Label>
          <Input
            value={draft.description ?? ""}
            onChange={(v) => setDraft((d) => ({ ...d, description: v || null }))}
            placeholder="카드 아래 작게 표시돼요"
          />

          {/* 이미지 업로드 */}
          <Label>이미지</Label>
          <div className="mb-3">
            {draft.image_url ? (
              <div className="relative">
                <img
                  src={draft.image_url}
                  alt=""
                  className="w-full aspect-[16/9] rounded-xl object-cover"
                  style={{ border: "1px solid #E3DCD3" }}
                />
                <button
                  type="button"
                  onClick={handleImageClear}
                  className="absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center active:scale-90"
                  style={{
                    backgroundColor: "rgba(0,0,0,0.6)",
                    color: "#fff",
                  }}
                  aria-label="이미지 제거"
                >
                  <X size={16} strokeWidth={3} />
                </button>
              </div>
            ) : (
              <label
                className="flex flex-col items-center justify-center aspect-[16/9] rounded-xl cursor-pointer active:scale-[0.99] transition-transform"
                style={{
                  backgroundColor: "#F6F1EA",
                  border: "1.5px dashed #C9BDAA",
                  color: "#A38E7A",
                }}
              >
                {uploadingImage ? (
                  <>
                    <Loader2 size={22} className="animate-spin mb-1" />
                    <span className="text-[12px] font-semibold">업로드 중...</span>
                  </>
                ) : (
                  <>
                    <ImagePlus size={24} className="mb-1" />
                    <span className="text-[12px] font-semibold">이미지 선택</span>
                    <span className="text-[10px] mt-0.5">JPG/PNG · 20MB 이하</span>
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

          {/* 날짜 + D-Day */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>날짜 표시</Label>
              <Input
                value={draft.date_label ?? ""}
                onChange={(v) => setDraft((d) => ({ ...d, date_label: v || null }))}
                placeholder="예: 5월 15일"
              />
            </div>
            <div>
              <Label>D-Day</Label>
              <Input
                value={draft.dday ?? ""}
                onChange={(v) => setDraft((d) => ({ ...d, dday: v || null }))}
                placeholder="예: D-38 / 시행중"
              />
            </div>
          </div>

          {/* 본문 */}
          <Label>본문</Label>
          <textarea
            value={draft.body ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value || null }))}
            rows={6}
            placeholder="상세 내용 (줄바꿈 유지됨)"
            className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none mb-3 resize-none"
            style={{
              backgroundColor: "#F6F1EA",
              color: "#2A2A28",
              border: "1px solid #E3DCD3",
            }}
          />

          {/* 외부 링크 */}
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
              <Label>외부 링크 라벨</Label>
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
            <span className="text-[12px] font-semibold text-text-sub flex items-center gap-1">
              <Pin size={11} /> 상단 고정
            </span>
          </label>

          {error && (
            <p className="text-[11px] mb-2" style={{ color: "#B84545" }}>
              {error}
            </p>
          )}

          {/* 액션 버튼 */}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving || uploadingImage}
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

      {/* 뉴스 목록 */}
      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="card p-6 text-center text-[13px] text-text-sub">
            아직 등록된 소식이 없어요.
          </div>
        ) : (
          items.map((item) => {
            const preset = BADGE_PRESETS[item.badge_type];
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
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt=""
                      className="w-16 h-16 rounded-xl object-cover shrink-0"
                    />
                  ) : (
                    <div
                      className="w-16 h-16 rounded-xl shrink-0"
                      style={{ background: preset.gradient }}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-md"
                        style={{ color: preset.color, backgroundColor: preset.bg }}
                      >
                        {preset.label}
                      </span>
                      {item.pinned && (
                        <span className="text-[10px] font-bold text-primary flex items-center gap-0.5">
                          <Pin size={10} /> 고정
                        </span>
                      )}
                      {item.dday && (
                        <span className="text-[10px] text-text-light">
                          · {item.dday}
                        </span>
                      )}
                    </div>
                    <p className="text-[14px] font-extrabold text-text-main leading-tight truncate">
                      {item.title}
                    </p>
                    {item.description && (
                      <p className="text-[11px] text-text-sub mt-0.5 truncate">
                        {item.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-1.5 mt-3 pt-3 border-t border-divider">
                  <button
                    onClick={() => handleEdit(item)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-bold"
                    style={{ backgroundColor: "#EEE8E0", color: "#C47E5A" }}
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
