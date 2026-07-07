// 쿠키·분석 동의 관리 — 정보통신망법 §22-2 대응
// 첫 방문 시 하단 배너로 동의 받음. 동의 전엔 Vercel Analytics·SpeedInsights 로드 안 함.
// 거부 시 분석 트래커 영원히 비활성. 동의·거부 모두 localStorage에 영구 저장.

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import MetaPixel from "@/app/components/MetaPixel";

type Consent = "accepted" | "rejected" | "pending";

const STORAGE_KEY = "dosigongzon_cookie_consent";

export default function ConsentManager() {
  // mounted 가드 — SSR과 hydration 사이엔 아무것도 렌더하지 않아 mismatch 회피.
  const [mounted, setMounted] = useState(false);
  const [consent, setConsent] = useState<Consent>("pending");

  useEffect(() => {
    if (typeof window === "undefined") return;
    // iOS 앱(PWAShell)에서는 추적 없이 자동 거부 처리 — ATT 미구현으로 Apple 5.1.2 위반 방지
    if (navigator.userAgent.includes("PWAShell")) {
      setConsent("rejected");
      setMounted(true);
      return;
    }
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "accepted" || stored === "rejected") {
        setConsent(stored);
      } else {
        setConsent("pending");
      }
    } catch {
      setConsent("pending");
    }
    setMounted(true);
  }, []);

  const handleAccept = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "accepted");
    } catch {
      // ignore
    }
    setConsent("accepted");
  };

  const handleReject = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "rejected");
    } catch {
      // ignore
    }
    setConsent("rejected");
  };

  // hydration 완료 전엔 아무것도 렌더하지 않음
  if (!mounted) return null;

  return (
    <>
      {/* 동의한 경우만 분석·광고 픽셀 로드 — Vercel Analytics·SpeedInsights·Meta Pixel은 쿠키·식별자 사용 */}
      {consent === "accepted" && (
        <>
          <Analytics />
          <SpeedInsights />
          <MetaPixel />
        </>
      )}

      {/* 첫 방문 시 배너 */}
      {consent === "pending" && (
        <div
          role="dialog"
          aria-label="쿠키 사용 동의"
          className="fixed left-0 right-0 bottom-0 z-[60] px-4 pb-4 pt-3"
          style={{
            background: "linear-gradient(180deg, rgba(247,244,238,0) 0%, rgba(247,244,238,0.95) 30%, #F7F4EE 100%)",
            backdropFilter: "blur(6px)",
          }}
        >
          <div
            className="mx-auto max-w-lg rounded-2xl bg-white p-4"
            style={{
              boxShadow: "0 8px 28px rgba(60,46,35,0.15), 0 2px 6px rgba(60,46,35,0.06)",
              border: "1px solid rgba(76,130,188,0.18)",
            }}
          >
            <div className="mb-3">
              <p
                className="mb-1 text-[13px] font-extrabold"
                style={{ color: "#3D2F25" }}
              >
                🍪 쿠키 사용에 대해 알려드려요
              </p>
              <p
                className="text-[12px] leading-relaxed"
                style={{ color: "rgba(60,46,35,0.7)" }}
              >
                도시공존은 서비스 개선을 위해 익명 방문 통계(Vercel Analytics·SpeedInsights)와 광고 효과 측정(Meta 픽셀)을 수집해요.
                동의하지 않아도 모든 기능은 그대로 이용 가능합니다.{" "}
                <Link
                  href="/privacy"
                  className="underline"
                  style={{ color: "#8B5A3C" }}
                >
                  개인정보처리방침
                </Link>
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleReject}
                className="flex-1 rounded-xl px-4 py-2.5 text-[12.5px] font-extrabold active:scale-[0.98] transition-transform"
                style={{
                  background: "rgba(60,46,35,0.06)",
                  color: "rgba(60,46,35,0.7)",
                  border: "1px solid rgba(60,46,35,0.08)",
                }}
              >
                거부
              </button>
              <button
                type="button"
                onClick={handleAccept}
                className="flex-1 rounded-xl px-4 py-2.5 text-[12.5px] font-extrabold text-white active:scale-[0.98] transition-transform"
                style={{
                  background: "linear-gradient(135deg, #4C82BC 0%, #3E6FA8 100%)",
                  boxShadow: "0 4px 12px rgba(76,130,188,0.28)",
                }}
              >
                동의하고 계속
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
