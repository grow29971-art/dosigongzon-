// API 라우트·서버 코드에서 catch한 에러를 Sentry로 전송 + 로컬 로그.
// 프로덕션: Sentry에 수집됨 (sentry.server.config.ts의 enabled=production).
// 개발: console.error만 보임 (Sentry 비활성).
//
// 사용:
//   } catch (err) {
//     reportError("weather", err);
//     return Response.json({ error: "..." }, { status: 500 });
//   }

import * as Sentry from "@sentry/nextjs";

export function reportError(
  scope: string,
  err: unknown,
  extra?: Record<string, unknown>,
) {
  if (extra) {
    console.error(`[${scope}]`, err, extra);
  } else {
    console.error(`[${scope}]`, err);
  }
  Sentry.captureException(err, {
    tags: { scope },
    extra,
  });
}
