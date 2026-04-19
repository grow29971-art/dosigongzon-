"use client";

import { useEffect, useState } from "react";
import { Mail, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { track } from "@vercel/analytics";

export default function EmailDigestToggle() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("email_digest_enabled")
        .eq("id", user.id)
        .maybeSingle();
      setEnabled((data?.email_digest_enabled as boolean | null) ?? true);
    })();
  }, []);

  const handleToggle = async () => {
    if (enabled === null || saving) return;
    const next = !enabled;
    setSaving(true);
    setEnabled(next); // 낙관적 업데이트

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({ email_digest_enabled: next })
      .eq("id", user.id);

    if (error) {
      setEnabled(!next); // 롤백
      console.error("[email-digest] toggle failed:", error);
    } else {
      try { track("email_digest_toggled", { enabled: next }); } catch {}
    }
    setSaving(false);
  };

  return (
    <div
      id="email-digest"
      className="w-full flex items-center gap-3 px-4 py-3.5 mt-2"
      style={{
        background: "#FFFFFF",
        borderRadius: 16,
        boxShadow: "0 4px 14px rgba(232,107,140,0.10), 0 1px 2px rgba(0,0,0,0.02)",
        border: "1px solid rgba(0,0,0,0.04)",
      }}
    >
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
        style={{ backgroundColor: "rgba(232,107,140,0.1)" }}
      >
        <Mail size={18} color="#E86B8C" strokeWidth={2} />
      </div>
      <div className="flex-1 min-w-0 text-left">
        <p className="text-[14px] font-extrabold text-text-main tracking-tight">
          주간 이메일 받기
        </p>
        <p className="text-[11px] text-text-sub mt-0.5">
          월요일마다 이번 주 동네 소식을 이메일로 보내드려요
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
          aria-label="주간 이메일 수신 설정"
          className="shrink-0 relative transition-colors disabled:opacity-60"
          style={{
            width: 44,
            height: 26,
            borderRadius: 999,
            background: enabled ? "#E86B8C" : "#E5E0D6",
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
