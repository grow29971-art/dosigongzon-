"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronRight, PackageOpen, Truck } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import LoginRequired from "@/app/components/LoginRequired";
import {
  listMyOrders, orderDisplayName, ORDER_STATUS_MAP,
  type OrderWithItems,
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
      <div className="px-4 pt-12 pb-2 flex items-center gap-2">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 rounded-full bg-white flex items-center justify-center active:scale-90"
          style={{ boxShadow: "var(--shadow-raised)" }}
          aria-label="뒤로 가기"
        >
          <ArrowLeft size={18} className="text-text-main" />
        </button>
        <h1 className="text-[16px] font-extrabold text-text-main">주문 내역</h1>
      </div>

      {loading ? (
        <div className="px-4 mt-4 space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-2xl animate-pulse" style={{ height: 100, background: "var(--color-surface-alt)" }} />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center text-center pt-16 px-6">
          <div
            className="w-16 h-16 rounded-3xl flex items-center justify-center mb-4"
            style={{ background: "linear-gradient(135deg, #f5e6d8 0%, #e8c9a8 100%)" }}
          >
            <PackageOpen size={28} style={{ color: "var(--color-primary)" }} />
          </div>
          <p className="text-[14px] font-bold text-text-main mb-1">주문 내역이 없어요</p>
          <p className="text-[12.5px] text-text-sub mb-6">첫 주문을 기다리고 있어요!</p>
          <Link
            href="/shop"
            className="px-5 py-2.5 rounded-2xl bg-primary text-white text-[13px] font-bold active:scale-95 transition-transform"
          >
            쇼핑하러가기
          </Link>
        </div>
      ) : (
        <div className="px-4 mt-3 space-y-2.5">
          {orders.map((order) => {
            const status = ORDER_STATUS_MAP[order.status];
            return (
              <Link
                key={order.id}
                href={`/shop/orders/${order.id}`}
                className="block active:scale-[0.99] transition-transform"
              >
                <div
                  className="p-4"
                  style={{ background: "#fff", borderRadius: 18, boxShadow: "0 2px 8px rgba(0,0,0,0.03), 0 1px 2px rgba(0,0,0,0.02)", border: "1px solid rgba(0,0,0,0.04)" }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-semibold text-text-light">{order.order_number}</span>
                    <span
                      className="text-[10.5px] font-extrabold px-2 py-1 rounded-lg"
                      style={{ backgroundColor: `${status.color}15`, color: status.color }}
                    >
                      {status.label}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-[13.5px] font-bold text-text-main truncate">{orderDisplayName(order.items)}</p>
                      <p className="text-[11px] text-text-light mt-1">{formatDate(order.created_at)}</p>
                      {order.tracking_number && (
                        <p className="text-[11px] text-text-sub mt-1 flex items-center gap-1">
                          <Truck size={11} /> 운송장 {order.tracking_number}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-3">
                      <span className="text-[14px] font-extrabold text-text-main">{formatWon(order.payment_amount)}</span>
                      <ChevronRight size={16} className="text-text-light" />
                    </div>
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
