// Next.js instrumentation hook — 서버·edge 런타임에서 Sentry 초기화 로드.
// https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
// @sentry/nextjs 10.x는 withSentryConfig가 onRequestError 자동 주입.

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}
