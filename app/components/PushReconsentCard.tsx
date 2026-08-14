"use client";

// 푸시 재동의 회수 카드 — 2026-08-10 사용량 회의 L1.
// 브라우저 권한은 이미 허용(granted)했지만 marketing_push_enabled가 꺼진 유저 전용.
// PushOptInCard는 permission==="default"일 때만 뜨므로, 과거에 허용만 하고 동의값이
// 안 세워진 유저(실측 28명)에게는 동의 카드가 영원히 안 뜨던 구멍을 막는다.
// 법리상 동의는 자동 부여 불가 — 명시적 "켜기" 클릭으로만 세운다(마이페이지에서 해제 가능).
// supabase-js는 지연 로드 — (main) 레이아웃 마운트라 정적 import 하나가 곧 전 페이지 first-load.

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { BellRing, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

const DISMISS_KEY = "dosigongzon_push_reconsent_dismissed_at";
const DISMISS_DAYS = 7;

export default function PushReconsentCard() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  // 첫밥 동선(/cats/, FirstFeedBar와 하단 충돌)·지도(자체 하단 UI)·온보딩 계열에선 안 띄움
  const onExcludedPath =
    pathname?.startsWith("/cats/") ||
    pathname?.startsWith("/map") ||
    pathname?.startsWith("/welcome") ||
    pathname?.startsWith("/onboarding");

  useEffect(() => {
    if (!user || onExcludedPath) return;
    if (typeof window === "undefined" || typeof Notification === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    // 재동의 대상은 이미 허용한 유저만 — default/denied는 PushOptInCard 영역
    if (Notification.permission !== "granted") return;

    try {
      const dismissed = localStorage.getItem(DISMISS_KEY);
      if (dismissed) {
        const at = parseInt(dismissed, 10);
        if (Number.isFinite(at) && Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000) {
          return;
        }
      }
    } catch {
      // localStorage 차단 무시
    }

    let cancelled = false;
    (async () => {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const { data } = await createClient()
          .from("profiles")
          .select("marketing_push_enabled")
          .eq("id", user.id)
          .maybeSingle();
        if (cancelled) return;
        if (data && data.marketing_push_enabled !== true) setShow(true);
      } catch {
        // 조회 실패 시 조용히 미노출
      }
    })();
    return () => { cancelled = true; };
  }, [user, onExcludedPath]);

  const handleDismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* no-op */
    }
    setShow(false);
  };

  const handleEnable = async () => {
    if (!user) return;
    setBusy(true);
    try {
      // 권한은 이미 granted — 팝업 없이 구독만 복구 (없을 때만)
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
      if (vapidKey) {
        try {
          const reg = await navigator.serviceWorker.ready;
          const existing = await reg.pushManager.getSubscription();
          if (!existing) {
            const sub = await reg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
            });
            await fetch("/api/push/subscribe", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ subscription: sub.toJSON() }),
            });
          }
        } catch {
          /* 구독 복구 실패해도 동의 반영은 진행 — 다음 세션의 PushSubscriber가 재시도 */
        }
      }
      const { createClient } = await import("@/lib/supabase/client");
      await createClient()
        .from("profiles")
        .update({ marketing_push_enabled: true })
        .eq("id", user.id);
      // 성공 시 profile 플래그 자체가 이후 노출을 막으므로 dismiss 기록 불필요
      setShow(false);
    } catch {
      handleDismiss();
    } finally {
      setBusy(false);
    }
  };

  if (!show || onExcludedPath) return null;

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-30 w-[calc(100%-24px)] max-w-lg px-4 py-3"
      style={{
        bottom: "84px",
        background: "linear-gradient(135deg, #FFF6EE 0%, #FFE9D2 100%)",
        borderRadius: "var(--radius-input)",
        border: "1px solid #F2D6B6",
        boxShadow: "0 6px 20px rgba(44,44,44,0.12)",
      }}
    >
      <div className="flex items-center gap-2.5">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: "rgba(173, 94, 59,0.15)" }}
        >
          <BellRing size={16} style={{ color: "var(--color-primary)" }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold leading-tight" style={{ color: "#8C5A37" }}>
            돌봄 소식, 다시 받아보실래요?
          </p>
          <p className="text-[11px] mt-0.5" style={{ color: "#A88160" }}>
            이웃이 아이들을 챙긴 소식과 안부 리마인드를 보내드려요
          </p>
          <p className="text-[10px] mt-0.5" style={{ color: "#BFA084" }}>
            켜면 돌봄·소식 알림(마케팅 포함) 수신에 동의해요 · 마이페이지에서 언제든 해제
          </p>
        </div>
        <button
          onClick={handleEnable}
          disabled={busy}
          className="px-3 py-1.5 rounded-lg text-[11px] font-bold shrink-0 active:scale-95 transition-transform disabled:opacity-50"
          style={{ backgroundColor: "var(--color-primary)", color: "#fff" }}
        >
          {busy ? "..." : "켜기"}
        </button>
        <button
          onClick={handleDismiss}
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 active:scale-90"
          aria-label="닫기"
        >
          <X size={14} style={{ color: "#A88160" }} />
        </button>
      </div>
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}
