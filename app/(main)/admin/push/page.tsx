"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Send, Loader2, Bell } from "lucide-react";
import { isCurrentUserAdmin } from "@/lib/news-repo";
import { createClient } from "@/lib/supabase/client";

export default function AdminPushPage() {
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const [title, setTitle] = useState("도시공존");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("/");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; total: number } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    isCurrentUserAdmin().then((ok) => {
      setIsAdmin(ok);
      setAuthChecked(true);
    });
  }, []);

  const handleSend = async () => {
    if (!body.trim()) return setError("메시지 내용을 입력해주세요.");
    setError("");
    setResult(null);
    setSending(true);

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("로그인이 필요해요.");

      const res = await fetch("/api/push/broadcast", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          title: title.trim() || "도시공존",
          body: body.trim(),
          url: url.trim() || "/",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "전송 실패");
      setResult(data);
      setBody("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "전송에 실패했어요.");
    } finally {
      setSending(false);
    }
  };

  if (!authChecked) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="px-5 pt-14 pb-8 text-center">
        <p className="text-[15px] text-text-sub">관리자 권한이 필요합니다.</p>
        <Link href="/map" className="text-primary text-[14px] font-bold mt-4 inline-block">
          돌아가기
        </Link>
      </div>
    );
  }

  return (
    <div className="px-5 pt-14 pb-8 max-w-lg mx-auto">
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/admin/news"
          className="w-9 h-9 rounded-full bg-surface-alt flex items-center justify-center active:scale-90 transition-transform"
        >
          <ArrowLeft size={18} className="text-text-sub" />
        </Link>
        <div>
          <h1 className="text-[20px] font-extrabold text-text-main">푸시 알림 발송</h1>
          <p className="text-[12px] text-text-sub">전체 구독자에게 알림을 보냅니다</p>
        </div>
      </div>

      {/* 미리보기 */}
      <div className="rounded-2xl p-4 mb-5" style={{ backgroundColor: "#F5F3EE", border: "1px solid rgba(196,126,90,0.15)" }}>
        <p className="text-[10px] font-bold text-text-light mb-2">미리보기</p>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
            <Bell size={18} className="text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold text-text-main">{title || "도시공존"}</p>
            <p className="text-[12px] text-text-sub mt-0.5 break-words">
              {body || "메시지 내용이 여기에 표시됩니다"}
            </p>
          </div>
        </div>
      </div>

      {/* 폼 */}
      <div className="space-y-4">
        <div>
          <label className="text-[12px] font-bold text-text-main mb-1.5 block">제목</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="도시공존"
            maxLength={50}
            className="w-full px-4 py-3 rounded-2xl bg-surface-alt text-[14px] text-text-main outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-text-muted"
          />
        </div>

        <div>
          <label className="text-[12px] font-bold text-text-main mb-1.5 block">
            메시지 <span className="text-error">*</span>
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="예: 새로운 고양이 5마리가 등록됐어요! 확인해보세요."
            maxLength={200}
            rows={3}
            className="w-full px-4 py-3 rounded-2xl bg-surface-alt text-[14px] text-text-main outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-text-muted resize-none"
          />
          <p className="text-[10px] text-text-light mt-1 text-right">{body.length}/200</p>
        </div>

        <div>
          <label className="text-[12px] font-bold text-text-main mb-1.5 block">클릭 시 이동 경로</label>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="/"
            className="w-full px-4 py-3 rounded-2xl bg-surface-alt text-[14px] text-text-main outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-text-muted"
          />
          <p className="text-[10px] text-text-light mt-1">예: /map, /community, /protection</p>
        </div>

        {error && (
          <div className="rounded-2xl px-4 py-3" style={{ backgroundColor: "#FBEAEA" }}>
            <p className="text-[13px] font-semibold" style={{ color: "#B84545" }}>{error}</p>
          </div>
        )}

        {result && (
          <div className="rounded-2xl px-4 py-3" style={{ backgroundColor: "#EAF0EA" }}>
            <p className="text-[13px] font-semibold" style={{ color: "#3E5A42" }}>
              전체 {result.total}명 중 {result.sent}명에게 전송 완료!
            </p>
          </div>
        )}

        <button
          onClick={handleSend}
          disabled={sending}
          className="w-full py-4 rounded-2xl bg-primary text-white text-[15px] font-bold active:scale-[0.97] transition-transform disabled:opacity-60 flex items-center justify-center gap-2"
          style={{ boxShadow: "0 6px 20px rgba(196,126,90,0.3)" }}
        >
          {sending ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              발송 중...
            </>
          ) : (
            <>
              <Send size={18} />
              전체 발송
            </>
          )}
        </button>
      </div>
    </div>
  );
}
