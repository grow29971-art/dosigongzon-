"use client";

import { useEffect, useState, useRef } from "react";
import {
  Plus,
  Loader2,
  Camera,
  Trash2,
  X,
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

  return (
    <div>
      {/* 통계 칩 */}
      {stats && stats.total > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-2 px-1 scrollbar-hide">
          {(Object.entries(stats.byType) as [CareType, number][]).map(
            ([type, count]) => {
              const info = CARE_TYPE_MAP[type];
              return (
                <span
                  key={type}
                  className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold"
                  style={{
                    backgroundColor: `${info.color}15`,
                    color: info.color,
                  }}
                >
                  {info.emoji} {info.label} {count}
                </span>
              );
            },
          )}
          <span className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold" style={{ backgroundColor: "#C47E5A15", color: "#C47E5A" }}>
            돌보미 {stats.caretakerCount}명
          </span>
        </div>
      )}

      {/* 기록 목록 */}
      <div className="overflow-y-auto px-1 space-y-2" style={{ maxHeight: 220 }}>
        {logs.length === 0 ? (
          <p className="text-[12px] text-text-light text-center py-6">
            아직 돌봄 기록이 없어요
          </p>
        ) : (
          logs.map((log) => {
            const info = CARE_TYPE_MAP[log.care_type as CareType];
            const isMine = currentUserId === log.author_id;
            return (
              <div
                key={log.id}
                className="flex gap-2.5 py-2 px-2 rounded-xl"
                style={{ backgroundColor: "#F9F6F2" }}
              >
                {/* 타입 아이콘 */}
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-[16px]"
                  style={{ backgroundColor: `${info.color}18` }}
                >
                  {info.emoji}
                </div>
                {/* 내용 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                      style={{ backgroundColor: `${info.color}18`, color: info.color }}
                    >
                      {info.label}
                    </span>
                    {log.amount && (
                      <span className="text-[10px] text-text-light">{log.amount}</span>
                    )}
                    <span className="text-[9px] text-text-light ml-auto">
                      {formatLogTime(log.logged_at)}
                    </span>
                  </div>
                  {log.memo && (
                    <p className="text-[12px] text-text-main mt-1 leading-snug">{log.memo}</p>
                  )}
                  {log.photo_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={sanitizeImageUrl(log.photo_url, "")}
                      alt=""
                      className="mt-1.5 rounded-lg max-h-28 object-cover"
                    />
                  )}
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-[10px] text-text-light">
                      {log.author_name ?? "익명"}
                    </span>
                    {isMine && (
                      <button
                        type="button"
                        onClick={() => handleDelete(log.id)}
                        className="ml-auto text-text-light active:scale-90"
                      >
                        <Trash2 size={11} />
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
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[12px] font-bold active:scale-[0.97] transition-transform"
              style={{ backgroundColor: "#F6F1EA", color: "#C47E5A" }}
            >
              <Plus size={14} />
              돌봄 기록 추가
            </button>
          ) : (
            <div
              className="p-3 rounded-2xl space-y-2.5"
              style={{ backgroundColor: "#F6F1EA", border: "1px solid #E5E0D6" }}
            >
              {/* 유형 선택 */}
              <div className="flex gap-1.5 flex-wrap">
                {(Object.entries(CARE_TYPE_MAP) as [CareType, typeof CARE_TYPE_MAP["feed"]][]).map(
                  ([type, info]) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setCareType(type)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all active:scale-95"
                      style={{
                        backgroundColor: careType === type ? info.color : "#fff",
                        color: careType === type ? "#fff" : info.color,
                        border: `1.5px solid ${info.color}${careType === type ? "" : "40"}`,
                      }}
                    >
                      {info.emoji} {info.label}
                    </button>
                  ),
                )}
              </div>

              {/* 사료량 (밥일 때만) */}
              {careType === "feed" && (
                <input
                  type="text"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="사료량 (예: 200g, 캔 1개)"
                  className="w-full px-3 py-2 rounded-xl text-[12px] outline-none"
                  style={{ backgroundColor: "#fff", border: "1px solid #E5E0D6", color: "#2A2A28" }}
                />
              )}

              {/* 메모 + 사진 + 전송 */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="메모 (선택)"
                  className="flex-1 px-3 py-2 rounded-xl text-[12px] outline-none"
                  style={{ backgroundColor: "#fff", border: "1px solid #E5E0D6", color: "#2A2A28" }}
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
                  className="w-9 h-9 rounded-xl flex items-center justify-center active:scale-90"
                  style={{ backgroundColor: photoFile ? "#6B8E6F" : "#fff", border: "1px solid #E5E0D6" }}
                >
                  <Camera size={14} style={{ color: photoFile ? "#fff" : "#A38E7A" }} />
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting || !careType}
                  className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center disabled:opacity-40 active:scale-90"
                >
                  {submitting ? (
                    <Loader2 size={14} className="animate-spin text-white" />
                  ) : (
                    <Plus size={16} color="#fff" strokeWidth={2.5} />
                  )}
                </button>
              </div>

              {/* 사진 미리보기 */}
              {photoPreview && (
                <div className="relative inline-block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photoPreview} alt="" className="h-16 rounded-lg object-cover" />
                  <button
                    type="button"
                    onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}
                    className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-white shadow flex items-center justify-center"
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
                className="w-full text-[11px] text-text-light py-1"
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
