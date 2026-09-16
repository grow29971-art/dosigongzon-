"use client";

// 접속 팝업 공지 — 관리자가 등록한 활성 공지를 최초 접속 시 1회 모달로 표시.
// 이후 localStorage로 재노출 방지(공지 id별). 본문은 순수 텍스트 렌더(XSS 방지).

import { useEffect, useState } from "react";
import { X, Megaphone } from "lucide-react";
import { getActiveAnnouncement, type Announcement } from "@/lib/announcements-repo";

export default function AnnouncementModal() {
  const [ann, setAnn] = useState<Announcement | null>(null);

  useEffect(() => {
    let cancelled = false;
    getActiveAnnouncement()
      .then((a) => {
        if (cancelled || !a) return;
        try {
          if (localStorage.getItem(`announcement_seen_${a.id}`)) return;
        } catch {
          /* localStorage 접근 불가 시 그냥 표시 */
        }
        setAnn(a);
      })
      .catch(() => {
        /* 조회 실패는 조용히 무시 */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ann) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(`announcement_seen_${ann.id}`, "1");
    } catch {
      /* 무시 */
    }
    setAnn(null);
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center px-6"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={dismiss}
    >
      <div
        className="relative w-full max-w-sm p-6 pt-7"
        style={{ background: "var(--color-surface)", borderRadius: "var(--radius-modal)", boxShadow: "var(--shadow-modal)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={dismiss}
          aria-label="닫기"
          className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center press-strong"
        >
          <X size={18} style={{ color: "var(--color-text-light)" }} />
        </button>

        <Megaphone size={24} strokeWidth={1.8} className="mb-3" style={{ color: "var(--color-text-main)" }} />

        <p className="text-[15px] leading-relaxed whitespace-pre-wrap text-text-main">
          {ann.body}
        </p>

        <button
          type="button"
          onClick={dismiss}
          className="mt-5 w-full h-12 text-[15px] font-semibold press"
          style={{ background: "var(--color-primary)", color: "var(--color-surface)", borderRadius: "var(--radius-input)" }}
        >
          확인했어요
        </button>
      </div>
    </div>
  );
}
