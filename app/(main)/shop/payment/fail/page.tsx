"use client";

import { Suspense, useEffect, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2, XCircle } from "lucide-react";

function FailContent() {
  const params = useSearchParams();
  const code = params.get("code");
  const message = params.get("message");
  const orderId = params.get("orderId"); // = order_number
  const cancelled = useRef(false);

  // 실패한 pending 주문 정리 (실패해도 무해 — 결제대기로 남을 뿐)
  useEffect(() => {
    if (cancelled.current || !orderId) return;
    cancelled.current = true;
    fetch("/api/payment/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderNumber: orderId }),
    }).catch(() => {});
  }, [orderId]);

  const friendlyMessage =
    code === "PAY_PROCESS_CANCELED"
      ? "결제를 취소하셨어요. 언제든 다시 주문할 수 있어요."
      : (message ?? "결제 처리 중 문제가 발생했어요. 다시 시도해주세요.");

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center mb-5"
        style={{ background: "rgba(216,85,85,0.1)" }}
      >
        <XCircle size={32} style={{ color: "#D85555" }} />
      </div>
      <h1 className="text-[18px] font-extrabold text-text-main mb-2">결제가 완료되지 않았어요</h1>
      <p className="text-[13px] text-text-sub leading-relaxed mb-2 max-w-[300px]">{friendlyMessage}</p>
      {code && code !== "PAY_PROCESS_CANCELED" && (
        <p className="text-[10.5px] text-text-light mb-6">오류 코드: {code}</p>
      )}
      <div className="flex flex-col gap-2 w-full max-w-[280px] mt-4">
        <Link
          href="/shop/checkout"
          className="py-3.5 rounded-2xl bg-primary text-white text-[14px] font-extrabold"
          style={{ boxShadow: "0 6px 20px rgba(49,130,246,0.3)" }}
        >
          다시 시도하기
        </Link>
        <Link href="/shop" className="py-3 text-[13px] font-bold text-text-sub">
          쇼핑 홈으로
        </Link>
      </div>
    </div>
  );
}

export default function PaymentFailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center pt-24">
          <Loader2 size={28} className="animate-spin text-primary" />
        </div>
      }
    >
      <FailContent />
    </Suspense>
  );
}
