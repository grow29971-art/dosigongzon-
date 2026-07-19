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

// ══════════════════════════════════════════
// 카드 배틀 파밍 방어 (인메모리)
// 자동/수동 배틀에 유량제한이 전무해 스크립트로 코인·EXP·리더보드를 무제한
// 파밍할 수 있었음. 버스트(분당 연타) + 일일 보상 횟수 상한으로 이중 차단.
// ⚠ 인메모리라 인스턴스별·재시작시 초기화 — 완벽하진 않지만 자동화 파밍은 실질 차단.
//    (영속 상한은 M15 rate-limit 영속화 잔여 과제로 후속.)
// ══════════════════════════════════════════

const DAY_MS = 24 * 60 * 60 * 1000;

/** 분당 배틀 요청 상한 — 사람은 배틀을 지켜보므로 여유롭게, 봇 연타는 차단. */
export const BATTLE_BURST_PER_MIN = 40;
/** 하루 보상 지급 배틀 수 상한(자동+수동 공유). 초과분은 코인·EXP 0 지급. */
export const BATTLE_REWARD_PER_DAY = 150;

/** 배틀 버스트 허용 여부. false면 429로 거절. */
export function battleBurstOk(userId: string): boolean {
  return rateLimit(`battle:burst:${userId}`, { max: BATTLE_BURST_PER_MIN, windowMs: 60_000 });
}

/**
 * 오늘 보상 여유가 있으면 true(카운터 1 소비). 초과면 false → 호출부에서 코인·EXP를 0으로.
 * 자동배틀·record(수동) 양쪽이 같은 키를 공유해 하루 총 보상 배틀 수를 함께 제한.
 */
export function battleRewardOk(userId: string): boolean {
  return rateLimit(`battle:reward:${userId}`, { max: BATTLE_REWARD_PER_DAY, windowMs: DAY_MS });
}

/**
 * 클라이언트 IP 추출 (Vercel 직결 환경 — Cloudflare 프록시 아님, cf-ray 부재 확인).
 * cf-connecting-ip는 우리 경로의 어떤 신뢰 프록시도 설정하지 않는 헤더라 클라이언트가
 * 임의로 위조할 수 있음(IP 기반 rate-limit·방문자 카운터 오염) → 신뢰 목록에서 제외.
 * Vercel이 설정·정규화하는 x-forwarded-for(첫 홉)·x-real-ip만 신뢰한다.
 */
export function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
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
