// ══════════════════════════════════════════
// 발주 다이제스트 — 매일 13:00 KST (04:00 UTC, vercel.json 크론)
// 결제완료(paid) 상태의 실물 주문을 모아 운영자 텔레그램으로 알린다.
// ⚠ 개인정보(전체 주소·전화·메모)는 싣지 않는다 — 텔레그램은 해외 서버라
//   원문 전송 = 국외이전 소지(8/26 원탁회의). 마스킹 요약만 보내고,
//   운영자는 관리자 주문 페이지에서 배송정보를 복사해 대즐에 전달한다.
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
import { TOSS_FEE_RATE } from "@/lib/payments-config";

interface OrderRow {
  id: string;
  order_number: string;
  recipient_name: string | null;
  recipient_address: string | null;
  paid_at: string | null;
  payment_amount: number;
  shipping_fee: number;
  items: { product_id: string | null; product_name: string; quantity: number; donation_amount: number }[];
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
    .select("id, order_number, recipient_name, recipient_address, paid_at, payment_amount, shipping_fee, items:order_items(product_id, product_name, quantity, donation_amount)")
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

  // 매입가(원가) — 관리자·서버 전용 product_costs (미입력 상품은 0으로 계산되니 표시로 구분)
  const productIds = Array.from(new Set(
    orders.flatMap((o) => o.items.map((it) => it.product_id)).filter((id): id is string => !!id),
  ));
  const costMap = new Map<string, number>();
  if (productIds.length > 0) {
    const { data: costs } = await svc
      .from("product_costs")
      .select("product_id, cost_price")
      .in("product_id", productIds);
    for (const c of (costs ?? []) as { product_id: string; cost_price: number }[]) {
      costMap.set(c.product_id, c.cost_price);
    }
  }

  const kst = new Date(Date.now() + 9 * 3600e3);
  const today = `${kst.getUTCMonth() + 1}월 ${kst.getUTCDate()}일`;
  let totalAmount = 0, totalCost = 0, totalDonation = 0, totalFee = 0, anyMissingCost = false;
  const feePct = `${(TOSS_FEE_RATE * 100).toFixed(1)}%`;
  const lines: string[] = [
    `📦 오늘 보낼 주문 ${orders.length}건 (${today})`,
    "주문 내용과 입금액을 확인하세요.",
    "",
  ];
  // ── 개인정보 마스킹 (2026-08-26 원탁회의 — 보안·법률·프로파일러 3자 수렴) ──
  // 텔레그램은 해외 서버라 고객 주소·전화 원문 전송 = 개인정보 국외이전 소지.
  // 발주서에는 비식별 요약만 싣고, 전체 배송정보는 관리자 주문 페이지에서 복사한다.
  const maskName = (n: string | null) =>
    !n ? "-" : n.length <= 1 ? n + "*" : n[0] + "*".repeat(Math.max(1, n.length - 2)) + (n.length > 2 ? n[n.length - 1] : "");
  const coarseAddress = (a: string | null) => {
    if (!a) return "-";
    const parts = a.trim().split(/\s+/);
    return parts.slice(0, 3).join(" "); // 시/구/동 수준까지만 — 상세주소·번지 제외
  };

  orders.forEach((o, i) => {
    const itemsLine = o.items.map((it) => `${it.product_name} × ${it.quantity}개`).join(", ");
    const cost = o.items.reduce((s, it) => s + (it.product_id ? (costMap.get(it.product_id) ?? 0) : 0) * it.quantity, 0);
    const missingCost = o.items.some((it) => !it.product_id || !costMap.has(it.product_id));
    const donation = o.items.reduce((s, it) => s + (it.donation_amount ?? 0), 0);
    const fee = Math.round((o.payment_amount ?? 0) * TOSS_FEE_RATE);
    const profit = (o.payment_amount ?? 0) - cost - donation - fee;
    totalAmount += o.payment_amount ?? 0;
    totalCost += cost;
    totalDonation += donation;
    totalFee += fee;
    if (missingCost) anyMissingCost = true;
    lines.push(
      `${i + 1}번 주문 · ${o.order_number}`,
      `- 상품: ${itemsLine}`,
      `- 받는 분: ${maskName(o.recipient_name)} · ${coarseAddress(o.recipient_address)}`,
      `- 결제금액: ${won(o.payment_amount ?? 0)}${o.shipping_fee > 0 ? ` (배송비 ${won(o.shipping_fee)} 포함)` : ""}`,
      `- 원가(매입가): ${won(cost)}${missingCost ? " ⚠매입가 미입력 상품 있음" : ""}`,
      `- 후원 적립: ${won(donation)}`,
      `- 카드 수수료(${feePct}): ${won(fee)}`,
      `- 진짜 남는 돈: ${won(profit)}`,
    );
    lines.push("");
  });
  if (orders.length > 1) {
    lines.push(
      `💰 오늘 합계`,
      `- 결제금액 ${won(totalAmount)} · 원가 ${won(totalCost)} · 후원 ${won(totalDonation)} · 수수료 ${won(totalFee)}`,
      `- 진짜 남는 돈 ${won(totalAmount - totalCost - totalDonation - totalFee)}`,
      "",
    );
  }
  lines.push(
    `※ 진짜 남는 돈 = 결제금액 − 매입가 − 후원 적립 − 카드 수수료(${feePct}, 계약 확정 전 보수 추정치). 배송 실비 부담분이 있으면 그만큼 더 빠져요.` + (anyMissingCost ? " ⚠매입가 미입력 상품은 원가 0으로 계산됨 — 관리자 상품 폼에서 입력해 주세요." : ""),
    "",
    "📋 배송지·연락처 전체 정보는 관리자 주문 페이지에서 복사해 대즐에 전달하세요:",
    "https://dosigongzon.com/admin/orders",
    "(개인정보 보호를 위해 이 메시지에는 싣지 않아요)",
    "",
    "✅ 다 보냈으면 주문 관리에서 '상품준비중'으로 바꿔주세요.",
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
