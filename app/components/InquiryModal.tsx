"use client";

import { useState, useEffect } from "react";
import { X, MessageSquare, Loader2, Check } from "lucide-react";
import { createInquiry } from "@/lib/support-repo";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function InquiryModal({ open, onClose }: Props) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (open) {
      setSubject("");
      setBody("");
      setError("");
      setDone(false);
    }
  }, [open]);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError("");
    try {
      await createInquiry({ subject, body });
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
                background: "linear-gradient(135deg, #4A7BA8 0%, #3A6590 100%)",
                boxShadow: "0 4px 10px rgba(74,123,168,0.35)",
              }}
            >
              <MessageSquare size={14} color="#fff" strokeWidth={2.5} />
            </div>
            <h2 className="text-[16px] font-extrabold text-text-main tracking-tight">
              문의하기
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
              문의가 전송됐어요
            </p>
            <p className="text-[11.5px] text-text-sub">
              관리자가 확인 후 답변드릴게요
            </p>
          </div>
        ) : (
          <>
            {/* 제목 */}
            <div className="px-5 pb-3">
              <p className="text-[11px] font-bold text-text-sub mb-2">
                제목
              </p>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={100}
                placeholder="문의 제목"
                className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none"
                style={{
                  backgroundColor: "#F6F1EA",
                  color: "#2A2A28",
                  border: "1px solid #E3DCD3",
                }}
              />
            </div>

            {/* 본문 */}
            <div className="px-5 pb-3">
              <p className="text-[11px] font-bold text-text-sub mb-2">
                내용
              </p>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={6}
                maxLength={2000}
                placeholder="불편 사항, 버그, 제안 등을 자세히 적어주세요"
                className="w-full px-3 py-2.5 rounded-xl text-[12.5px] outline-none resize-none"
                style={{
                  backgroundColor: "#F6F1EA",
                  color: "#2A2A28",
                  border: "1px solid #E3DCD3",
                }}
              />
              <p className="text-[10px] text-text-light mt-1 text-right">
                {body.length} / 2000
              </p>
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
                disabled={submitting || !subject.trim() || !body.trim()}
                className="flex-1 py-3 rounded-xl text-[13px] font-bold text-white disabled:opacity-40 flex items-center justify-center gap-1.5"
                style={{
                  background: "linear-gradient(135deg, #4A7BA8 0%, #3A6590 100%)",
                  boxShadow: "0 6px 14px rgba(74,123,168,0.35)",
                }}
              >
                {submitting ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <MessageSquare size={14} />
                )}
                전송
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
