import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// ── 전역 API Rate Limiting (IP 기반, 인메모리) ──
const ipBuckets = new Map<string, { count: number; resetAt: number }>();
const GLOBAL_LIMIT = 120; // IP당 1분에 120요청
const WINDOW_MS = 60_000;

function getIP(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
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

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
