"use client";

import { useEffect, useState } from "react";
import { BellRing, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { track } from "@vercel/analytics";

/**
 * 마케팅성 푸시(주간 동네 소식, 지역 채팅 유도 등) 수신 설정.
 * 댓글·쪽지·돌봄 같은 "트랜잭션성" 푸시는 이 설정과 무관하게 작동.
 */
export default function MarketingPushToggle() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("marketing_push_enabled")
        .eq("id", user.id)
        .maybeSingle();
      setEnabled((data?.marketing_push_enabled as boolean | null) ?? false);
    })();
  }, []);

  const handleToggle = async () => {
    if (enabled === null || saving) return;
    const next = !enabled;
    setSaving(true);
    setEnabled(next);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({ marketing_push_enabled: next })
      .eq("id", user.id);

    if (error) {
      setEnabled(!next);
    } else {
      try { track("marketing_push_toggled", { enabled: next }); } catch {}
    }
    setSaving(false);
  };

  return (
    <div
      className="w-full flex items-center gap-3 px-4 py-3.5 mt-2"
      style={{
        background: "#FFFFFF",
        borderRadius: 16,
        boxShadow: "0 4px 14px rgba(74,123,168,0.10), 0 1px 2px rgba(0,0,0,0.02)",
        border: "1px solid rgba(0,0,0,0.04)",
      }}
    >
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
        style={{ backgroundColor: "rgba(74,123,168,0.1)" }}
      >
        <BellRing size={18} color="#4A7BA8" strokeWidth={2} />
      </div>
      <div className="flex-1 min-w-0 text-left">
        <p className="text-[14px] font-extrabold text-text-main tracking-tight">
          동네 소식 푸시 받기
        </p>
        <p className="text-[11px] text-text-sub mt-0.5">
          주 1~2회 우리 동네 신규 소식·지역 채팅 유도 (광고성)
        </p>
      </div>
      {enabled === null ? (
        <Loader2 size={16} className="animate-spin text-text-muted shrink-0" />
      ) : (
        <button
          type="button"
          onClick={handleToggle}
          disabled={saving}
          role="switch"
          aria-checked={enabled}
          aria-label="마케팅 푸시 수신 설정"
          className="shrink-0 relative transition-colors disabled:opacity-60"
          style={{
            width: 44,
            height: 26,
            borderRadius: 999,
            background: enabled ? "#4A7BA8" : "#E5E0D6",
          }}
        >
          <span
            className="absolute top-[3px] transition-all"
            style={{
              left: enabled ? 21 : 3,
              width: 20,
              height: 20,
              borderRadius: 999,
              background: "#fff",
              boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
            }}
          />
        </button>
      )}
    </div>
  );
}
