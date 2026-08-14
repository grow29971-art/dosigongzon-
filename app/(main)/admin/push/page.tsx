"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Send, Loader2, Bell, Clock, X } from "lucide-react";
import { isCurrentUserAdmin } from "@/lib/news-repo";
import { createClient } from "@/lib/supabase/client";
import {
  listScheduledPushes,
  createScheduledPush,
  cancelScheduledPush,
  type ScheduledPush,
} from "@/lib/scheduled-push-repo";

// datetime-local 입력용 — 로컬 시각 기준 "YYYY-MM-DDTHH:mm"
function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const STATUS_LABEL: Record<ScheduledPush["status"], string> = {
  pending: "대기 중",
  sending: "발송 중",
  sent: "발송 완료",
  cancelled: "취소됨",
  failed: "실패",
};

export default function AdminPushPage() {
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const [title, setTitle] = useState("도시공존");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("/");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; total: number } | null>(null);
  const [error, setError] = useState("");

  // 예약 발송
  const [scheduleAt, setScheduleAt] = useState("");
  const [scheduling, setScheduling] = useState(false);
  const [scheduled, setScheduled] = useState<ScheduledPush[]>([]);
  const [scheduleMsg, setScheduleMsg] = useState("");

  const reloadScheduled = useCallback(() => {
    listScheduledPushes()
      .then(setScheduled)
      .catch(() => setScheduled([]));
  }, []);

  useEffect(() => {
    isCurrentUserAdmin().then((ok) => {
      setIsAdmin(ok);
      setAuthChecked(true);
      if (ok) reloadScheduled();
    });
  }, [reloadScheduled]);

  const handleSchedule = async () => {
    setError("");
    setScheduleMsg("");
    if (!body.trim()) return setError("메시지 내용을 입력해주세요.");
    if (!scheduleAt) return setError("발송 시각을 선택해주세요.");
    setScheduling(true);
    try {
      await createScheduledPush({
        title,
        body,
        url,
        scheduledAt: new Date(scheduleAt),
      });
      setScheduleMsg("예약했어요. 지정 시각 이후 첫 체크포인트(매일 오후 1시)에 발송됩니다.");
      setBody("");
      setScheduleAt("");
      reloadScheduled();
    } catch (err) {
      setError(err instanceof Error ? err.message : "예약에 실패했어요.");
    } finally {
      setScheduling(false);
    }
  };

  const handleCancel = async (id: string) => {
    setError("");
    setScheduleMsg("");
    try {
      await cancelScheduledPush(id);
      setScheduleMsg("예약을 취소했어요.");
      reloadScheduled();
    } catch (err) {
      setError(err instanceof Error ? err.message : "취소에 실패했어요.");
    }
  };

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
        <Link href="/map" className="text-primary text-[15px] font-bold mt-4 inline-block">
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
          <p className="text-[13px] text-text-sub">전체 구독자에게 알림을 보냅니다</p>
        </div>
      </div>

      {/* 미리보기 */}
      <div className="rounded-2xl p-4 mb-5" style={{ backgroundColor: "#F5F3EE", border: "1px solid rgba(173, 94, 59,0.15)" }}>
        <p className="text-[11px] font-bold text-text-light mb-2">미리보기</p>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
            <Bell size={18} className="text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold text-text-main">{title || "도시공존"}</p>
            <p className="text-[13px] text-text-sub mt-0.5 break-words">
              {body || "메시지 내용이 여기에 표시됩니다"}
            </p>
          </div>
        </div>
      </div>

      {/* 이벤트 quick-fill — 6/1 출시 이후 자동 비활성 (수동 삭제) */}
      <div className="mb-5 space-y-2">
        <p className="text-[11px] font-extrabold tracking-[0.15em] text-text-light mb-1.5">EVENT QUICK-FILL</p>

        <button
          type="button"
          onClick={() => {
            // 푸시 본문은 40자쯤에서 잘린다 — 핵심(시각·장소)을 앞에 두고,
            // "신청"처럼 약속의 무게가 큰 단어는 뺀다.
            setTitle("🐾 오늘 오후 4시, 종각에서 만나요");
            setBody("세계 고양이의 날 보신각 집회예요. 잠깐 얼굴만 비춰도 큰 힘이 돼요. 못 오셔도 괜찮아요 — 도시공존도 현장에 있어요.");
            setUrl("/");
            // 집회 당일 오후 1시 — 3시간 전 리마인더
            setScheduleAt(toLocalInputValue(new Date(2026, 7, 8, 13, 0)));
          }}
          className="w-full text-left px-4 py-2.5 rounded-xl active:scale-[0.99] transition-transform"
          style={{
            background: "linear-gradient(135deg, #FFE3D3 0%, #FFC9AE 100%)",
            border: "1px solid rgba(173, 94, 59,0.35)",
          }}
        >
          <p className="text-[13px] font-extrabold" style={{ color: "#8A4A28" }}>
            🐾 8/8 보신각 집회 리마인더
          </p>
          <p className="text-[11px] mt-0.5" style={{ color: "#9A5A34" }}>
            제목·본문·이동경로 + 8/8 오후 1시 예약 시각까지 자동 채움. 아래 &quot;예약 발송&quot;을 누르세요.
          </p>
        </button>

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
          <p className="text-[13px] font-extrabold" style={{ color: "#7A4F30" }}>
            🌟 초기 200 이벤트 안내 (출시 D-3)
          </p>
          <p className="text-[11px] mt-0.5" style={{ color: "#8E5430" }}>
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
          <p className="text-[13px] font-extrabold" style={{ color: "#2C5A85" }}>
            📱 Play 스토어 앱 출시 안내
          </p>
          <p className="text-[11px] mt-0.5" style={{ color: "#3F6B8E" }}>
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
            border: "1px solid var(--color-like-soft)",
          }}
        >
          <p className="text-[13px] font-extrabold" style={{ color: "#A8395B" }}>
            🎉 정식 출시 D-Day (6/1 당일 발송)
          </p>
          <p className="text-[11px] mt-0.5" style={{ color: "#B5546F" }}>
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
          <p className="text-[13px] font-extrabold" style={{ color: "#3F6B4E" }}>
            🌱 출시 +7일 회고 (6/1 발송)
          </p>
          <p className="text-[11px] mt-0.5" style={{ color: "#5F8F73" }}>
            첫 주 통계·회고. 출시 다음 주말 발송 권장.
          </p>
        </button>
      </div>

      {/* 폼 */}
      <div className="space-y-4">
        <div>
          <label className="text-[13px] font-bold text-text-main mb-1.5 block">제목</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="도시공존"
            maxLength={50}
            className="w-full px-4 py-3 rounded-2xl bg-surface-alt text-[15px] text-text-main outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-text-muted"
          />
        </div>

        <div>
          <label className="text-[13px] font-bold text-text-main mb-1.5 block">
            메시지 <span className="text-error">*</span>
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="예: 새로운 고양이 5마리가 등록됐어요! 확인해보세요."
            maxLength={200}
            rows={3}
            className="w-full px-4 py-3 rounded-2xl bg-surface-alt text-[15px] text-text-main outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-text-muted resize-none"
          />
          <p className="text-[11px] text-text-light mt-1 text-right">{body.length}/200</p>
        </div>

        <div>
          <label className="text-[13px] font-bold text-text-main mb-1.5 block">클릭 시 이동 경로</label>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="/"
            className="w-full px-4 py-3 rounded-2xl bg-surface-alt text-[15px] text-text-main outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-text-muted"
          />
          <p className="text-[11px] text-text-light mt-1">예: /map, /community, /protection</p>
        </div>

        {error && (
          <div className="rounded-2xl px-4 py-3" style={{ backgroundColor: "var(--color-error-soft)" }}>
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

        {scheduleMsg && (
          <div className="rounded-2xl px-4 py-3" style={{ backgroundColor: "#EAF0EA" }}>
            <p className="text-[13px] font-semibold" style={{ color: "#3E5A42" }}>{scheduleMsg}</p>
          </div>
        )}

        <button
          onClick={handleSend}
          disabled={sending || scheduling}
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
              지금 전체 발송
            </>
          )}
        </button>

        {/* ── 예약 발송 ── */}
        <div className="pt-2">
          <label className="text-[13px] font-bold text-text-main mb-1.5 block">
            예약 발송 시각
          </label>
          <input
            type="datetime-local"
            value={scheduleAt}
            onChange={(e) => setScheduleAt(e.target.value)}
            min={toLocalInputValue(new Date())}
            className="w-full px-4 py-3 rounded-2xl bg-surface-alt text-[15px] text-text-main outline-none focus:ring-2 focus:ring-primary/20 transition-all"
          />
          <p className="text-[11px] text-text-light mt-1 leading-relaxed">
            발송 점검은 <b>매일 오후 1시</b>에 한 번 돕니다. 지정한 시각이 지난 뒤 첫 점검에서 나가요.
            (예: 8/8 오후 1시로 두면 그날 오후 1시에 발송)
          </p>

          <button
            onClick={handleSchedule}
            disabled={sending || scheduling}
            className="w-full mt-3 py-3.5 rounded-2xl text-[15px] font-bold active:scale-[0.97] transition-transform disabled:opacity-60 flex items-center justify-center gap-2 bg-white"
            style={{ color: "var(--color-primary-dark)", border: "1.5px solid rgba(173, 94, 59,0.35)" }}
          >
            {scheduling ? (
              <>
                <Loader2 size={17} className="animate-spin" />
                예약 중...
              </>
            ) : (
              <>
                <Clock size={17} />
                예약 발송
              </>
            )}
          </button>
        </div>

        {/* 예약 목록 */}
        {scheduled.length > 0 && (
          <div className="pt-4">
            <p className="text-[11px] font-extrabold tracking-[0.15em] text-text-light mb-2">예약 목록</p>
            <div className="space-y-2">
              {scheduled.map((s) => (
                <div
                  key={s.id}
                  className="rounded-2xl px-4 py-3"
                  style={{ backgroundColor: "#F5F3EE", border: "1px solid rgba(173, 94, 59,0.15)" }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-extrabold text-text-main truncate">{s.title}</p>
                      <p className="text-[13px] text-text-sub mt-0.5 line-clamp-2">{s.body}</p>
                      <p className="text-[11px] text-text-light mt-1">
                        {new Date(s.scheduled_at).toLocaleString("ko-KR", {
                          month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
                        })}
                        {" · "}
                        <b style={{ color: s.status === "pending" ? "var(--color-primary-dark)" : undefined }}>
                          {STATUS_LABEL[s.status]}
                        </b>
                        {s.status === "sent" && s.total_count != null && (
                          <> · {s.total_count}명 중 {s.sent_count}명 도달</>
                        )}
                      </p>
                    </div>
                    {s.status === "pending" && (
                      <button
                        onClick={() => handleCancel(s.id)}
                        className="w-7 h-7 rounded-full bg-white flex items-center justify-center shrink-0 active:scale-90 transition-transform"
                        style={{ border: "1px solid rgba(173, 94, 59,0.25)" }}
                        aria-label="예약 취소"
                      >
                        <X size={14} className="text-text-sub" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
