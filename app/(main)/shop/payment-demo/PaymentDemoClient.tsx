"use client";

// 토스페이먼츠 가맹 심사용 결제창 데모 (클라이언트).
// - "결제창 열기" 탭 → 토스 결제창 호출 (checkout과 동일한 결제창 방식·CARD)
// - successUrl/failUrl 모두 이 페이지로 복귀 — 승인(confirm) API를 호출하지 않으므로
//   테스트 환경에서도 결제·주문이 생성되지 않는다.
// - 주문번호는 DEMO- prefix — 실주문 체계(order_number)와 절대 섞이지 않음.

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CreditCard, ShieldCheck, CheckCircle2, XCircle } from "lucide-react";
import { loadTossPayments, ANONYMOUS } from "@tosspayments/tosspayments-sdk";

const TOSS_CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY?.trim() ?? "";

const DEMO_PRODUCT = {
  name: "대즐 × 도시공존 콜라보 치킨&연어 전연령 사료 15kg",
  amount: 70000,
};

export default function PaymentDemoClient() {
  return (
    <Suspense>
      <PaymentDemoContent />
    </Suspense>
  );
}

function PaymentDemoContent() {
  const searchParams = useSearchParams();
  const result = searchParams.get("result"); // success | fail | null
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleOpen = async () => {
    if (!TOSS_CLIENT_KEY) {
      setError("결제 클라이언트 키가 설정되지 않았습니다.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const toss = await loadTossPayments(TOSS_CLIENT_KEY);
      const payment = toss.payment({ customerKey: ANONYMOUS });
      await payment.requestPayment({
        method: "CARD",
        amount: { currency: "KRW", value: DEMO_PRODUCT.amount },
        orderId: `DEMO-${Date.now()}`,
        orderName: `${DEMO_PRODUCT.name} (심사용 데모)`,
        successUrl: `${window.location.origin}/shop/payment-demo?result=success`,
        failUrl: `${window.location.origin}/shop/payment-demo?result=fail`,
        card: {
          useEscrow: false,
          flowMode: "DEFAULT",
          useCardPoint: false,
          useAppCardOnly: false,
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg && !msg.includes("취소")) setError(msg);
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh px-5 py-14 max-w-lg mx-auto">
      {/* 심사용 안내 */}
      <div
        className="mb-6 px-4 py-3.5 rounded-2xl flex items-start gap-2.5"
        style={{ background: "var(--color-warning-soft)", border: "1px solid #F5DAB0" }}
      >
        <ShieldCheck size={17} className="mt-0.5 shrink-0" style={{ color: "#6F4910" }} />
        <p className="text-[13px] leading-relaxed" style={{ color: "#6F4910" }}>
          <b>토스페이먼츠 가맹 심사용 결제창 연동 확인 페이지</b>입니다.
          테스트 환경이며, 결제 진행·승인이 이루어지지 않아 실제 결제와 주문이
          발생하지 않습니다.
        </p>
      </div>

      {/* 데모 결과 배너 */}
      {result === "success" && (
        <div
          className="mb-6 px-4 py-3.5 rounded-2xl flex items-start gap-2.5"
          style={{ background: "rgba(107,142,111,0.12)", border: "1px solid rgba(107,142,111,0.3)" }}
        >
          <CheckCircle2 size={17} className="mt-0.5 shrink-0" style={{ color: "#4F6E53" }} />
          <p className="text-[13px] leading-relaxed" style={{ color: "#4F6E53" }}>
            결제창 연동이 정상 동작했습니다. 승인(confirm) 요청을 하지 않았으므로
            결제가 발생하지 않았습니다.
          </p>
        </div>
      )}
      {result === "fail" && (
        <div
          className="mb-6 px-4 py-3.5 rounded-2xl flex items-start gap-2.5"
          style={{ background: "var(--color-error-soft)", border: "1px solid rgba(216,85,85,0.3)" }}
        >
          <XCircle size={17} className="mt-0.5 shrink-0" style={{ color: "#B84545" }} />
          <p className="text-[13px] leading-relaxed" style={{ color: "#B84545" }}>
            결제창이 닫히거나 취소되었습니다. 아래 버튼으로 다시 열 수 있습니다.
          </p>
        </div>
      )}

      {/* 데모 주문 요약 */}
      <div
        className="p-4 rounded-2xl mb-6"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-divider)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <p className="text-[13px] font-bold text-text-main">{DEMO_PRODUCT.name}</p>
        <p className="text-[13px] text-text-sub mt-1">결제 금액 {DEMO_PRODUCT.amount.toLocaleString()}원</p>
        <p className="text-[11px] text-text-light mt-2">
          판매 페이지: https://dosigongzon.com/shop
        </p>
      </div>

      {error && (
        <div className="rounded-xl px-4 py-3 mb-4" style={{ backgroundColor: "var(--color-error-soft)" }}>
          <p className="text-[13px] font-semibold" style={{ color: "#B84545" }}>{error}</p>
        </div>
      )}

      <button
        onClick={handleOpen}
        disabled={busy}
        className="w-full py-3.5 rounded-2xl text-white text-[15px] font-bold flex items-center justify-center gap-2 press transition-transform disabled:opacity-50"
        style={{ background: "var(--color-primary)", boxShadow: "var(--shadow-primary)" }}
      >
        <CreditCard size={17} />
        {busy ? "결제창 여는 중..." : "결제창 열기"}
      </button>

      <p className="text-[11px] text-text-light text-center mt-4 leading-relaxed">
        도시공존 · 대표 김성우 · 사업자등록번호 793-16-02886
        <br />
        통신판매업 신고번호 제2026-인천검단-0207호
      </p>
    </div>
  );
}
