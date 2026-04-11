// ══════════════════════════════════════════
// URL 검증 — XSS/프로토콜 인젝션 방어
// ══════════════════════════════════════════

// 이미지 URL: https(s)만, 인용부호/제어문자/공백 금지.
// map 마커에서 innerHTML의 CSS url()에 내삽되므로
// 단일 인용부호 탈출이 치명적 → 문자 단위로 엄격 검사.
const SAFE_IMAGE_URL = /^https?:\/\/[^\s'"<>`\\]+$/i;

export function isSafeImageUrl(raw: unknown): raw is string {
  if (typeof raw !== "string") return false;
  if (raw.length > 2048) return false;
  return SAFE_IMAGE_URL.test(raw);
}

/**
 * 이미지 URL 소독. 안전하지 않으면 fallback 반환.
 */
export function sanitizeImageUrl(
  raw: unknown,
  fallback: string = "",
): string {
  return isSafeImageUrl(raw) ? raw : fallback;
}

// 일반 링크 URL: http/https만. javascript:, data:, vbscript: 등 차단.
const SAFE_HTTP_URL = /^https?:\/\/[^\s'"<>`\\]+$/i;

export function isSafeHttpUrl(raw: unknown): raw is string {
  if (typeof raw !== "string") return false;
  if (raw.length > 2048) return false;
  return SAFE_HTTP_URL.test(raw);
}

export function sanitizeHttpUrl(
  raw: unknown,
  fallback: string = "",
): string {
  return isSafeHttpUrl(raw) ? raw : fallback;
}
