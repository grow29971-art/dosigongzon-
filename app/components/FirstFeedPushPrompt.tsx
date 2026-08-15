"use client";

// 첫밥 성공 직후 푸시 옵트인 (2026-07-24 회의 P0-3)
// 배경: 구독 3명 = 옵트인을 가치 체감 전에 물어서. 첫 밥이라는 감정 정점 직후에,
// "앱 알림"이 아니라 방금 밥 준 아이의 대리 프레임("○○ 소식만")으로 묻는다.
// 죄책감 프레임 금지 원칙 — "굶어요" 대신 "기다려요/궁금해해요".
// 수락 시에만 시스템 허용창 → 구독 → marketing_push_enabled 동의 통합(7/22 회의 방식).

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function FirstFeedPushPrompt({ catName }: { catName: string }) {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof Notification === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (Notification.permission !== "default") return; // granted/denied → 노출 X
    setShow(true);
  }, []);

  if (!show) return null;

  const enable = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setShow(false);
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
      // 구독+마케팅 동의 통합 (2026-07-22 리텐션 회의 — 교집합 3명 문제)
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        if (data.user) {
          await supabase.from("profiles").update({ marketing_push_enabled: true }).eq("id", data.user.id);
        }
      } catch { /* 동의 반영 실패는 구독 자체를 막지 않음 */ }
      setDone(true);
    } catch {
      setShow(false);
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <p className="mt-2.5 text-[13px] font-bold text-center" style={{ color: "rgba(255,255,255,0.85)" }}>
        좋아요! {catName} 소식이 오면 살짝 알려드릴게요 🔔
      </p>
    );
  }

  return (
    <div className="mt-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.15)" }}>
      <p className="text-[13px] font-bold text-white text-center leading-snug">
        {catName} 소식만 받아볼래요?
      </p>
      <p className="text-[11px] text-center mt-0.5" style={{ color: "rgba(255,255,255,0.7)" }}>
        내일 밥때가 되면 {catName}가 살짝 알려드려요
      </p>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={enable}
          disabled={busy}
          className="flex-[1.4] flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[13px] font-bold active:scale-[0.98] transition-transform disabled:opacity-60"
          style={{ background: "rgba(255,255,255,0.95)", color: "#7A5238" }}
        >
          <Bell size={13} /> {busy ? "켜는 중..." : "소식 받기"}
        </button>
        <button
          type="button"
          onClick={() => setShow(false)}
          className="flex-1 py-2.5 rounded-xl text-[13px] font-bold active:scale-[0.98] transition-transform"
          style={{ background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.75)" }}
        >
          괜찮아요
        </button>
      </div>
      <p className="text-[9px] text-center mt-1.5" style={{ color: "rgba(255,255,255,0.45)" }}>
        켜면 돌봄·소식 알림(마케팅 포함) 수신에 동의해요 · 마이페이지에서 해제 가능
      </p>
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}
