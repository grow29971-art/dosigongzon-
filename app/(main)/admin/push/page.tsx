"use client";

// 푸시 알림 발송 (admin 전용) — 2026-09-16 「익숙한 동네앱」 리디자인:
// 파스텔 퀵필 카드 → 구분선 리스트, 틴트 미리보기 → 헤어라인 섹션, 예약 목록 구분선 리스트. 토큰만.
// 발송 문구 템플릿(퀵필 제목·본문·경로·예약 시각)과 점검 시각 안내는 무변경.

import { useState, useEffect, useCallback } from "react";
import { Send, Loader2, Bell, Clock, X, ChevronRight } from "lucide-react";
import { isCurrentUserAdmin } from "@/lib/news-repo";
import { createClient } from "@/lib/supabase/client";
import {
  listScheduledPushes,
  createScheduledPush,
  cancelScheduledPush,
  type ScheduledPush,
} from "@/lib/scheduled-push-repo";
import UIButton from "@/app/components/ui/Button";
import {
  AdminForbidden, AdminHeader, AdminLoading, AdminPage, AdminSection, AdminTag, FieldLabel, HairlineButton,
  inputCls, inputStyle, type Tone,
} from "../_ui";

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

const STATUS_TONE: Record<ScheduledPush["status"], Tone> = {
  pending: "warning",
  sending: "neutral",
  sent: "sage",
  cancelled: "neutral",
  failed: "error",
};

// 이벤트 quick-fill — 6/1 출시 이후 자동 비활성 (수동 삭제). 문구는 발송 템플릿이라 무변경.
const QUICK_FILLS: Array<{
  label: string;
  hint: string;
  title: string;
  body: string;
  url: string;
  scheduleAt?: Date;
}> = [
  {
    label: "8/8 보신각 집회 리마인더",
    hint: "제목·본문·이동경로 + 8/8 오후 1시 예약 시각까지 자동 채움. 아래 \"예약 발송\"을 누르세요.",
    // 푸시 본문은 40자쯤에서 잘린다 — 핵심(시각·장소)을 앞에 두고,
    // "신청"처럼 약속의 무게가 큰 단어는 뺀다.
    title: "🐾 오늘 오후 4시, 종각에서 만나요",
    body: "세계 고양이의 날 보신각 집회예요. 잠깐 얼굴만 비춰도 큰 힘이 돼요. 못 오셔도 괜찮아요 — 도시공존도 현장에 있어요.",
    url: "/",
    // 집회 당일 오후 1시 — 3시간 전 리마인더
    scheduleAt: new Date(2026, 7, 8, 13, 0),
  },
  {
    label: "초기 200 이벤트 안내 (출시 D-3)",
    hint: "제목·본문·이동경로 자동 채움. 클릭 후 발송 버튼만 누르세요.",
    title: "🌟 초기 200 타이틀 도착",
    body: "정식 출시 D-3 — 초기 합류 멤버에게 영구 한정 타이틀을 부여했어요. 마이페이지에서 장착해보세요.",
    url: "/mypage",
  },
  {
    label: "Play 스토어 앱 출시 안내",
    hint: "Play 스토어 설치 URL로 외부 이동. 마케팅 옵트인자 대상.",
    title: "📱 안드로이드 앱 출시",
    body: "Play 스토어에서 도시공존 앱을 만나보세요. 더 빠른 알림, 한 번에 진입.",
    url: "https://play.google.com/store/apps/details?id=kr.dosigongzon.app",
  },
  {
    label: "정식 출시 D-Day (6/1 당일 발송)",
    hint: "/celebrate 페이지로 안내. 출시일 한 번만 발송.",
    title: "🎉 도시공존 정식 출시",
    body: "오늘 도시공존이 정식 출시됐어요. 처음부터 함께해 주셔서 진심으로 감사합니다. 누적 기록과 감사 메시지를 확인해보세요.",
    url: "/celebrate",
  },
  {
    label: "출시 +7일 회고 (6/1 발송)",
    hint: "첫 주 통계·회고. 출시 다음 주말 발송 권장.",
    title: "🌱 도시공존 출시 첫 주",
    body: "정식 출시 후 일주일 — 새로 합류한 이웃 소식과 다음 주 업데이트를 확인해보세요.",
    url: "/",
  },
];

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

  if (!authChecked) return <AdminLoading />;
  if (!isAdmin) return <AdminForbidden />;

  return (
    <AdminPage>
      <AdminHeader title="푸시 알림 발송" description="전체 구독자에게 알림을 보냅니다" />

      {/* 미리보기 */}
      <AdminSection title="미리보기">
        <div className="flex items-start gap-3">
          <Bell size={20} className="shrink-0 mt-0.5 text-text-sub" strokeWidth={1.8} />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-text-main">{title || "도시공존"}</p>
            <p className="text-[13px] text-text-sub mt-0.5 break-words">
              {body || "메시지 내용이 여기에 표시됩니다"}
            </p>
          </div>
        </div>
      </AdminSection>

      {/* 이벤트 quick-fill */}
      <AdminSection title="이벤트 빠른 채우기" padding={false}>
        {QUICK_FILLS.map((q) => (
          <button
            key={q.label}
            type="button"
            onClick={() => {
              setTitle(q.title);
              setBody(q.body);
              setUrl(q.url);
              if (q.scheduleAt) setScheduleAt(toLocalInputValue(q.scheduleAt));
            }}
            className="w-full text-left flex items-center gap-3 px-4 py-3 border-b border-divider last:border-b-0 press"
          >
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-semibold text-text-main">{q.label}</p>
              <p className="text-[13px] text-text-light mt-0.5 leading-snug">{q.hint}</p>
            </div>
            <ChevronRight size={18} className="shrink-0" style={{ color: "var(--color-text-muted)" }} />
          </button>
        ))}
      </AdminSection>

      {/* 폼 */}
      <AdminSection title="메시지">
        <div className="space-y-3">
          <div>
            <FieldLabel>제목</FieldLabel>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="도시공존"
              maxLength={50}
              className={inputCls}
              style={inputStyle}
            />
          </div>

          <div>
            <FieldLabel>
              메시지 <span style={{ color: "var(--color-error)" }}>*</span>
            </FieldLabel>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="예: 새로운 고양이 5마리가 등록됐어요. 확인해보세요."
              maxLength={200}
              rows={3}
              className={`${inputCls} resize-none`}
              style={inputStyle}
            />
            <p className="text-[11px] text-text-light mt-1 text-right tabular-nums">{body.length}/200</p>
          </div>

          <div>
            <FieldLabel>클릭 시 이동 경로</FieldLabel>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="/"
              className={inputCls}
              style={inputStyle}
            />
            <p className="text-[11px] text-text-light mt-1">예: /map, /community, /protection</p>
          </div>

          {error && (
            <p className="text-[13px] font-semibold" style={{ color: "var(--color-error)" }}>{error}</p>
          )}

          {result && (
            <p className="text-[13px] font-semibold tabular-nums" style={{ color: "var(--color-sage)" }}>
              전체 {result.total}명 중 {result.sent}명에게 전송 완료
            </p>
          )}

          {scheduleMsg && (
            <p className="text-[13px] font-semibold" style={{ color: "var(--color-sage)" }}>{scheduleMsg}</p>
          )}

          <UIButton size="lg" full onClick={handleSend} disabled={sending || scheduling}>
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
          </UIButton>
        </div>
      </AdminSection>

      {/* ── 예약 발송 ── */}
      <AdminSection title="예약 발송">
        <FieldLabel>예약 발송 시각</FieldLabel>
        <input
          type="datetime-local"
          value={scheduleAt}
          onChange={(e) => setScheduleAt(e.target.value)}
          min={toLocalInputValue(new Date())}
          className={inputCls}
          style={inputStyle}
        />
        <p className="text-[13px] text-text-light mt-1 leading-relaxed">
          발송 점검은 <b>매일 오후 1시</b>에 한 번 돕니다. 지정한 시각이 지난 뒤 첫 점검에서 나가요.
          (예: 8/8 오후 1시로 두면 그날 오후 1시에 발송)
        </p>

        <HairlineButton
          size="md"
          tone="primary"
          className="w-full mt-3"
          onClick={handleSchedule}
          disabled={sending || scheduling}
          icon={scheduling ? <Loader2 size={17} className="animate-spin" /> : <Clock size={17} />}
        >
          {scheduling ? "예약 중..." : "예약 발송"}
        </HairlineButton>
      </AdminSection>

      {/* 예약 목록 */}
      {scheduled.length > 0 && (
        <AdminSection title="예약 목록" padding={false}>
          {scheduled.map((s) => (
            <div key={s.id} className="flex items-start gap-3 px-4 py-3 border-b border-divider last:border-b-0">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-[15px] font-semibold text-text-main truncate">{s.title}</p>
                  <AdminTag tone={STATUS_TONE[s.status]}>{STATUS_LABEL[s.status]}</AdminTag>
                </div>
                <p className="text-[13px] text-text-sub mt-0.5 line-clamp-2">{s.body}</p>
                <p className="text-[13px] text-text-light mt-1 tabular-nums">
                  {new Date(s.scheduled_at).toLocaleString("ko-KR", {
                    month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
                  })}
                  {s.status === "sent" && s.total_count != null && (
                    <> · {s.total_count}명 중 {s.sent_count}명 도달</>
                  )}
                </p>
              </div>
              {s.status === "pending" && (
                <button
                  type="button"
                  onClick={() => handleCancel(s.id)}
                  className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 press text-text-sub"
                  style={{ border: "1px solid var(--color-border)" }}
                  aria-label="예약 취소"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
        </AdminSection>
      )}
    </AdminPage>
  );
}
