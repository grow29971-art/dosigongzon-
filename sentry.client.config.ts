// Sentry 클라이언트(브라우저) 설정
// 브라우저에서 발생하는 에러·성능 이벤트를 Sentry로 전송.
// DSN이 없으면(dev 환경 등) Sentry 자체가 no-op.

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    // 샘플링: error는 100%, transaction(성능)은 10% — 무료 플랜 쿼터(5k/월) 보호
    tracesSampleRate: 0.1,
    // Replay(세션 녹화): 에러 발생 세션만 녹화해서 디버그 도움, 용량 제한
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0,
    integrations: [
      Sentry.replayIntegration({
        maskAllText: true, // 개인정보 마스킹 (닉네임·이메일 등)
        blockAllMedia: true,
      }),
    ],
    // 개발 환경에서는 무시 (콘솔만 쓰기)
    enabled: process.env.NODE_ENV === "production",
    environment: process.env.NODE_ENV,
    // 특정 에러는 무시 (브라우저 확장 등 노이즈)
    ignoreErrors: [
      "ResizeObserver loop limit exceeded",
      "ResizeObserver loop completed with undelivered notifications",
      "Non-Error promise rejection captured",
    ],
  });
}
