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
      <div className="rounded-2xl p-4 mb-5" style={{ backgroundColor: "#F5F3EE", border: "1px solid rgba(173, 94, 59,0.15)" }}>
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

      {/* 이벤트 quick-fill — 6/1 출시 이후 자동 비활성 (수동 삭제) */}
      <div className="mb-5 space-y-2">
        <p className="text-[10px] font-extrabold tracking-[0.15em] text-text-light mb-1.5">EVENT QUICK-FILL</p>
        <button
          type="button"
          onClick={() => {
            setTitle("🌟 초기 200 타이틀 도착");
            setBody("정식 출시 D-3 — 초기 합류 멤버에게 영구 한정 타이틀을 부여했어요. 마이페이지에서 장착해보세요.");
            setUrl("/mypage");
          }}
          className="w-full text-left px-4 py-2.5 rounded-xl active:scale-[0.99] transition-transform"
          style={{
            background: "linear-gradient(135deg, #FFE8C2 0%, #FFCFB5 100%)",
            border: "1px solid rgba(173, 94, 59,0.30)",
          }}
        >
          <p className="text-[12.5px] font-extrabold" style={{ color: "#7A4F30" }}>
            🌟 초기 200 이벤트 안내 (출시 D-3)
          </p>
          <p className="text-[10.5px] mt-0.5" style={{ color: "#8E5430" }}>
            제목·본문·이동경로 자동 채움. 클릭 후 발송 버튼만 누르세요.
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            setTitle("📱 안드로이드 앱 출시");
            setBody("Play 스토어에서 도시공존 앱을 만나보세요. 더 빠른 알림, 한 번에 진입.");
            setUrl("https://play.google.com/store/apps/details?id=kr.dosigongzon.app");
          }}
          className="w-full text-left px-4 py-2.5 rounded-xl active:scale-[0.99] transition-transform"
          style={{
            background: "linear-gradient(135deg, #DCEAF6 0%, #B5D2EC 100%)",
            border: "1px solid rgba(74,123,168,0.30)",
          }}
        >
          <p className="text-[12.5px] font-extrabold" style={{ color: "#2C5A85" }}>
            📱 Play 스토어 앱 출시 안내
          </p>
          <p className="text-[10.5px] mt-0.5" style={{ color: "#3F6B8E" }}>
            Play 스토어 설치 URL로 외부 이동. 마케팅 옵트인자 대상.
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            setTitle("🎉 도시공존 정식 출시");
            setBody("오늘 도시공존이 정식 출시됐어요. 처음부터 함께해 주셔서 진심으로 감사합니다. 누적 기록과 감사 메시지를 확인해보세요.");
            setUrl("/celebrate");
          }}
          className="w-full text-left px-4 py-2.5 rounded-xl active:scale-[0.99] transition-transform"
          style={{
            background: "linear-gradient(135deg, #FFD6E4 0%, #FFB99B 100%)",
            border: "1px solid rgba(232,107,140,0.30)",
          }}
        >
          <p className="text-[12.5px] font-extrabold" style={{ color: "#A8395B" }}>
            🎉 정식 출시 D-Day (6/1 당일 발송)
          </p>
          <p className="text-[10.5px] mt-0.5" style={{ color: "#B5546F" }}>
            /celebrate 페이지로 안내. 출시일 한 번만 발송.
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            setTitle("🌱 도시공존 출시 첫 주");
            setBody("정식 출시 후 일주일 — 새로 합류한 이웃 소식과 다음 주 업데이트를 확인해보세요.");
            setUrl("/");
          }}
          className="w-full text-left px-4 py-2.5 rounded-xl active:scale-[0.99] transition-transform"
          style={{
            background: "linear-gradient(135deg, #E4F2E4 0%, #C9E5C9 100%)",
            border: "1px solid rgba(107,142,111,0.30)",
          }}
        >
          <p className="text-[12.5px] font-extrabold" style={{ color: "#3F6B4E" }}>
            🌱 출시 +7일 회고 (6/1 발송)
          </p>
          <p className="text-[10.5px] mt-0.5" style={{ color: "#5F8F73" }}>
            첫 주 통계·회고. 출시 다음 주말 발송 권장.
          </p>
        </button>
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
          style={{ boxShadow: "var(--shadow-primary)" }}
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
