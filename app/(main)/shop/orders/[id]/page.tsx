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
  background: "#fff",
  borderRadius: 20,
  boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
  border: "1px solid rgba(0,0,0,0.04)",
} as const;

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [order, setOrder] = useState<OrderWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
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

  const handleCancel = async () => {
    if (!order) return;
    setCancelling(true);
    setError("");
    try {
      const res = await fetch("/api/payment/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error ?? "주문 취소에 실패했어요. 잠시 후 다시 시도해주세요.");
      }
      setOrder((prev) => (prev ? { ...prev, status: "cancelled" } : prev));
      setCancelOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "주문 취소에 실패했어요.");
    } finally {
      setCancelling(false);
    }
  };

  const status = order ? ORDER_STATUS_MAP[order.status] : null;
  const tlIndex = order ? timelineIndex(order.status) : -1;
  const isAborted = order?.status === "cancelled" || order?.status === "refunded";

  return (
    <div className="pb-24">
      <div className="px-4 pt-12 pb-2 flex items-center gap-2">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 rounded-full bg-white flex items-center justify-center active:scale-90"
          style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}
          aria-label="뒤로 가기"
        >
          <ArrowLeft size={18} className="text-text-main" />
        </button>
        <h1 className="text-[16px] font-extrabold text-text-main">주문 상세</h1>
      </div>

      {loading ? (
        <div className="px-4 mt-4 space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-2xl animate-pulse" style={{ height: 110, background: "#F2F4F6" }} />
          ))}
        </div>
      ) : !order || !status ? (
        <div className="flex flex-col items-center text-center pt-16 px-6">
          <p className="text-[14px] font-bold text-text-main mb-4">주문을 찾을 수 없어요</p>
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
              <span className="text-[12px] font-semibold text-text-light">{order.order_number}</span>
              <span
                className="text-[11px] font-extrabold px-2.5 py-1 rounded-lg"
                style={{ backgroundColor: `${status.color}15`, color: status.color }}
              >
                {status.label}
              </span>
            </div>
            <p className="text-[11.5px] text-text-light">{formatDate(order.created_at)} 주문</p>

            {/* 상태 타임라인 */}
            {isAborted ? (
              <div
                className="mt-4 py-3 text-center rounded-2xl text-[12.5px] font-bold"
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
                            background: reached ? "#3182F6" : "#F2F4F6",
                            boxShadow: reached ? "0 2px 6px rgba(49,130,246,0.35)" : "none",
                          }}
                        >
                          {reached && <Check size={13} color="#fff" strokeWidth={3} />}
                        </div>
                        {!isLast && (
                          <div className="flex-1 h-[3px] mx-1 rounded-full" style={{ background: tlIndex > i ? "#3182F6" : "#F2F4F6" }} />
                        )}
                      </div>
                      <span
                        className="text-[9.5px] font-bold mt-1.5"
                        style={{ color: reached ? "#3182F6" : "#8B95A1" }}
                      >
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div
                className="mt-4 py-3 text-center rounded-2xl text-[12.5px] font-bold"
                style={{ background: "rgba(138,144,160,0.1)", color: "#8B95A1" }}
              >
                결제를 기다리고 있어요
              </div>
            )}
          </section>

          {/* 주문 상품 */}
          <section className="p-4" style={sectionStyle}>
            <h2 className="text-[13.5px] font-extrabold text-text-main mb-3">주문 상품</h2>
            <div className="space-y-2">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-text-main truncate">{item.product_name}</p>
                    <p className="text-[11.5px] text-text-sub">{formatWon(item.product_price)} · {item.quantity}개</p>
                  </div>
                  <span className="text-[13px] font-extrabold text-text-main shrink-0 ml-3">{formatWon(item.subtotal)}</span>
                </div>
              ))}
            </div>
          </section>

          {/* 배송지 */}
          <section className="p-4" style={sectionStyle}>
            <h2 className="text-[13.5px] font-extrabold text-text-main mb-3 flex items-center gap-1.5">
              <MapPin size={14} style={{ color: "#3182F6" }} /> 배송지
            </h2>
            <p className="text-[13px] font-bold text-text-main">{order.recipient_name} · {order.recipient_phone}</p>
            <p className="text-[12.5px] text-text-sub mt-1">
              ({order.postal_code}) {order.recipient_address}
              {order.recipient_address_detail ? ` ${order.recipient_address_detail}` : ""}
            </p>
            {order.memo && (
              <p className="text-[12px] text-text-light mt-2">메모: {order.memo}</p>
            )}
            {order.tracking_number && (
              <p className="text-[12.5px] text-text-sub mt-2 flex items-center gap-1.5">
                <Truck size={13} /> 운송장번호 <span className="font-bold text-text-main">{order.tracking_number}</span>
              </p>
            )}
          </section>

          {/* 결제 정보 */}
          <section className="p-4" style={sectionStyle}>
            <h2 className="text-[13.5px] font-extrabold text-text-main mb-3 flex items-center gap-1.5">
              <CreditCard size={14} style={{ color: "#3182F6" }} /> 결제 정보
            </h2>
            <div className="flex items-center justify-between text-[12.5px] text-text-sub mb-1.5">
              <span>상품금액</span>
              <span>{formatWon(order.total_amount)}</span>
            </div>
            <div className="flex items-center justify-between text-[12.5px] text-text-sub mb-2.5">
              <span>배송비</span>
              <span>{order.shipping_fee > 0 ? formatWon(order.shipping_fee) : "무료"}</span>
            </div>
            <div
              className="flex items-center justify-between pt-2.5 text-[14.5px] font-extrabold text-text-main"
              style={{ borderTop: "1px dashed rgba(0,0,0,0.08)" }}
            >
              <span>총 결제금액</span>
              <span style={{ color: "#3182F6" }}>{formatWon(order.payment_amount)}</span>
            </div>
            {order.payment_method && (
              <p className="text-[11.5px] text-text-light mt-2">결제수단: {order.payment_method}</p>
            )}
            {order.paid_at && (
              <p className="text-[11.5px] text-text-light mt-0.5">{formatDate(order.paid_at)} 결제</p>
            )}
          </section>

          {error && (
            <p className="text-[12.5px] font-bold text-center" style={{ color: "#D85555" }}>{error}</p>
          )}

          {/* 주문 취소 — 결제완료 상태에서만 */}
          {order.status === "paid" && (
            <button
              onClick={() => setCancelOpen(true)}
              className="w-full py-3 rounded-2xl text-[13px] font-bold active:scale-[0.98] transition-transform"
              style={{ background: "rgba(216,85,85,0.08)", color: "#D85555", border: "1px solid rgba(216,85,85,0.2)" }}
            >
              주문 취소
            </button>
          )}
        </div>
      )}

      {/* 취소 확인 모달 */}
      {cancelOpen && order && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-8" style={{ background: "rgba(20,25,40,0.5)" }}>
          <div className="w-full max-w-[320px] p-5" style={{ background: "#fff", borderRadius: 24 }}>
            <p className="text-[15px] font-extrabold text-text-main mb-1.5">주문을 취소할까요?</p>
            <p className="text-[12.5px] text-text-sub leading-relaxed mb-4">
              결제된 금액은 결제수단으로 환불돼요. 취소 후에는 되돌릴 수 없어요.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setCancelOpen(false)}
                disabled={cancelling}
                className="flex-1 py-3 rounded-2xl text-[13px] font-bold"
                style={{ background: "#F9FAFB", color: "#4E5968" }}
              >
                돌아가기
              </button>
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="flex-1 py-3 rounded-2xl text-[13px] font-extrabold text-white disabled:opacity-50"
                style={{ background: "#D85555" }}
              >
                {cancelling ? "취소 중…" : "주문 취소"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
