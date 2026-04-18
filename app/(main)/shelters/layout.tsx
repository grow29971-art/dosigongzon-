import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "길고양이 쉼터",
  description: "우리 동네 길고양이 쉼터 · 겨울 은신처 · 급식소 위치 안내.",
  keywords: ["길고양이 쉼터", "길고양이 은신처", "겨울집", "급식소"],
  openGraph: {
    title: "길고양이 쉼터 | 도시공존",
    description: "우리 동네 길고양이 쉼터 · 겨울 은신처 · 급식소 위치 안내.",
  },
  alternates: { canonical: "/shelters" },
};

export default function SheltersLayout({ children }: { children: React.ReactNode }) {
  return children;
}
