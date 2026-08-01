// ══════════════════════════════════════════
// QR 지킴판 — 구역·제보 Repository (B-1, admin 전용 조작)
// 제보 insert는 여기 없음 — /api/zone-report (Turnstile + service_role) 전용.
// 상태값은 접수(received)→이관(forwarded)→종결(closed)만 — 판정 상태 금지.
// ══════════════════════════════════════════

import { createClient } from "@/lib/supabase/client";
import { requireAdmin } from "@/lib/admin-guard";

export interface GuardianZone {
  id: string;
  label: string;
  notice: string | null;
  active: boolean;
  created_at: string;
}

export type ZoneReportStatus = "received" | "forwarded" | "closed";

export interface ZoneReport {
  id: string;
  zone_id: string;
  incident_type: string;
  occurred_when: string;
  animal_status: string;
  detail: string | null;
  status: ZoneReportStatus;
  purge_at: string;
  created_at: string;
}

export const INCIDENT_LABELS: Record<string, string> = {
  violence: "폭행·위협",
  poison_suspect: "독극물 의심",
  trap_suspect: "포획틀·덫 의심",
  shelter_damage: "급식소·쉼터 훼손",
  abandonment: "유기",
  other: "기타",
};

export const WHEN_LABELS: Record<string, string> = {
  now: "방금", hours_ago: "몇 시간 전", today: "오늘", yesterday: "어제", earlier: "그 이전", unknown: "모름",
};

export const ANIMAL_STATUS_LABELS: Record<string, string> = {
  fine: "무사", injured: "다침", dead: "죽음", missing: "안 보임", unknown: "모름",
};

export const ZONE_REPORT_STATUS_LABELS: Record<ZoneReportStatus, string> = {
  received: "접수",
  forwarded: "기관 이관",
  closed: "종결",
};

export async function listZones(): Promise<GuardianZone[]> {
  await requireAdmin();
  const supabase = createClient();
  const { data, error } = await supabase
    .from("guardian_zones")
    .select("id, label, notice, active, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`구역 조회 실패: ${error.message}`);
  return (data ?? []) as GuardianZone[];
}

export async function createZone(label: string, notice?: string): Promise<void> {
  const adminId = await requireAdmin();
  const supabase = createClient();
  const trimmed = label.trim();
  if (!trimmed) throw new Error("구역 라벨을 입력해주세요.");
  const { error } = await supabase.from("guardian_zones").insert({
    label: trimmed,
    notice: notice?.trim() || null,
    created_by: adminId,
  });
  if (error) throw new Error(`구역 생성 실패: ${error.message}`);
}

export async function setZoneActive(id: string, active: boolean): Promise<void> {
  await requireAdmin();
  const supabase = createClient();
  const { error } = await supabase.from("guardian_zones").update({ active }).eq("id", id);
  if (error) throw new Error(`구역 상태 변경 실패: ${error.message}`);
}

export async function listZoneReports(): Promise<ZoneReport[]> {
  await requireAdmin();
  const supabase = createClient();
  const { data, error } = await supabase
    .from("zone_reports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(`제보 조회 실패: ${error.message}`);
  return (data ?? []) as ZoneReport[];
}

export async function updateZoneReportStatus(id: string, status: ZoneReportStatus): Promise<void> {
  await requireAdmin();
  const supabase = createClient();
  const { error } = await supabase.from("zone_reports").update({ status }).eq("id", id);
  if (error) throw new Error(`상태 변경 실패: ${error.message}`);
}
