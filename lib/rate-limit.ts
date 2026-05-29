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
    // Cloudflare 프록시 통과 시 실제 클라이언트 IP (프록시 OFF면 헤더 없음 → 폴백)
    request.headers.get("cf-connecting-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

// ══════════════════════════════════════════
// 사용자 행 수 기반 rate limit — 도배 방어
// 같은 user의 최근 1분·24시간 insert 카운트로 차단.
// ══════════════════════════════════════════

import type { SupabaseClient } from "@supabase/supabase-js";

export interface UserActionLimitConfig {
  /** 검사할 테이블 (e.g. "direct_messages") */
  table: string;
  /** 작성자 컬럼 (e.g. "sender_id", "author_id") */
  userColumn: string;
  /** 현재 user id */
  userId: string;
  /** 분당 최대 행수 */
  perMinute: number;
  /** 일당 최대 행수 */
  perDay: number;
  /** 사용자에게 보여줄 작업 라벨 (e.g. "쪽지", "댓글") */
  label: string;
}

/**
 * Supabase로 사용자별 최근 행 수를 세서 임계값 초과 시 throw.
 * 호출은 insert 직전. RLS로 본인 행만 count 가능.
 */
export async function enforceUserActionLimit(
  supabase: SupabaseClient,
  cfg: UserActionLimitConfig,
): Promise<void> {
  const now = Date.now();
  const oneMinAgo = new Date(now - 60 * 1000).toISOString();
  const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();

  const { count: minCount, error: minErr } = await supabase
    .from(cfg.table)
    .select("*", { count: "exact", head: true })
    .eq(cfg.userColumn, cfg.userId)
    .gte("created_at", oneMinAgo);

  if (minErr) {
    // 카운트 실패 시 막지 않음 (가용성 우선)
    console.error(`[rate-limit] count failed for ${cfg.table}:`, minErr.message);
    return;
  }
  if ((minCount ?? 0) >= cfg.perMinute) {
    throw new Error(
      `${cfg.label}을(를) 너무 자주 작성하고 있어요. 잠시 후 다시 시도해주세요.`,
    );
  }

  const { count: dayCount } = await supabase
    .from(cfg.table)
    .select("*", { count: "exact", head: true })
    .eq(cfg.userColumn, cfg.userId)
    .gte("created_at", oneDayAgo);

  if ((dayCount ?? 0) >= cfg.perDay) {
    throw new Error(
      `오늘 ${cfg.label} 한도(${cfg.perDay}건)에 도달했어요. 내일 다시 시도해주세요.`,
    );
  }
}
