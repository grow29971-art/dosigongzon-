// ══════════════════════════════════════════
// 로그인 에러 로그 조회/삭제 (관리자 전용)
// RLS에 의해 관리자만 SELECT/DELETE 가능
// ══════════════════════════════════════════

import { createClient } from "@/lib/supabase/client";

export interface AuthErrorLog {
  id: string;
  provider: string | null;
  stage: string;
  error_code: string | null;
  error_desc: string | null;
  user_agent: string | null;
  url: string | null;
  referrer: string | null;
  created_at: string;
}

export interface AuthErrorFilters {
  provider?: string | null;   // null = 전체
  errorCode?: string | null;
  days?: number;              // 최근 N일 (기본 30)
  limit?: number;             // 기본 200
}

// ── 리스트 ──
export async function listAuthErrors(
  filters: AuthErrorFilters = {},
): Promise<AuthErrorLog[]> {
  const supabase = createClient();
  const days = filters.days ?? 30;
  const limit = filters.limit ?? 200;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  let q = supabase
    .from("auth_error_logs")
    .select("*")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (filters.provider) q = q.eq("provider", filters.provider);
  if (filters.errorCode) q = q.eq("error_code", filters.errorCode);

  const { data, error } = await q;
  if (error) {
    console.error("[auth-errors-repo] list failed:", error);
    throw new Error(`로그를 불러올 수 없어요: ${error.message}`);
  }
  return (data ?? []) as AuthErrorLog[];
}

// ── 집계: 에러 코드별 카운트 ──
export interface ErrorCodeStat {
  error_code: string;
  provider: string | null;
  count: number;
  last_at: string;
}

export async function aggregateByErrorCode(days = 7): Promise<ErrorCodeStat[]> {
  const supabase = createClient();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  // Supabase JS에는 group by가 없어 클라이언트에서 집계
  const { data, error } = await supabase
    .from("auth_error_logs")
    .select("error_code, provider, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(5000);

  if (error) {
    console.error("[auth-errors-repo] aggregate failed:", error);
    return [];
  }

  const map = new Map<string, ErrorCodeStat>();
  for (const row of (data ?? []) as { error_code: string | null; provider: string | null; created_at: string }[]) {
    const code = row.error_code || "(unknown)";
    const key = `${code}::${row.provider ?? ""}`;
    const prev = map.get(key);
    if (prev) {
      prev.count += 1;
      // created_at is desc, so first seen is the latest
    } else {
      map.set(key, {
        error_code: code,
        provider: row.provider,
        count: 1,
        last_at: row.created_at,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

// ── 삭제: 특정 기간 이전 로그 청소 ──
export async function purgeOldLogs(olderThanDays: number): Promise<number> {
  const supabase = createClient();
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString();

  const { error, count } = await supabase
    .from("auth_error_logs")
    .delete({ count: "exact" })
    .lt("created_at", cutoff);

  if (error) {
    throw new Error(`삭제 실패: ${error.message}`);
  }
  return count ?? 0;
}

// ── 단일 로그 삭제 ──
export async function deleteAuthError(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("auth_error_logs").delete().eq("id", id);
  if (error) throw new Error(`삭제 실패: ${error.message}`);
}
