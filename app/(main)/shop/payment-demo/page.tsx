// 토스페이먼츠 가맹 심사용 결제창 데모 — 심사관이 결제창 연동을 확인하는 전용 페이지.
// DB 접근·주문 생성·승인(confirm) 호출이 전혀 없다: 결제창을 띄우는 것까지만 시연.
// PAYMENT_ENABLED 하드락과 무관하게 동작하며(실결제 경로가 아예 없음), 앱 어디에서도
// 링크하지 않는다 — URL은 토스 심사 제출 시에만 전달.
import type { Metadata } from "next";
import PaymentDemoClient from "./PaymentDemoClient";

export const metadata: Metadata = {
  title: "결제창 연동 확인 | 도시공존",
  robots: { index: false, follow: false },
};

export default function PaymentDemoPage() {
  return <PaymentDemoClient />;
}
