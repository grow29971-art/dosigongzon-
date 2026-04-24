// regions 공개 페이지 (SEO 랜딩) 레이아웃 — 모바일 우선 디자인이라 데스크탑에서
// 카드가 화면 전체로 퍼지지 않도록 max-w-lg(512px)로 제약.

export default function RegionsLayout({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto w-full max-w-lg">{children}</main>;
}
