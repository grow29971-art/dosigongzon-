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
      style={{ background: "rgba(30,22,16,0.55)", backdropFilter: "blur(2px)" }}
      onClick={dismiss}
    >
      <div
        className="relative w-full max-w-sm rounded-3xl bg-white p-6 pt-7"
        style={{ boxShadow: "0 18px 50px rgba(0,0,0,0.3)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={dismiss}
          aria-label="닫기"
          className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center active:scale-90"
          style={{ background: "#F1ECE4" }}
        >
          <X size={16} style={{ color: "#8B7562" }} />
        </button>

        <div
          className="w-11 h-11 rounded-2xl flex items-center justify-center mb-3"
          style={{ background: "rgba(196,126,90,0.14)" }}
        >
          <Megaphone size={20} style={{ color: "#C47E5A" }} />
        </div>

        <p
          className="text-[14px] leading-relaxed whitespace-pre-wrap"
          style={{ color: "#3D2F25" }}
        >
          {ann.body}
        </p>

        <button
          type="button"
          onClick={dismiss}
          className="mt-5 w-full py-3 rounded-2xl text-white text-[14px] font-extrabold active:scale-[0.98]"
          style={{
            background: "linear-gradient(135deg, #C47E5A 0%, #A96A47 100%)",
            boxShadow: "0 6px 16px rgba(196,126,90,0.32)",
          }}
        >
          확인했어요
        </button>
      </div>
    </div>
  );
}
