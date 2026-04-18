import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "보호 지침",
  description: "길고양이 응급 구조 · 새끼 고양이 발견 · TNR 요령 · 동물보호법 · 시군구 담당부서 연락처 · 약품 가이드.",
  keywords: ["길고양이 응급", "새끼고양이 구조", "TNR", "동물보호법", "길고양이 약품"],
  openGraph: {
    title: "길고양이 보호 지침 | 도시공존",
    description: "응급 구조 · 새끼 고양이 · TNR · 동물보호법 · 약품 가이드를 한 곳에서.",
  },
  alternates: { canonical: "/protection" },
};

export default function ProtectionLayout({ children }: { children: React.ReactNode }) {
  return children;
}
