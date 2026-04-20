// ══════════════════════════════════════════
// 공용 rate limiter (인메모리)
// ⚠ 멀티 인스턴스 환경에서는 인스턴스당 계산. 완벽한 방어 아님.
// 추후 Upstash Redis 등으로 교체 고려.
// ══════════════════════════════════════════

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** 호출 허용 여부 반환. true=허용, false=제한 초과. */
export function rateLimit(
  key: string,
  opts: { max: number; windowMs: number },
): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    return true;
  }
  if (bucket.count >= opts.max) return false;
  bucket.count++;
  return true;
}

/** 주기적 청소 — 메모리 누수 방지. 호출은 옵션. */
export function cleanupRateLimitBuckets(): void {
  const now = Date.now();
  for (const [k, v] of buckets) {
    if (v.resetAt < now) buckets.delete(k);
  }
}

/** 클라이언트 IP 추출 */
export function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}
