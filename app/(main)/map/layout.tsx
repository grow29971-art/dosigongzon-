import type { Metadata } from "next";

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
  return children;
}
