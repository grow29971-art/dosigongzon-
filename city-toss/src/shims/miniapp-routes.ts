// 앱인토스 규칙상 미니앱에 넣지 않는 경로 — 쇼핑(토스페이 외 결제 금지)·쪽지/서클 채팅(채팅 필수 사항 미충족)·
// 본 앱 로그인/가입(토스 로그인 전용)·관리자. 링크는 홈으로, 라우터는 리다이렉트.
const BLOCKED = [
  /^\/shop(\/|$)/, /^\/messages(\/|$)/, /^\/circle(\/|$)/, /^\/mypage\/circle(\/|$)/,
  /^\/login(\/|$)/, /^\/signup(\/|$)/, /^\/welcome(\/|$)/, /^\/onboarding(\/|$)/, /^\/admin(\/|$)/,
];
export function isMiniAppBlockedPath(p: string): boolean {
  const path = p.split(/[?#]/)[0];
  return BLOCKED.some((r) => r.test(path));
}
