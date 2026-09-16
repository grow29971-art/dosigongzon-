"use client";

// 지도 시트의 돌봄 기록 탭 — 2026-09-16 리디자인 「익숙한 동네앱」:
// 유형별 색·이모지 박스 대신 회색 선 아이콘(CARE_TYPE_ICON) + 구분선 리스트, 칩은 공용 UIChip.

import { useEffect, useState, useRef } from "react";
import {
  Plus,
  Loader2,
  Camera,
  Trash2,
  X,
  Send,
  Lock,
  Unlock,
  Utensils,
  Droplet,
  Cookie,
  Stethoscope,
  Scissors,
  Hospital,
  House,
  NotebookPen,
  type LucideIcon,
} from "lucide-react";
import {
  listCareLogs,
  createCareLog,
  deleteCareLog,
  uploadCareLogPhoto,
  getCareLogStats,
  formatLogTime,
  CARE_TYPE_MAP,
  type CareLog,
  type CareType,
  type CareLogStats,
} from "@/lib/care-logs-repo";
import { sanitizeImageUrl } from "@/lib/url-validate";
import CareLogCelebration from "@/app/components/CareLogCelebration";
import { getMyStreakInfo } from "@/lib/streak-repo";
import UIChip from "@/app/components/ui/Chip";
import UIButton from "@/app/components/ui/Button";
import SquareToggle from "@/app/components/ui/SquareToggle";

// CARE_TYPE_MAP.emoji 참조를 끊고 선 아이콘으로 — 상수의 emoji 필드는 푸시 문구 등 다른 소비처가 있어 그대로 둔다
const CARE_TYPE_ICON: Record<CareType, LucideIcon> = {
  feed: Utensils,
  water: Droplet,
  treat: Cookie,
  health: Stethoscope,
  tnr: Scissors,
  hospital: Hospital,
  shelter: House,
  other: NotebookPen,
};

interface Props {
  catId: string;
  isLoggedIn: boolean;
  currentUserId?: string;
}

export default function CareLogTab({ catId, isLoggedIn, currentUserId }: Props) {
  const [logs, setLogs] = useState<CareLog[]>([]);
  const [stats, setStats] = useState<CareLogStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // 입력 상태
  const [careType, setCareType] = useState<CareType | null>(null);
  const [memo, setMemo] = useState("");
  const [amount, setAmount] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isPrivate, setIsPrivate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  // 축하 모달 상태
  const [celebration, setCelebration] = useState<{
    open: boolean;
    isFirstEver: boolean;
    streak: number;
  }>({ open: false, isFirstEver: false, streak: 0 });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([listCareLogs(catId), getCareLogStats(catId)])
      .then(([l, s]) => { setLogs(l); setStats(s); })
      .finally(() => setLoading(false));
  }, [catId]);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    if (!careType) { setError("돌봄 유형을 선택해주세요."); return; }
    setSubmitting(true);
    setError("");

    try {
      let photoUrl: string | undefined;
      if (photoFile) {
        photoUrl = await uploadCareLogPhoto(photoFile);
      }

      const newLog = await createCareLog({
        cat_id: catId,
        care_type: careType,
        memo: memo.trim() || undefined,
        amount: amount.trim() || undefined,
        photo_url: photoUrl,
        is_private: isPrivate,
      });

      setLogs((prev) => [newLog, ...prev]);
      // 통계 갱신
      getCareLogStats(catId).then(setStats);
      // 폼 리셋
      setCareType(null);
      setMemo("");
      setAmount("");
      setPhotoFile(null);
      setPhotoPreview(null);
      setIsPrivate(false);
      setShowForm(false);

      // peak-end 축하 연출
      const firstEverKey = "care-log-first-ever-dismissed";
      const isFirstEver = typeof window !== "undefined" && !localStorage.getItem(firstEverKey);
      // 최신 streak 조회 (이번 제출 반영)
      getMyStreakInfo()
        .then((info) => {
          setCelebration({ open: true, isFirstEver, streak: info.streak });
          if (isFirstEver) {
            try { localStorage.setItem(firstEverKey, "1"); } catch {}
          }
        })
        .catch(() => {
          setCelebration({ open: true, isFirstEver, streak: 0 });
        });
    } catch (err) {
      setError(err instanceof Error ? err.message : "기록 실패");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (logId: string) => {
    if (!confirm("이 기록을 삭제할까요?")) return;
    try {
      await deleteCareLog(logId);
      setLogs((prev) => prev.filter((l) => l.id !== logId));
      getCareLogStats(catId).then(setStats);
    } catch {
      alert("삭제 실패");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 size={20} className="animate-spin text-primary" />
      </div>
    );
  }

  const fieldStyle: React.CSSProperties = {
    borderRadius: "var(--radius-input)",
    background: "var(--color-surface)",
    border: "1px solid var(--color-border)",
    color: "var(--color-text-main)",
  };

  return (
    <div>
      {/* 통계 — 회색 칩 한 줄 */}
      {stats && stats.total > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-2 px-1 no-scrollbar">
          {(Object.entries(stats.byType) as [CareType, number][]).map(
            ([type, count]) => {
              const info = CARE_TYPE_MAP[type];
              return (
                <span
                  key={type}
                  className="shrink-0 inline-flex items-center gap-1 h-7 px-2.5 text-[11px] font-semibold text-text-sub"
                  style={{ borderRadius: "var(--radius-square)", border: "1px solid var(--color-border)" }}
                >
                  {info.label} {count}
                </span>
              );
            },
          )}
          <span
            className="shrink-0 inline-flex items-center gap-1 h-7 px-2.5 text-[11px] font-semibold text-text-sub"
            style={{ borderRadius: "var(--radius-square)", border: "1px solid var(--color-border)" }}
          >
            길집사 {stats.caretakerCount}명
          </span>
        </div>
      )}

      {/* 기록 목록 — 구분선 리스트 */}
      <div className="overflow-y-auto px-1" style={{ maxHeight: 220 }}>
        {logs.length === 0 ? (
          <p className="text-[13px] text-text-light text-center py-6">
            아직 돌봄 기록이 없어요
          </p>
        ) : (
          logs.map((log) => {
            const type = log.care_type as CareType;
            const info = CARE_TYPE_MAP[type];
            const Icon = CARE_TYPE_ICON[type] ?? NotebookPen;
            const isMine = currentUserId === log.author_id;
            return (
              <div
                key={log.id}
                className="flex gap-3 py-3"
                style={{ borderBottom: "1px solid var(--color-divider)" }}
              >
                {/* 타입 아이콘 — 회색 선 */}
                <div className="w-9 h-9 flex items-center justify-center shrink-0 text-text-sub">
                  <Icon size={18} />
                </div>
                {/* 내용 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[15px] font-semibold text-text-main">{info?.label ?? "돌봄"}</span>
                    {log.amount && (
                      <span className="text-[13px] text-text-sub">{log.amount}</span>
                    )}
                    {log.is_private && (
                      <span className="inline-flex items-center gap-0.5 text-[11px] text-text-light">
                        <Lock size={10} /> 비밀
                      </span>
                    )}
                    <span className="text-[11px] text-text-light ml-auto">
                      {formatLogTime(log.logged_at)}
                    </span>
                  </div>
                  {log.memo && (
                    <p className="text-[13px] text-text-main mt-0.5 leading-snug">{log.memo}</p>
                  )}
                  {log.photo_url && (() => {
                    // 2026-05-23 핫픽스: Image Transformation 비활성 — 원본 URL 사용.
                    const optimized = sanitizeImageUrl(log.photo_url, "");
                    // eslint-disable-next-line @next/next/no-img-element
                    return (
                      <img
                        src={optimized}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="mt-1.5 max-h-28 object-cover"
                        style={{ borderRadius: "var(--radius-card-sm)" }}
                      />
                    );
                  })()}
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-[11px] text-text-light">
                      {log.author_name ?? "익명"}
                    </span>
                    {isMine && (
                      <button
                        type="button"
                        onClick={() => handleDelete(log.id)}
                        className="ml-auto text-text-light press-strong"
                        aria-label="기록 삭제"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 입력 폼 */}
      {isLoggedIn && (
        <div className="mt-2 px-1">
          {!showForm ? (
            <UIButton variant="secondary" size="md" full onClick={() => setShowForm(true)}>
              <Plus size={14} />
              돌봄 기록 추가
            </UIButton>
          ) : (
            <div
              className="p-3 space-y-2.5"
              style={{ borderRadius: "var(--radius-card)", border: "1px solid var(--color-border)" }}
            >
              {/* 유형 선택 */}
              <div className="flex gap-1.5 flex-wrap">
                {(Object.entries(CARE_TYPE_MAP) as [CareType, typeof CARE_TYPE_MAP["feed"]][]).map(
                  ([type, info]) => {
                    const Icon = CARE_TYPE_ICON[type];
                    return (
                      <UIChip
                        key={type}
                        active={careType === type}
                        onClick={() => setCareType(type)}
                        icon={<Icon size={13} />}
                      >
                        {info.label}
                      </UIChip>
                    );
                  },
                )}
              </div>

              {/* 사료량 (밥일 때만) */}
              {careType === "feed" && (
                <input
                  type="text"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="사료량 (예: 200g, 캔 1개)"
                  className="w-full px-3 py-2 text-[13px] outline-none placeholder:text-text-light"
                  style={fieldStyle}
                />
              )}

              {/* 메모 + 사진 */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.nativeEvent.isComposing && careType && !submitting) {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                  placeholder="메모 (선택)"
                  className="flex-1 min-w-0 px-3 py-2 text-[13px] outline-none placeholder:text-text-light"
                  style={fieldStyle}
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoSelect}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="shrink-0 w-9 h-9 flex items-center justify-center press-strong"
                  style={{
                    borderRadius: "var(--radius-input)",
                    background: photoFile ? "var(--color-primary)" : "var(--color-surface)",
                    border: `1px solid ${photoFile ? "var(--color-primary)" : "var(--color-border)"}`,
                    color: photoFile ? "var(--color-surface)" : "var(--color-text-sub)",
                  }}
                  aria-label="사진 첨부"
                >
                  <Camera size={14} />
                </button>
              </div>

              {/* 비밀글 토글 — 켜면 나(작성자)만 볼 수 있음 */}
              <div
                className="flex items-center gap-2 w-full px-3 py-2"
                style={{ borderRadius: "var(--radius-input)", border: "1px solid var(--color-border)" }}
              >
                {isPrivate ? <Lock size={13} className="text-text-main" /> : <Unlock size={13} className="text-text-sub" />}
                <span className="text-[13px] font-semibold text-text-main">
                  {isPrivate ? "비밀글 — 나만 볼 수 있어요" : "비밀글로 남기기"}
                </span>
                <div className="ml-auto">
                  <SquareToggle checked={isPrivate} onChange={setIsPrivate} size="sm" aria-label="비밀글" />
                </div>
              </div>

              {/* 등록 버튼 — 한 줄 전체 폭으로 명확하게 */}
              <UIButton variant="primary" size="md" full onClick={handleSubmit} disabled={submitting || !careType}>
                {submitting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    등록 중...
                  </>
                ) : (
                  <>
                    <Send size={14} />
                    돌봄 기록 등록
                  </>
                )}
              </UIButton>

              {/* 사진 미리보기 */}
              {photoPreview && (
                <div className="relative inline-block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photoPreview} alt="" className="h-16 object-cover" style={{ borderRadius: "var(--radius-card-sm)" }} />
                  <button
                    type="button"
                    onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}
                    className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
                    aria-label="사진 제거"
                  >
                    <X size={10} className="text-text-sub" />
                  </button>
                </div>
              )}

              {error && <p className="text-[11px] text-error">{error}</p>}

              {/* 취소 */}
              <button
                type="button"
                onClick={() => { setShowForm(false); setCareType(null); setMemo(""); setAmount(""); setPhotoFile(null); setPhotoPreview(null); setError(""); }}
                className="w-full text-[13px] text-text-sub py-1"
              >
                취소
              </button>
            </div>
          )}
        </div>
      )}

      {/* 돌봄 기록 후 peak-end 축하 + commitment */}
      <CareLogCelebration
        open={celebration.open}
        catName={"이 아이"}
        isFirstEver={celebration.isFirstEver}
        streak={celebration.streak}
        onClose={() => setCelebration({ ...celebration, open: false })}
      />
    </div>
  );
}
