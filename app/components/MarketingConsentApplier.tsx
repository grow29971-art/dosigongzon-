// 가입 시점에 마케팅 수신 동의를 체크했으면, OAuth callback 후 profiles에 반영.
// PendingInviteApplier와 동일한 패턴 — layout에 한 번만 마운트되어 세션 열릴 때 조용히 실행.
// 정보통신망법 §22 개별 명시적 동의 — 가입 단계에서 받은 동의를 즉시 기록.

"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";

const STORAGE_KEY = "dosigongzon_pending_marketing_consent";

export default function MarketingConsentApplier() {
  const { user } = useAuth();
  const triedRef = useRef(false);

  useEffect(() => {
    if (!user || triedRef.current) return;
    let pending = false;
    try {
      pending = sessionStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return;
    }
    if (!pending) return;
    triedRef.current = true;

    (async () => {
      const supabase = createClient();
      const { error } = await supabase
        .from("profiles")
        .update({ marketing_push_enabled: true })
        .eq("id", user.id);
      if (!error) {
        try {
          sessionStorage.removeItem(STORAGE_KEY);
        } catch {
          // ignore
        }
      }
    })();
  }, [user]);

  return null;
}
