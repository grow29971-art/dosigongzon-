// ══════════════════════════════════════════
// admin 권한 가드
// RLS에 더해 코드 레벨 이중 확인 — 정책 실수/퇴행 대비.
// ══════════════════════════════════════════

import { createClient } from "@/lib/supabase/client";

export class NotAdminError extends Error {
  constructor(message = "관리자 권한이 필요합니다.") {
    super(message);
    this.name = "NotAdminError";
  }
}

/**
 * 현재 로그인 유저가 admin이 아니면 throw.
 * 성공 시 user.id 반환 — suspended_by 등에 재사용.
 */
export async function requireAdmin(): Promise<string> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new NotAdminError("로그인이 필요해요.");

  const { data, error } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[admin-guard] requireAdmin check failed:", error);
    throw new NotAdminError();
  }
  if (!data) throw new NotAdminError();

  return user.id;
}
