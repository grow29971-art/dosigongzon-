"use client";

// 푸시 권한 권유 카드.
// 사용자가 명시적으로 "켜기"를 눌렀을 때만 Notification.requestPermission 호출.
// 한 번 닫으면 7일간 다시 안 보임.

import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";

const DISMISS_KEY = "dosigongzon_push_optin_dismissed_at";
const DISMISS_DAYS = 7;

interface PushOptInCardProps {
  /** 카드 제목 (용도별 커스텀 — 예: 쇼핑 오픈 알림) */
  title?: string;
  description?: string;
  /** 닫기 상태 저장 키 — 용도별로 분리해야 서로 안 겹침 */
  dismissKey?: string;
}

export default function PushOptInCard({
  title = "내 글에 댓글 달리면 알려드릴까요?",
  description = "중요한 순간 놓치지 않게 알림으로 알려드려요",
  dismissKey = DISMISS_KEY,
}: PushOptInCardProps = {}) {
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
      const dismissed = localStorage.getItem(dismissKey);
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
      localStorage.setItem(dismissKey, String(Date.now()));
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
      // 구독과 마케팅 수신 동의를 한 플로우로 통합 (2026-07-22 리텐션 회의:
      // 구독 31명 ∩ 옵트인 45명 = 교집합 3명 문제 — 카드에 동의 문구 명시, 마이페이지에서 해제 가능)
      if (user) {
        try {
          await createClient()
            .from("profiles")
            .update({ marketing_push_enabled: true })
            .eq("id", user.id);
        } catch { /* 동의 반영 실패는 구독 자체를 막지 않음 */ }
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
        borderRadius: "var(--radius-input)",
        border: "1px solid #F2D6B6",
      }}
    >
      <div className="flex items-center gap-2.5">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: "rgba(173, 94, 59,0.15)" }}
        >
          <Bell size={16} style={{ color: "var(--color-primary)" }} />
        </div>
        <div className="flex-1 min-w-0">
          <p
            className="text-[12.5px] font-bold leading-tight"
            style={{ color: "#8C5A37" }}
          >
            {title}
          </p>
          <p
            className="text-[10.5px] mt-0.5"
            style={{ color: "#A88160" }}
          >
            {description}
          </p>
          <p className="text-[9.5px] mt-0.5" style={{ color: "#BFA084" }}>
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
