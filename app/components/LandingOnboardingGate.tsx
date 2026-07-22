"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * 첫 방문자를 /map 으로 직결하는 client gate — "지도가 곧 온보딩" (2026-07-22 회의 B안).
 * 인터스티셜 온보딩(/onboarding) 폐지: 첫 안내는 지도 위 MapIntroSheet 1장이 담당하고,
 * onboarded 플래그도 그 시트가 닫힐 때 세팅한다.
 * 서버 렌더된 랜딩 마크업은 유지되어 SEO 크롤러에게 노출된다.
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
        router.replace("/map");
      }
    } catch { /* 저장소 차단 시 무시 */ }
  }, [router]);
  return null;
}
