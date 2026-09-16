"use client";

// 주문 관리 (admin 전용) — 2026-09-16 「익숙한 동네앱」 리디자인:
// 주문 카드 → 구분선 리스트(펼침 상세), 환불 요청 헤어라인 섹션, 상태는 회색 태그(의미색만 예외), 필터 칩. 토큰만.

import { useCallback, useEffect, useState } from "react";
import { Loader2, Save, Truck, ChevronDown, ChevronUp } from "lucide-react";
import { isCurrentUserAdmin } from "@/lib/news-repo";
import { ORDER_STATUS_MAP, orderDisplayName, type OrderStatus, type OrderWithItems } from "@/lib/order-repo";
import { listAllOrders, listOpenRefunds, updateOrderAdmin, type AdminRefundRequest } from "@/lib/shop-admin-repo";
import { REFUND_REASON_LABELS, type RefundReasonCode } from "@/lib/refund-policy";
import { COURIERS } from "@/lib/courier";
import UIButton from "@/app/components/ui/Button";
import UIChip from "@/app/components/ui/Chip";
import {
  AdminForbidden, AdminHeader, AdminLoading, AdminPage, AdminSection, AdminTag, EmptyState, HairlineButton,
  inputCls, inputStyle, type Tone,
} from "../_ui";

// 환불 원장 상태별 표시 (requested 외에는 비정상 중단 건 — 재시도 대상)
const REFUND_STATE_LABEL: Record<AdminRefundRequest["status"], { label: string; tone: Tone }> = {
  requested: { label: "심사 대기", tone: "warning" },
  approved:  { label: "처리 중단 — 재시도 필요", tone: "error" },
  failed:    { label: "토스 실패 — 재시도 필요", tone: "error" },
};

// 주문 상태 태그 톤 — 취소·환불=error, 완료=sage, 그 외 회색
const STATUS_TONE: Partial<Record<OrderStatus, Tone>> = {
  delivered: "sage",
  cancelled: "error",
  refunded: "error",
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
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<OrderStatus | "all">("all");

  const [openId, setOpenId] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState<OrderStatus>("paid");
  const [draftTracking, setDraftTracking] = useState("");
  const [draftCourier, setDraftCourier] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

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
    setDraftCourier(order.courier ?? "");
    setError("");
    setNotice("");
  };

  const handleSave = async (order: OrderWithItems) => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await updateOrderAdmin(order, {
        status: draftStatus,
        tracking_number: draftTracking.trim() || null,
        courier: draftCourier || null,
      });
      // 배송중으로 처음 전환되면 구매자에게 푸시+쪽지 알림 (실패해도 저장은 유지)
      if (draftStatus === "shipping" && order.status !== "shipping") {
        try {
          const r = await fetch("/api/admin/notify-shipping", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderId: order.id }),
          });
          const d = await r.json().catch(() => ({}));
          if (r.ok && d.reason === "guest") setNotice("저장 완료 · 게스트 주문이라 알림은 보낼 수 없어요.");
          else if (r.ok) setNotice(`저장 완료 · 구매자에게 알림 발송 (푸시 ${d.sent ?? 0}건${d.dm ? " + 쪽지" : ""})`);
          else setNotice("저장 완료 · 알림 발송은 실패했어요.");
        } catch {
          setNotice("저장 완료 · 알림 발송은 실패했어요.");
        }
      }
      await refresh(filter);
      setOpenId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장에 실패했어요.");
    } finally {
      setSaving(false);
    }
  };

  if (!authChecked || (loading && orders.length === 0 && isAdmin === false)) return <AdminLoading />;
  if (!isAdmin) return <AdminForbidden />;

  const selectCls = "px-3 h-10 text-[13px] font-semibold text-text-main outline-none bg-surface";

  return (
    <AdminPage>
      <AdminHeader title="주문 관리" description="주문 상태·운송장·취소/환불" />

      {/* 환불 요청 — 심사 대기·실패 건 (승인 시 토스 취소까지 자동 실행) */}
      {refunds.length > 0 && (
        <AdminSection title={`환불 요청 ${refunds.length}건`} padding={false}>
          {refunds.map((r) => {
            const state = REFUND_STATE_LABEL[r.status];
            const busy = refundBusyId === r.id;
            return (
              <div key={r.id} className="px-4 py-3 border-b border-divider last:border-b-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[13px] text-text-light tabular-nums">{r.order?.order_number ?? r.order_id}</span>
                  <AdminTag tone={state.tone}>{state.label}</AdminTag>
                </div>
                <p className="text-[15px] font-semibold text-text-main tabular-nums">
                  {formatWon(r.amount)} 환불
                  {r.return_shipping_fee > 0 && <span className="text-text-light font-medium text-[13px]"> (반품비 {formatWon(r.return_shipping_fee)} 차감됨)</span>}
                </p>
                <p className="text-[13px] text-text-sub mt-0.5">
                  사유: {REFUND_REASON_LABELS[r.reason_code as RefundReasonCode] ?? r.reason_code}
                  {r.reason_note && ` — ${r.reason_note}`}
                </p>
                <p className="text-[13px] text-text-light mt-0.5">
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
                      className={inputCls}
                      style={inputStyle}
                    />
                    <div className="mt-1.5 flex gap-1.5">
                      <UIButton variant="secondary" className="flex-1" onClick={() => { setRejectId(null); setRejectReason(""); }} disabled={busy}>
                        돌아가기
                      </UIButton>
                      <UIButton variant="danger" className="flex-1" onClick={() => handleRefundAction(r, "reject")} disabled={busy}>
                        {busy ? "처리 중…" : "거부 확정"}
                      </UIButton>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 flex gap-1.5">
                    <HairlineButton tone="error" size="md" className="flex-1" onClick={() => { setRejectId(r.id); setRejectReason(""); }} disabled={busy}>
                      거부
                    </HairlineButton>
                    <UIButton className="flex-1" onClick={() => handleRefundAction(r, "approve")} disabled={busy}>
                      {busy ? "처리 중…" : r.status === "requested" ? "승인 (토스 환불 실행)" : "재시도"}
                    </UIButton>
                  </div>
                )}
              </div>
            );
          })}
          {refundError && <p className="px-4 py-2 text-[13px] font-semibold" style={{ color: "var(--color-error)" }}>{refundError}</p>}
        </AdminSection>
      )}

      {/* 상태 필터 */}
      <div className="flex items-center gap-1.5 mb-3 overflow-x-auto no-scrollbar">
        <UIChip active={filter === "all"} onClick={() => handleFilter("all")}>전체</UIChip>
        {ALL_STATUSES.map((s) => (
          <UIChip key={s} active={filter === s} onClick={() => handleFilter(s)}>
            {ORDER_STATUS_MAP[s].label}
          </UIChip>
        ))}
      </div>

      {notice && (
        <p className="mb-3 text-[13px] font-semibold" style={{ color: "var(--color-sage)" }}>{notice}</p>
      )}

      <AdminSection padding={false}>
        {loading ? (
          <AdminLoading />
        ) : orders.length === 0 ? (
          <EmptyState>
            {filter === "all" ? "아직 주문이 없어요." : `${ORDER_STATUS_MAP[filter as OrderStatus].label} 상태의 주문이 없어요.`}
          </EmptyState>
        ) : (
          orders.map((order) => {
            const status = ORDER_STATUS_MAP[order.status];
            const open = openId === order.id;
            return (
              <div key={order.id} className="border-b border-divider last:border-b-0">
                <button type="button" className="w-full text-left px-4 py-3 press" onClick={() => handleOpen(order)}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[13px] text-text-light tabular-nums">{order.order_number}</span>
                    <div className="flex items-center gap-1.5">
                      <AdminTag tone={STATUS_TONE[order.status] ?? "neutral"}>{status.label}</AdminTag>
                      {open ? (
                        <ChevronUp size={16} style={{ color: "var(--color-text-muted)" }} />
                      ) : (
                        <ChevronDown size={16} style={{ color: "var(--color-text-muted)" }} />
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-semibold text-text-main truncate">{orderDisplayName(order.items)}</p>
                      <p className="text-[13px] text-text-light mt-0.5">
                        {order.recipient_name ?? "후원 주문"} · {formatDate(order.created_at)}
                      </p>
                    </div>
                    <span className="text-[15px] font-bold text-text-main shrink-0 tabular-nums">{formatWon(order.payment_amount)}</span>
                  </div>
                </button>

                {open && (
                  <div className="px-4 pb-4" style={{ borderTop: "1px solid var(--color-divider)" }}>
                    {/* 상세 정보 */}
                    <div className="pt-3 space-y-1 text-[13px] text-text-sub">
                      {order.items.map((item) => (
                        <p key={item.id} className="tabular-nums">· {item.product_name} × {item.quantity} = {formatWon(item.subtotal)}</p>
                      ))}
                      {order.recipient_address ? (
                        <>
                          <p className="pt-1">
                            ({order.postal_code}) {order.recipient_address}
                            {order.recipient_address_detail ? ` ${order.recipient_address_detail}` : ""}
                          </p>
                          <p className="tabular-nums">{order.recipient_phone}</p>
                        </>
                      ) : (
                        <p className="pt-1">배송 없음 — 후원(가상) 상품 주문</p>
                      )}
                      {order.memo && <p className="text-text-light">메모: {order.memo}</p>}
                    </div>

                    {/* 상태 변경 */}
                    <div className="mt-3">
                      <select
                        value={draftStatus}
                        onChange={(e) => setDraftStatus(e.target.value as OrderStatus)}
                        className={`${selectCls} w-full`}
                        style={inputStyle}
                      >
                        {ALL_STATUSES.map((s) => (
                          <option key={s} value={s}>{ORDER_STATUS_MAP[s].label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <select
                        value={draftCourier}
                        onChange={(e) => setDraftCourier(e.target.value)}
                        className={`${selectCls} shrink-0`}
                        style={{ ...inputStyle, maxWidth: 130 }}
                      >
                        <option value="">택배사</option>
                        {COURIERS.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                      <div className="flex-1 flex items-center gap-1.5 px-3 h-10 bg-surface" style={inputStyle}>
                        <Truck size={13} className="text-text-light shrink-0" />
                        <input
                          type="text"
                          value={draftTracking}
                          onChange={(e) => setDraftTracking(e.target.value)}
                          placeholder="운송장번호"
                          className="flex-1 min-w-0 text-[13px] outline-none bg-transparent text-text-main placeholder:text-text-muted tabular-nums"
                          maxLength={30}
                        />
                      </div>
                      <UIButton onClick={() => handleSave(order)} disabled={saving}>
                        {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                        저장
                      </UIButton>
                    </div>
                    {draftStatus === "shipping" && order.status !== "shipping" && (
                      <p className="mt-2 text-[13px] text-text-light">
                        배송중으로 저장하면 구매자에게 &ldquo;배송 시작&rdquo; 푸시·쪽지가 자동 발송돼요.
                      </p>
                    )}

                    {(draftStatus === "cancelled" || draftStatus === "refunded") && order.status !== "cancelled" && order.status !== "refunded" && (
                      <p className="mt-2 text-[13px] font-semibold" style={{ color: "var(--color-error)" }}>
                        취소/환불로 변경하면 재고가 복구돼요. 실제 결제금 환불은 토스페이먼츠 연동 후 자동 처리되며, 그 전에는 토스 상점관리자에서 직접 환불해야 해요.
                      </p>
                    )}
                    {error && <p className="mt-2 text-[13px] font-semibold" style={{ color: "var(--color-error)" }}>{error}</p>}
                  </div>
                )}
              </div>
            );
          })
        )}
      </AdminSection>
    </AdminPage>
  );
}
