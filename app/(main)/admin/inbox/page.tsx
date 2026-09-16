"use client";

// 신고·문의 관리 (admin 전용) — 2026-09-16 「익숙한 동네앱」 리디자인:
// 색 테두리 카드·그라디언트 탭 → 구분선 리스트 + 세그먼트 탭, 상태는 회색 태그(의미색만 예외), 액션은 헤어라인 버튼. 토큰만.

import { useEffect, useState } from "react";
import {
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
  hideHospitalByAdmin,
  restoreHospitalByAdmin,
  hidePostByAdmin,
  restorePostByAdmin,
  restoreCommentByAdmin,
  restorePostCommentByAdmin,
  suspendUser,
  REPORT_REASON_LABELS,
  REPORT_STATUS_LABELS,
  INQUIRY_STATUS_LABELS,
  type Report,
  type Inquiry,
  type ReportStatus,
  type InquiryStatus,
} from "@/lib/support-repo";
import { Ban, Eraser } from "lucide-react";
import ReportEvidenceBlock from "@/app/components/ReportEvidenceBlock";
import UIButton from "@/app/components/ui/Button";
import {
  AdminForbidden, AdminHeader, AdminLoading, AdminPage, AdminSection, AdminTag, EmptyState, HairlineButton,
  SegmentTabs, inputCls, inputStyle, type Tone,
} from "../_ui";

type Tab = "reports" | "inquiries";

// 상태 태그 톤 — 대기=warning, 완료·답변=sage, 그 외 회색
const REPORT_STATUS_TONE: Partial<Record<ReportStatus, Tone>> = { pending: "warning", resolved: "sage" };
const INQUIRY_STATUS_TONE: Partial<Record<InquiryStatus, Tone>> = { pending: "warning", replied: "sage" };

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
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [tab, setTab] = useState<Tab>("reports");
  const [reports, setReports] = useState<Report[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  // 답변 draft — inquiry id → 작성 중 메시지
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replying, setReplying] = useState<string | null>(null);

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
    // 게시글: 삭제가 아닌 hidden 토글(정보통신망법 임시조치·오신고 복원·증거 보존).
    // 2026-08-29 법률감사 H1: posts는 Supabase로 이전됐는데 "localStorage라 삭제 불가"로 막혀 있었음.
    if (report.target_type === "post") {
      if (!confirm("이 커뮤니티 게시글을 숨길까요?\n(삭제가 아닌 숨김 — 오신고 시 복원 가능)")) return;
      try {
        await hidePostByAdmin(report.target_id);
        const sameTargetReports = reports.filter(
          (r) => r.target_type === "post" && r.target_id === report.target_id && r.status === "pending",
        );
        for (const r of sameTargetReports) await updateReportStatus(r.id, "resolved");
        await refresh();
        alert("게시글이 숨김 처리됐어요.");
      } catch (err) {
        alert(err instanceof Error ? err.message : "숨김 실패");
      }
      return;
    }
    // DM 신고: 삭제할 콘텐츠 없음(쪽지는 자동 삭제). target_id = 신고당한 발신자 user id →
    // 그 유저를 정지. (2026-08-29 법률감사 H2)
    if (report.target_type === "dm") {
      const days = prompt(
        "신고된 쪽지 발신자를 정지합니다.\n정지 기간(일, 빈 값이면 영구):",
        "7",
      );
      if (days === null) return;
      const n = days.trim() === "" ? null : parseInt(days, 10);
      if (n !== null && (isNaN(n) || n < 0)) { alert("숫자를 입력해주세요."); return; }
      try {
        await suspendUser(report.target_id, "쪽지 신고 (협박/스토킹/성희롱 등)", n);
        const same = reports.filter((r) => r.target_type === "dm" && r.target_id === report.target_id && r.status === "pending");
        for (const r of same) await updateReportStatus(r.id, "resolved");
        await refresh();
        alert(n === null ? "발신자가 영구 정지됐어요." : `발신자가 ${n}일 정지됐어요.`);
      } catch (err) {
        alert(err instanceof Error ? err.message : "정지 실패");
      }
      return;
    }
    // 병원 폐업 신고: 삭제 대신 hidden 토글. 라벨·확인 메시지·액션 모두 분기.
    if (report.target_type === "hospital_closed") {
      if (!confirm("이 병원을 지도에서 숨길까요?\n(데이터 삭제는 아님 — 오신고 시 복원 가능)")) return;
      try {
        await hideHospitalByAdmin(report.target_id);
        // 같은 hospitalId에 대한 pending 신고를 모두 resolved로 마킹
        const sameTargetReports = reports.filter(
          (r) => r.target_type === "hospital_closed" && r.target_id === report.target_id && r.status === "pending",
        );
        for (const r of sameTargetReports) {
          await updateReportStatus(r.id, "resolved");
        }
        await refresh();
        alert("병원이 숨김 처리됐어요.");
      } catch (err) {
        alert(err instanceof Error ? err.message : "숨김 실패");
      }
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

  // 게시글·댓글 복원 (자동숨김 3건 누적 또는 관리자 숨김의 오신고 처리 — 2026-08-29 법률감사 H1/H2)
  const handleRestoreTarget = async (report: Report) => {
    const label =
      report.target_type === "post" ? "게시글"
        : report.target_type === "comment" ? "고양이 댓글" : "커뮤니티 댓글";
    if (!confirm(`이 ${label}을(를) 다시 표시할까요? (오신고 처리)`)) return;
    try {
      if (report.target_type === "post") await restorePostByAdmin(report.target_id);
      else if (report.target_type === "comment") await restoreCommentByAdmin(report.target_id);
      else if (report.target_type === "post_comment") await restorePostCommentByAdmin(report.target_id);
      const same = reports.filter((r) => r.target_type === report.target_type && r.target_id === report.target_id);
      for (const r of same) await updateReportStatus(r.id, "dismissed");
      await refresh();
      alert(`${label}이(가) 복원됐어요.`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "복원 실패");
    }
  };

  // 병원 신고 반려 시 — 신고만 dismiss할 게 아니라, 이미 hidden된 병원을 복원할 수도 있게.
  const handleRestoreHospital = async (report: Report) => {
    if (report.target_type !== "hospital_closed") return;
    if (!confirm("이 병원을 다시 표시할까요? (오신고 처리)")) return;
    try {
      await restoreHospitalByAdmin(report.target_id);
      // 같은 hospitalId 신고들을 모두 dismissed로
      const sameTargetReports = reports.filter(
        (r) => r.target_type === "hospital_closed" && r.target_id === report.target_id,
      );
      for (const r of sameTargetReports) {
        await updateReportStatus(r.id, "dismissed");
      }
      await refresh();
      alert("병원이 복원됐어요.");
    } catch (err) {
      alert(err instanceof Error ? err.message : "복원 실패");
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
      `신고자를 정지합니다.\n정지 기간(일 단위, 빈 값이면 영구):`,
      "7",
    );
    if (days === null) return;
    const trimmed = days.trim();
    let parsedDays: number | null = null;
    if (trimmed !== "") {
      if (!/^\d+$/.test(trimmed)) {
        alert("숫자만 입력해주세요.");
        return;
      }
      parsedDays = parseInt(trimmed, 10);
      if (parsedDays <= 0 || parsedDays > 3650) {
        alert("1 이상 3650 이하 숫자를 입력해주세요.");
        return;
      }
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

  const handleSendReply = async (id: string) => {
    const body = (replyDrafts[id] ?? "").trim();
    if (!body) {
      alert("답변 내용을 입력해주세요.");
      return;
    }
    setReplying(id);
    try {
      await updateInquiryStatus(id, "replied", body);
      setReplyDrafts((d) => {
        const next = { ...d };
        delete next[id];
        return next;
      });
      await refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "답변 저장 실패");
    } finally {
      setReplying(null);
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

  if (!authChecked || loading) return <AdminLoading />;
  if (!isAdmin) return <AdminForbidden />;

  const pendingReports = reports.filter((r) => r.status === "pending").length;
  const pendingInquiries = inquiries.filter((i) => i.status === "pending").length;

  return (
    <AdminPage>
      <AdminHeader
        title="신고·문의 관리"
        description="유저가 보낸 신고와 문의를 확인하고 처리해요"
        back="/mypage"
        backLabel="마이페이지"
      />

      {/* 탭 */}
      <SegmentTabs
        className="mb-3"
        value={tab}
        onChange={setTab}
        items={[
          { key: "reports", label: "신고", count: pendingReports },
          { key: "inquiries", label: "문의", count: pendingInquiries },
        ]}
      />

      {/* 신고 목록 */}
      {tab === "reports" && (
        <AdminSection padding={false}>
          {reports.length === 0 ? (
            <EmptyState>받은 신고가 없어요</EmptyState>
          ) : (
            reports.map((r) => (
              <div key={r.id} className="px-4 py-3 border-b border-divider last:border-b-0">
                <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                  <AdminTag tone="error">{REPORT_REASON_LABELS[r.reason]}</AdminTag>
                  <AdminTag tone={REPORT_STATUS_TONE[r.status] ?? "neutral"}>{REPORT_STATUS_LABELS[r.status]}</AdminTag>
                  <span className="text-[11px] text-text-light">· {r.target_type}</span>
                  <span className="text-[11px] text-text-light ml-auto">{formatRelative(r.created_at)}</span>
                </div>
                <p className="text-[13px] font-semibold text-text-main mb-1">신고자: 익명</p>
                {r.target_snapshot && (
                  <p className="text-[13px] leading-relaxed text-text-sub mb-2 pl-2" style={{ borderLeft: "2px solid var(--color-border)" }}>
                    <span className="text-text-light font-semibold">대상 내용:</span>{" "}
                    {r.target_snapshot}
                  </p>
                )}
                {r.description && (
                  <p className="text-[13px] text-text-sub leading-relaxed mb-2">{r.description}</p>
                )}
                {/* 증거 사진 + 기관 이관 서식 (B-2) */}
                <ReportEvidenceBlock report={r} />
                {/* 관리자 액션 — 상단 행(대상 처리) */}
                <div className="flex gap-1.5 mt-3 pt-2.5 border-t border-divider">
                  <ActionBtn
                    label={
                      r.target_type === "hospital_closed"
                        ? "병원 숨김"
                        : r.target_type === "post"
                          ? "게시글 숨김"
                          : r.target_type === "dm"
                            ? "발신자 정지"
                            : "대상 삭제"
                    }
                    onClick={() => handleDeleteTarget(r)}
                    Icon={Eraser}
                    tone="error"
                  />
                  {r.target_type === "hospital_closed" ? (
                    <ActionBtn label="병원 복원" onClick={() => handleRestoreHospital(r)} Icon={Check} tone="sage" />
                  ) : r.target_type === "post" || r.target_type === "comment" || r.target_type === "post_comment" ? (
                    <ActionBtn label="복원(오신고)" onClick={() => handleRestoreTarget(r)} Icon={Check} tone="sage" />
                  ) : (
                    <ActionBtn label="신고자 정지" onClick={() => handleSuspendReporter(r)} Icon={Ban} tone="error" />
                  )}
                </div>
                {/* 관리자 액션 — 하단 행(상태 변경) */}
                <div className="flex gap-1.5 mt-1.5">
                  <ActionBtn
                    label="처리완료"
                    onClick={() => handleReportStatus(r.id, "resolved")}
                    Icon={Check}
                    tone="sage"
                    disabled={r.status === "resolved"}
                  />
                  <ActionBtn
                    label="반려"
                    onClick={() => handleReportStatus(r.id, "dismissed")}
                    Icon={XIcon}
                    disabled={r.status === "dismissed"}
                  />
                  <ActionBtn
                    label="기록삭제"
                    onClick={() => handleReportDelete(r.id)}
                    Icon={Trash2}
                    tone="error"
                  />
                </div>
              </div>
            ))
          )}
        </AdminSection>
      )}

      {/* 문의 목록 */}
      {tab === "inquiries" && (
        <AdminSection padding={false}>
          {inquiries.length === 0 ? (
            <EmptyState>받은 문의가 없어요</EmptyState>
          ) : (
            inquiries.map((i) => (
              <div key={i.id} className="px-4 py-3 border-b border-divider last:border-b-0">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <AdminTag tone={INQUIRY_STATUS_TONE[i.status] ?? "neutral"}>{INQUIRY_STATUS_LABELS[i.status]}</AdminTag>
                  <span className="text-[11px] text-text-light ml-auto">{formatRelative(i.created_at)}</span>
                </div>
                <p className="text-[15px] font-semibold text-text-main mb-0.5 leading-tight">{i.subject}</p>
                <p className="text-[13px] text-text-light mb-2">
                  {i.user_name ?? "익명"}{" "}
                  {i.user_email && `(${i.user_email})`}
                </p>
                <p className="text-[13px] leading-relaxed whitespace-pre-wrap text-text-main">{i.body}</p>

                {/* 기존 답변(있으면) — 수정 가능하게 prefill */}
                {i.admin_note && (
                  <div className="mt-3">
                    <p className="text-[13px] font-semibold text-text-light mb-1">기존 답변</p>
                    <p
                      className="text-[13px] leading-relaxed whitespace-pre-wrap text-text-sub pl-2"
                      style={{ borderLeft: "2px solid var(--color-sage)" }}
                    >
                      {i.admin_note}
                    </p>
                  </div>
                )}

                {/* 답변 작성 */}
                <div className="mt-3">
                  <p className="text-[13px] font-semibold text-text-light mb-1">
                    {i.admin_note ? "답변 수정" : "답변 작성"}
                  </p>
                  <textarea
                    value={replyDrafts[i.id] ?? i.admin_note ?? ""}
                    onChange={(e) =>
                      setReplyDrafts((d) => ({ ...d, [i.id]: e.target.value }))
                    }
                    rows={3}
                    placeholder="유저에게 보낼 답변 내용을 작성하세요..."
                    className={`${inputCls} text-[13px] resize-none`}
                    style={inputStyle}
                  />
                  <UIButton full className="mt-2" onClick={() => handleSendReply(i.id)} disabled={replying === i.id}>
                    {replying === i.id
                      ? "저장 중..."
                      : i.admin_note
                      ? "답변 수정 · 답변됨 처리"
                      : "답변 보내기 · 답변됨 처리"}
                  </UIButton>
                </div>

                {/* 액션 */}
                <div className="flex gap-1.5 mt-3 pt-2.5 border-t border-divider">
                  <ActionBtn
                    label="종료"
                    onClick={() => handleInquiryStatus(i.id, "closed")}
                    Icon={XIcon}
                    disabled={i.status === "closed"}
                  />
                  <ActionBtn
                    label="삭제"
                    onClick={() => handleInquiryDelete(i.id)}
                    Icon={Trash2}
                    tone="error"
                  />
                </div>
              </div>
            ))
          )}
        </AdminSection>
      )}
    </AdminPage>
  );
}

/* ═══ 액션 버튼 — 헤어라인 버튼, 의미색은 글자에만 ═══ */
function ActionBtn({
  label,
  onClick,
  Icon,
  tone = "neutral",
  disabled,
}: {
  label: string;
  onClick: () => void;
  Icon: typeof Check;
  tone?: Tone;
  disabled?: boolean;
}) {
  return (
    <HairlineButton onClick={onClick} disabled={disabled} tone={tone} className="flex-1" icon={<Icon size={12} />}>
      {label}
    </HairlineButton>
  );
}
