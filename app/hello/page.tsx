import type { Metadata } from "next";
import HelloScreen from "@/app/components/HelloScreen";

// 인스타그램 프로필 링크·광고 랜딩. 링크는 /hello?utm_source=instagram 으로 건다
// (SourceCapture가 진입 즉시 출처를 잡는다). 화면 자체는 HelloScreen — 비로그인 첫 방문 홈과 같다.

export const metadata: Metadata = {
  title: "우리 동네 길고양이",
  description: "오늘 우리 골목 고양이는 밥을 먹었을까? 동네 길집사들이 함께 기록하는 길고양이 지도.",
  robots: { index: false },
  openGraph: { images: ["/images/hello-hero.jpg"] },
};

export default function HelloPage() {
  return <HelloScreen />;
}
