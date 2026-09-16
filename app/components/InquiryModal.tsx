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
      // admin 이메일 알림 — 본 흐름과 분리, 실패해도 사용자에게 영향 없음
      fetch("/api/admin/notify-inquiry", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "inquiry", subject, body }),
        keepalive: true,
      }).catch(() => { /* no-op */ });
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
          background: "var(--color-surface)",
          borderRadius: "var(--radius-modal)",
          boxShadow: "var(--shadow-modal)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-2">
            <MessageSquare size={18} strokeWidth={1.8} className="text-text-sub" />
            <h2 className="text-[17px] font-bold text-text-main tracking-tight">
              문의하기
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="w-8 h-8 flex items-center justify-center press-strong"
            aria-label="닫기"
          >
            <X size={18} style={{ color: "var(--color-text-light)" }} />
          </button>
        </div>

        {done ? (
          <div className="px-5 pb-6 text-center">
            <Check size={32} strokeWidth={2} className="mx-auto mb-3" style={{ color: "var(--color-sage)" }} />
            <p className="text-[15px] font-semibold text-text-main mb-1">
              문의가 전송됐어요
            </p>
            <p className="text-[13px] text-text-sub">
              보통 24시간 내에 마이페이지 &gt; 내 문의 보기로 답변드려요
            </p>
          </div>
        ) : (
          <>
            {/* 제목 */}
            <div className="px-5 pb-3">
              <p className="text-[13px] font-semibold text-text-sub mb-2">
                제목
              </p>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={100}
                placeholder="문의 제목"
                className="w-full px-3 py-2.5 text-[15px] outline-none focus:border-primary"
                style={{
                  backgroundColor: "var(--color-surface-alt)",
                  color: "var(--color-text-main)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-input)",
                }}
              />
            </div>

            {/* 본문 */}
            <div className="px-5 pb-3">
              <p className="text-[13px] font-semibold text-text-sub mb-2">
                내용
              </p>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={6}
                maxLength={2000}
                placeholder="불편 사항, 버그, 제안 등을 자세히 적어주세요"
                className="w-full px-3 py-2.5 text-[15px] outline-none resize-none focus:border-primary"
                style={{
                  backgroundColor: "var(--color-surface-alt)",
                  color: "var(--color-text-main)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-input)",
                }}
              />
              <p className="text-[11px] text-text-light mt-1 text-right">
                {body.length} / 2000
              </p>
            </div>

            {error && (
              <p className="px-5 text-[11px]" style={{ color: "var(--color-error)" }}>
                {error}
              </p>
            )}

            {/* 버튼 */}
            <div className="flex gap-2 px-5 pb-5 pt-2">
              <button
                onClick={onClose}
                disabled={submitting}
                className="flex-1 py-3 text-[15px] font-semibold press"
                style={{
                  backgroundColor: "var(--color-gray-100)",
                  color: "var(--color-text-main)",
                  borderRadius: "var(--radius-input)",
                }}
              >
                취소
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !subject.trim() || !body.trim()}
                className="flex-1 py-3 text-[15px] font-semibold text-surface disabled:opacity-40 flex items-center justify-center gap-1.5 press"
                style={{
                  background: "var(--color-primary)",
                  borderRadius: "var(--radius-input)",
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
