import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "동네 게시판",
  description: "우리 동네 길고양이 소식과 이웃 캣맘들의 이야기.",
  alternates: { canonical: "/neighborhood" },
};

export default function NeighborhoodLayout({ children }: { children: React.ReactNode }) {
  return children;
}
