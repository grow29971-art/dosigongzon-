"use client";

// 푸시 권한 권유 카드.
// 사용자가 명시적으로 "켜기"를 눌렀을 때만 Notification.requestPermission 호출.
// 한 번 닫으면 7일간 다시 안 보임.

import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

const DISMISS_KEY = "dosigongzon_push_optin_dismissed_at";
const DISMISS_DAYS = 7;

export default function PushOptInCard() {
  const { user } = useAuth();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (typeof window === "undefined") return;
    if (typeof Notification === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    // permission이 default(미응답)일 때만 표시. granted/denied는 노출 X.
    if (Notification.permission !== "default") return;

    try {
      const dismissed = localStorage.getItem(DISMISS_KEY);
      if (dismissed) {
        const at = parseInt(dismissed, 10);
        if (
          Number.isFinite(at) &&
          Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000
        ) {
          return;
        }
      }
    } catch {
      // localStorage 차단 무시
    }

    setShow(true);
  }, [user]);

  const handleDismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* no-op */
    }
    setShow(false);
  };

  const handleEnable = async () => {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        // 거부 또는 닫음 → 다시 묻지 않게 dismiss
        handleDismiss();
        return;
      }
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
      if (!vapidKey) {
        setShow(false);
        return;
      }
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
      handleDismiss();
    } finally {
      setBusy(false);
    }
  };

  if (!show) return null;

  return (
    <div
      className="mb-3 px-4 py-3"
      style={{
        background: "linear-gradient(135deg, #FFF6EE 0%, #FFE9D2 100%)",
        borderRadius: 14,
        border: "1px solid #F2D6B6",
      }}
    >
      <div className="flex items-center gap-2.5">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: "rgba(196,126,90,0.15)" }}
        >
          <Bell size={16} style={{ color: "#C47E5A" }} />
        </div>
        <div className="flex-1 min-w-0">
          <p
            className="text-[12.5px] font-bold leading-tight"
            style={{ color: "#8C5A37" }}
          >
            내 글에 댓글 달리면 알려드릴까요?
          </p>
          <p
            className="text-[10.5px] mt-0.5"
            style={{ color: "#A88160" }}
          >
            중요한 순간 놓치지 않게 알림으로 알려드려요
          </p>
        </div>
        <button
          onClick={handleEnable}
          disabled={busy}
          className="px-3 py-1.5 rounded-lg text-[11px] font-bold shrink-0 active:scale-95 transition-transform disabled:opacity-50"
          style={{ backgroundColor: "#C47E5A", color: "#fff" }}
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
