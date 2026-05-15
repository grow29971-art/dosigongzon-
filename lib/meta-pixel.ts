// Meta Pixel (Facebook Pixel) 헬퍼.
// 동의 후 ConsentManager가 fbq base code를 로드 → 그 다음부터 trackEvent 사용 가능.
// env에 따옴표·\n 들어간 케이스 방어 ([[project-dosigongzon-env-trim]]).

const RAW_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

// .env 오염 방어: trim + 양쪽 따옴표 제거
export const META_PIXEL_ID =
  (RAW_PIXEL_ID || "").trim().replace(/^["']|["']$/g, "") || null;

type FbqStandardEvent =
  | "PageView"
  | "Lead"
  | "CompleteRegistration"
  | "ViewContent"
  | "Search"
  | "Contact"
  | "Subscribe";

declare global {
  interface Window {
    fbq?: (
      command: "track" | "trackCustom" | "init",
      eventName: string,
      params?: Record<string, unknown>,
    ) => void;
  }
}

/**
 * Meta Pixel 표준 이벤트 발사. 픽셀이 로드 안 됐거나 동의 안 했으면 조용히 무시.
 */
export function trackPixelEvent(
  event: FbqStandardEvent,
  params?: Record<string, unknown>,
): void {
  if (typeof window === "undefined") return;
  if (!window.fbq) return;
  try {
    window.fbq("track", event, params);
  } catch {
    // 광고 차단·iOS 환경 차단 시 무시
  }
}

/**
 * 커스텀 이벤트 발사 (도시공존 도메인 — 첫 cat 등록, 첫 돌봄 등).
 */
export function trackPixelCustom(
  eventName: string,
  params?: Record<string, unknown>,
): void {
  if (typeof window === "undefined") return;
  if (!window.fbq) return;
  try {
    window.fbq("trackCustom", eventName, params);
  } catch {
    // ignore
  }
}

/**
 * localStorage dedup으로 1회만 발사. 가입 완료처럼 중복 발사 안 되게.
 */
export function trackPixelOnce(
  storageKey: string,
  event: FbqStandardEvent,
  params?: Record<string, unknown>,
): void {
  if (typeof window === "undefined") return;
  try {
    if (localStorage.getItem(storageKey)) return;
    trackPixelEvent(event, params);
    localStorage.setItem(storageKey, "1");
  } catch {
    // localStorage 차단 시 fall through
    trackPixelEvent(event, params);
  }
}
