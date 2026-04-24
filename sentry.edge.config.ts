// Sentry Edge runtime 설정 (middleware·edge runtime API 라우트)
// 도시공존은 middleware(proxy.ts) + routing middleware 사용.

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    enabled: process.env.NODE_ENV === "production",
    environment: process.env.NODE_ENV,
  });
}
