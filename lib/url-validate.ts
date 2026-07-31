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

// ── OG 이미지(next/og) 전용 SSRF 가드 ──
// next/og의 ImageResponse는 이 URL을 서버에서 직접 fetch한다. 위의 sanitizeImageUrl은
// XSS(CSS url() 탈출) 방어용이라 http·사설IP·내부 호스트(169.254.169.254 등)를 통과시켜
// 서버측 SSRF가 된다. OG용은 https + 신뢰 호스트(Supabase 스토리지·플레이스홀더)만 허용.
const OG_IMAGE_HOST_ALLOW: Set<string> = (() => {
  const hosts = new Set<string>(["placehold.co"]);
  try {
    const h = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname.toLowerCase();
    if (h) hosts.add(h);
  } catch {
    /* env 미설정 시 스토리지 호스트 없이 플레이스홀더만 허용 */
  }
  return hosts;
})();

export function sanitizeOgImageUrl(raw: unknown, fallback: string): string {
  if (typeof raw !== "string" || raw.length > 2048) return fallback;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return fallback;
  }
  if (u.protocol !== "https:") return fallback;
  if (!OG_IMAGE_HOST_ALLOW.has(u.hostname.toLowerCase())) return fallback;
  return raw;
}
