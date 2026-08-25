// ══════════════════════════════════════════
// 배송 시작 알림 (admin 전용) — 관리자가 주문을 "배송중"으로 바꾼 뒤 호출
// 구매자에게 웹푸시 + 쪽지(DM)를 함께 보낸다.
//  - 푸시: 구독자에게만 도달 (미구독이면 0건이 정상)
//  - 쪽지: 항상 남는 기록 — 푸시 미구독자도 앱에서 확인 가능
// 게스트 주문(user_id null)은 보낼 곳이 없어 건너뛴다.
// 인증: 쿠키 세션 + admins 테이블 (admin/fund-refresh와 동일 패턴)
// ══════════════════════════════════════════

import { NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

const VAPID_PUBLIC = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "").trim();
const VAPID_PRIVATE = (process.env.VAPID_PRIVATE_KEY ?? "").trim();
const VAPID_SUBJECT = (process.env.VAPID_SUBJECT ?? "mailto:grow29971@gmail.com").trim();

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });

  const svc = createServiceClient();
  const { data: admin } = await svc
    .from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!admin) return NextResponse.json({ error: "관리자 권한이 필요해요." }, { status: 403 });

  let body: { orderId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }
  if (!body.orderId) return NextResponse.json({ error: "orderId가 필요해요." }, { status: 400 });

  const { data: order } = await svc
    .from("orders")
    .select("id, user_id, order_number, status, tracking_number, courier, items:order_items(product_name, quantity)")
    .eq("id", body.orderId)
    .maybeSingle();
  if (!order) return NextResponse.json({ error: "주문을 찾을 수 없어요." }, { status: 404 });

  const row = order as {
    id: string; user_id: string | null; order_number: string; status: string;
    tracking_number: string | null; courier: string | null;
    items: { product_name: string; quantity: number }[];
  };
  if (row.status !== "shipping") {
    return NextResponse.json({ error: "배송중 상태의 주문만 알림을 보낼 수 있어요." }, { status: 409 });
  }
  if (!row.user_id) {
    // 게스트 주문 — 계정이 없어 알림 수단이 없다 (게스트 동선은 의도적 보류)
    return NextResponse.json({ ok: true, sent: 0, dm: false, reason: "guest" });
  }

  const productLabel = row.items.length === 0
    ? "주문 상품"
    : row.items.length > 1
      ? `${row.items[0].product_name} 외 ${row.items.length - 1}건`
      : row.items[0].product_name;
  const trackingLine = row.tracking_number
    ? `${row.courier ? row.courier + " " : ""}운송장 ${row.tracking_number}`
    : "";
  const url = `/shop/orders/${row.id}`;

  // ── 쪽지 (운영자 발신 — refund-notify와 동일 패턴, 실패해도 푸시는 계속) ──
  let dmOk = false;
  try {
    const { data: profiles } = await svc
      .from("profiles")
      .select("id, nickname, avatar_url")
      .in("id", [user.id, row.user_id]);
    const map = new Map(
      ((profiles ?? []) as { id: string; nickname: string | null; avatar_url: string | null }[])
        .map((p) => [p.id, p]),
    );
    const { error: dmError } = await svc.from("direct_messages").insert([{
      sender_id: user.id,
      sender_name: map.get(user.id)?.nickname ?? "도시공존 운영자",
      sender_avatar_url: map.get(user.id)?.avatar_url ?? null,
      receiver_id: row.user_id,
      receiver_name: map.get(row.user_id)?.nickname ?? "회원",
      body: `📦 배송이 시작됐어요!\n주문 ${row.order_number} — ${productLabel}\n${trackingLine ? trackingLine + "\n" : ""}주문 상세의 "배송 조회하기"에서 현재 위치를 볼 수 있어요.`,
    }]);
    dmOk = !dmError;
    if (dmError) console.error("[notify-shipping] DM failed:", dmError.code);
  } catch (e) {
    console.error("[notify-shipping] DM error:", e);
  }

  // ── 웹푸시 (구독자에게만 — 미구독이면 sent 0이 정상) ──
  let sent = 0;
  let failed = 0;
  if (VAPID_PUBLIC && VAPID_PRIVATE) {
    const { data: subs } = await svc
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", row.user_id);
    for (const sub of (subs ?? []) as { id: string; endpoint: string; p256dh: string; auth: string }[]) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({
            title: "📦 배송이 시작됐어요",
            body: `${productLabel} — 눌러서 배송 현황을 확인하세요`,
            url,
          }),
        );
        sent++;
      } catch (err: unknown) {
        failed++;
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 410 || statusCode === 404) {
          await svc.from("push_subscriptions").delete().eq("id", sub.id);
        }
      }
    }
  }

  return NextResponse.json({ ok: true, sent, failed, dm: dmOk });
}
