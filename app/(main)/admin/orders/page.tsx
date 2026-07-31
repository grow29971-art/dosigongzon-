"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Shield, Save, Truck, ChevronDown, ChevronUp } from "lucide-react";
import { isCurrentUserAdmin } from "@/lib/news-repo";
import { ORDER_STATUS_MAP, orderDisplayName, type OrderStatus, type OrderWithItems } from "@/lib/order-repo";
import { listAllOrders, listOpenRefunds, updateOrderAdmin, type AdminRefundRequest } from "@/lib/shop-admin-repo";
import { REFUND_REASON_LABELS, type RefundReasonCode } from "@/lib/refund-policy";

// 환불 원장 상태별 표시 (requested 외에는 비정상 중단 건 — 재시도 대상)
const REFUND_STATE_LABEL: Record<AdminRefundRequest["status"], { label: string; color: string }> = {
  requested: { label: "심사 대기", color: "#E88D5A" },
  approved:  { label: "처리 중단 — 재시도 필요", color: "#D85555" },
  failed:    { label: "토스 실패 — 재시도 필요", color: "#D85555" },
};

const ALL_STATUSES = Object.keys(ORDER_STATUS_MAP) as OrderStatus[];

function formatWon(amount: number): string {
  return `${amount.toLocaleString()}원`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default function AdminOrdersPage() {
  const router = useRouter();

  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<OrderStatus | "all">("all");

  const [openId, setOpenId] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState<OrderStatus>("paid");
  const [draftTracking, setDraftTracking] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [refunds, setRefunds] = useState<AdminRefundRequest[]>([]);
  const [refundBusyId, setRefundBusyId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [refundError, setRefundError] = useState("");

  const refresh = useCallback(async (f: OrderStatus | "all") => {
    setLoading(true);
    try {
      setOrders(await listAllOrders(f === "all" ? undefined : f));
      setRefunds(await listOpenRefunds());
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRefundAction = async (refund: AdminRefundRequest, action: "approve" | "reject") => {
    setRefundBusyId(refund.id);
    setRefundError("");
    try {
      const res = await fetch("/api/admin/refunds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          refundId: refund.id,
          action,
          ...(action === "reject" ? { rejectReason: rejectReason.trim() } : {}),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "처리에 실패했어요.");
      setRejectId(null);
      setRejectReason("");
      await refresh(filter);
    } catch (e) {
      setRefundError(e instanceof Error ? e.message : "처리에 실패했어요.");
    } finally {
      setRefundBusyId(null);
    }
  };

  useEffect(() => {
    let cancelled = false;
    isCurrentUserAdmin().then(async (admin) => {
      if (cancelled) return;
      setIsAdmin(admin);
      setAuthChecked(true);
      if (admin) await refresh("all");
      else setLoading(false);
    });
    return () => { cancelled = true; };
  }, [refresh]);

  const handleFilter = (f: OrderStatus | "all") => {
    setFilter(f);
    setOpenId(null);
    refresh(f);
  };

  const handleOpen = (order: OrderWithItems) => {
    if (openId === order.id) { setOpenId(null); return; }
    setOpenId(order.id);
    setDraftStatus(order.status);
    setDraftTracking(order.tracking_number ?? "");
    setError("");
  };

  const handleSave = async (order: OrderWithItems) => {
    setSaving(true);
    setError("");
    try {
      await updateOrderAdmin(order, {
        status: draftStatus,
        tracking_number: draftTracking.trim() || null,
      });
      await refresh(filter);
      setOpenId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장에 실패했어요.");
    } finally {
      setSaving(false);
    }
  };

  if (!authChecked || (loading && orders.length === 0 && isAdmin === false)) {
    return (
      <div className="flex justify-center pt-20">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="px-5 pt-20 text-center">
        <Shield size={40} className="mx-auto text-text-light mb-3" strokeWidth={1.5} />
        <p className="text-[14px] font-bold text-text-main mb-1">관리자 전용 페이지예요</p>
        <Link href="/mypage" className="inline-block mt-4 text-[13px] font-bold text-primary">
          마이페이지로 돌아가기
        </Link>
      </div>
    );
  }

  return (
    <div className="px-4 pt-12 pb-24">
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 rounded-full bg-white flex items-center justify-center active:scale-90"
          style={{ boxShadow: "var(--shadow-raised)" }}
          aria-label="뒤로 가기"
        >
          <ArrowLeft size={18} className="text-text-main" />
        </button>
        <h1 className="text-[17px] font-extrabold text-text-main">주문 관리</h1>
      </div>

      {/* 환불 요청 — 심사 대기·실패 건 (승인 시 토스 취소까지 자동 실행) */}
      {refunds.length > 0 && (
        <section
          className="mb-4 p-3.5"
          style={{ background: "#fff", borderRadius: "var(--radius-card-sm)", boxShadow: "var(--shadow-card)", border: "1.5px solid rgba(232,141,90,0.35)" }}
        >
          <h2 className="text-[13.5px] font-extrabold text-text-main mb-2.5">환불 요청 {refunds.length}건</h2>
          <div className="space-y-2.5">
            {refunds.map((r) => {
              const state = REFUND_STATE_LABEL[r.status];
              const busy = refundBusyId === r.id;
              return (
                <div key={r.id} className="p-3 rounded-xl" style={{ background: "var(--color-warm-white)" }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-semibold text-text-light">{r.order?.order_number ?? r.order_id}</span>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 chip-square" style={{ backgroundColor: `${state.color}15`, color: state.color }}>
                      {state.label}
                    </span>
                  </div>
                  <p className="text-[12.5px] font-bold text-text-main">
                    {formatWon(r.amount)} 환불
                    {r.return_shipping_fee > 0 && <span className="text-text-light font-semibold"> (반품비 {formatWon(r.return_shipping_fee)} 차감됨)</span>}
                  </p>
                  <p className="text-[11.5px] text-text-sub mt-0.5">
                    사유: {REFUND_REASON_LABELS[r.reason_code as RefundReasonCode] ?? r.reason_code}
                    {r.reason_note && ` — ${r.reason_note}`}
                  </p>
                  <p className="text-[11px] text-text-light mt-0.5">
                    주문 상태 {r.order ? ORDER_STATUS_MAP[r.order.status].label : "?"} · {formatDate(r.created_at)} 접수
                  </p>

                  {rejectId === r.id ? (
                    <div className="mt-2">
                      <input
                        type="text"
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="거부 사유 (유저에게 전달돼요)"
                        maxLength={500}
                        className="w-full px-3 py-2 rounded-xl text-[12px] outline-none"
                        style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.08)" }}
                      />
                      <div className="mt-1.5 flex gap-1.5">
                        <button
                          onClick={() => { setRejectId(null); setRejectReason(""); }}
                          disabled={busy}
                          className="flex-1 py-2 rounded-xl text-[12px] font-bold"
                          style={{ background: "#fff", color: "var(--color-text-sub)" }}
                        >
                          돌아가기
                        </button>
                        <button
                          onClick={() => handleRefundAction(r, "reject")}
                          disabled={busy}
                          className="flex-1 py-2 rounded-xl text-[12px] font-extrabold text-white disabled:opacity-50"
                          style={{ background: "#D85555" }}
                        >
                          {busy ? "처리 중…" : "거부 확정"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 flex gap-1.5">
                      <button
                        onClick={() => { setRejectId(r.id); setRejectReason(""); }}
                        disabled={busy}
                        className="flex-1 py-2 rounded-xl text-[12px] font-bold"
                        style={{ background: "#fff", color: "#D85555", border: "1px solid rgba(216,85,85,0.25)" }}
                      >
                        거부
                      </button>
                      <button
                        onClick={() => handleRefundAction(r, "approve")}
                        disabled={busy}
                        className="flex-1 py-2 rounded-xl text-[12px] font-extrabold text-white disabled:opacity-50"
                        style={{ background: "var(--color-primary)" }}
                      >
                        {busy ? "처리 중…" : r.status === "requested" ? "승인 (토스 환불 실행)" : "재시도"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {refundError && <p className="mt-2 text-[11.5px] font-bold" style={{ color: "#D85555" }}>{refundError}</p>}
        </section>
      )}

      {/* 상태 필터 */}
      <div className="flex items-center gap-1.5 mb-4 overflow-x-auto pb-1">
        <button
          onClick={() => handleFilter("all")}
          className="px-3 py-1.5 rounded-xl text-[11.5px] font-bold shrink-0"
          style={{ background: filter === "all" ? "#2C2C2C" : "#fff", color: filter === "all" ? "#fff" : "#666", boxShadow: "0 2px 6px rgba(0,0,0,0.05)" }}
        >
          전체
        </button>
        {ALL_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => handleFilter(s)}
            className="px-3 py-1.5 rounded-xl text-[11.5px] font-bold shrink-0"
            style={{
              background: filter === s ? ORDER_STATUS_MAP[s].color : "#fff",
              color: filter === s ? "#fff" : "#666",
              boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
            }}
          >
            {ORDER_STATUS_MAP[s].label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center pt-10">
          <Loader2 size={24} className="animate-spin text-primary" />
        </div>
      ) : orders.length === 0 ? (
        <p className="text-center text-[13px] text-text-sub pt-10">
          {filter === "all" ? "아직 주문이 없어요." : `${ORDER_STATUS_MAP[filter as OrderStatus].label} 상태의 주문이 없어요.`}
        </p>
      ) : (
        <div className="space-y-2">
          {orders.map((order) => {
            const status = ORDER_STATUS_MAP[order.status];
            const open = openId === order.id;
            return (
              <div
                key={order.id}
                style={{ background: "#fff", borderRadius: "var(--radius-card-sm)", boxShadow: "var(--shadow-card)", border: open ? "1.5px solid rgba(173, 94, 59,0.35)" : "1px solid rgba(0,0,0,0.04)" }}
              >
                <button className="w-full text-left p-3.5" onClick={() => handleOpen(order)}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-semibold text-text-light">{order.order_number}</span>
                    <div className="flex items-center gap-1.5">
                      <span
                        className="text-[10px] font-extrabold px-2 py-0.5 chip-square"
                        style={{ backgroundColor: `${status.color}15`, color: status.color }}
                      >
                        {status.label}
                      </span>
                      {open ? <ChevronUp size={14} className="text-text-light" /> : <ChevronDown size={14} className="text-text-light" />}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-text-main truncate">{orderDisplayName(order.items)}</p>
                      <p className="text-[11px] text-text-light mt-0.5">
                        {order.recipient_name ?? "후원 주문"} · {formatDate(order.created_at)}
                      </p>
                    </div>
                    <span className="text-[13.5px] font-extrabold text-text-main shrink-0 ml-2">{formatWon(order.payment_amount)}</span>
                  </div>
                </button>

                {open && (
                  <div className="px-3.5 pb-3.5" style={{ borderTop: "1px dashed rgba(0,0,0,0.08)" }}>
                    {/* 상세 정보 */}
                    <div className="pt-3 space-y-1 text-[12px] text-text-sub">
                      {order.items.map((item) => (
                        <p key={item.id}>· {item.product_name} × {item.quantity} = {formatWon(item.subtotal)}</p>
                      ))}
                      {order.recipient_address ? (
                        <>
                          <p className="pt-1">
                            ({order.postal_code}) {order.recipient_address}
                            {order.recipient_address_detail ? ` ${order.recipient_address_detail}` : ""}
                          </p>
                          <p>{order.recipient_phone}</p>
                        </>
                      ) : (
                        <p className="pt-1">배송 없음 — 후원(가상) 상품 주문</p>
                      )}
                      {order.memo && <p className="text-text-light">메모: {order.memo}</p>}
                    </div>

                    {/* 상태 변경 */}
                    <div className="mt-3 flex items-center gap-2">
                      <select
                        value={draftStatus}
                        onChange={(e) => setDraftStatus(e.target.value as OrderStatus)}
                        className="flex-1 px-3 py-2.5 text-[12.5px] font-bold outline-none"
                        style={{ background: "var(--color-warm-white)", borderRadius: 12, border: "1px solid rgba(0,0,0,0.05)" }}
                      >
                        {ALL_STATUSES.map((s) => (
                          <option key={s} value={s}>{ORDER_STATUS_MAP[s].label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 flex items-center gap-1.5 px-3 py-2.5" style={{ background: "var(--color-warm-white)", borderRadius: 12, border: "1px solid rgba(0,0,0,0.05)" }}>
                        <Truck size={13} className="text-text-light shrink-0" />
                        <input
                          type="text"
                          value={draftTracking}
                          onChange={(e) => setDraftTracking(e.target.value)}
                          placeholder="운송장번호"
                          className="flex-1 text-[12.5px] outline-none bg-transparent"
                          maxLength={30}
                        />
                      </div>
                      <button
                        onClick={() => handleSave(order)}
                        disabled={saving}
                        className="px-4 py-2.5 rounded-xl bg-primary text-white text-[12.5px] font-extrabold disabled:opacity-50 flex items-center gap-1"
                      >
                        {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                        저장
                      </button>
                    </div>

                    {(draftStatus === "cancelled" || draftStatus === "refunded") && order.status !== "cancelled" && order.status !== "refunded" && (
                      <p className="mt-2 text-[11px] font-bold" style={{ color: "#D85555" }}>
                        ⚠ 취소/환불로 변경하면 재고가 복구돼요. 실제 결제금 환불은 토스페이먼츠 연동 후 자동 처리되며, 그 전에는 토스 상점관리자에서 직접 환불해야 해요.
                      </p>
                    )}
                    {error && <p className="mt-2 text-[11.5px] font-bold" style={{ color: "#D85555" }}>{error}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
