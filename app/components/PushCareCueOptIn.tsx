"use client";

// 돌봄 cue 푸시 옵트인 카드 (홈 상단, catCount>0 + 미구독 유저).
// 일반 PushOptInCard(하단·범용)과 별개로, 고양이 보유자 전용·가치 제안을 차별화.
// Notification.permission === "default" + 14일 dismiss 쿨다운.
// 구독 시 /api/push/subscribe 호출(기존 인프라 재사용).

import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

const DISMISS_KEY = "dosigongzon_push_care_cue_dismissed_at";
const DISMISS_DAYS = 14;

export default function PushCareCueOptIn({ hasCat }: { hasCat: boolean }) {
  const { user } = useAuth();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user || !hasCat) return;
    if (typeof window === "undefined") return;
    if (typeof Notification === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (Notification.permission !== "default") return; // granted/denied → 노출 X

    try {
      const dismissed = localStorage.getItem(DISMISS_KEY);
      if (dismissed) {
        const at = parseInt(dismissed, 10);
        if (Number.isFinite(at) && Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000) {
          return;
        }
      }
    } catch {
      /* ignore */
    }
    setShow(true);
  }, [user, hasCat]);

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* no-op */ }
    setShow(false);
  };

  const enable = async () => {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        dismiss();
        return;
      }
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
      if (!vapidKey) { setShow(false); return; }
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
      setShow(false);
    } catch {
      dismiss();
    } finally {
      setBusy(false);
    }
  };

  if (!show) return null;

  return (
    <div
      className="mb-3 p-3.5"
      style={{
        background: "linear-gradient(135deg, #FFF1D9 0%, #FFE0C0 100%)",
        borderRadius: 16,
        border: "1px solid rgba(232,141,90,0.3)",
        boxShadow: "0 4px 14px rgba(232,141,90,0.12)",
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
          style={{ background: "linear-gradient(135deg, #E88D5A 0%, #4C82BC 100%)", boxShadow: "0 3px 10px rgba(76,130,188,0.35)" }}
        >
          <Bell size={17} color="#fff" strokeWidth={2.3} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-extrabold tracking-[0.12em]" style={{ color: "#3E6FA8" }}>매일 6시 알림</p>
          <p className="text-[13px] font-extrabold text-text-main leading-tight mt-0.5">
            🍚 내 아이 한 끼 챙길 시간, 알려드릴까요?
          </p>
          <p className="text-[11px] text-text-sub mt-0.5 leading-snug">
            바쁘면 까먹어요 — 알림이 챙겨드려요.
          </p>
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          <button
            type="button"
            onClick={enable}
            disabled={busy}
            className="h-8 px-3 rounded-full text-white text-[11.5px] font-extrabold active:scale-95 transition-transform disabled:opacity-60"
            style={{ background: "#4C82BC", boxShadow: "0 3px 8px rgba(76,130,188,0.3)" }}
          >
            {busy ? "..." : "켜기"}
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="h-6 px-2 rounded-full flex items-center justify-center text-[10.5px] font-bold"
            style={{ color: "#A88160" }}
            aria-label="다음에"
          >
            <X size={12} />
          </button>
        </div>
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
