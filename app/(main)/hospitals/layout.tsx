import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "구조동물 치료 병원",
  description: "길고양이·구조동물을 치료해주는 동물병원 목록과 연락처. 지역별 검색 · 지도 안내.",
  keywords: ["길고양이 병원", "구조 동물병원", "동물병원", "길냥이 치료"],
  openGraph: {
    title: "구조동물 치료 병원 | 도시공존",
    description: "길고양이·구조동물을 치료해주는 동물병원 목록과 연락처.",
  },
  alternates: { canonical: "/hospitals" },
};

export default function HospitalsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
