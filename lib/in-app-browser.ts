// ══════════════════════════════════════════
// 인앱 브라우저 감지 + 외부 브라우저 탈출
// Google OAuth가 카톡/페북/인스타 웹뷰에서 차단되는 문제 우회
// ══════════════════════════════════════════

export type InAppBrowser =
  | "kakaotalk"
  | "facebook"
  | "instagram"
  | "naver"
  | "line"
  | "daum"
  | "band"
  | null;

export type OS = "android" | "ios" | "other";

/** UA 문자열에서 인앱 브라우저 종류 감지 */
export function detectInAppBrowser(ua?: string): InAppBrowser {
  if (typeof window === "undefined" && !ua) return null;
  const s = (ua ?? navigator.userAgent).toLowerCase();
  if (s.includes("kakaotalk")) return "kakaotalk";
  if (s.includes("fban") || s.includes("fbav")) return "facebook";
  if (s.includes("instagram")) return "instagram";
  if (s.includes("naver(inapp")) return "naver";
  if (s.includes("line/")) return "line";
  if (s.includes("daumapps")) return "daum";
  if (s.includes("band/")) return "band";
  return null;
}

/** 기기 OS 감지 */
export function detectOS(ua?: string): OS {
  if (typeof window === "undefined" && !ua) return "other";
  const s = ua ?? navigator.userAgent;
  if (/android/i.test(s)) return "android";
  if (/iphone|ipad|ipod/i.test(s)) return "ios";
  return "other";
}

/**
 * 현재 URL을 외부 브라우저(크롬/사파리)로 강제 오픈.
 * 카톡/페북/네이버 등 인앱 웹뷰 안에서 호출하면 탈출 가능.
 *
 * Android: intent:// 스킴 사용해서 크롬으로 강제 오픈
 * iOS 카카오톡: kakaotalk://web/openExternal 사용
 * iOS 그 외: URL 복사 안내 (프로그래매틱 탈출 불가)
 */
export function openInExternalBrowser(): boolean {
  if (typeof window === "undefined") return false;
  const url = window.location.href;
  const os = detectOS();
  const inApp = detectInAppBrowser();

  if (os === "android") {
    // intent URL로 크롬에서 강제 오픈
    const urlNoScheme = url.replace(/^https?:\/\//, "");
    window.location.href = `intent://${urlNoScheme}#Intent;scheme=https;package=com.android.chrome;end`;
    return true;
  }

  if (os === "ios" && inApp === "kakaotalk") {
    // 카카오톡 iOS 전용 스킴
    window.location.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`;
    return true;
  }

  // iOS + 그 외 인앱: 프로그래매틱 탈출 불가 → false 반환해서 안내 UI 표시
  return false;
}

/** 인앱 브라우저 이름을 한국어로 */
export function inAppBrowserLabel(kind: InAppBrowser): string {
  switch (kind) {
    case "kakaotalk":
      return "카카오톡";
    case "facebook":
      return "페이스북";
    case "instagram":
      return "인스타그램";
    case "naver":
      return "네이버 앱";
    case "line":
      return "라인";
    case "daum":
      return "다음 앱";
    case "band":
      return "네이버 밴드";
    default:
      return "앱";
  }
}
