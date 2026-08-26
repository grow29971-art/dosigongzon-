"use client";

// 유입 출처 first-touch 캡처 — 앱 최상단(app/layout.tsx)에서 1회.
//
// 왜 여기냐: 광고 링크는 보통 랜딩(`/`)으로 떨어지는데 `onboarding_intro` 는 `/map` 에서
// 발화한다. 그 사이 클라이언트 내비게이션이 일어나면 쿼리스트링이 사라져
// logFunnelEvent 시점엔 utm_source 를 읽을 수 없다. 그래서 진입 즉시 잡아 localStorage 에
// 박아두고, 이후 모든 퍼널 이벤트가 그 값을 달고 나간다.
//
// 렌더 출력이 없고 계측 발화 지점을 건드리지 않는다 — 순수 가산.

import { useEffect } from "react";
import { captureSource, syncSignupSourceOnce } from "@/lib/funnel-repo";

export default function SourceCapture() {
  useEffect(() => {
    captureSource();
    // 로그인돼 있으면 first-touch 출처를 profiles.signup_source에 1회 귀속 (2026-08-26)
    void syncSignupSourceOnce();
  }, []);
  return null;
}
