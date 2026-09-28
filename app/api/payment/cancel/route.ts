// ══════════════════════════════════════════
// 주문 취소 API
// - pending 주문: 상태만 취소로 변경 (결제 전이라 PG 호출 없음)
// - 결제 후 주문: 409 — 환불은 /api/payment/refund 경로로만
// 본인 주문 또는 관리자만 가능.
// ══════════════════════════════════════════

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { rateLimit } from "@/lib/rate-limit";
import { safePgError } from "@/lib/log-sanitize";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });

  // Rate limit: 사용자당 분당 10회 — 토스 환불 API 반복 호출 방지
  if (!rateLimit(`payment-cancel:${user.id}`, { max: 10, windowMs: 60_000 })) {
    return NextResponse.json({ error: "요청이 너무 많아요. 잠시 후 다시 시도해주세요." }, { status: 429 });
  }

  let body: { orderId?: string; orderNumber?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }
  if (!body.orderId && !body.orderNumber) {
    return NextResponse.json({ error: "주문 정보가 누락됐어요." }, { status: 400 });
  }

  const svc = createServiceClient();

  // 주문 조회 (id 또는 order_number)
  let query = svc.from("orders").select("*, items:order_items(*)");
  query = body.orderId ? query.eq("id", body.orderId) : query.eq("order_number", body.orderNumber!);
  const { data: order, error: orderError } = await query.maybeSingle();

  if (orderError || !order) {
    return NextResponse.json({ error: "주문을 찾을 수 없어요." }, { status: 404 });
  }

  // 권한: 본인 또는 관리자
  if (order.user_id !== user.id) {
    const { data: admin } = await svc
      .from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
    if (!admin) return NextResponse.json({ error: "권한이 없어요." }, { status: 403 });
  }

  if (order.status === "cancelled" || order.status === "refunded") {
    return NextResponse.json({ ok: true, status: order.status });
  }

  // ── pending: PG 호출 없이 취소 ──
  if (order.status === "pending") {
    // payment_key가 이미 잡혀 있으면 confirm이 토스 승인 중(status=pending 유지)이라는
    // 뜻 — 여기서 취소하면 "청구됐는데 주문 취소" 상태가 됨. is(payment_key,null)로
    // 승인 진행 중인 주문은 취소 대상에서 제외한다.
    const { data: done, error } = await svc
      .from("orders")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", order.id)
      .eq("status", "pending") // 경합 방지
      .is("payment_key", null) // 결제 승인 진행 중(payment_key 선점됨)이면 취소 불가
      .select("id");
    if (error) {
      console.error("[payment/cancel] pending cancel failed:", safePgError(error));
      return NextResponse.json({ error: "주문 취소에 실패했어요." }, { status: 500 });
    }
    if (!done || done.length === 0) {
      // 취소 못 함 — 결제 승인이 진행 중이거나 이미 상태가 바뀜. 최신 상태 재조회로 안내.
      const { data: fresh } = await svc.from("orders").select("status, payment_key").eq("id", order.id).maybeSingle();
      const st = (fresh as { status?: string } | null)?.status;
      if (st === "cancelled" || st === "refunded") {
        return NextResponse.json({ ok: true, status: st });
      }
      // pending인데 payment_key가 잡혀 있음 = 승인 처리 중
      return NextResponse.json({ error: "결제 승인이 진행 중이에요. 잠시 후 다시 시도해주세요." }, { status: 409 });
    }
    return NextResponse.json({ ok: true, status: "cancelled" });
  }

  // 결제 후 주문(paid 이상)은 여기서 환불하지 않는다 — 환불 원장·멱등키·송장 심사가 있는
  // /api/payment/refund(유저) · /api/admin/refunds(관리자)로만. 예전엔 paid면 송장 여부와 무관하게
  // 즉시 전액 환불해 발송 후 자동환불 차단(H-2)을 우회할 수 있었다(2026-09-28 감사).
  return NextResponse.json(
    { error: "결제가 끝난 주문은 주문 상세의 환불 요청으로 진행해 주세요." },
    { status: 409 },
  );
}
