"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Check, MapPin, CreditCard, Truck } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import LoginRequired from "@/app/components/LoginRequired";
import {
  getMyOrder, ORDER_STATUS_MAP,
  type OrderWithItems, type OrderStatus,
} from "@/lib/order-repo";
import {
  decideRefund, refundableAmount, REFUND_REASON_LABELS,
  type RefundOrderInput, type RefundReasonCode,
} from "@/lib/refund-policy";

// 유저가 고를 수 있는 환불 사유 (서버 USER_REASONS와 동일 세트)
const USER_REASONS: RefundReasonCode[] = [
  "change_of_mind", "defect", "wrong_delivery", "delayed", "other",
];

function formatWon(amount: number): string {
  return `${amount.toLocaleString()}원`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// 정상 흐름 타임라인 단계 (취소/환불은 별도 표시)
const TIMELINE_STEPS: { key: OrderStatus; label: string }[] = [
  { key: "paid", label: "결제완료" },
  { key: "preparing", label: "상품준비중" },
  { key: "shipping", label: "배송중" },
  { key: "delivered", label: "배송완료" },
];

function timelineIndex(status: OrderStatus): number {
  return TIMELINE_STEPS.findIndex((s) => s.key === status);
}

const sectionStyle = {
  background: "var(--color-surface)",
  borderRadius: "var(--radius-card)",
  boxShadow: "var(--shadow-card)",
  border: "1px solid var(--color-divider)",
} as const;

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [order, setOrder] = useState<OrderWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [refundOpen, setRefundOpen] = useState(false);
  const [reason, setReason] = useState<RefundReasonCode>("change_of_mind");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user || !id) return;
    getMyOrder(id)
      .then(setOrder)
      .catch(() => setOrder(null))
      .finally(() => setLoading(false));
  }, [user, id]);

  if (!authLoading && !user) {
    return <LoginRequired from={`/shop/orders/${id}`} title="주문 상세는 로그인 후 확인할 수 있어요" />;
  }

  const handleRefund = async () => {
    if (!order) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/payment/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          reasonCode: reason,
          reasonNote: note.trim() || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error ?? "환불 요청에 실패했어요. 잠시 후 다시 시도해주세요.");
      }
      if (json.mode === "auto") {
        setOrder((prev) => prev
          ? { ...prev, status: "refunded", refund_status: "refunded", refund_amount: json.amount ?? prev.payment_amount }
          : prev);
        setNotice("환불이 완료됐어요. 결제수단으로 며칠 내에 입금돼요.");
      } else {
        setOrder((prev) => (prev ? { ...prev, refund_status: "requested" } : prev));
        setNotice("환불 요청이 접수됐어요. 관리자 확인 후 처리 결과를 알려드려요.");
      }
      setRefundOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "환불 요청에 실패했어요.");
    } finally {
      setSubmitting(false);
    }
  };

  const status = order ? ORDER_STATUS_MAP[order.status] : null;
  const tlIndex = order ? timelineIndex(order.status) : -1;
  const isAborted = order?.status === "cancelled" || order?.status === "refunded";

  // ── 환불 정책 판정 (서버 /api/payment/refund와 같은 순수 함수 공유) ──
  // 전 품목 가상(후원) 주문은 배송지가 없다 — recipient_address 유무가 실물 포함의 프록시.
  const refundStatus = order?.refund_status ?? "none";
  const refundInput: RefundOrderInput | null = order ? {
    status: order.status,
    refundStatus: refundStatus as RefundOrderInput["refundStatus"],
    paymentAmount: order.payment_amount,
    refundAmount: order.refund_amount ?? 0,
    paidAt: order.paid_at,
    shippedAt: order.shipped_at ?? null,
    deliveredAt: order.delivered_at ?? null,
    // 서버(buildRefundOrderInput)와 같은 근거를 써야 화면 안내와 실제 판정이 갈리지 않는다
    hasTracking: !!order.tracking_number?.trim(),
    shippingFee: order.shipping_fee ?? 0,
    hasPhysicalItem: !!order.recipient_address,
    hasDonationItem: order.items.some((i) => (i.donation_amount ?? 0) > 0),
    allVirtual: !order.recipient_address,
  } : null;
  // 배송 전(즉시 전액 취소)과 배송 후(사유 선택 + 심사)는 문구가 다르다.
  // 송장이 이미 나갔으면 상태가 preparing이어도 즉시취소가 아니라 심사다(H-2) —
  // "즉시 취소돼요" 안내 후 실제로는 심사로 접수되면 유저가 속았다고 느낀다.
  const preShipment =
    (order?.status === "paid" || order?.status === "preparing") &&
    !order?.tracking_number?.trim() && !order?.shipped_at;
  const modalDecision = refundInput ? decideRefund(refundInput, reason) : null;
  const remaining = order ? order.payment_amount - (order.refund_amount ?? 0) : 0;
  // 어떤 사유로든 요청 가능하면 버튼 노출 (기한은 사유별로 다르니 둘 다 확인)
  const canRequestRefund = !!refundInput && !isAborted && order!.status !== "pending" &&
    refundStatus !== "requested" &&
    (decideRefund(refundInput, "change_of_mind").allowed || decideRefund(refundInput, "defect").allowed);

  return (
    <div className="pb-24">
      <div className="px-4 pt-12 pb-2 flex items-center gap-2">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 rounded-full bg-white flex items-center justify-center press-strong"
          style={{ boxShadow: "var(--shadow-raised)" }}
          aria-label="뒤로 가기"
        >
          <ArrowLeft size={18} className="text-text-main" />
        </button>
        <h1 className="text-[17px] font-bold text-text-main">주문 상세</h1>
      </div>

      {loading ? (
        <div className="px-4 mt-4 space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-2xl animate-pulse" style={{ height: 110, background: "var(--color-surface-alt)" }} />
          ))}
        </div>
      ) : !order || !status ? (
        <div className="flex flex-col items-center text-center pt-16 px-6">
          <p className="text-[15px] font-bold text-text-main mb-4">주문을 찾을 수 없어요</p>
          <button
            onClick={() => router.push("/shop/orders")}
            className="px-5 py-2.5 rounded-2xl bg-primary text-white text-[13px] font-bold"
          >
            주문 내역으로
          </button>
        </div>
      ) : (
        <div className="px-4 mt-3 space-y-4">
          {/* 주문번호 + 상태 */}
          <section className="p-4" style={sectionStyle}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[13px] font-semibold text-text-light">{order.order_number}</span>
              <span
                className="text-[11px] font-bold px-2.5 py-1 rounded-lg"
                style={{ backgroundColor: `${status.color}15`, color: status.color }}
              >
                {status.label}
              </span>
            </div>
            <p className="text-[11px] text-text-light">{formatDate(order.created_at)} 주문</p>

            {/* 상태 타임라인 */}
            {isAborted ? (
              <div
                className="mt-4 py-3 text-center rounded-2xl text-[13px] font-bold"
                style={{ background: `${status.color}10`, color: status.color }}
              >
                {order.status === "cancelled" ? "이 주문은 취소되었어요" : "이 주문은 환불 처리되었어요"}
              </div>
            ) : order.status !== "pending" ? (
              <div className="mt-5 flex items-center">
                {TIMELINE_STEPS.map((step, i) => {
                  const reached = tlIndex >= i;
                  const isLast = i === TIMELINE_STEPS.length - 1;
                  return (
                    <div key={step.key} className={isLast ? "flex flex-col items-center" : "flex-1 flex flex-col"}>
                      <div className={isLast ? "flex items-center" : "flex items-center w-full"}>
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                          style={{
                            background: reached ? "var(--color-primary)" : "var(--color-surface-alt)",
                            boxShadow: reached ? "0 2px 6px rgba(173, 94, 59,0.35)" : "none",
                          }}
                        >
                          {reached && <Check size={13} color="#fff" strokeWidth={3} />}
                        </div>
                        {!isLast && (
                          <div className="flex-1 h-[3px] mx-1 rounded-full" style={{ background: tlIndex > i ? "var(--color-primary)" : "var(--color-surface-alt)" }} />
                        )}
                      </div>
                      <span
                        className="text-[11px] font-bold mt-1.5"
                        style={{ color: reached ? "var(--color-primary)" : "var(--color-text-light)" }}
                      >
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div
                className="mt-4 py-3 text-center rounded-2xl text-[13px] font-bold"
                style={{ background: "rgba(138,144,160,0.1)", color: "var(--color-text-light)" }}
              >
                결제를 기다리고 있어요
              </div>
            )}

            {/* 환불 축 상태 — 배송 상태와 독립 */}
            {!isAborted && refundStatus === "requested" && (
              <div
                className="mt-3 py-2.5 text-center rounded-2xl text-[13px] font-bold"
                style={{ background: "rgba(255,169,39,0.12)", color: "var(--color-warning)" }}
              >
                환불 요청이 접수됐어요 — 관리자 확인 후 처리돼요
              </div>
            )}
            {!isAborted && refundStatus === "rejected" && (
              <div
                className="mt-3 py-2.5 text-center rounded-2xl text-[13px] font-bold"
                style={{ background: "rgba(138,144,160,0.12)", color: "var(--color-text-sub)" }}
              >
                환불 요청이 반려됐어요 — 필요하면 다시 요청할 수 있어요
              </div>
            )}
          </section>

          {/* 주문 상품 */}
          <section className="p-4" style={sectionStyle}>
            <h2 className="text-[13px] font-bold text-text-main mb-3">주문 상품</h2>
            <div className="space-y-2">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-text-main truncate">{item.product_name}</p>
                    <p className="text-[11px] text-text-sub">{formatWon(item.product_price)} · {item.quantity}개</p>
                  </div>
                  <span className="text-[13px] font-medium text-text-main shrink-0 ml-3">{formatWon(item.subtotal)}</span>
                </div>
              ))}
            </div>
          </section>

          {/* 배송지 */}
          <section className="p-4" style={sectionStyle}>
            <h2 className="text-[13px] font-bold text-text-main mb-3 flex items-center gap-1.5">
              <MapPin size={14} style={{ color: "var(--color-primary)" }} /> 배송지
            </h2>
            {order.recipient_address ? (
              <>
                <p className="text-[13px] font-bold text-text-main">{order.recipient_name} · {order.recipient_phone}</p>
                <p className="text-[13px] text-text-sub mt-1">
                  ({order.postal_code}) {order.recipient_address}
                  {order.recipient_address_detail ? ` ${order.recipient_address_detail}` : ""}
                </p>
              </>
            ) : (
              <p className="text-[13px] text-text-sub">💛 후원 상품 주문이라 배송이 없어요.</p>
            )}
            {order.memo && (
              <p className="text-[13px] text-text-light mt-2">메모: {order.memo}</p>
            )}
            {order.tracking_number && (
              <p className="text-[13px] text-text-sub mt-2 flex items-center gap-1.5">
                <Truck size={13} /> 운송장번호 <span className="font-bold text-text-main">{order.tracking_number}</span>
              </p>
            )}
          </section>

          {/* 결제 정보 */}
          <section className="p-4" style={sectionStyle}>
            <h2 className="text-[13px] font-bold text-text-main mb-3 flex items-center gap-1.5">
              <CreditCard size={14} style={{ color: "var(--color-primary)" }} /> 결제 정보
            </h2>
            <div className="flex items-center justify-between text-[13px] text-text-sub mb-1.5">
              <span>상품금액</span>
              <span>{formatWon(order.total_amount)}</span>
            </div>
            <div className="flex items-center justify-between text-[13px] text-text-sub mb-2.5">
              <span>배송비</span>
              <span>{order.shipping_fee > 0 ? formatWon(order.shipping_fee) : "무료"}</span>
            </div>
            <div
              className="flex items-center justify-between pt-2.5 text-[15px] font-bold text-text-main"
              style={{ borderTop: "1px dashed rgba(0,0,0,0.08)" }}
            >
              <span>총 결제금액</span>
              <span style={{ color: "var(--color-primary)" }}>{formatWon(order.payment_amount)}</span>
            </div>
            {order.payment_method && (
              <p className="text-[11px] text-text-light mt-2">결제수단: {order.payment_method}</p>
            )}
            {order.paid_at && (
              <p className="text-[11px] text-text-light mt-0.5">{formatDate(order.paid_at)} 결제</p>
            )}
          </section>

          {notice && (
            <p className="text-[13px] font-bold text-center" style={{ color: "var(--color-primary)" }}>{notice}</p>
          )}
          {error && (
            <p className="text-[13px] font-bold text-center" style={{ color: "var(--color-error)" }}>{error}</p>
          )}

          {/* 취소·환불 — 정책 판정(decideRefund)이 허용하는 상태에서만.
              배송 전(paid/preparing)은 즉시 전액, 배송 중·완료는 사유 선택 후 심사 접수 */}
          {canRequestRefund && (
            <button
              onClick={() => { setReason("change_of_mind"); setNote(""); setRefundOpen(true); }}
              className="w-full py-3 rounded-2xl text-[13px] font-bold press transition-transform"
              style={{ background: "rgba(240,68,82,0.08)", color: "var(--color-error)", border: "1px solid rgba(240,68,82,0.2)" }}
            >
              {preShipment ? "주문 취소" : "환불 요청"}
            </button>
          )}
        </div>
      )}

      {/* 취소·환불 요청 모달 */}
      {refundOpen && order && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-8" style={{ background: "rgba(20,25,40,0.5)" }}>
          <div className="w-full max-w-[320px] p-5 max-h-[80vh] overflow-y-auto" style={{ background: "var(--color-surface)", borderRadius: "var(--radius-modal)" }}>
            <p className="text-[15px] font-bold text-text-main mb-1.5">
              {preShipment ? "주문을 취소할까요?" : "환불을 요청할까요?"}
            </p>

            {preShipment ? (
              <p className="text-[13px] text-text-sub leading-relaxed mb-4">
                배송 시작 전이라 전액이 결제수단으로 환불돼요. 취소 후에는 되돌릴 수 없어요.
              </p>
            ) : (
              <>
                <p className="text-[13px] text-text-sub leading-relaxed mb-3">환불 사유를 선택해주세요.</p>
                <div className="space-y-1.5 mb-3">
                  {USER_REASONS.map((code) => (
                    <button
                      key={code}
                      onClick={() => setReason(code)}
                      className="w-full px-3 py-2.5 rounded-xl text-left text-[13px] font-bold"
                      style={{
                        background: reason === code ? "rgba(173,94,59,0.08)" : "var(--color-warm-white)",
                        color: reason === code ? "var(--color-primary)" : "var(--color-text-sub)",
                        border: reason === code ? "1.5px solid rgba(173,94,59,0.4)" : "1px solid var(--color-divider)",
                      }}
                    >
                      {REFUND_REASON_LABELS[code]}
                    </button>
                  ))}
                </div>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="상세 내용 (선택)"
                  maxLength={500}
                  rows={2}
                  className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none resize-none mb-3"
                  style={{ background: "var(--color-warm-white)", border: "1px solid var(--color-divider)" }}
                />
              </>
            )}

            {/* 판정 미리보기 — 서버와 같은 decideRefund 결과 */}
            {modalDecision && (modalDecision.allowed ? (
              <div className="px-3 py-2.5 rounded-xl mb-4 text-[11px] leading-relaxed" style={{ background: "rgba(34,163,102,0.08)", color: "var(--color-sage)" }}>
                <p className="font-bold">{modalDecision.note}</p>
                <p className="mt-0.5">
                  예상 환불액 <b>{formatWon(refundableAmount(remaining, modalDecision))}</b>
                  {modalDecision.mode === "review" && " · 관리자 확인 후 처리돼요"}
                </p>
              </div>
            ) : (
              <p className="px-3 py-2.5 rounded-xl mb-4 text-[11px] font-bold leading-relaxed" style={{ background: "rgba(240,68,82,0.08)", color: "var(--color-error)" }}>
                {modalDecision.reason}
              </p>
            ))}

            <div className="flex gap-2">
              <button
                onClick={() => setRefundOpen(false)}
                disabled={submitting}
                className="flex-1 py-3 rounded-2xl text-[13px] font-bold"
                style={{ background: "var(--color-warm-white)", color: "var(--color-text-sub)" }}
              >
                돌아가기
              </button>
              <button
                onClick={handleRefund}
                disabled={submitting || !modalDecision?.allowed}
                className="flex-1 py-3 rounded-2xl text-[13px] font-bold text-white disabled:opacity-50"
                style={{ background: "var(--color-error)" }}
              >
                {submitting ? "처리 중…" : preShipment ? "주문 취소" : "환불 요청"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
