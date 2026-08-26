import { NextResponse, type NextRequest, type NextFetchEvent } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// ── 크론 하트비트 — Vercel Cron이 실제로 호출하는지 진단 (2026-07-13) ──
// cron_runs 테이블(box/supabase_cron_runs_migration.sql)에 호출 사실만 기록.
// 테이블이 없거나 실패해도 요청 처리에 영향 없음 (fire-and-forget + waitUntil).
//
// 주의: 이 기록은 service_role 권한으로 들어가는 쓰기다. 실재하는 크론 이름일 때만
// 남긴다 — 경로 나머지를 그대로 넣으면 아무나 임의 문자열로 행을 무한히 쌓을 수 있다.
// (2026-08-04 보안: 화이트리스트 + rate limit 통과 후 호출로 변경)
const KNOWN_CRONS = new Set([
  "admin-daily-digest", "area-chat-nudge", "backfill-cat-art", "care-cue",
  "cleanup-area-chats", "cleanup-read-dms", "cleanup-stale-orders", "community-topic",
  "daily-dispatch", "engagement-push", "fund-snapshot", "health-alert-push", "like-digest",
  "news-crawl", "onboarding-nudge", "order-dispatch", "payment-reconcile", "purge-safety-data",
  "retention-report", "scheduled-push", "storage-diet", "streak-reminder",
  "sync-pharmacies", "weather-alert", "weekly-digest", "weekly-dispatch",
  "weekly-postcard-push",
  // ⚠ 새 크론 라우트를 만들면 여기에도 추가할 것 — 없으면 실행은 되지만
  //   cron_runs 하트비트가 안 남아 결행 감시가 눈먼다 (8/26 fund-snapshot에서 실측).
]);

function logCronRun(request: NextRequest, event: NextFetchEvent, name: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
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
// IP당 1분 한도. 통신사 CGNAT·공용 WiFi에서는 수십 명이 같은 IP로 묶여
// 나가므로, 오프라인 행사(집회 등)에서 정상 이용자가 429를 맞지 않도록 넉넉히 잡는다.
// 봇 프로빙은 위 BOT_PROBE_PATTERNS가 별도로 404 처리한다. (2026-08-06)
const GLOBAL_LIMIT = 600;
const WINDOW_MS = 60_000;

function getIP(req: NextRequest): string {
  // Vercel 직결(Cloudflare 프록시 아님 — cf-ray 부재 확인). cf-connecting-ip는 우리
  // 경로의 신뢰 프록시가 설정하지 않아 클라이언트가 위조 가능 → 신뢰 목록에서 제외.
  // x-forwarded-for는 클라이언트가 보낸 값 뒤에 프록시가 실제 IP를 덧붙이는 형태라
  // 첫 요소가 위조값일 수 있다 → 항상 마지막(가장 가까운 홉) 요소를 쓴다. (2026-08-04)
  return req.headers.get("x-vercel-forwarded-for")?.split(",").pop()?.trim()
    || req.headers.get("x-real-ip")?.trim()
    || req.headers.get("x-forwarded-for")?.split(",").pop()?.trim()
    || "unknown";
}

function checkGlobalRate(ip: string): boolean {
  const now = Date.now();
  // 만료 버킷 정리 — 정리 코드가 없으면 인스턴스 수명 동안 IP당 엔트리가 무한 증가한다.
  if (ipBuckets.size > 10_000) {
    for (const [k, v] of ipBuckets) {
      if (v.resetAt <= now) ipBuckets.delete(k);
    }
  }
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

  // API 라우트 + Sentry 터널(/monitoring)에 전역 rate limiting.
  // /monitoring은 무인증 프록시라 리밋에서 빠지면 Sentry 쿼터·함수 실행시간을 태우는
  // 무료 증폭 경로가 된다.
  if (pathname.startsWith("/api/") || pathname === "/monitoring") {
    const ip = getIP(request);
    if (!checkGlobalRate(ip)) {
      return NextResponse.json(
        { error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." },
        { status: 429, headers: { "Retry-After": "60" } },
      );
    }
  }

  // 크론 호출 기록 (스케줄 실행 여부 진단) — rate limit을 통과한 요청만,
  // 그리고 실재하는 크론 이름일 때만 기록한다.
  if (pathname.startsWith("/api/cron/")) {
    const name = pathname.slice("/api/cron/".length);
    if (KNOWN_CRONS.has(name)) logCronRun(request, event, name);
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)",
  ],
};
