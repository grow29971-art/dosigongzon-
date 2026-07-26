// ══════════════════════════════════════════
// 동네 돌봄 실험 — 서버 전용 헬퍼 (API 라우트 공용)
// ⚠️ service_role을 다루므로 클라이언트 컴포넌트에서 import 금지.
// 쓰기 검증(기간·멤버십·정지·1회용 토큰)은 전부 여기+라우트에서 강제한다 —
// RLS는 클라이언트 쓰기를 기본 거부하는 2차 방어선 (box/supabase_experiment_migration.sql).
// ══════════════════════════════════════════

import type { SupabaseClient } from "@supabase/supabase-js";
import { kstToday } from "@/lib/kst";

export interface ExperimentRow {
  id: string;
  public_area_name: string;
  starts_at: string; // date
  ends_at: string;   // date
  status: "draft" | "active" | "ended";
  created_by: string;
  created_at: string;
}

export type ExperimentEventName =
  | "experiment_viewed"
  | "invite_link_created"
  | "invite_link_opened"
  | "experiment_joined"
  | "care_log_started"
  | "care_log_completed"
  | "care_log_failed";

/** KST 오늘 기준 기록 가능 여부 */
export function isOpenToday(exp: Pick<ExperimentRow, "starts_at" | "ends_at" | "status">): boolean {
  const today = kstToday();
  return exp.status === "active" && exp.starts_at <= today && today <= exp.ends_at;
}

export async function getExperiment(
  svc: SupabaseClient,
  experimentId: string,
): Promise<ExperimentRow | null> {
  const { data } = await svc
    .from("experiments")
    .select("id, public_area_name, starts_at, ends_at, status, created_by, created_at")
    .eq("id", experimentId)
    .maybeSingle();
  return (data as ExperimentRow | null) ?? null;
}

export async function isMember(
  svc: SupabaseClient,
  experimentId: string,
  userId: string,
): Promise<boolean> {
  const { data } = await svc
    .from("experiment_members")
    .select("user_id")
    .eq("experiment_id", experimentId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

/** 정지 유저 차단 — profiles.suspended_until이 미래면 true */
export async function isSuspendedUser(svc: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await svc
    .from("profiles")
    .select("suspended_until")
    .eq("id", userId)
    .maybeSingle();
  const until = (data as { suspended_until: string | null } | null)?.suspended_until;
  return !!until && new Date(until).getTime() > Date.now();
}

/**
 * 최소 분석 이벤트 기록 — user_id/위치/메모를 절대 넣지 않는다 (건수 전용).
 * 실패해도 본 흐름을 막지 않는다 (fire-and-forget).
 */
export async function logExperimentEvent(
  svc: SupabaseClient,
  experimentId: string | null,
  event: ExperimentEventName,
): Promise<void> {
  try {
    await svc.from("experiment_events").insert({ experiment_id: experimentId, event });
  } catch {
    /* 계측 실패는 무시 */
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}
