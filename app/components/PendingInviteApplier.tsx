"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { applyInviteCode, consumePendingInviteCode } from "@/lib/invites-repo";

/**
 * 인증된 유저에게 보류 중인 초대 코드가 있으면 자동 적용.
 * layout에 한 번만 마운트되어 세션이 열릴 때 조용히 실행.
 * 실패(이미 적용됨/코드 없음 등)해도 UI 표시하지 않음 (pending 코드는 consumePendingInviteCode로 소비).
 */
export default function PendingInviteApplier() {
  const { user } = useAuth();
  const triedRef = useRef(false);

  useEffect(() => {
    if (!user || triedRef.current) return;
    const code = consumePendingInviteCode();
    if (!code) return;
    triedRef.current = true;
    applyInviteCode(code).catch(() => {});
  }, [user]);

  return null;
}
