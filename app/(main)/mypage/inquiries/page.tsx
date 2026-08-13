"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Loader2, Inbox, Clock, CheckCircle2, MessageSquare,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { listInquiries, listMyReports, INQUIRY_STATUS_LABELS, INQUIRY_STATUS_COLORS, type Inquiry } from "@/lib/support-repo";
import { isCoreJourneyEnabled } from "@/lib/core-journey-flags";
import { buildMyReportsPanel, myReportsPanelHasContent, type MyReportsPanel } from "@/lib/report-status";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function MyInquiriesPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // P5 신고 상태 추적: flag가 켜졌을 때만 내가 접수한 신고의 진행 상태 패널을
  // 이 화면(내 문의) 상단에 함께 보여준다. flag off 또는 kill switch on이면
  // 아래 배선이 모두 no-op이라 기존 내 문의 화면이 그대로 유지된다(fail-closed).
  const showReportStatus = isCoreJourneyEnabled("P5");
  const [reportsPanel, setReportsPanel] = useState<MyReportsPanel | null>(null);

  useEffect(() => {
    if (!user) return;
    listInquiries()
      .then((all) => setItems(all.filter((i) => i.user_id === user.id)))
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    if (!user || !showReportStatus) {
      // Clear any previously loaded panel on logout / flag-off so a stale
      // reporter panel can never linger. This is a one-time reset on
      // user/flag change (not a per-render cascade), so the synchronous
      // setState here is a known false positive.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setReportsPanel(null);
      return;
    }
    let alive = true;
    listMyReports()
      .then((rows) => {
        if (alive) setReportsPanel(buildMyReportsPanel(rows));
      })
      .catch(() => {
        // fail-safe: 신고 목록 조회 실패는 내 문의 화면을 막지 않는다.
        if (alive) setReportsPanel(null);
      });
    return () => {
      alive = false;
    };
  }, [user, showReportStatus]);

  if (authLoading || loading) {
    return (
      <div className="flex justify-center pt-20">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="px-5 pt-20 text-center">
        <p className="text-[14px] text-text-sub">로그인이 필요해요.</p>
        <Link href="/login?next=%2Fmypage%2Finquiries" className="inline-block mt-4 text-[13px] font-bold text-primary">
          로그인하기
        </Link>
      </div>
    );
  }

  const pending = items.filter((i) => i.status === "pending").length;
  const replied = items.filter((i) => i.status === "replied").length;
  const showReportsPanel =
    showReportStatus && myReportsPanelHasContent(reportsPanel);

  return (
    <div className="px-4 pt-14 pb-24 max-w-[720px] mx-auto">
      {/* 헤더 */}
      <div className="mb-5">
        <button
          onClick={() => router.push("/mypage")}
          className="flex items-center gap-1 text-[12px] font-semibold text-text-sub mb-3 active:scale-95 transition-transform"
        >
          <ArrowLeft size={14} />
          마이페이지
        </button>
        <div className="flex items-baseline gap-2 mb-1">
          <h1 className="text-[22px] font-extrabold text-text-main tracking-tight">
            내 문의
          </h1>
          <span className="text-[10px] font-semibold text-text-light">My Inquiries</span>
        </div>
        <div className="flex items-center gap-3 text-[12px] text-text-sub">
          <span className="flex items-center gap-1">
            <Inbox size={13} /> 전체 {items.length}
          </span>
          {pending > 0 && (
            <span className="flex items-center gap-1" style={{ color: "#C9A961" }}>
              <Clock size={13} /> 대기 {pending}
            </span>
          )}
          {replied > 0 && (
            <span className="flex items-center gap-1" style={{ color: "#48A59E" }}>
              <CheckCircle2 size={13} /> 답변 {replied}
            </span>
          )}
        </div>
      </div>

      {/* P5 내 신고 상태 (flag on & 접수한 신고가 있을 때만) */}
      {showReportsPanel && reportsPanel && (
        <div
          className="mb-5 rounded-2xl bg-white overflow-hidden"
          style={{ border: "1px solid rgba(0,0,0,0.05)", boxShadow: "var(--shadow-card)" }}
        >
          <div className="px-4 pt-3.5 pb-2">
            <div className="flex items-baseline gap-2">
              <h2 className="text-[14px] font-extrabold text-text-main">내 신고 상태</h2>
              <span className="text-[11px] text-text-sub ml-auto">{reportsPanel.headline}</span>
            </div>
          </div>
          <div style={{ borderTop: "1px solid rgba(0,0,0,0.05)" }}>
            {reportsPanel.items.map((it) => (
              <div
                key={it.id}
                className="px-4 py-3"
                style={{
                  borderBottom: "1px solid rgba(0,0,0,0.04)",
                  opacity: it.closed ? 0.65 : 1,
                }}
              >
                <p className="text-[12.5px] font-bold text-text-main">{it.line}</p>
                <p className="text-[11.5px] text-text-sub mt-0.5">{it.detail}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 빈 상태 */}
      {items.length === 0 && (
        <div
          className="py-16 text-center rounded-2xl bg-white"
          style={{ border: "1px solid rgba(0,0,0,0.05)" }}
        >
          <MessageSquare size={36} strokeWidth={1.2} className="text-text-light mx-auto mb-3" />
          <p className="text-[14px] font-bold text-text-main mb-1">아직 접수한 문의가 없어요</p>
          <p className="text-[12px] text-text-sub mb-4">
            궁금한 점이나 불편사항을 관리자에게 전달할 수 있어요
          </p>
          <Link
            href="/mypage"
            className="inline-block px-4 py-2 rounded-xl text-[12px] font-bold text-white"
            style={{ background: "linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)" }}
          >
            마이페이지에서 문의하기
          </Link>
        </div>
      )}

      {/* 문의 목록 */}
      <div className="space-y-3">
        {items.map((iq) => {
          const expanded = expandedId === iq.id;
          const color = INQUIRY_STATUS_COLORS[iq.status];
          const label = INQUIRY_STATUS_LABELS[iq.status];
          return (
            <div
              key={iq.id}
              className="bg-white rounded-2xl overflow-hidden"
              style={{
                border: `1px solid ${iq.status === "replied" ? `${color}30` : "rgba(0,0,0,0.05)"}`,
                boxShadow: "var(--shadow-card)",
              }}
            >
              <button
                type="button"
                onClick={() => setExpandedId(expanded ? null : iq.id)}
                className="w-full text-left px-4 py-3.5 active:bg-gray-50"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span
                    className="text-[9.5px] font-extrabold px-2 py-0.5 chip-square"
                    style={{ backgroundColor: `${color}15`, color }}
                  >
                    {label}
                  </span>
                  <span className="text-[10.5px] text-text-light ml-auto">
                    {formatDate(iq.created_at)}
                  </span>
                </div>
                <p className="text-[13.5px] font-extrabold text-text-main truncate">
                  {iq.subject}
                </p>
                <p className="text-[11.5px] text-text-sub mt-0.5 truncate">
                  {iq.body}
                </p>
              </button>

              {expanded && (
                <div
                  className="px-4 pb-4 pt-2 space-y-3"
                  style={{ borderTop: "1px solid rgba(0,0,0,0.05)" }}
                >
                  {/* 내 문의 원본 */}
                  <div className="rounded-xl p-3" style={{ background: "var(--color-gray-50)" }}>
                    <p className="text-[10px] font-extrabold text-text-sub tracking-[0.1em] mb-1.5">
                      내 문의
                    </p>
                    <p className="text-[13px] text-text-main whitespace-pre-wrap leading-relaxed">
                      {iq.body}
                    </p>
                  </div>

                  {/* 관리자 답변 */}
                  {iq.admin_note ? (
                    <div
                      className="rounded-xl p-3"
                      style={{
                        background: "linear-gradient(135deg, rgba(72,165,158,0.08) 0%, rgba(72,165,158,0.04) 100%)",
                        border: "1px solid rgba(72,165,158,0.2)",
                      }}
                    >
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <CheckCircle2 size={12} style={{ color: "#48A59E" }} />
                        <p className="text-[10px] font-extrabold tracking-[0.1em]" style={{ color: "#48A59E" }}>
                          관리자 답변
                        </p>
                        <span className="text-[10px] text-text-light ml-auto">
                          {formatDate(iq.updated_at)}
                        </span>
                      </div>
                      <p className="text-[13px] text-text-main whitespace-pre-wrap leading-relaxed">
                        {iq.admin_note}
                      </p>
                    </div>
                  ) : (
                    <div
                      className="rounded-xl p-3 text-center"
                      style={{ background: "#FFF9E8", border: "1px dashed rgba(201,169,97,0.3)" }}
                    >
                      <p className="text-[11.5px]" style={{ color: "#8A7318" }}>
                        {iq.status === "pending"
                          ? "아직 답변을 기다리고 있어요"
                          : "답변이 등록되지 않았어요"}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
