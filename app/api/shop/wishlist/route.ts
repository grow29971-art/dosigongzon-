// 찜 서버 계측 수집 API (2026-08-12, 화이트리스트 ①) — /api/funnel 패턴 준용.
// 목적: 결제 오픈 게이트(유니크 15명·찜 40개) 측정. localStorage 찜의 서버 사본이 아니라
// add/remove 이벤트 로그다 — 현재 상태는 (anon_id, product_id)별 마지막 이벤트로 계산.
// 비로그인 허용(찜은 로그인 전 행동이 대부분) — 입력 검증 + IP 레이트리밋으로 방어.

import { createServiceClient } from "@/lib/supabase/service";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const ip = getClientIp(request);
  // 상품 18종 전부를 찜해도 18회 — 분당 30회면 정상 사용엔 충분, 봇 도배는 차단
  if (!rateLimit(`wishlist:${ip}`, { max: 30, windowMs: 60_000 })) {
    return Response.json({ ok: false }, { status: 429 });
  }

  let body: { anonId?: unknown; productId?: unknown; action?: unknown; source?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  const anonId = typeof body.anonId === "string" ? body.anonId.trim() : "";
  const productId =
    typeof body.productId === "string" && UUID_RE.test(body.productId) ? body.productId : null;
  const action = body.action === "add" || body.action === "remove" ? body.action : null;
  const source =
    typeof body.source === "string"
      ? body.source.toLowerCase().replace(/[^a-z0-9_.-]/g, "").slice(0, 32) || null
      : null;
  if (anonId.length < 8 || anonId.length > 64 || !productId || !action) {
    return Response.json({ ok: false }, { status: 400 });
  }

  const supabase = createServiceClient();

  // 로그인 상태면 user_id 연결 (선택 — 토큰 없거나 무효면 anon 취급)
  let userId: string | null = null;
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const { data } = await supabase.auth.getUser(authHeader.slice(7));
      userId = data.user?.id ?? null;
    } catch { /* 무효 토큰 — anon 취급 */ }
  }

  const { error } = await supabase.from("shop_wishlist_events").insert({
    anon_id: anonId,
    user_id: userId,
    product_id: productId,
    action,
    source,
  });

  if (error) {
    // 존재하지 않는 product_id(FK 위반)는 클라이언트 오염 — 400으로 구분
    if (error.code === "23503") return Response.json({ ok: false }, { status: 400 });
    return Response.json({ ok: false }, { status: 500 });
  }
  return Response.json({ ok: true });
}
