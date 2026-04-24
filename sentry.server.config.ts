// Sentry 서버(Node.js) 설정
// API 라우트, 서버 컴포넌트에서 발생하는 에러 수집.

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
