// Cloudflare Turnstile 토큰 서버 검증.
// TURNSTILE_SECRET_KEY 미설정 시 bypass 모드로 동작 (graceful fallback).

export async function POST(request: Request) {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  // 프로덕션에서 키 미설정 시 차단, 개발 환경에서만 bypass
  if (!secret) {
    if (process.env.VERCEL_ENV === "production") {
      return Response.json({ success: false, error: "bot_verification_unavailable" }, { status: 500 });
    }
    console.warn("[turnstile] TURNSTILE_SECRET_KEY not set — bypassing (dev only)");
    return Response.json({ success: true, bypassed: true });
  }

  let body: { token?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ success: false, error: "invalid_body" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token : null;
  if (!token) {
    return Response.json({ success: false, error: "missing_token" }, { status: 400 });
  }

  const formData = new FormData();
  formData.append("secret", secret);
  formData.append("response", token);

  try {
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body: formData,
      },
    );
    const data = (await res.json()) as {
      success: boolean;
      "error-codes"?: string[];
    };

    if (data.success) {
      return Response.json({ success: true });
    }

    console.error("[turnstile] verification failed:", data["error-codes"]);
    return Response.json(
      { success: false, error: "verification_failed" },
      { status: 400 },
    );
  } catch (err) {
    console.error("[turnstile] upstream error:", err);
    return Response.json(
      { success: false, error: "upstream_error" },
      { status: 500 },
    );
  }
}
