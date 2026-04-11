"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  Shield,
  Flag,
  MessageSquare,
  Trash2,
  Check,
  X as XIcon,
} from "lucide-react";
import { isCurrentUserAdmin } from "@/lib/news-repo";
import {
  listReports,
  updateReportStatus,
  deleteReport,
  listInquiries,
  updateInquiryStatus,
  deleteInquiry,
  deleteCommentByAdmin,
  deleteCatByAdmin,
  deletePostCommentByAdmin,
  suspendUser,
  REPORT_REASON_LABELS,
  REPORT_STATUS_LABELS,
  REPORT_STATUS_COLORS,
  INQUIRY_STATUS_LABELS,
  INQUIRY_STATUS_COLORS,
  type Report,
  type Inquiry,
  type ReportStatus,
  type InquiryStatus,
} from "@/lib/support-repo";
import { Ban, Eraser } from "lucide-react";

type Tab = "reports" | "inquiries";

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR", {
    month: "short",
    day: "numeric",
  });
}

export default function AdminInboxPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [tab, setTab] = useState<Tab>("reports");
  const [reports, setReports] = useState<Report[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([isCurrentUserAdmin(), listReports(), listInquiries()])
      .then(([admin, rs, is]) => {
        if (cancelled) return;
        setIsAdmin(admin);
        setReports(rs);
        setInquiries(is);
      })
      .finally(() => {
        if (cancelled) return;
        setAuthChecked(true);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = async () => {
    const [rs, is] = await Promise.all([listReports(), listInquiries()]);
    setReports(rs);
    setInquiries(is);
  };

  const handleReportStatus = async (id: string, status: ReportStatus) => {
    try {
      await updateReportStatus(id, status);
      await refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "상태 변경 실패");
    }
  };

  const handleReportDelete = async (id: string) => {
    if (!confirm("이 신고 기록을 삭제할까요?")) return;
    try {
      await deleteReport(id);
      await refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "삭제 실패");
    }
  };

  // 신고 대상 삭제
  const handleDeleteTarget = async (report: Report) => {
    if (report.target_type === "post") {
      alert(
        "커뮤니티 게시글은 localStorage 기반이라 서버에서 삭제할 수 없어요.\n신고 기록만 처리해주세요.",
      );
      return;
    }
    const label =
      report.target_type === "comment"
        ? "이 고양이 댓글"
        : report.target_type === "post_comment"
          ? "이 커뮤니티 댓글"
          : "이 고양이 등록";
    if (!confirm(`${label}을(를) 정말 삭제할까요?`)) return;
    try {
      if (report.target_type === "comment") {
        await deleteCommentByAdmin(report.target_id);
      } else if (report.target_type === "cat") {
        await deleteCatByAdmin(report.target_id);
      } else if (report.target_type === "post_comment") {
        await deletePostCommentByAdmin(report.target_id);
      }
      // 신고도 처리완료로 변경
      await updateReportStatus(report.id, "resolved");
      await refresh();
      alert("대상이 삭제됐어요.");
    } catch (err) {
      alert(err instanceof Error ? err.message : "삭제 실패");
    }
  };

  // 유저 정지 (신고 대상의 작성자 — 여기서는 신고 정보로부터 author_id를 알 수 없으므로
  // 임시로 reporter 대신 target content의 작성자 정보 필요. 단, 현재 스키마는 author_id
  // 를 reports 테이블에 안 들고 있어서 정지 대상을 확정하려면 target을 조회해야 함.
  // 실무적으로는 신고자가 아닌 작성자를 정지해야 함. 이 함수는 reporter_email을 보여주고
  // 작성자 수동 입력 또는 target 조회 기반으로 수행.
  // MVP: 신고자 본인 계정 정지(스팸/반복신고 차단)와 대상 삭제를 분리 제공.
  const handleSuspendReporter = async (report: Report) => {
    if (!report.reporter_id) {
      alert("신고자 정보가 없어요.");
      return;
    }
    const days = prompt(
      `신고자 "${report.reporter_name ?? "익명"}"을(를) 정지합니다.\n정지 기간(일 단위, 빈 값이면 영구):`,
      "7",
    );
    if (days === null) return;
    const parsedDays = days.trim() === "" ? null : parseInt(days, 10);
    if (parsedDays !== null && (isNaN(parsedDays) || parsedDays <= 0)) {
      alert("유효한 숫자를 입력해주세요.");
      return;
    }
    const reason = prompt("정지 사유:", "허위/악성 신고");
    if (reason === null) return;
    try {
      await suspendUser(report.reporter_id, reason || "관리자 정지", parsedDays);
      alert(`신고자가 정지됐어요${parsedDays ? ` (${parsedDays}일)` : " (영구)"}`);
      await refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "정지 실패");
    }
  };

  const handleInquiryStatus = async (id: string, status: InquiryStatus) => {
    try {
      await updateInquiryStatus(id, status);
      await refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "상태 변경 실패");
    }
  };

  const handleInquiryDelete = async (id: string) => {
    if (!confirm("이 문의를 삭제할까요?")) return;
    try {
      await deleteInquiry(id);
      await refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "삭제 실패");
    }
  };

  if (!authChecked || loading) {
    return (
      <div className="flex justify-center pt-20">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="px-5 pt-20 text-center">
        <Shield size={40} className="mx-auto text-text-light mb-3" strokeWidth={1.5} />
        <p className="text-[14px] font-bold text-text-main mb-1">
          관리자 전용 페이지예요
        </p>
        <p className="text-[12px] text-text-sub">접근 권한이 없어요.</p>
        <Link
          href="/mypage"
          className="inline-block mt-4 text-[13px] font-bold text-primary"
        >
          마이페이지로 돌아가기
        </Link>
      </div>
    );
  }

  const pendingReports = reports.filter((r) => r.status === "pending").length;
  const pendingInquiries = inquiries.filter((i) => i.status === "pending").length;

  return (
    <div className="px-4 pt-14 pb-24">
      {/* 헤더 */}
      <div className="mb-4">
        <button
          onClick={() => router.push("/mypage")}
          className="flex items-center gap-1 text-[12px] font-semibold text-text-sub mb-3 active:scale-95 transition-transform"
        >
          <ArrowLeft size={14} />
          마이페이지
        </button>
        <div className="flex items-baseline gap-2 mb-1">
          <h1 className="text-[22px] font-extrabold text-text-main tracking-tight">
            신고·문의 관리
          </h1>
          <span className="text-[10px] font-semibold text-text-light">
            Admin · Inbox
          </span>
        </div>
        <p className="text-[12px] text-text-sub">
          유저가 보낸 신고와 문의를 확인하고 처리해요
        </p>
      </div>

      {/* 탭 */}
      <div className="flex gap-2 mb-4">
        <TabButton
          active={tab === "reports"}
          label="신고"
          count={pendingReports}
          Icon={Flag}
          color="#D85555"
          onClick={() => setTab("reports")}
        />
        <TabButton
          active={tab === "inquiries"}
          label="문의"
          count={pendingInquiries}
          Icon={MessageSquare}
          color="#4A7BA8"
          onClick={() => setTab("inquiries")}
        />
      </div>

      {/* 신고 목록 */}
      {tab === "reports" && (
        <div className="space-y-2.5">
          {reports.length === 0 ? (
            <EmptyBox>받은 신고가 없어요</EmptyBox>
          ) : (
            reports.map((r) => (
              <div
                key={r.id}
                className="p-4"
                style={{
                  background: "#FFFFFF",
                  borderRadius: 16,
                  boxShadow: "0 4px 14px rgba(216,85,85,0.08), 0 1px 2px rgba(0,0,0,0.02)",
                  border: "1px solid rgba(0,0,0,0.04)",
                  borderLeft: `3px solid ${REPORT_STATUS_COLORS[r.status]}`,
                }}
              >
                <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                  <span
                    className="text-[10px] font-extrabold px-2 py-0.5 rounded-md text-white"
                    style={{ backgroundColor: "#D85555" }}
                  >
                    {REPORT_REASON_LABELS[r.reason]}
                  </span>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-md"
                    style={{
                      backgroundColor: `${REPORT_STATUS_COLORS[r.status]}22`,
                      color: REPORT_STATUS_COLORS[r.status],
                    }}
                  >
                    {REPORT_STATUS_LABELS[r.status]}
                  </span>
                  <span className="text-[10px] text-text-light">
                    · {r.target_type}
                  </span>
                  <span className="text-[10px] text-text-light ml-auto">
                    {formatRelative(r.created_at)}
                  </span>
                </div>
                <p className="text-[12px] font-semibold text-text-main mb-1">
                  신고자: {r.reporter_name ?? "익명"}{" "}
                  <span className="text-text-light font-normal">
                    {r.reporter_email && `(${r.reporter_email})`}
                  </span>
                </p>
                {r.target_snapshot && (
                  <div
                    className="text-[11px] leading-relaxed p-2 rounded-lg mb-2"
                    style={{ backgroundColor: "#F6F1EA", color: "#4A3F35" }}
                  >
                    <span className="text-text-light font-bold">대상 내용:</span>{" "}
                    {r.target_snapshot}
                  </div>
                )}
                {r.description && (
                  <p className="text-[11.5px] text-text-sub leading-relaxed mb-2">
                    {r.description}
                  </p>
                )}
                {/* 관리자 액션 — 상단 행(대상 처리) */}
                <div className="flex gap-1.5 mt-3 pt-2.5 border-t border-divider">
                  <ActionBtn
                    label="대상 삭제"
                    onClick={() => handleDeleteTarget(r)}
                    Icon={Eraser}
                    bg="#B84545"
                    disabled={r.target_type === "post"}
                  />
                  <ActionBtn
                    label="신고자 정지"
                    onClick={() => handleSuspendReporter(r)}
                    Icon={Ban}
                    bg="#8B65B8"
                  />
                </div>
                {/* 관리자 액션 — 하단 행(상태 변경) */}
                <div className="flex gap-1.5 mt-1.5">
                  <ActionBtn
                    label="처리완료"
                    onClick={() => handleReportStatus(r.id, "resolved")}
                    Icon={Check}
                    bg="#6B8E6F"
                    disabled={r.status === "resolved"}
                  />
                  <ActionBtn
                    label="반려"
                    onClick={() => handleReportStatus(r.id, "dismissed")}
                    Icon={XIcon}
                    bg="#A38E7A"
                    disabled={r.status === "dismissed"}
                  />
                  <ActionBtn
                    label="기록삭제"
                    onClick={() => handleReportDelete(r.id)}
                    Icon={Trash2}
                    bg="#D85555"
                  />
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* 문의 목록 */}
      {tab === "inquiries" && (
        <div className="space-y-2.5">
          {inquiries.length === 0 ? (
            <EmptyBox>받은 문의가 없어요</EmptyBox>
          ) : (
            inquiries.map((i) => (
              <div
                key={i.id}
                className="p-4"
                style={{
                  background: "#FFFFFF",
                  borderRadius: 16,
                  boxShadow: "0 4px 14px rgba(74,123,168,0.08), 0 1px 2px rgba(0,0,0,0.02)",
                  border: "1px solid rgba(0,0,0,0.04)",
                  borderLeft: `3px solid ${INQUIRY_STATUS_COLORS[i.status]}`,
                }}
              >
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-md"
                    style={{
                      backgroundColor: `${INQUIRY_STATUS_COLORS[i.status]}22`,
                      color: INQUIRY_STATUS_COLORS[i.status],
                    }}
                  >
                    {INQUIRY_STATUS_LABELS[i.status]}
                  </span>
                  <span className="text-[10px] text-text-light ml-auto">
                    {formatRelative(i.created_at)}
                  </span>
                </div>
                <p className="text-[14px] font-extrabold text-text-main mb-1 leading-tight">
                  {i.subject}
                </p>
                <p className="text-[11px] text-text-light mb-2">
                  {i.user_name ?? "익명"}{" "}
                  {i.user_email && `(${i.user_email})`}
                </p>
                <div
                  className="text-[12px] leading-relaxed p-3 rounded-lg whitespace-pre-wrap"
                  style={{ backgroundColor: "#F6F1EA", color: "#4A3F35" }}
                >
                  {i.body}
                </div>
                {/* 액션 */}
                <div className="flex gap-1.5 mt-3 pt-2.5 border-t border-divider">
                  <ActionBtn
                    label="답변됨"
                    onClick={() => handleInquiryStatus(i.id, "replied")}
                    Icon={Check}
                    bg="#6B8E6F"
                    disabled={i.status === "replied"}
                  />
                  <ActionBtn
                    label="종료"
                    onClick={() => handleInquiryStatus(i.id, "closed")}
                    Icon={XIcon}
                    bg="#A38E7A"
                    disabled={i.status === "closed"}
                  />
                  <ActionBtn
                    label="삭제"
                    onClick={() => handleInquiryDelete(i.id)}
                    Icon={Trash2}
                    bg="#D85555"
                  />
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ═══ 탭 버튼 ═══ */
function TabButton({
  active,
  label,
  count,
  Icon,
  color,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  Icon: typeof Flag;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl transition-all"
      style={{
        background: active ? `linear-gradient(135deg, ${color} 0%, ${color}DD 100%)` : "#FFFFFF",
        color: active ? "#FFFFFF" : color,
        border: `1.5px solid ${active ? color : "#E3DCD3"}`,
        boxShadow: active ? `0 4px 12px ${color}55` : "0 2px 6px rgba(0,0,0,0.03)",
      }}
    >
      <Icon size={14} strokeWidth={2.3} />
      <span className="text-[13px] font-extrabold tracking-tight">{label}</span>
      {count > 0 && (
        <span
          className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md tabular-nums"
          style={{
            backgroundColor: active ? "rgba(255,255,255,0.3)" : `${color}22`,
            color: active ? "#FFFFFF" : color,
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

/* ═══ 액션 버튼 ═══ */
function ActionBtn({
  label,
  onClick,
  Icon,
  bg,
  disabled,
}: {
  label: string;
  onClick: () => void;
  Icon: typeof Check;
  bg: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-[11px] font-bold disabled:opacity-30"
      style={{ backgroundColor: `${bg}15`, color: bg }}
    >
      <Icon size={11} strokeWidth={2.5} />
      {label}
    </button>
  );
}

/* ═══ 빈 상태 ═══ */
function EmptyBox({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="py-12 text-center text-[13px] text-text-sub"
      style={{
        background: "#FFFFFF",
        borderRadius: 16,
        boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
        border: "1px solid rgba(0,0,0,0.04)",
      }}
    >
      {children}
    </div>
  );
}
