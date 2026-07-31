// ══════════════════════════════════════════
// 환불 알림 (서버 전용) — 쪽지(direct_messages) insert 재사용
// 텔레그램 연동은 존재하지 않으므로 관리자 알림은 payment-reconcile과 같은
// self-DM 패턴, 유저 알림은 broadcast-dm과 같은 운영자 발신 DM 패턴을 쓴다.
// 알림 실패는 환불 처리 자체를 막지 않는다 — 로그만 남긴다.
// ══════════════════════════════════════════

import type { SupabaseClient } from "@supabase/supabase-js";

type ProfileSnap = { id: string; nickname: string | null; avatar_url: string | null };

// ── 전체 관리자에게 self-DM (요청 접수·즉시환불 발생 알림) ──
export async function notifyAdminsRefund(svc: SupabaseClient, body: string): Promise<void> {
  try {
    const { data: admins } = await svc.from("admins").select("user_id");
    const adminIds = ((admins ?? []) as { user_id: string }[]).map((a) => a.user_id);
    if (adminIds.length === 0) return;

    const { data: profiles } = await svc
      .from("profiles")
      .select("id, nickname, avatar_url")
      .in("id", adminIds);
    const profileMap = new Map(((profiles ?? []) as ProfileSnap[]).map((p) => [p.id, p]));

    const rows = adminIds.map((id) => {
      const prof = profileMap.get(id);
      return {
        sender_id: id,
        sender_name: prof?.nickname ?? "도시공존 운영",
        sender_avatar_url: prof?.avatar_url ?? null,
        receiver_id: id,
        receiver_name: prof?.nickname ?? "운영자",
        body,
      };
    });
    const { error } = await svc.from("direct_messages").insert(rows);
    if (error) console.error("[refund-notify] admin DM failed:", error);
  } catch (e) {
    console.error("[refund-notify] admin DM error:", e);
  }
}

// ── 유저에게 처리 결과 DM (승인·거부) — 발신자는 처리한 관리자 ──
export async function notifyUserRefund(
  svc: SupabaseClient,
  adminId: string,
  userId: string,
  body: string,
): Promise<void> {
  try {
    const { data: profiles } = await svc
      .from("profiles")
      .select("id, nickname, avatar_url")
      .in("id", [adminId, userId]);
    const map = new Map(((profiles ?? []) as ProfileSnap[]).map((p) => [p.id, p]));
    const adminProf = map.get(adminId);
    const userProf = map.get(userId);

    const { error } = await svc.from("direct_messages").insert([{
      sender_id: adminId,
      sender_name: adminProf?.nickname ?? "도시공존 운영자",
      sender_avatar_url: adminProf?.avatar_url ?? null,
      receiver_id: userId,
      receiver_name: userProf?.nickname ?? "회원",
      body,
    }]);
    if (error) console.error("[refund-notify] user DM failed:", error);
  } catch (e) {
    console.error("[refund-notify] user DM error:", e);
  }
}
