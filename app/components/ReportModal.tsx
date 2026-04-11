"use client";

import { useState, useEffect } from "react";
import { X, Flag, Loader2, Check } from "lucide-react";
import {
  createReport,
  REPORT_REASON_LABELS,
  type ReportReason,
  type ReportTargetType,
} from "@/lib/support-repo";

interface Props {
  open: boolean;
  onClose: () => void;
  targetType: ReportTargetType;
  targetId: string;
  targetSnapshot?: string; // 대상 내용 일부 (삭제돼도 확인 가능)
}

const REASONS: ReportReason[] = [
  "spam",
  "abuse",
  "inappropriate",
  "false_info",
  "other",
];

export default function ReportModal({
  open,
  onClose,
  targetType,
  targetId,
  targetSnapshot,
}: Props) {
  const [reason, setReason] = useState<ReportReason>("abuse");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (open) {
      setReason("abuse");
      setDescription("");
      setError("");
      setDone(false);
    }
  }, [open]);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError("");
    try {
      await createReport({
        target_type: targetType,
        target_id: targetId,
        target_snapshot: targetSnapshot,
        reason,
        description,
      });
      setDone(true);
      setTimeout(onClose, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "전송 실패");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm relative"
        style={{
          background: "#FFFFFF",
          borderRadius: 24,
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, #D85555 0%, #B84545 100%)",
                boxShadow: "0 4px 10px rgba(216,85,85,0.35)",
              }}
            >
              <Flag size={14} color="#fff" strokeWidth={2.5} />
            </div>
            <h2 className="text-[16px] font-extrabold text-text-main tracking-tight">
              신고하기
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="w-7 h-7 rounded-lg flex items-center justify-center active:scale-90"
            style={{ backgroundColor: "#EEE8E0" }}
          >
            <X size={13} style={{ color: "#A38E7A" }} strokeWidth={3} />
          </button>
        </div>

        {/* 성공 상태 */}
        {done ? (
          <div className="px-5 pb-6 text-center">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3"
              style={{
                background: "linear-gradient(135deg, #6B8E6F 0%, #5A7C5E 100%)",
                boxShadow: "0 6px 16px rgba(107,142,111,0.4)",
              }}
            >
              <Check size={24} color="#fff" strokeWidth={3} />
            </div>
            <p className="text-[14px] font-extrabold text-text-main mb-1">
              신고가 접수됐어요
            </p>
            <p className="text-[11.5px] text-text-sub">
              관리자가 확인 후 조치해드려요
            </p>
          </div>
        ) : (
          <>
            {/* 사유 선택 */}
            <div className="px-5 pb-3">
              <p className="text-[11px] font-bold text-text-sub mb-2">신고 사유</p>
              <div className="grid grid-cols-2 gap-1.5">
                {REASONS.map((r) => {
                  const active = reason === r;
                  return (
                    <button
                      key={r}
                      onClick={() => setReason(r)}
                      className="py-2.5 rounded-xl text-[12px] font-bold transition-all"
                      style={{
                        backgroundColor: active ? "#D85555" : "#F6F1EA",
                        color: active ? "#FFFFFF" : "#4A3F35",
                        border: `1.5px solid ${active ? "#D85555" : "#E3DCD3"}`,
                      }}
                    >
                      {REPORT_REASON_LABELS[r]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 상세 설명 */}
            <div className="px-5 pb-3">
              <p className="text-[11px] font-bold text-text-sub mb-2">
                상세 설명 (선택)
              </p>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="관리자에게 전달할 상세 내용을 적어주세요"
                className="w-full px-3 py-2.5 rounded-xl text-[12px] outline-none resize-none"
                style={{
                  backgroundColor: "#F6F1EA",
                  color: "#2A2A28",
                  border: "1px solid #E3DCD3",
                }}
              />
            </div>

            {error && (
              <p className="px-5 text-[11px]" style={{ color: "#B84545" }}>
                {error}
              </p>
            )}

            {/* 버튼 */}
            <div className="flex gap-2 px-5 pb-5 pt-2">
              <button
                onClick={onClose}
                disabled={submitting}
                className="flex-1 py-3 rounded-xl text-[13px] font-bold"
                style={{
                  backgroundColor: "#EEE8E0",
                  color: "#A38E7A",
                }}
              >
                취소
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 py-3 rounded-xl text-[13px] font-bold text-white disabled:opacity-40 flex items-center justify-center gap-1.5"
                style={{
                  background: "linear-gradient(135deg, #D85555 0%, #B84545 100%)",
                  boxShadow: "0 6px 14px rgba(216,85,85,0.35)",
                }}
              >
                {submitting ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Flag size={14} />
                )}
                신고
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
