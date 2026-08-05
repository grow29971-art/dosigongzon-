// ══════════════════════════════════════════
// 푸시 예약 발송 repo
// 실제 발송은 /api/cron/scheduled-push(매일 13:00 KST)가 service_role로 수행한다.
// 여기서는 예약을 만들고·보고·취소하는 것만 담당하며, 권한은
// requireAdmin() + RLS(scheduled_pushes 관리자 정책) 이중으로 막는다.
// ══════════════════════════════════════════

import { createClient } from "@/lib/supabase/client";
import { requireAdmin } from "@/lib/admin-guard";

export type ScheduledPushStatus = "pending" | "sending" | "sent" | "cancelled" | "failed";

export interface ScheduledPush {
  id: string;
  title: string;
  body: string;
  url: string;
  scheduled_at: string;
  status: ScheduledPushStatus;
  sent_count: number | null;
  total_count: number | null;
  sent_at: string | null;
  created_at: string;
}

export interface ScheduledPushInput {
  title: string;
  body: string;
  url: string;
  /** 로컬 시각 기준 ISO 문자열 (datetime-local 입력값을 Date로 변환해 전달) */
  scheduledAt: Date;
}

/** 푸시 이동 경로 검증 — 내부 절대경로 또는 https 외부 URL만 허용 */
export function normalizePushUrl(raw: string): string {
  const v = raw.trim();
  if (!v) return "/";
  if (v.startsWith("/") && !v.startsWith("//")) return v;
  if (/^https:\/\/[^\s]+$/i.test(v)) return v;
  return "/";
}

export async function listScheduledPushes(): Promise<ScheduledPush[]> {
  await requireAdmin();
  const supabase = createClient();
  const { data, error } = await supabase
    .from("scheduled_pushes")
    .select("id, title, body, url, scheduled_at, status, sent_count, total_count, sent_at, created_at")
    .order("scheduled_at", { ascending: false })
    .limit(30);

  if (error) {
    console.error("[scheduled-push-repo] 목록 조회 실패:", error.code);
    throw new Error("예약 목록을 불러올 수 없어요.");
  }
  return (data ?? []) as ScheduledPush[];
}

export async function createScheduledPush(input: ScheduledPushInput): Promise<void> {
  const adminId = await requireAdmin();
  const supabase = createClient();

  const body = input.body.trim();
  if (!body) throw new Error("메시지 내용을 입력해주세요.");
  if (body.length > 200) throw new Error("메시지는 200자까지예요.");
  if (Number.isNaN(input.scheduledAt.getTime())) throw new Error("발송 시각을 확인해주세요.");
  if (input.scheduledAt.getTime() < Date.now()) throw new Error("이미 지난 시각이에요.");

  const { error } = await supabase.from("scheduled_pushes").insert({
    title: input.title.trim() || "도시공존",
    body,
    url: normalizePushUrl(input.url),
    scheduled_at: input.scheduledAt.toISOString(),
    created_by: adminId,
  });

  if (error) {
    console.error("[scheduled-push-repo] 예약 생성 실패:", error.code);
    throw new Error("예약을 저장할 수 없어요.");
  }
}

/** 취소 — 아직 발송 전(pending)인 건만. 이력은 남긴다(삭제하지 않음). */
export async function cancelScheduledPush(id: string): Promise<void> {
  await requireAdmin();
  const supabase = createClient();
  const { data, error } = await supabase
    .from("scheduled_pushes")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("status", "pending")
    .select("id");

  if (error) {
    console.error("[scheduled-push-repo] 취소 실패:", error.code);
    throw new Error("취소할 수 없어요.");
  }
  if (!data || data.length === 0) {
    throw new Error("이미 발송됐거나 취소된 예약이에요.");
  }
}
