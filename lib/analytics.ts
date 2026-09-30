// Vercel Analytics 커스텀 이벤트 — 쿠키 배너에서 "동의"한 경우에만 보낸다.
// @vercel/analytics 의 track() 은 <Analytics/> 마운트(ConsentManager가 동의 시에만 함)와 무관하게
// 바로 전송되므로, 컴포넌트에서 직접 부르면 "거부"한 이용자의 행동도 수집됐다(2026-09-30 감사).
// 이벤트를 보낼 땐 @vercel/analytics 대신 이 함수를 쓴다.
import { track as vercelTrack } from "@vercel/analytics";

const CONSENT_KEY = "dosigongzon_cookie_consent"; // ConsentManager.tsx와 같은 키

type Props = Parameters<typeof vercelTrack>[1];

export function track(name: string, props?: Props): void {
  try {
    if (navigator.userAgent.includes("PWAShell")) return; // iOS 앱은 항상 거부로 처리(ConsentManager와 동일)
    if (localStorage.getItem(CONSENT_KEY) !== "accepted") return;
  } catch {
    return;
  }
  vercelTrack(name, props);
}
