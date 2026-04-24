// Sentry 서버 에러 수집 검증용 라우트. 요청 오면 의도적으로 throw.

export async function GET() {
  throw new Error("[Sentry 테스트] 서버 의도적 에러 — " + new Date().toISOString());
}
