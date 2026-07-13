import { NextResponse, type NextRequest, type NextFetchEvent } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// ── 크론 하트비트 — Vercel Cron이 실제로 호출하는지 진단 (2026-07-13) ──
// cron_runs 테이블(box/supabase_cron_runs_migration.sql)에 호출 사실만 기록.
// 테이블이 없거나 실패해도 요청 처리에 영향 없음 (fire-and-forget + waitUntil).
function logCronRun(request: NextRequest, event: NextFetchEvent) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  const name = request.nextUrl.pathname.replace("/api/cron/", "");
  event.waitUntil(
    fetch(`${url}/rest/v1/cron_runs`, {
      method: "POST",
      headers: {
        apikey: key,
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
        prefer: "return=minimal",
      },
      body: JSON.stringify({
        name,
        method: request.method,
        has_auth: !!request.headers.get("authorization"),
      }),
    }).catch(() => {}),
  );
}

// ── 전역 API Rate Limiting (IP 기반, 인메모리) ──
const ipBuckets = new Map<string, { count: number; resetAt: number }>();
const GLOBAL_LIMIT = 120; // IP당 1분에 120요청
const WINDOW_MS = 60_000;

function getIP(req: NextRequest): string {
  // Cloudflare 프록시 통과 시 실제 클라이언트 IP 우선 (프록시 OFF면 헤더 없음 → 폴백).
  // ⚠ 안 하면 프록시 켰을 때 모든 요청이 클플 IP 몇 개로 보여 전역 레이트리밋에 떼로 걸림.
  return req.headers.get("cf-connecting-ip")?.trim()
    ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? req.headers.get("x-real-ip")
    ?? "unknown";
}

function checkGlobalRate(ip: string): boolean {
  const now = Date.now();
  const bucket = ipBuckets.get(ip);
  if (!bucket || bucket.resetAt <= now) {
    ipBuckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (bucket.count >= GLOBAL_LIMIT) return false;
  bucket.count++;
  return true;
}

// 봇 프로빙 경로 — PHP/WordPress 취약점 스캐너가 때리는 경로.
// 이 프로젝트(Next.js)엔 해당 없음. 403 대신 404로 존재 자체 부정.
const BOT_PROBE_PATTERNS = [
  /^\/adminer(\.php)?$/i,
  /^\/phpmyadmin/i,
  /^\/pma\//i,
  /^\/wp-admin/i,
  /^\/wp-login(\.php)?$/i,
  /^\/wp-content/i,
  /^\/wp-includes/i,
  /^\/xmlrpc\.php$/i,
  /^\/\.env(\.|$)/i,
  /^\/\.git\//i,
  /^\/config\.php$/i,
  /^\/shell\.php$/i,
  /^\/\.aws\//i,
  /^\/\.ssh\//i,
  /\.(asp|aspx|jsp|cgi)$/i,
];

export async function proxy(request: NextRequest, event: NextFetchEvent) {
  const { pathname } = request.nextUrl;

  // 크론 호출 기록 (스케줄 실행 여부 진단)
  if (pathname.startsWith("/api/cron/")) {
    logCronRun(request, event);
  }

  // 봇 프로빙 → 404 (세션 업데이트·rate limit 낭비 방지)
  for (const pattern of BOT_PROBE_PATTERNS) {
    if (pattern.test(pathname)) {
      return new NextResponse("Not Found", {
        status: 404,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "public, max-age=86400",
          "X-Robots-Tag": "noindex, nofollow",
        },
      });
    }
  }

  // API 라우트에 전역 rate limiting
  if (pathname.startsWith("/api/")) {
    const ip = getIP(request);
    if (!checkGlobalRate(ip)) {
      return NextResponse.json(
        { error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." },
        { status: 429, headers: { "Retry-After": "60" } },
      );
    }
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)",
  ],
};
