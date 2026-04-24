// regions 공개 페이지 (SEO 랜딩) 레이아웃 — 모바일 우선 디자인이라 데스크탑에서
// 카드가 화면 전체로 퍼지지 않도록 max-w-lg(512px)로 제약.
// PublicHeader로 브랜드·로그인 CTA 제공.

import PublicHeader from "@/app/components/PublicHeader";

export default function RegionsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PublicHeader />
      <main className="mx-auto w-full max-w-lg">{children}</main>
    </>
  );
}
