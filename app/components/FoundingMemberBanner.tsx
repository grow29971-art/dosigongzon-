// 창립 멤버 환영 배너 — 정식 오픈(2026-05-20) 전 가입자(admin_title='founding_member')에게만 표시.
// 한 번 닫으면 localStorage에 dismiss 기록 → 다시 안 보임.
// 5/20 오픈 후엔 더 이상 부여 안 되니 영구 희소성을 가진 자부심 마크.

"use client";

import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";

const STORAGE_KEY = "dosigongzon_founding_banner_dismissed";

export default function FoundingMemberBanner() {
  const { user } = useAuth();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    // 닫은 적 있으면 안 보여줌
    try {
      if (localStorage.getItem(STORAGE_KEY) === "1") return;
    } catch {
      // localStorage 차단 환경 — 그래도 fetch는 시도
    }

    (async () => {
      const sb = createClient();
      const { data } = await sb
        .from("profiles")
        .select("admin_title")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if ((data as { admin_title?: string | null } | null)?.admin_title === "founding_member") {
        setShow(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!show) return null;

  const handleDismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore
    }
    setShow(false);
  };

  return (
    <div
      className="relative mb-3 rounded-2xl px-4 py-3.5"
      style={{
        background: "linear-gradient(135deg, #FFF6E8 0%, #F4E6C8 100%)",
        border: "1.5px solid rgba(49,130,246,0.25)",
        boxShadow: "0 4px 14px rgba(49,130,246,0.12)",
      }}
    >
      <button
        type="button"
        onClick={handleDismiss}
        className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center active:scale-90"
        style={{ background: "rgba(49,130,246,0.10)" }}
        aria-label="배너 닫기"
      >
        <X size={14} color="#1B64DA" />
      </button>
      <div className="flex items-start gap-3 pr-7">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "linear-gradient(135deg, #3182F6 0%, #1B64DA 100%)" }}
        >
          <Sparkles size={20} color="#FFFFFF" />
        </div>
        <div className="flex-1 min-w-0">
          <p
            className="text-[13.5px] font-extrabold mb-0.5"
            style={{ color: "#5C4A3E" }}
          >
            ✨ 창립 멤버에 합류하셨어요
          </p>
          <p
            className="text-[11.5px] leading-relaxed"
            style={{ color: "rgba(92,74,62,0.75)" }}
          >
            정식 오픈(2026-05-20) 전 도시공존을 함께 시작한 초기 멤버에게 드리는 영구 타이틀이에요.
            마이페이지 → 타이틀에서 장착할 수 있어요.
          </p>
        </div>
      </div>
    </div>
  );
}
