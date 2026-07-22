"use client";

// 2026-07-22 12에이전트 회의 B안: 인터스티셜 온보딩 폐지 — "지도가 곧 온보딩".
// 첫 방문 안내는 지도 위 MapIntroSheet 1장이 담당한다.
// 이 라우트는 구 북마크·공유 링크 대응용 리다이렉트만 남김.
// (구 3단계 온보딩 구현은 git 히스토리 fe9b7f7 이전 참조)

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function OnboardingRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/map");
  }, [router]);
  return null;
}
