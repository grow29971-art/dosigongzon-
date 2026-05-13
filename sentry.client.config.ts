// Sentry 클라이언트(브라우저) 설정
// 브라우저에서 발생하는 에러·성능 이벤트를 Sentry로 전송.
// DSN이 없으면(dev 환경 등) Sentry 자체가 no-op.
//
// Replay 지연 로드: replayIntegration은 ~70KB. 첫 페인트 번들에 포함되면 LCP·TBT 직격.
// 대신 첫 에러 발생 시 lazyLoadIntegration으로 동적 import → 에러 세션만 녹화.
// replaysSessionSampleRate: 0이라 평소엔 어차피 녹화 안 함, 손해 없음.

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    // 샘플링: error는 100%, transaction(성능)은 10% — 무료 플랜 쿼터(5k/월) 보호
    tracesSampleRate: 0.1,
    // Replay(세션 녹화): 에러 발생 시에만 녹화. integration은 lazy로 첫 에러 직전에 추가.
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0,
    integrations: [],
    // 개발 환경에서는 무시 (콘솔만 쓰기)
    enabled: process.env.NODE_ENV === "production",
    environment: process.env.NODE_ENV,
    // 특정 에러는 무시 (브라우저 확장 등 노이즈)
    ignoreErrors: [
      "ResizeObserver loop limit exceeded",
      "ResizeObserver loop completed with undelivered notifications",
      "Non-Error promise rejection captured",
    ],
    // beforeSend — 첫 에러 직전 replayIntegration을 lazy load.
    // 이미 로드돼있으면 skip. 후속 에러는 정상 녹화됨.
    beforeSend: (event, hint) => {
      void ensureReplayLoaded();
      return event;
    },
  });
}

let replayLoading: Promise<void> | null = null;
function ensureReplayLoaded(): Promise<void> {
  if (replayLoading) return replayLoading;
  replayLoading = (async () => {
    try {
      const client = Sentry.getClient();
      if (!client) return;
      // 이미 추가됐는지 확인
      if (client.getIntegrationByName?.("Replay")) return;
      const { replayIntegration } = await import("@sentry/nextjs");
      Sentry.addIntegration(
        replayIntegration({
          maskAllText: true,
          blockAllMedia: true,
        }),
      );
    } catch { /* no-op */ }
  })();
  return replayLoading;
}
