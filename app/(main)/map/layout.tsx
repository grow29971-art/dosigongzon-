import type { Metadata } from "next";
import MapIntroSheet from "@/app/components/MapIntroSheet";

export const metadata: Metadata = {
  title: "길고양이 지도",
  description: "우리 동네 길고양이 위치·건강상태·TNR 여부를 한눈에. 시민이 함께 만드는 길고양이 지도.",
  openGraph: {
    title: "길고양이 지도 | 도시공존",
    description: "우리 동네 길고양이 위치·건강상태·TNR 여부를 한눈에. 시민이 함께 만드는 길고양이 지도.",
  },
  alternates: { canonical: "/map" },
};

export default function MapLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* 첫 방문 1회 인트로 시트 — "지도가 곧 온보딩" (2026-07-22 회의 B안) */}
      <MapIntroSheet />
      {children}
    </>
  );
}
