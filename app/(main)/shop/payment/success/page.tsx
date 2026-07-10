"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

function SuccessContent() {
  const params = useSearchParams();
  const [state, setState] = useState<"confirming" | "done" | "error">("confirming");
  const [errorMsg, setErrorMsg] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [orderId, setOrderId] = useState("");
  const [donation, setDonation] = useState(0);
  const requested = useRef(false);

  useEffect(() => {
    if (requested.current) return; // StrictMode/리렌더 중복 승인 방지
    requested.current = true;

    const paymentKey = params.get("paymentKey");
    const tossOrderId = params.get("orderId"); // = order_number
    const amount = Number(params.get("amount"));

    if (!paymentKey || !tossOrderId || !Number.isInteger(amount)) {
      setState("error");
      setErrorMsg("결제 정보가 올바르지 않아요.");
      return;
    }

    fetch("/api/payment/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentKey, orderId: tossOrderId, amount }),
    })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error ?? "결제 승인에 실패했어요.");
        setOrderNumber(json.orderNumber ?? tossOrderId);
        setOrderId(json.orderId ?? "");
        setDonation(typeof json.donation === "number" ? json.donation : 0);
        setState("done");
      })
      .catch((e) => {
        setState("error");
        setErrorMsg(e instanceof Error ? e.message : "결제 승인에 실패했어요.");
      });
  }, [params]);

  if (state === "confirming") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
        <Loader2 size={36} className="animate-spin text-primary mb-5" />
        <h1 className="text-[18px] font-extrabold text-text-main mb-2">결제를 확인하고 있어요</h1>
        <p className="text-[13px] text-text-sub">잠시만 기다려주세요. 화면을 닫지 마세요.</p>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mb-5"
          style={{ background: "rgba(216,85,85,0.1)" }}
        >
          <XCircle size={32} style={{ color: "#D85555" }} />
        </div>
        <h1 className="text-[18px] font-extrabold text-text-main mb-2">결제 승인에 실패했어요</h1>
        <p className="text-[13px] text-text-sub leading-relaxed mb-7 max-w-[300px]">{errorMsg}</p>
        <div className="flex flex-col gap-2 w-full max-w-[280px]">
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

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center mb-5"
        style={{ background: "rgba(107,142,111,0.12)" }}
      >
        <CheckCircle2 size={32} style={{ color: "#6B8E6F" }} />
      </div>
      <h1 className="text-[19px] font-extrabold text-text-main mb-2">결제가 완료됐어요!</h1>
      <p className="text-[13px] text-text-sub leading-relaxed mb-1">
        주문번호 <span className="font-extrabold text-text-main">{orderNumber}</span>
      </p>
      {donation > 0 && (
        <div
          className="mb-4 px-4 py-3 rounded-2xl"
          style={{ background: "rgba(232,107,140,0.08)", border: "1px solid rgba(232,107,140,0.2)" }}
        >
          <p className="text-[13px] font-extrabold" style={{ color: "#D85575" }}>
            이 주문으로 {donation.toLocaleString()}원이
            <br />길고양이에게 적립됐어요 💛
          </p>
        </div>
      )}
      <p className="text-[12.5px] text-text-light mb-8">
        소중한 주문 감사해요. 우리 동네 고양이들에게 따뜻함이 전해질 거예요 🐾
      </p>
      <div className="flex flex-col gap-2 w-full max-w-[280px]">
        <Link
          href={orderId ? `/shop/orders/${orderId}` : "/shop/orders"}
          className="py-3.5 rounded-2xl bg-primary text-white text-[14px] font-extrabold"
          style={{ boxShadow: "0 6px 20px rgba(49,130,246,0.3)" }}
        >
          주문 내역 보기
        </Link>
        <Link href="/shop" className="py-3 text-[13px] font-bold text-text-sub">
          쇼핑 계속하기
        </Link>
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center pt-24">
          <Loader2 size={28} className="animate-spin text-primary" />
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
