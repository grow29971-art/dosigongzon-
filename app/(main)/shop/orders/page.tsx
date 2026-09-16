"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronRight, PackageOpen, Truck } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import LoginRequired from "@/app/components/LoginRequired";
import {
  listMyOrders, orderDisplayName, ORDER_STATUS_MAP,
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

// 상태 배지 — 회색 헤어라인 칩, 취소·환불만 오류색 글자 (ORDER_STATUS_MAP.color는 화면에 쓰지 않는다)
function statusTone(status: OrderStatus): string {
  return status === "cancelled" || status === "refunded" ? "var(--color-error)" : "var(--color-text-sub)";
}

export default function OrdersPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    listMyOrders()
      .then(setOrders)
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, [user]);

  if (!authLoading && !user) {
    return <LoginRequired from="/shop/orders" title="주문 내역은 로그인 후 확인할 수 있어요" description="내 주문과 배송 상태를 확인하려면 로그인이 필요해요." />;
  }

  return (
    <div className="pb-24">
      <div className="px-4 pt-12 pb-2 flex items-center gap-1">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 rounded-full flex items-center justify-center press-strong -ml-2"
          aria-label="뒤로 가기"
        >
          <ArrowLeft size={20} className="text-text-main" />
        </button>
        <h1 className="text-[17px] font-bold text-text-main">주문 내역</h1>
      </div>

      {loading ? (
        <div className="px-4 mt-4 space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="animate-pulse" style={{ height: 88, background: "var(--color-surface-alt)", borderRadius: "var(--radius-card-sm)" }} />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center text-center pt-16 px-6">
          <PackageOpen size={32} className="mb-3" style={{ color: "var(--color-text-muted)" }} />
          <p className="text-[15px] font-semibold text-text-main mb-1">주문 내역이 없어요</p>
          <p className="text-[13px] text-text-sub mb-6">첫 주문을 기다리고 있어요</p>
          <Link
            href="/shop"
            className="press inline-flex items-center justify-center h-10 px-5 text-[15px] font-semibold text-white"
            style={{ background: "var(--color-primary)", borderRadius: "var(--radius-input)" }}
          >
            쇼핑하러가기
          </Link>
        </div>
      ) : (
        <div className="px-4 mt-1">
          {orders.map((order) => {
            const status = ORDER_STATUS_MAP[order.status];
            const tone = statusTone(order.status);
            return (
              <Link
                key={order.id}
                href={`/shop/orders/${order.id}`}
                className="block press py-4"
                style={{ borderBottom: "1px solid var(--color-divider)" }}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] text-text-light">{order.order_number}</span>
                  <span
                    className="text-[11px] font-medium px-1.5 py-0.5"
                    style={{ color: tone, border: `1px solid ${tone === "var(--color-error)" ? tone : "var(--color-border)"}`, borderRadius: "var(--radius-square)" }}
                  >
                    {status.label}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-semibold text-text-main truncate">{orderDisplayName(order.items)}</p>
                    <p className="text-[11px] text-text-light mt-1">{formatDate(order.created_at)}</p>
                    {order.tracking_number && (
                      <p className="text-[11px] text-text-sub mt-1 flex items-center gap-1">
                        <Truck size={11} /> 운송장 {order.tracking_number}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-3">
                    <span className="text-[15px] font-bold text-text-main tabular-nums">{formatWon(order.payment_amount)}</span>
                    <ChevronRight size={18} style={{ color: "var(--color-text-muted)" }} />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
