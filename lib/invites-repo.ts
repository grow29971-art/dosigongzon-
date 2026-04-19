// ══════════════════════════════════════════
// 친구 초대 코드 Repository
// DB는 RPC `apply_invite_code` + view `my_invite_stats` 를 사용
// ══════════════════════════════════════════

import { createClient } from "@/lib/supabase/client";

const PENDING_INVITE_KEY = "dosigongzon_pending_invite";

export interface MyInviteInfo {
  inviteCode: string | null;
  invitedCount: number;
  invitedByCode: string | null; // 나를 초대한 사람의 코드 (있다면)
}

/**
 * 내 초대 코드와 실적을 한 번에 조회.
 * profiles에서 invite_code/invited_by 를, view에서 invited_count 를 가져옴.
 */
export async function getMyInviteInfo(): Promise<MyInviteInfo> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { inviteCode: null, invitedCount: 0, invitedByCode: null };
  }

  const [statsRes, meRes] = await Promise.all([
    supabase
      .from("my_invite_stats")
      .select("invite_code, invited_count")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("invited_by")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  let invitedByCode: string | null = null;
  if (meRes.data?.invited_by) {
    const { data: inviter } = await supabase
      .from("profiles")
      .select("invite_code")
      .eq("id", meRes.data.invited_by)
      .maybeSingle();
    invitedByCode = (inviter?.invite_code as string | null) ?? null;
  }

  return {
    inviteCode: (statsRes.data?.invite_code as string | null) ?? null,
    invitedCount: (statsRes.data?.invited_count as number | null) ?? 0,
    invitedByCode,
  };
}

/**
 * 초대 코드 적용 (가입 완료 후 호출).
 * RPC가 원자적으로 profiles.invited_by 업데이트 + invite_events insert.
 */
export async function applyInviteCode(code: string): Promise<
  | { ok: true }
  | { ok: false; error: "invalid_code_format" | "already_invited" | "code_not_found" | "self_invite_forbidden" | "not_authenticated" | "network_error" }
> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("apply_invite_code", {
    p_invite_code: code,
  });
  if (error) {
    console.error("[invites-repo] applyInviteCode RPC failed:", error);
    return { ok: false, error: "network_error" };
  }
  const res = data as { ok: boolean; error?: string; inviter_id?: string };
  if (res?.ok) return { ok: true };
  const err = (res?.error ?? "network_error") as
    | "invalid_code_format"
    | "already_invited"
    | "code_not_found"
    | "self_invite_forbidden"
    | "not_authenticated";
  return { ok: false, error: err };
}

/** 가입 페이지 등에서 쿼리로 받은 초대 코드를 보관. 가입 완료 후 적용 시 사용. */
export function setPendingInviteCode(code: string): void {
  try {
    const normalized = code.trim().toUpperCase();
    if (!normalized) return;
    localStorage.setItem(PENDING_INVITE_KEY, normalized);
  } catch { /* no-op */ }
}

export function consumePendingInviteCode(): string | null {
  try {
    const code = localStorage.getItem(PENDING_INVITE_KEY);
    if (code) localStorage.removeItem(PENDING_INVITE_KEY);
    return code;
  } catch {
    return null;
  }
}

/** 6~8자 영숫자 — 서버 쪽 규칙과 맞춤 */
export function isValidInviteCodeFormat(code: string): boolean {
  const trimmed = code.trim().toUpperCase();
  return /^[A-Z0-9]{4,10}$/.test(trimmed);
}
