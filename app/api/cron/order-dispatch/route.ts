// ══════════════════════════════════════════
// 발주 다이제스트 — 매일 13:00 KST (04:00 UTC, vercel.json 크론)
// 결제완료(paid) 상태의 실물 주문을 전부 모아 발주서로 정리해
// 운영자 텔레그램으로 보낸다. 운영자는 이걸 드롭쉬핑 업체(대즐 카톡)에
// 전달하고 입금한 뒤, 주문 관리에서 "상품준비중"으로 바꾼다.
//
// 설계 원칙:
// - paid에 머무는 주문은 다음날 또 뜬다 = 발주 누락 방지 리마인더 겸용.
//   (상태 자동 전환은 하지 않는다 — 실제 전달·입금은 사람이 하므로,
//    앱이 먼저 "준비중"으로 바꾸면 전달 누락이 조용히 묻힌다)
// - 실물 주문만: 후원(가상) 주문은 배송이 없어 발주 대상이 아니다.
// - 주문 0건이면 텔레그램 발송 생략 (빈 알림 스팸 방지).
// - 텔레그램 미설정이면 조용히 스킵 (lib/telegram.ts silent skip).
// ══════════════════════════════════════════

import { createServiceClient } from "@/lib/supabase/service";
import { sendTelegramToAdmin, telegramConfigured } from "@/lib/telegram";

interface OrderRow {
  id: string;
  order_number: string;
  recipient_name: string | null;
  recipient_phone: string | null;
  recipient_address: string | null;
  recipient_address_detail: string | null;
  postal_code: string | null;
  memo: string | null;
  paid_at: string | null;
  payment_amount: number;
  shipping_fee: number;
  items: { product_name: string; quantity: number }[];
}

const won = (n: number) => `${n.toLocaleString()}원`;

async function handle(request: Request): Promise<Response> {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const svc = createServiceClient();
  const { data, error } = await svc
    .from("orders")
    .select("id, order_number, recipient_name, recipient_phone, recipient_address, recipient_address_detail, postal_code, memo, paid_at, payment_amount, shipping_fee, items:order_items(product_name, quantity)")
    .eq("status", "paid")
    .not("recipient_address", "is", null) // 실물 주문만 (후원/가상은 배송 없음)
    .order("paid_at", { ascending: true });

  if (error) {
    console.error("[cron/order-dispatch] query failed:", error.code);
    return Response.json({ error: "주문 조회 실패" }, { status: 500 });
  }

  const orders = (data ?? []) as OrderRow[];
  if (orders.length === 0) {
    return Response.json({ ok: true, orders: 0, sent: 0, note: "발주 대상 없음 — 발송 생략" });
  }

  const kst = new Date(Date.now() + 9 * 3600e3);
  const today = `${kst.getUTCMonth() + 1}월 ${kst.getUTCDate()}일`;
  const totalAmount = orders.reduce((s, o) => s + (o.payment_amount ?? 0), 0);
  const lines: string[] = [
    `📦 오늘 보낼 주문 ${orders.length}건 (${today})`,
    "아래 내용을 대즐에 전달하고 입금해 주세요.",
    "",
  ];
  orders.forEach((o, i) => {
    const itemsLine = o.items.map((it) => `${it.product_name} × ${it.quantity}개`).join(", ");
    lines.push(
      `${i + 1}번 주문 · ${o.order_number}`,
      `- 상품: ${itemsLine}`,
      `- 받는 분: ${o.recipient_name ?? "-"} (${o.recipient_phone ?? "-"})`,
      `- 주소: (${o.postal_code ?? "-"}) ${o.recipient_address ?? "-"}${o.recipient_address_detail ? " " + o.recipient_address_detail : ""}`,
      `- 결제금액: ${won(o.payment_amount ?? 0)}${o.shipping_fee > 0 ? ` (배송비 ${won(o.shipping_fee)} 포함)` : ""}`,
    );
    if (o.memo) lines.push(`- 요청사항: ${o.memo}`);
    lines.push("");
  });
  if (orders.length > 1) {
    lines.push(`💰 오늘 결제금액 합계: ${won(totalAmount)}`, "");
  }
  lines.push(
    "✅ 다 보냈으면 관리자 → 주문 관리에서 '상품준비중'으로 바꿔주세요.",
    "안 바꾸면 내일 또 알려드려요 (깜빡 방지).",
  );

  const sent = await sendTelegramToAdmin(lines.join("\n"));
  if (!telegramConfigured()) {
    console.error("[cron/order-dispatch] 텔레그램 미설정 — 발주 " + orders.length + "건이 전달되지 못함");
  }
  return Response.json({ ok: true, orders: orders.length, sent, configured: telegramConfigured() });
}

export async function POST(request: Request) {
  return handle(request);
}

// Vercel Cron은 GET으로 호출
export const GET = POST;
