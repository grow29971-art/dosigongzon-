// 결제 대사(reconciliation) — Vercel Cron 매일 07:30 KST (22:30 UTC 전날)
// 우리 DB가 기록한 결제 금액/상태와 토스페이먼츠 원장을 매일 자동 대조.
// 승인 시점 검증(금액 위변조·무결성 재계산)은 /api/payment/confirm에 이미 있고,
// 이 크론은 "그 이후" 어긋난 케이스를 잡는 마지막 안전망:
//   - DB는 paid인데 토스에선 취소/부분취소된 주문 (환불 미반영)
//   - DB 금액과 토스 실제 청구 금액 불일치
//   - 웹훅 유실로 상태가 어긋난 주문
// 불일치 발견 시 관리자 DM 자가발송(admin-daily-digest와 동일 패턴) + 로그.
// 수동 호출: POST /api/cron/payment-reconcile (CRON_SECRET 필요)

import { createClient } from "@supabase/supabase-js";

export const maxDuration = 60;

const LOOKBACK_DAYS = 3;
const MAX_ORDERS_PER_RUN = 50;

// 우리 상태 → 기대하는 토스 상태
const PAID_LIKE = ["paid", "preparing", "shipping", "delivered"];
const CANCELLED_LIKE = ["cancelled", "refunded"];

interface TossPayment {
  status?: string;        // DONE | CANCELED | PARTIAL_CANCELED | ABORTED | EXPIRED ...
  totalAmount?: number;   // 총 결제 금액
  balanceAmount?: number; // 취소 후 남은 금액 (전액 취소면 0)
  code?: string;
  message?: string;
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    return Response.json({ error: "서버 설정 미완료" }, { status: 500 });
  }
  const secretKey = process.env.TOSS_SECRET_KEY;
  if (!secretKey) {
    // 결제 미개통 단계 — 조용히 스킵
    return Response.json({ ok: true, skipped: "TOSS_SECRET_KEY 미설정" });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const cutoff = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // 최근 결제 이력이 있는 주문 (payment_key 보유 = 토스 원장에 존재)
  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("id, order_number, status, payment_amount, payment_key, updated_at")
    .not("payment_key", "is", null)
    .gte("updated_at", cutoff)
    .order("updated_at", { ascending: false })
    .limit(MAX_ORDERS_PER_RUN);

  if (ordersError) {
    console.error("[payment-reconcile] orders fetch failed:", ordersError);
    return Response.json({ ok: false, error: ordersError.message }, { status: 500 });
  }

  const rows = (orders ?? []) as {
    id: string; order_number: string; status: string;
    payment_amount: number; payment_key: string; updated_at: string;
  }[];

  const basicAuth = Buffer.from(`${secretKey}:`).toString("base64");
  const mismatches: string[] = [];
  let checked = 0;

  for (const order of rows) {
    let toss: TossPayment;
    try {
      const res = await fetch(
        `https://api.tosspayments.com/v1/payments/${encodeURIComponent(order.payment_key)}`,
        { headers: { Authorization: `Basic ${basicAuth}` } },
      );
      toss = (await res.json()) as TossPayment;
      if (!res.ok) {
        // 원장에 없는 paymentKey — pending 중 이탈 등 정상 케이스도 있어 paid류만 문제
        if (PAID_LIKE.includes(order.status)) {
          mismatches.push(`${order.order_number}: DB=${order.status}인데 토스 조회 실패(${toss.code ?? res.status})`);
        }
        continue;
      }
    } catch (e) {
      console.error("[payment-reconcile] toss fetch error:", e, order.order_number);
      continue; // 네트워크 오류는 다음 실행에서 재확인
    }
    checked++;

    if (PAID_LIKE.includes(order.status)) {
      // 결제 완료로 기록된 주문 — 토스도 DONE + 금액 일치 + 미취소여야 함
      if (toss.status !== "DONE") {
        mismatches.push(`${order.order_number}: DB=${order.status}, 토스=${toss.status} (환불 미반영 가능)`);
      } else if (toss.totalAmount !== order.payment_amount) {
        mismatches.push(`${order.order_number}: 금액 불일치 DB=${order.payment_amount}원, 토스=${toss.totalAmount}원`);
      } else if (typeof toss.balanceAmount === "number" && toss.balanceAmount !== toss.totalAmount) {
        mismatches.push(`${order.order_number}: 부분취소 감지 — 토스 잔액 ${toss.balanceAmount}/${toss.totalAmount}원, DB=${order.status}`);
      }
    } else if (CANCELLED_LIKE.includes(order.status)) {
      // 취소/환불로 기록된 주문 — 토스에 잔액이 남아 있으면 환불 실패 의심
      const cancelled = toss.status === "CANCELED" || toss.status === "PARTIAL_CANCELED";
      if (toss.status === "DONE" && (toss.balanceAmount ?? 0) > 0) {
        mismatches.push(`${order.order_number}: DB=${order.status}인데 토스 잔액 ${toss.balanceAmount}원 남음 (환불 확인 필요)`);
      } else if (!cancelled && toss.status !== "DONE") {
        // ABORTED/EXPIRED 등은 청구 없음 → 정상
      }
    }
  }

  // 불일치 → 관리자 DM 자가발송 (admin-daily-digest 패턴)
  if (mismatches.length > 0) {
    console.error("[payment-reconcile] mismatches:", mismatches);

    const { data: admins } = await supabase.from("admins").select("user_id");
    const adminIds = ((admins ?? []) as { user_id: string }[]).map((a) => a.user_id);
    if (adminIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, nickname, avatar_url")
        .in("id", adminIds);
      const profileMap = new Map(
        ((profiles ?? []) as { id: string; nickname: string | null; avatar_url: string | null }[]).map((p) => [p.id, p]),
      );
      const body = [
        `🚨 결제 대사 불일치 ${mismatches.length}건`,
        "",
        ...mismatches.slice(0, 10).map((m) => `• ${m}`),
        mismatches.length > 10 ? `…외 ${mismatches.length - 10}건` : "",
        "",
        "토스 개발자센터 결제 내역과 /admin/orders를 대조해주세요.",
      ].filter(Boolean).join("\n");

      const dmRows = adminIds.map((id) => {
        const prof = profileMap.get(id);
        return {
          sender_id: id,
          sender_name: prof?.nickname ?? "도시공존 운영",
          sender_avatar_url: prof?.avatar_url ?? null,
          receiver_id: id,
          receiver_name: prof?.nickname ?? "운영자",
          body,
        };
      });
      const { error: dmError } = await supabase.from("direct_messages").insert(dmRows);
      if (dmError) console.error("[payment-reconcile] admin DM failed:", dmError);
    }
  }

  return Response.json({
    ok: true,
    scanned: rows.length,
    checked,
    mismatches: mismatches.length,
    details: mismatches,
  });
}

// Vercel Cron은 GET으로 호출 — POST와 동일 처리 (CRON_SECRET 검사 동일)
export const GET = POST;
