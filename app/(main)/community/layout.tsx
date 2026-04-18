import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "커뮤니티",
  description: "길고양이 긴급 제보 · 임시보호 · 입양 · 용품 거래 · 자유게시판. 이웃 캣맘들과 함께하는 공간.",
  openGraph: {
    title: "커뮤니티 | 도시공존",
    description: "긴급 · 임보 · 입양 · 중고마켓 · 자유게시판. 이웃 캣맘들과 함께하는 공간.",
  },
  alternates: { canonical: "/community" },
};

export default function CommunityLayout({ children }: { children: React.ReactNode }) {
  return children;
}
