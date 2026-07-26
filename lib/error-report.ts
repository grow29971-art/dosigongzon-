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
import { allowlistExtra } from "@/lib/sentry-redact";

export function reportError(
  scope: string,
  err: unknown,
  extra?: Record<string, unknown>,
) {
  // extra는 무조건 전달하지 않는다 — 식별자·수치류 키만 allowlist 통과시키고
  // 자유 문자열(본문·주소·이메일 등)은 버린다 (2026-07-26 보안 패치).
  const safeExtra = allowlistExtra(extra);
  if (safeExtra) {
    console.error(`[${scope}]`, err, safeExtra);
  } else {
    console.error(`[${scope}]`, err);
  }
  Sentry.captureException(err, {
    tags: { scope },
    extra: safeExtra,
  });
}
