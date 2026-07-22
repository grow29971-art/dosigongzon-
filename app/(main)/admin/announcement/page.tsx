// 접속 팝업 공지 관리 (admin 전용)
// 등록하면 사용자 최초 접속 시 모달로 1회 표시. 내리기로 즉시 중단.

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Megaphone, Send, EyeOff } from "lucide-react";
import { isCurrentUserAdmin } from "@/lib/news-repo";
import {
  getActiveAnnouncement,
  publishAnnouncement,
  clearAnnouncements,
  type Announcement,
} from "@/lib/announcements-repo";

export default function AdminAnnouncementPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  const [message, setMessage] = useState("");
  const [current, setCurrent] = useState<Announcement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  useEffect(() => {
    isCurrentUserAdmin()
      .then((isAdmin) => {
        setAuthorized(isAdmin);
        setChecking(false);
        if (!isAdmin) router.replace("/");
        else getActiveAnnouncement().then(setCurrent).catch(() => {});
      })
      .catch(() => {
        setChecking(false);
        router.replace("/");
      });
  }, [router]);

  const refresh = () => getActiveAnnouncement().then(setCurrent).catch(() => {});

  const handlePublish = async () => {
    if (busy) return;
    if (!message.trim()) {
      setError("공지 내용을 입력해주세요.");
      return;
    }
    if (
      !confirm(
        "이 공지를 지금부터 모든 접속자에게 팝업으로 띄웁니다.\n(기존 공지는 자동으로 내려가요.)\n진행할까요?",
      )
    ) {
      return;
    }
    setBusy(true);
    setError("");
    setDone("");
    try {
      await publishAnnouncement(message.trim());
      setDone("✓ 공지를 등록했어요. 이제 접속자에게 팝업으로 표시됩니다.");
      setMessage("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "등록 실패");
    } finally {
      setBusy(false);
    }
  };

  const handleClear = async () => {
    if (busy) return;
    if (!confirm("현재 팝업 공지를 내릴까요? (더 이상 표시되지 않아요.)")) return;
    setBusy(true);
    setError("");
    setDone("");
    try {
      await clearAnnouncements();
      setDone("✓ 공지를 내렸어요.");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "내리기 실패");
    } finally {
      setBusy(false);
    }
  };

  if (checking || !authorized) {
    return (
      <div className="flex justify-center pt-20">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div
      className="px-4 pt-12 pb-24 max-w-2xl mx-auto"
      style={{ background: "#F7F4EE", minHeight: "100dvh" }}
    >
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/admin"
          className="w-9 h-9 rounded-full bg-white flex items-center justify-center active:scale-90"
          style={{ boxShadow: "var(--shadow-raised)" }}
          aria-label="어드민 홈"
        >
          <ArrowLeft size={18} className="text-text-main" />
        </Link>
        <div>
          <h1 className="text-[20px] font-extrabold text-text-main tracking-tight flex items-center gap-2">
            <Megaphone size={18} className="text-primary" />
            접속 팝업 공지
          </h1>
          <p className="text-[11.5px] text-text-sub">
            등록하면 사용자 최초 접속 시 모달로 1회 표시 · 쪽지와 별개
          </p>
        </div>
      </div>

      {/* 현재 공지 */}
      <section className="mb-5">
        <p className="text-[12px] font-extrabold mb-2 px-1" style={{ color: "rgba(60,46,35,0.65)" }}>
          현재 표시 중인 공지
        </p>
        {current ? (
          <div
            className="rounded-2xl bg-white p-4 text-[13px] whitespace-pre-wrap"
            style={{ border: "1px solid rgba(0,0,0,0.06)", color: "#3D2F25" }}
          >
            {current.body}
            <button
              type="button"
              onClick={handleClear}
              disabled={busy}
              className="mt-3 flex items-center gap-1.5 text-[12px] font-bold px-3 py-1.5 rounded-lg active:scale-95 disabled:opacity-50"
              style={{ background: "#FBEAEA", color: "#B84545" }}
            >
              <EyeOff size={13} /> 이 공지 내리기
            </button>
          </div>
        ) : (
          <div
            className="rounded-2xl p-4 text-[12.5px] text-center"
            style={{ background: "#F1ECE4", color: "rgba(60,46,35,0.5)" }}
          >
            표시 중인 공지가 없어요.
          </div>
        )}
      </section>

      {/* 새 공지 작성 */}
      <section className="mb-4">
        <p className="text-[12px] font-extrabold mb-2 px-1" style={{ color: "rgba(60,46,35,0.65)" }}>
          새 공지 ({message.length}/1000)
        </p>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={7}
          maxLength={1000}
          placeholder="예) 도시공존에 곧 굿즈샵이 열려요! 준비되면 알려드릴게요 🐾"
          className="w-full rounded-2xl bg-white p-4 text-[13.5px] leading-relaxed resize-none"
          style={{
            border: "1px solid rgba(0,0,0,0.06)",
            boxShadow: "inset 0 1px 2px rgba(0,0,0,0.02)",
            color: "#3D2F25",
          }}
        />
      </section>

      <button
        type="button"
        onClick={handlePublish}
        disabled={busy || !message.trim()}
        className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-white text-[14px] font-extrabold active:scale-[0.98] disabled:opacity-60"
        style={{
          background: "linear-gradient(135deg, #C47E5A 0%, #A96A47 100%)",
          boxShadow: "0 6px 18px rgba(196,126,90,0.3)",
        }}
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        팝업 공지로 등록
      </button>

      {error && (
        <div className="mt-4 rounded-2xl p-4 text-[13px]" style={{ background: "#FBEAEA", color: "#B84545" }}>
          {error}
        </div>
      )}
      {done && (
        <div className="mt-4 rounded-2xl p-4 text-[13px]" style={{ background: "#EAF6EC", color: "#2E7D32" }}>
          {done}
        </div>
      )}

      <p className="text-center text-[11px] mt-4" style={{ color: "rgba(60,46,35,0.45)" }}>
        각 사용자에게 1회만 표시됩니다(닫으면 다시 안 뜸). 광고성 내용은 별도 규제 대상이니 서비스 안내 위주로.
      </p>
    </div>
  );
}
