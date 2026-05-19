import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

// 클라이언트에서 로그인 에러를 로깅하기 위한 라우트.
// 인증 불필요 (비로그인 상태에서도 실패 기록해야 함).
// RLS 정책(insert: anyone) 이 이미 있으므로 anon 클라이언트로 충분.

export async function POST(request: Request) {
  // IP당 분당 5회 + 전역 분당 100회 — 봇넷 IP rotate 폭격으로 auth_error_logs 누수 방지
  const ip = getClientIp(request);
  if (!rateLimit(`log-error:${ip}`, { max: 5, windowMs: 60_000 })) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }
  // 전역 캡 — 단일 인스턴스 기준 분당 100 (멀티 인스턴스에선 인스턴스당 100)
  if (!rateLimit(`log-error:global`, { max: 100, windowMs: 60_000 })) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const provider = typeof body.provider === "string" ? body.provider.slice(0, 40) : null;
    const stage = typeof body.stage === "string" ? body.stage.slice(0, 40) : "client";
    const error_code = typeof body.error_code === "string" ? body.error_code.slice(0, 100) : null;
    const error_desc = typeof body.error_desc === "string" ? body.error_desc.slice(0, 500) : null;
    const url = typeof body.url === "string" ? body.url.slice(0, 1000) : null;

    const user_agent = request.headers.get("user-agent")?.slice(0, 500) ?? null;
    const referrer = request.headers.get("referer")?.slice(0, 500) ?? null;

    const supabase = await createClient();
    await supabase.from("auth_error_logs").insert({
      provider,
      stage,
      error_code,
      error_desc,
      user_agent,
      url,
      referrer,
    });

    return NextResponse.json({ ok: true });
  } catch {
    // 로깅 실패는 무시 (로그인 흐름을 깨지 않음)
    return NextResponse.json({ ok: false });
  }
}
