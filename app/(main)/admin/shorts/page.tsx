"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  X,
  Loader2,
  Pin,
  Eye,
  EyeOff,
  Film,
  ImagePlus,
  PlayCircle,
  Download,
} from "lucide-react";
import {
  listAllShorts,
  createShort,
  updateShort,
  deleteShort,
  uploadShortVideo,
  uploadShortThumbnail,
  parseYouTubeId,
  youTubeThumbnailUrl,
  type Short,
  type ShortInput,
} from "@/lib/shorts-repo";
import { isCurrentUserAdmin } from "@/lib/news-repo";
import { sanitizeImageUrl, sanitizeHttpUrl } from "@/lib/url-validate";
import { revalidateShorts } from "./actions";

const EMPTY_DRAFT: ShortInput = {
  title: "",
  description: null,
  video_url: null,
  youtube_url: null,
  youtube_video_id: null,
  youtube_channel_name: null,
  youtube_channel_url: null,
  thumbnail_url: null,
  duration_sec: null,
  width: null,
  height: null,
  sort_order: 0,
  pinned: false,
  published: true,
  published_at: new Date().toISOString(),
};

export default function AdminShortsPage() {
  const router = useRouter();

  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [items, setItems] = useState<Short[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ShortInput>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadingThumb, setUploadingThumb] = useState(false);
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([isCurrentUserAdmin(), listAllShorts()])
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
    return () => { cancelled = true; };
  }, []);

  const refresh = async () => {
    const list = await listAllShorts();
    setItems(list);
  };

  const handleNew = () => {
    setDraft({ ...EMPTY_DRAFT, published_at: new Date().toISOString() });
    setEditingId("new");
    setError("");
  };

  const handleEdit = (s: Short) => {
    setDraft({
      title: s.title,
      description: s.description,
      video_url: s.video_url,
      youtube_url: s.youtube_url,
      youtube_video_id: s.youtube_video_id,
      youtube_channel_name: s.youtube_channel_name,
      youtube_channel_url: s.youtube_channel_url,
      thumbnail_url: s.thumbnail_url,
      duration_sec: s.duration_sec,
      width: s.width,
      height: s.height,
      sort_order: s.sort_order,
      pinned: s.pinned,
      published: s.published,
      published_at: s.published_at,
    });
    setEditingId(s.id);
    setError("");
  };

  // YouTube URL 입력 핸들러 — 붙여넣으면 video_id, 썸네일 자동 추출
  const handleYouTubeUrlChange = (raw: string) => {
    const url = raw.trim();
    if (!url) {
      setDraft((d) => ({ ...d, youtube_url: null, youtube_video_id: null }));
      return;
    }
    const id = parseYouTubeId(url);
    setDraft((d) => ({
      ...d,
      youtube_url: url,
      youtube_video_id: id,
      // 썸네일이 비어있을 때만 자동 채움 (커스텀 썸네일 덮어쓰기 방지)
      thumbnail_url: id && !d.thumbnail_url ? youTubeThumbnailUrl(id) : d.thumbnail_url,
    }));
  };

  const handleCancel = () => {
    setEditingId(null);
    setError("");
  };

  const handleVideoFile = async (file: File) => {
    setError("");
    setUploadingVideo(true);
    try {
      // 영상 메타데이터 측정 (자동)
      const meta = await probeVideo(file).catch(() => null);
      const url = await uploadShortVideo(file);
      setDraft((d) => ({
        ...d,
        video_url: url,
        duration_sec: meta?.duration ?? d.duration_sec,
        width: meta?.width ?? d.width,
        height: meta?.height ?? d.height,
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "영상 업로드 실패");
    } finally {
      setUploadingVideo(false);
    }
  };

  const handleThumbFile = async (file: File) => {
    setError("");
    setUploadingThumb(true);
    try {
      const url = await uploadShortThumbnail(file);
      setDraft((d) => ({ ...d, thumbnail_url: url }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "썸네일 업로드 실패");
    } finally {
      setUploadingThumb(false);
    }
  };

  const handleSave = async () => {
    setError("");
    if (!draft.title.trim()) {
      setError("제목을 입력해주세요.");
      return;
    }
    if (!draft.video_url && !draft.youtube_video_id) {
      setError("YouTube URL을 붙여넣거나 영상 파일을 업로드해주세요.");
      return;
    }
    if (draft.youtube_url && !draft.youtube_video_id) {
      setError("YouTube URL에서 영상 ID를 추출하지 못했어요. URL을 다시 확인해주세요.");
      return;
    }
    setSaving(true);
    try {
      if (editingId === "new") {
        await createShort(draft);
      } else if (editingId) {
        await updateShort(editingId, draft);
      }
      await revalidateShorts();
      await refresh();
      setEditingId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  const handleQuickToggle = async (s: Short, patch: Partial<ShortInput>) => {
    try {
      await updateShort(s.id, patch);
      await revalidateShorts();
      await refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "변경 실패");
    }
  };

  const handleImport = async () => {
    if (importing) return;
    if (!confirm("YouTube에서 다양한 동물 shorts(고양이·강아지·소동물·야생·조류·농장·수생 등)를 자동으로 가져옵니다. 시작할까요?")) return;
    setImporting(true);
    setImportMsg("");
    try {
      const res = await fetch("/api/cron/import-shorts", { method: "POST" });
      const data = await res.json();
      console.log("[import-shorts] response:", data);
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "임포트 실패");
      }
      // 상세 결과 메시지 — 검색별 found / dedupNew / passedLike / added
      type QR = {
        query: string;
        found: number;
        newAfterDedup: number;
        passedLikeFilter: number;
        added: number;
        error?: string;
      };
      // 쿼터 에러 감지 — 모든 쿼리가 quota 에러면 명확히 안내
      const allQuotaError =
        (data.queryResults ?? []).length > 0
        && (data.queryResults ?? []).every((r: QR) => r.error?.includes("quota"));
      if (allQuotaError) {
        setImportMsg(
          `❌ YouTube 일일 쿼터 초과\n오늘은 더 임포트할 수 없어요. 한국 시간 17:00 이후 자동 리셋됩니다.`,
        );
        setImporting(false);
        window.setTimeout(() => setImportMsg(""), 15000);
        return;
      }

      const breakdown = (data.queryResults ?? [])
        .map((r: QR) =>
          r.error
            ? `· "${r.query}" — ❌ ${r.error}`
            : `· "${r.query}" — 검색 ${r.found} → 신규 ${r.newAfterDedup} → 좋아요 통과 ${r.passedLikeFilter} → 추가 ${r.added}`,
        )
        .join("\n");
      const orderLabel = data.order === "date" ? "최신순"
        : data.order === "viewCount" ? "조회순"
        : data.order === "relevance" ? "관련도순" : "?";
      const minLikes = (data.minLikeCount ?? 0).toLocaleString();
      setImportMsg(
        `✅ 총 ${data.totalAdded}개 추가 (정렬: ${orderLabel} · 최소 좋아요: ${minLikes})\n${breakdown}`,
      );
      await revalidateShorts();
      await refresh();
    } catch (e) {
      setImportMsg(`❌ ${e instanceof Error ? e.message : "임포트 실패"}`);
    } finally {
      setImporting(false);
      // 결과 메시지 15초 동안 표시 (디버그 정보 읽을 시간)
      window.setTimeout(() => setImportMsg(""), 15000);
    }
  };

  const handleDelete = async (s: Short) => {
    if (!confirm(`"${s.title}" 영상을 삭제할까요? 되돌릴 수 없어요.`)) return;
    try {
      await deleteShort(s.id);
      await revalidateShorts();
      await refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "삭제 실패");
    }
  };

  if (!authChecked) {
    return (
      <div className="min-h-dvh flex items-center justify-center" style={{ background: "#F7F4EE" }}>
        <Loader2 className="animate-spin" size={24} style={{ color: "#5C8DEE" }} />
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center px-6 text-center" style={{ background: "#F7F4EE" }}>
        <p className="text-[15px] font-extrabold text-text-main mb-2">관리자 전용 페이지예요</p>
        <p className="text-[12px] text-text-sub mb-5">이 페이지는 운영자만 접근할 수 있어요.</p>
        <button onClick={() => router.replace("/")} className="px-5 py-2.5 rounded-xl bg-primary text-white text-[13px] font-extrabold">홈으로</button>
      </div>
    );
  }

  const editing = editingId !== null;

  return (
    <div className="min-h-dvh pb-20" style={{ background: "#F7F4EE" }}>
      {/* 헤더 */}
      <div className="px-4 pt-12 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/admin" className="w-9 h-9 rounded-full bg-white flex items-center justify-center active:scale-90" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }} aria-label="관리자">
            <ArrowLeft size={18} className="text-text-main" />
          </Link>
          <div>
            <p className="text-[10px] font-extrabold tracking-[0.12em]" style={{ color: "#5C8DEE" }}>ADMIN</p>
            <h1 className="text-[18px] font-extrabold text-text-main tracking-tight">숏폼 영상 관리</h1>
          </div>
        </div>
        {!editing && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleImport}
              disabled={importing}
              className="flex items-center gap-1 px-3 py-2 rounded-xl active:scale-95 disabled:opacity-50"
              style={{ background: "rgba(92,141,238,0.12)", color: "#A8684A" }}
              title="YouTube에서 다양한 동물 shorts 자동 가져오기"
            >
              {importing ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              <span className="text-[12px] font-extrabold">
                {importing ? "가져오는 중..." : "YouTube 임포트"}
              </span>
            </button>
            <button onClick={handleNew} className="flex items-center gap-1 px-3 py-2 rounded-xl text-white active:scale-95" style={{ background: "linear-gradient(135deg, #5C8DEE 0%, #A8684A 100%)" }}>
              <Plus size={14} />
              <span className="text-[12px] font-extrabold">새 영상</span>
            </button>
          </div>
        )}
      </div>

      {/* 임포트 결과 메시지 — 줄바꿈 지원, 검색별 상세 */}
      {importMsg && (
        <div className="mx-4 mb-3">
          <div
            className="px-3 py-2 rounded-xl text-[12px] font-bold whitespace-pre-line"
            style={{
              background: importMsg.startsWith("✅") ? "rgba(63,91,66,0.10)" : "rgba(216,85,85,0.10)",
              color: importMsg.startsWith("✅") ? "#3F5B42" : "#D85555",
              border: `1px solid ${importMsg.startsWith("✅") ? "rgba(63,91,66,0.20)" : "rgba(216,85,85,0.20)"}`,
            }}
          >
            {importMsg}
          </div>
        </div>
      )}

      {/* 편집 폼 */}
      {editing && (
        <div className="mx-4 mb-4 p-4 bg-white rounded-2xl" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[14px] font-extrabold text-text-main">
              {editingId === "new" ? "새 영상 등록" : "영상 수정"}
            </p>
            <button onClick={handleCancel} className="w-7 h-7 rounded-full flex items-center justify-center active:scale-90" style={{ background: "rgba(0,0,0,0.05)" }} aria-label="닫기">
              <X size={14} className="text-text-sub" />
            </button>
          </div>

          {/* YouTube URL — 권장 (가장 간단) */}
          <Field label="YouTube Shorts URL (권장 · 붙여넣으면 자동 임베드)">
            <input
              value={draft.youtube_url ?? ""}
              onChange={(e) => handleYouTubeUrlChange(e.target.value)}
              maxLength={2048}
              className="w-full px-3 py-2.5 rounded-xl text-[12.5px] outline-none"
              style={{ background: "#FFF8F2", border: "1px solid #E8C9A8" }}
              placeholder="https://www.youtube.com/shorts/..."
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
            />
            {draft.youtube_url && draft.youtube_video_id && (
              <div className="mt-2 rounded-xl overflow-hidden" style={{ background: "#000", aspectRatio: "9/16", maxWidth: 220 }}>
                <iframe
                  src={`https://www.youtube.com/embed/${draft.youtube_video_id}?playsinline=1&modestbranding=1&rel=0`}
                  className="w-full h-full"
                  style={{ border: 0 }}
                  allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title="미리보기"
                />
              </div>
            )}
            {draft.youtube_url && !draft.youtube_video_id && (
              <p className="text-[11px] mt-1" style={{ color: "#D85555" }}>
                ⚠ 영상 ID를 추출할 수 없어요. URL을 다시 확인해주세요.
              </p>
            )}
            {draft.youtube_video_id && (
              <p className="text-[10.5px] text-text-sub mt-1">
                video_id: <code className="font-mono">{draft.youtube_video_id}</code>
              </p>
            )}
          </Field>

          {/* 원본 채널 정보 — YouTube 임베드일 때만 노출 (저작권 출처 표기) */}
          {draft.youtube_video_id && (
            <>
              <Field label="원본 채널 이름 (저작권 표기 · 권장)">
                <input
                  value={draft.youtube_channel_name ?? ""}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, youtube_channel_name: e.target.value || null }))
                  }
                  maxLength={100}
                  className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none"
                  style={{ background: "#F7F4EE", border: "1px solid rgba(0,0,0,0.06)" }}
                  placeholder="예: 길고양이TV / @cat_channel"
                />
              </Field>
              <Field label="원본 채널 URL (옵션 · 비워두면 영상 페이지로 링크)">
                <input
                  value={draft.youtube_channel_url ?? ""}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, youtube_channel_url: e.target.value || null }))
                  }
                  maxLength={2048}
                  className="w-full px-3 py-2.5 rounded-xl text-[12.5px] outline-none"
                  style={{ background: "#F7F4EE", border: "1px solid rgba(0,0,0,0.06)" }}
                  placeholder="https://www.youtube.com/@..."
                  inputMode="url"
                  autoComplete="off"
                />
              </Field>
            </>
          )}

          {/* 직접 업로드 — 고급 옵션 (YouTube 안 쓸 때만) */}
          {!draft.youtube_video_id && (
            <Field label="또는 영상 파일 직접 업로드 (mp4 · webm · mov · 50MB 이하)">
              <label className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-surface-alt cursor-pointer active:scale-[0.99]" style={{ background: "#FFF8F2", border: "1px dashed #E8C9A8" }}>
                {uploadingVideo ? <Loader2 size={16} className="animate-spin" style={{ color: "#5C8DEE" }} /> : <Film size={16} style={{ color: "#5C8DEE" }} />}
                <span className="text-[12.5px] font-bold" style={{ color: "#A8684A" }}>
                  {uploadingVideo ? "업로드 중..." : draft.video_url ? "영상 다시 선택" : "영상 파일 선택"}
                </span>
                <input
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleVideoFile(f);
                    e.target.value = "";
                  }}
                />
              </label>
              {draft.video_url && (
                <div className="mt-2">
                  <video
                    src={sanitizeHttpUrl(draft.video_url, "")}
                    poster={sanitizeImageUrl(draft.thumbnail_url ?? "", "") || undefined}
                    className="w-full rounded-xl bg-black"
                    style={{ maxHeight: 240, objectFit: "contain" }}
                    controls
                    playsInline
                    muted
                  />
                  <p className="text-[10.5px] text-text-sub mt-1">
                    {draft.duration_sec ? `${draft.duration_sec}초 · ` : ""}
                    {draft.width && draft.height ? `${draft.width}×${draft.height}` : "메타데이터 없음"}
                  </p>
                </div>
              )}
            </Field>
          )}

          {/* 썸네일 (옵션) */}
          <Field label="썸네일 이미지 (옵션 · jpg/png/webp · 5MB 이하)">
            <label className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-surface-alt cursor-pointer active:scale-[0.99]" style={{ background: "#FFF8F2", border: "1px dashed #E8C9A8" }}>
              {uploadingThumb ? <Loader2 size={16} className="animate-spin" style={{ color: "#5C8DEE" }} /> : <ImagePlus size={16} style={{ color: "#5C8DEE" }} />}
              <span className="text-[12.5px] font-bold" style={{ color: "#A8684A" }}>
                {uploadingThumb ? "업로드 중..." : draft.thumbnail_url ? "썸네일 변경" : "썸네일 선택"}
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleThumbFile(f);
                  e.target.value = "";
                }}
              />
            </label>
            {draft.thumbnail_url && (
              <div className="mt-2 flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={sanitizeImageUrl(draft.thumbnail_url, "")} alt="" className="w-20 h-20 object-cover rounded-lg" />
                <button onClick={() => setDraft((d) => ({ ...d, thumbnail_url: null }))} className="text-[11px] font-bold text-text-sub underline">제거</button>
              </div>
            )}
          </Field>

          {/* 제목 */}
          <Field label="제목">
            <input
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              maxLength={200}
              className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none"
              style={{ background: "#F7F4EE", border: "1px solid rgba(0,0,0,0.06)" }}
              placeholder="아이들을 비춘 한 장면, 한 줄로"
            />
          </Field>

          {/* 설명 */}
          <Field label="설명 (옵션)">
            <textarea
              value={draft.description ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value || null }))}
              maxLength={2000}
              rows={3}
              className="w-full px-3 py-2.5 rounded-xl text-[12.5px] leading-relaxed outline-none resize-none"
              style={{ background: "#F7F4EE", border: "1px solid rgba(0,0,0,0.06)" }}
              placeholder="이 영상을 본 사람이 받았으면 하는 한 줄"
            />
          </Field>

          {/* 정렬·발행·고정 */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            <Field label="정렬 (큰 게 위)">
              <input
                type="number"
                value={draft.sort_order}
                onChange={(e) => setDraft((d) => ({ ...d, sort_order: Number(e.target.value) || 0 }))}
                className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none"
                style={{ background: "#F7F4EE", border: "1px solid rgba(0,0,0,0.06)" }}
              />
            </Field>
            <ToggleField
              label="발행"
              on={draft.published}
              onChange={(v) => setDraft((d) => ({ ...d, published: v }))}
            />
            <ToggleField
              label="최상단 고정"
              on={draft.pinned}
              onChange={(v) => setDraft((d) => ({ ...d, pinned: v }))}
            />
          </div>

          {error && (
            <p className="text-[12px] font-bold mb-2" style={{ color: "#D85555" }}>{error}</p>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-1.5 py-3 rounded-xl text-white text-[13px] font-extrabold active:scale-[0.99] disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #5C8DEE 0%, #A8684A 100%)" }}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            <span>{saving ? "저장 중..." : "저장"}</span>
          </button>
        </div>
      )}

      {/* 리스트 */}
      <div className="px-4">
        {loading ? (
          <div className="py-10 flex justify-center">
            <Loader2 className="animate-spin" size={20} style={{ color: "#5C8DEE" }} />
          </div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center">
            <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: "#F2EBE0" }}>
              <Film size={24} style={{ color: "#5C8DEE", opacity: 0.7 }} />
            </div>
            <p className="text-[13px] font-extrabold text-text-main mb-1">아직 영상이 없어요</p>
            <p className="text-[11.5px] text-text-sub">우상단 “새 영상”을 눌러 첫 영상을 올려보세요.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((s) => (
              <ShortRow
                key={s.id}
                short={s}
                onEdit={() => handleEdit(s)}
                onTogglePublished={() => handleQuickToggle(s, { published: !s.published })}
                onTogglePinned={() => handleQuickToggle(s, { pinned: !s.pinned })}
                onDelete={() => handleDelete(s)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ShortRow({
  short: s,
  onEdit,
  onTogglePublished,
  onTogglePinned,
  onDelete,
}: {
  short: Short;
  onEdit: () => void;
  onTogglePublished: () => void;
  onTogglePinned: () => void;
  onDelete: () => void;
}) {
  const thumb = sanitizeImageUrl(s.thumbnail_url ?? "", "");
  const isYoutube = !!s.youtube_video_id;
  return (
    <div className="bg-white rounded-2xl p-3 flex gap-3" style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}>
      <div className="relative w-20 h-28 rounded-xl overflow-hidden shrink-0" style={{ background: "#000" }}>
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <PlayCircle size={28} color="#FFFFFF" opacity={0.7} />
          </div>
        )}
        {isYoutube && (
          <span className="absolute top-1 left-1 text-[8.5px] font-extrabold px-1.5 py-0.5 rounded text-white" style={{ background: "rgba(255,0,0,0.85)" }}>
            YT
          </span>
        )}
        {!s.published && (
          <span className="absolute bottom-1 left-1 text-[8.5px] font-extrabold px-1.5 py-0.5 rounded text-white" style={{ background: "rgba(0,0,0,0.7)" }}>
            숨김
          </span>
        )}
        {s.pinned && (
          <span className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: "rgba(92,141,238,0.95)" }} aria-label="고정">
            <Pin size={10} color="#FFFFFF" fill="#FFFFFF" />
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-extrabold text-text-main line-clamp-2 leading-snug" onClick={onEdit}>
          {s.title}
        </p>
        {s.description && (
          <p className="text-[11px] text-text-sub line-clamp-1 mt-0.5">{s.description}</p>
        )}
        <p className="text-[10.5px] text-text-light mt-1">
          {s.duration_sec ? `${s.duration_sec}초 · ` : ""}조회 {s.view_count.toLocaleString()} · ❤ {s.like_count.toLocaleString()} · 정렬 {s.sort_order}
        </p>

        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          <button onClick={onEdit} className="text-[10.5px] font-bold px-2 py-1 rounded-md" style={{ background: "rgba(92,141,238,0.12)", color: "#A8684A" }}>편집</button>
          <button onClick={onTogglePublished} className="text-[10.5px] font-bold px-2 py-1 rounded-md flex items-center gap-1" style={{ background: s.published ? "rgba(107,142,111,0.12)" : "rgba(0,0,0,0.06)", color: s.published ? "#3F5B42" : "#666" }}>
            {s.published ? <Eye size={11} /> : <EyeOff size={11} />}
            {s.published ? "발행됨" : "숨김"}
          </button>
          <button onClick={onTogglePinned} className="text-[10.5px] font-bold px-2 py-1 rounded-md flex items-center gap-1" style={{ background: s.pinned ? "rgba(232,176,64,0.18)" : "rgba(0,0,0,0.06)", color: s.pinned ? "#A6841E" : "#666" }}>
            <Pin size={11} />
            {s.pinned ? "고정됨" : "고정"}
          </button>
          <button onClick={onDelete} className="text-[10.5px] font-bold px-2 py-1 rounded-md flex items-center gap-1" style={{ background: "rgba(216,85,85,0.12)", color: "#D85555" }}>
            <Trash2 size={11} />
            삭제
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <p className="text-[11px] font-extrabold text-text-sub mb-1.5">{label}</p>
      {children}
    </div>
  );
}

function ToggleField({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div>
      <p className="text-[11px] font-extrabold text-text-sub mb-1.5">{label}</p>
      <button
        type="button"
        onClick={() => onChange(!on)}
        className="w-full px-3 py-2.5 rounded-xl text-[12px] font-extrabold active:scale-[0.99]"
        style={{
          background: on ? "rgba(107,142,111,0.15)" : "rgba(0,0,0,0.05)",
          color: on ? "#3F5B42" : "#666",
          border: `1px solid ${on ? "rgba(107,142,111,0.3)" : "rgba(0,0,0,0.06)"}`,
        }}
      >
        {on ? "ON" : "OFF"}
      </button>
    </div>
  );
}

// 영상 메타데이터 측정 (duration, width, height)
function probeVideo(file: File): Promise<{ duration: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve({
        duration: Math.round(video.duration) || 0,
        width: video.videoWidth || 0,
        height: video.videoHeight || 0,
      });
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("영상 메타데이터 측정 실패"));
    };
    video.src = url;
  });
}
