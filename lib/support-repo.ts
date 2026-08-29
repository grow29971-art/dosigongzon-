// ══════════════════════════════════════════
// 도시공존 — 신고/문의 Repository
// Supabase public.reports + public.inquiries
// ══════════════════════════════════════════

import { createClient } from "@/lib/supabase/client";
import { getDisplayName } from "@/lib/cats-repo";
import { requireAdmin } from "@/lib/admin-guard";
import { enforceUserActionLimit } from "@/lib/rate-limit";

// ══ 신고 ══
export type ReportTargetType = "comment" | "cat" | "post" | "post_comment" | "hospital_closed";
export type ReportReason =
  | "spam"
  | "abuse"
  | "inappropriate"
  | "false_info"
  | "other";
export type ReportStatus =
  | "pending"
  | "reviewed"
  | "resolved"
  | "dismissed";

export interface Report {
  id: string;
  reporter_id: string | null;
  reporter_email: string | null;
  reporter_name: string | null;
  target_type: ReportTargetType;
  target_id: string;
  target_snapshot: string | null;
  reason: ReportReason;
  description: string | null;
  status: ReportStatus;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
}

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  spam: "스팸/도배",
  abuse: "학대 조장",
  inappropriate: "부적절한 내용",
  false_info: "허위 정보",
  other: "기타",
};

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  pending: "대기",
  reviewed: "검토중",
  resolved: "처리완료",
  dismissed: "반려",
};

export const REPORT_STATUS_COLORS: Record<ReportStatus, string> = {
  pending: "#C9A961",
  reviewed: "#4A7BA8",
  resolved: "#6B8E6F",
  dismissed: "#A38E7A",
};

export interface CreateReportInput {
  target_type: ReportTargetType;
  target_id: string;
  target_snapshot?: string;
  reason: ReportReason;
  description?: string;
}

/** 신고 생성. 생성된 신고 id를 반환 (증거 첨부 등 후속 작업용). */
export async function createReport(input: CreateReportInput): Promise<string> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요해요.");

  // Rate limit — 분당 10건, 일당 50건 (신고 도배 방어)
  await enforceUserActionLimit(supabase, {
    table: "reports",
    userColumn: "reporter_id",
    userId: user.id,
    perMinute: 10,
    perDay: 50,
    label: "신고",
  });

  const { data, error } = await supabase.from("reports").insert({
    reporter_id: user.id,
    reporter_email: null,
    reporter_name: "익명 신고자",
    target_type: input.target_type,
    target_id: input.target_id,
    target_snapshot: input.target_snapshot ?? null,
    reason: input.reason,
    description: input.description?.trim() || null,
  }).select("id").single();

  if (error || !data) {
    console.error("[support-repo] createReport failed:", error);
    throw new Error(`신고 전송 실패: ${error?.message ?? "id 반환 실패"}`);
  }
  return (data as { id: string }).id;
}

export async function listReports(): Promise<Report[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("reports")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[support-repo] listReports failed:", error);
    return [];
  }
  return (data ?? []) as Report[];
}

/**
 * P5 신고 상태 추적 — 신고자 관점 읽기 전용 조회.
 *
 * listReports()는 운영진용(전체 조회)이라 신고자가 자기 신고 상태를 따라가는
 * P5 "신고 상태 추적"에는 맞지 않는다. 이 함수는 현재 로그인한 사용자가
 * reporter_id로 남긴 신고만 최신순으로 돌려주는 순수 읽기(SELECT) 헬퍼다.
 * 새 스키마·컬럼·라우트·뮤테이션을 만들지 않고 기존 reports 테이블만 조회하며,
 * 실제 가시성은 기존 RLS가 다시 제한한다(방어 심층). 미로그인·오류는 예외를
 * 던지지 않고 빈 배열로 fail-safe 처리해, 조회 실패가 신고자 화면을 깨지 않는다.
 */
export async function listMyReports(): Promise<Report[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("reports")
    .select("*")
    .eq("reporter_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[support-repo] listMyReports failed:", error);
    return [];
  }
  return (data ?? []) as Report[];
}

export async function updateReportStatus(
  id: string,
  status: ReportStatus,
  adminNote?: string | null,
): Promise<void> {
  await requireAdmin();
  const supabase = createClient();
  const patch: { status: ReportStatus; updated_at: string; admin_note?: string | null } = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (adminNote !== undefined) patch.admin_note = adminNote;

  const { error } = await supabase
    .from("reports")
    .update(patch)
    .eq("id", id);

  if (error) {
    console.error("[support-repo] updateReportStatus failed:", error);
    throw new Error(`상태 변경 실패: ${error.message}`);
  }
}

export async function deleteReport(id: string): Promise<void> {
  await requireAdmin();
  const supabase = createClient();
  const { error } = await supabase.from("reports").delete().eq("id", id);
  if (error) {
    console.error("[support-repo] deleteReport failed:", error);
    throw new Error(`삭제 실패: ${error.message}`);
  }
}

// ══ 문의 ══
export type InquiryStatus = "pending" | "replied" | "closed";

export interface Inquiry {
  id: string;
  user_id: string | null;
  user_email: string | null;
  user_name: string | null;
  subject: string;
  body: string;
  status: InquiryStatus;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
}

export const INQUIRY_STATUS_LABELS: Record<InquiryStatus, string> = {
  pending: "대기",
  replied: "답변됨",
  closed: "종료",
};

export const INQUIRY_STATUS_COLORS: Record<InquiryStatus, string> = {
  pending: "#C9A961",
  replied: "#6B8E6F",
  closed: "#A38E7A",
};

export interface CreateInquiryInput {
  subject: string;
  body: string;
}

export async function createInquiry(input: CreateInquiryInput): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요해요.");

  const subject = input.subject.trim();
  const body = input.body.trim();
  if (!subject) throw new Error("제목을 입력해주세요.");
  if (!body) throw new Error("내용을 입력해주세요.");

  const { error } = await supabase.from("inquiries").insert({
    user_id: user.id,
    user_email: user.email ?? null,
    user_name: getDisplayName(user),
    subject,
    body,
  });

  if (error) {
    console.error("[support-repo] createInquiry failed:", error);
    throw new Error(`문의 전송 실패: ${error.message}`);
  }
}

export async function listInquiries(): Promise<Inquiry[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("inquiries")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[support-repo] listInquiries failed:", error);
    return [];
  }
  return (data ?? []) as Inquiry[];
}

export async function updateInquiryStatus(
  id: string,
  status: InquiryStatus,
  adminNote?: string | null,
): Promise<void> {
  await requireAdmin();
  const supabase = createClient();

  // admin_note 길이 제한 (5000자) — 과도하게 긴 메시지로 발송 페이로드·DB 팽창 방지
  let note: string | null | undefined = adminNote;
  if (typeof note === "string") {
    note = note.trim().slice(0, 5000);
  }

  const patch: { status: InquiryStatus; updated_at: string; admin_note?: string | null } = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (note !== undefined) patch.admin_note = note;

  const { error } = await supabase
    .from("inquiries")
    .update(patch)
    .eq("id", id);

  if (error) {
    console.error("[support-repo] updateInquiryStatus failed:", error);
    throw new Error(`상태 변경 실패: ${error.message}`);
  }
}

export async function deleteInquiry(id: string): Promise<void> {
  await requireAdmin();
  const supabase = createClient();
  const { error } = await supabase.from("inquiries").delete().eq("id", id);
  if (error) {
    console.error("[support-repo] deleteInquiry failed:", error);
    throw new Error(`삭제 실패: ${error.message}`);
  }
}

// ══ 유저 정지 ══
export interface Suspension {
  user_id: string;
  reason: string | null;
  suspended_until: string | null;
  admin_note: string | null;
  suspended_by: string | null;
  created_at: string;
}

/**
 * 유저 정지. durationDays: 일 단위 (null/0 = 영구).
 */
export async function suspendUser(
  userId: string,
  reason: string,
  durationDays: number | null = null,
): Promise<void> {
  const adminId = await requireAdmin();
  const supabase = createClient();

  const until = durationDays
    ? new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const { error } = await supabase
    .from("user_suspensions")
    .upsert(
      {
        user_id: userId,
        reason,
        suspended_until: until,
        suspended_by: adminId,
      },
      { onConflict: "user_id" },
    );

  if (error) {
    console.error("[support-repo] suspendUser failed:", error);
    throw new Error(`유저 정지 실패: ${error.message}`);
  }
}

export async function unsuspendUser(userId: string): Promise<void> {
  await requireAdmin();
  const supabase = createClient();
  const { error } = await supabase
    .from("user_suspensions")
    .delete()
    .eq("user_id", userId);
  if (error) {
    console.error("[support-repo] unsuspendUser failed:", error);
    throw new Error(`정지 해제 실패: ${error.message}`);
  }
}

/**
 * 현재 유저가 정지 상태인지 확인.
 * 반환: { suspended: true, until?: string, reason?: string } 또는 { suspended: false }
 */
export async function getMySuspension(): Promise<{
  suspended: boolean;
  until?: string | null;
  reason?: string | null;
}> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { suspended: false };

  const { data } = await supabase
    .from("user_suspensions")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!data) return { suspended: false };

  // suspended_until이 과거면 만료된 것 → 정지 해제됨으로 간주
  if (data.suspended_until) {
    if (new Date(data.suspended_until).getTime() < Date.now()) {
      return { suspended: false };
    }
  }

  return {
    suspended: true,
    until: data.suspended_until,
    reason: data.reason,
  };
}

// ══ admin이 신고된 대상 삭제 (댓글만 — RLS가 본인 외 삭제 막음, admin은 service_role 아님) ══
// 참고: cat_comments 삭제 정책은 본인만이라 admin도 직접 못 지움.
// 대신 이 함수는 삭제 정책을 admin이 지울 수 있도록 확장된 상태에서 동작.
// (SQL 마이그레이션에서 cat_comments_delete_admin 정책 추가 필요)
export async function deleteCommentByAdmin(commentId: string): Promise<void> {
  await requireAdmin();
  const supabase = createClient();
  const { error } = await supabase
    .from("cat_comments")
    .delete()
    .eq("id", commentId);
  if (error) {
    console.error("[support-repo] deleteCommentByAdmin failed:", error);
    throw new Error(`댓글 삭제 실패: ${error.message}`);
  }
}

// admin이 고양이 삭제
export async function deleteCatByAdmin(catId: string): Promise<void> {
  await requireAdmin();
  const supabase = createClient();
  const { error } = await supabase.from("cats").delete().eq("id", catId);
  if (error) {
    console.error("[support-repo] deleteCatByAdmin failed:", error);
    throw new Error(`고양이 삭제 실패: ${error.message}`);
  }
}

// admin이 커뮤니티 댓글 삭제
export async function deletePostCommentByAdmin(commentId: string): Promise<void> {
  await requireAdmin();
  const supabase = createClient();
  const { error } = await supabase
    .from("post_comments")
    .delete()
    .eq("id", commentId);
  if (error) {
    console.error("[support-repo] deletePostCommentByAdmin failed:", error);
    throw new Error(`커뮤니티 댓글 삭제 실패: ${error.message}`);
  }
}

// admin이 병원을 hidden 처리(폐업/오류 신고에 따른 숨김).
// 데이터 삭제가 아닌 hidden=true 토글 — 추후 오신고 확인 시 되돌릴 수 있게.
export async function hideHospitalByAdmin(hospitalId: string): Promise<void> {
  await requireAdmin();
  const supabase = createClient();
  const { error } = await supabase
    .from("rescue_hospitals")
    .update({ hidden: true })
    .eq("id", hospitalId);
  if (error) {
    console.error("[support-repo] hideHospitalByAdmin failed:", error);
    throw new Error(`병원 숨김 실패: ${error.message}`);
  }
}

// admin이 hidden 상태 병원을 복원(오신고 확인 시).
export async function restoreHospitalByAdmin(hospitalId: string): Promise<void> {
  await requireAdmin();
  const supabase = createClient();
  const { error } = await supabase
    .from("rescue_hospitals")
    .update({ hidden: false })
    .eq("id", hospitalId);
  if (error) {
    console.error("[support-repo] restoreHospitalByAdmin failed:", error);
    throw new Error(`병원 복원 실패: ${error.message}`);
  }
}

// ══ 게시글·댓글 hidden 토글 (2026-08-29 법률감사 H1: posts는 Supabase로 이전됐는데
//    admin inbox가 "localStorage라 삭제 불가"로 오판해 신고 처리가 막혀 있었음) ══
// 삭제가 아닌 hidden=true 토글 — 정보통신망법 임시조치는 지체없이(1건에도) 가능해야 하고,
// 오신고 복원·증거 보존을 위해 hard delete 대신 숨김을 쓴다. RLS posts_update_admin 필요.
export async function hidePostByAdmin(postId: string): Promise<void> {
  await requireAdmin();
  const supabase = createClient();
  const { error } = await supabase.from("posts").update({ hidden: true }).eq("id", postId);
  if (error) {
    console.error("[support-repo] hidePostByAdmin failed:", error);
    throw new Error(`게시글 숨김 실패: ${error.message}`);
  }
}

export async function restorePostByAdmin(postId: string): Promise<void> {
  await requireAdmin();
  const supabase = createClient();
  const { error } = await supabase.from("posts").update({ hidden: false }).eq("id", postId);
  if (error) {
    console.error("[support-repo] restorePostByAdmin failed:", error);
    throw new Error(`게시글 복원 실패: ${error.message}`);
  }
}

// 자동숨김(신고 3건 누적) 또는 관리자 숨김된 댓글을 복원 — 오신고·표적 몰이 신고 대비.
// RLS cat_comments_update_admin / post_comments_update_admin 필요.
export async function restoreCommentByAdmin(commentId: string): Promise<void> {
  await requireAdmin();
  const supabase = createClient();
  const { error } = await supabase.from("cat_comments").update({ hidden: false }).eq("id", commentId);
  if (error) {
    console.error("[support-repo] restoreCommentByAdmin failed:", error);
    throw new Error(`댓글 복원 실패: ${error.message}`);
  }
}

export async function restorePostCommentByAdmin(commentId: string): Promise<void> {
  await requireAdmin();
  const supabase = createClient();
  const { error } = await supabase.from("post_comments").update({ hidden: false }).eq("id", commentId);
  if (error) {
    console.error("[support-repo] restorePostCommentByAdmin failed:", error);
    throw new Error(`커뮤니티 댓글 복원 실패: ${error.message}`);
  }
}
