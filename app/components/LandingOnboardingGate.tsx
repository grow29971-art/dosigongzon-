"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * 첫 방문자를 /onboarding 으로 보내는 client gate.
 * 서버 렌더된 랜딩 마크업은 유지되어 SEO 크롤러에게 노출되고,
 * 실제 브라우저에서 localStorage에 온보딩 기록이 없으면 즉시 redirect.
 */
export default function LandingOnboardingGate() {
  const router = useRouter();
  useEffect(() => {
    try {
      // iOS 앱 감지: URL 파라미터(최우선) → UA → 쿠키 순서
      const params = new URLSearchParams(window.location.search);
      const isIOSApp =
        params.get("ios") === "1" ||
        navigator.userAgent.includes("PWAShell") ||
        document.cookie.includes("app-platform=iOS App Store");
      if (isIOSApp) {
        localStorage.setItem("dosigongzon_onboarded", "true");
        return;
      }
      if (!localStorage.getItem("dosigongzon_onboarded")) {
        router.replace("/onboarding");
      }
    } catch { /* 저장소 차단 시 무시 */ }
  }, [router]);
  return null;
}
