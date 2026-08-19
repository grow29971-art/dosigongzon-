"use client";

// 기존 가입자 대상 1회 전면 "알림 켜기" 게이트 — 2026-08-19 사장님 지시(전 유저 알림 허용 유도).
// 신규 가입자는 /welcome의 알림 스텝이 동일 역할 — 같은 seen 키를 세워 이중 노출을 막는다.
// 법리상 동의는 자동 부여 불가(정보통신망법 §50) — 명시적 "알림 켜기" 탭으로만 구독+동의를 세운다.
// 대상: 브라우저 권한이 default(미응답)인 로그인 유저. granted는 PushSubscriber/PushReconsentCard 영역.
// supabase-js는 지연 로드 — (main) 레이아웃 마운트라 정적 import 하나가 곧 전 페이지 first-load.

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export const PUSH_GATE_SEEN_PREFIX = "dosigongzon_push_gate_seen_";

export default function PushOnboardInterstitial() {
  const { user } = useAuth();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (typeof window === "undefined" || typeof Notification === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (Notification.permission !== "default") return;
    if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim()) return;
    try {
      if (localStorage.getItem(PUSH_GATE_SEEN_PREFIX + user.id)) return;
    } catch {
      // localStorage 차단 환경 — seen 기록이 불가능하면 매 방문 전면 차단이 되므로 미노출
      return;
    }
    setShow(true);
  }, [user]);

  const markSeenAndClose = () => {
    try {
      if (user) localStorage.setItem(PUSH_GATE_SEEN_PREFIX + user.id, String(Date.now()));
    } catch {
      /* no-op */
    }
    setShow(false);
  };

  // "알림 켜기" 탭(사용자 제스처) → 네이티브 프롬프트 → 구독 + 마케팅 수신 동의.
  // 동의 문구는 버튼 위에 명시 — 구독·동의 통합 플로우 (PushOptInCard와 동일 패턴)
  const handleEnable = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
        if (vapidKey) {
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
        }
        if (user) {
          try {
            const { createClient } = await import("@/lib/supabase/client");
            await createClient()
              .from("profiles")
              .update({ marketing_push_enabled: true })
              .eq("id", user.id);
          } catch { /* 동의 반영 실패는 닫기를 막지 않음 — 재동의 카드가 후속 회수 */ }
        }
      }
    } catch {
      // 권한/구독 실패 — 조용히 닫기
    } finally {
      setBusy(false);
      markSeenAndClose();
    }
  };

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 overflow-hidden flex flex-col"
      style={{
        zIndex: 999,
        background: "linear-gradient(170deg, #8C5A37 0%, var(--color-primary) 55%, #C98A62 100%)",
      }}
    >
      <div className="flex-1 flex flex-col items-center justify-center px-7">
        <div
          className="w-24 h-24 rounded-full flex items-center justify-center mb-7"
          style={{
            background: "rgba(255,255,255,0.18)",
            backdropFilter: "blur(10px)",
            border: "1px solid rgba(255,255,255,0.25)",
            boxShadow: "var(--shadow-modal)",
          }}
        >
          <Bell size={42} color="#FFFFFF" strokeWidth={1.6} />
        </div>

        <h2 className="text-[24px] font-bold text-center text-white tracking-tight leading-[1.4] mb-4">
          알림 켜고 소식 받아요
        </h2>
        <p className="text-[15px] text-center text-white/85 leading-[1.9] max-w-[320px]">
          내 글에 달린 댓글, 쪽지 답장,
          <br />
          돌봄 소식과 동네 이벤트까지 —
          <br />
          중요한 순간을 놓치지 않게 알려드려요.
        </p>
      </div>

      <div className="px-6 pb-10 z-20">
        {/* 정보통신망법 §50 — 마케팅 수신 동의 문구 명시 (구독·동의 통합 플로우) */}
        <p className="text-[11px] text-center mb-3 leading-relaxed" style={{ color: "rgba(255,255,255,0.65)" }}>
          켜면 돌봄·소식 알림(마케팅 포함) 수신에 동의해요 · 마이페이지에서 언제든 해제
        </p>
        <button
          onClick={handleEnable}
          disabled={busy}
          className="w-full h-[52px] rounded-2xl text-[15px] font-bold flex items-center justify-center gap-1.5 press disabled:opacity-60"
          style={{
            background: "#FFFFFF",
            color: "var(--color-primary-dark)",
            boxShadow: "var(--shadow-fab)",
          }}
        >
          <Bell size={17} />
          {busy ? "설정 중..." : "알림 켜기"}
        </button>
        <button
          onClick={markSeenAndClose}
          disabled={busy}
          className="w-full py-3 mt-2 text-[13px] font-medium active:opacity-50"
          style={{ color: "rgba(255,255,255,0.7)" }}
        >
          나중에 할게요
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
