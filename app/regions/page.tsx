import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, MapPin, ArrowRight } from "lucide-react";
import { KOREA_SIDOS } from "@/lib/korea-regions";

const SITE_URL = "https://dosigongzon.com";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "전국 길고양이 돌봄 지도 — 시·도별 현황",
  description:
    "서울·부산·인천·대구·대전·광주·울산·세종·제주·경기 등 전국 광역시·도 길고양이 돌봄 현황. 내 지역 캣맘·캣대디와 함께 만드는 도시공존.",
  alternates: { canonical: "/regions" },
  keywords: [
    "전국 길고양이 지도",
    "부산 길고양이",
    "인천 길고양이",
    "대구 길고양이",
    "수원 길고양이",
    "고양시 길고양이",
    "TNR 지도",
    "길고양이 구조",
    "도시공존",
  ],
  openGraph: {
    type: "website",
    title: "전국 광역시·도 길고양이 돌봄 지도 | 도시공존",
    description: "서울 외 전국 광역시·도의 길고양이 돌봄 현황을 한눈에.",
    url: `${SITE_URL}/regions`,
    images: [{ url: `${SITE_URL}/opengraph-image`, width: 1200, height: 630 }],
  },
};

const SEOUL_HIGHLIGHT = {
  slug: "seoul",
  name: "서울특별시",
  shortName: "서울",
  href: "/areas",
  desc: "25개 자치구 · 동 단위 상세 지도",
};

export default function RegionsIndexPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "전국 광역시·도 길고양이 돌봄 지도",
    numberOfItems: KOREA_SIDOS.length + 1,
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: SEOUL_HIGHLIGHT.name,
        url: `${SITE_URL}${SEOUL_HIGHLIGHT.href}`,
      },
      ...KOREA_SIDOS.map((s, i) => ({
        "@type": "ListItem",
        position: i + 2,
        name: s.name,
        url: `${SITE_URL}/regions/${s.slug}`,
      })),
    ],
  };

  return (
    <div className="min-h-dvh pb-16" style={{ background: "#F7F4EE" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="px-4 pt-12 pb-2 flex items-center gap-2">
        <Link
          href="/"
          className="w-9 h-9 rounded-full bg-white flex items-center justify-center active:scale-90"
          style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}
          aria-label="홈"
        >
          <ArrowLeft size={18} className="text-text-main" />
        </Link>
        <span className="text-[12px] font-semibold text-text-sub">홈</span>
      </div>

      <section className="px-5 pt-4">
        <div className="flex items-center gap-1.5 mb-1.5">
          <MapPin size={14} style={{ color: "#C47E5A" }} />
          <span className="text-[11.5px] font-bold" style={{ color: "#C47E5A" }}>대한민국</span>
        </div>
        <h1 className="text-[24px] font-extrabold text-text-main leading-tight tracking-tight">
          전국 길고양이<br />돌봄 지도
        </h1>
        <p className="text-[13px] text-text-sub mt-2 leading-relaxed">
          서울 외 광역시·세종·제주·경기 사용자들도 함께해요.
          내 지역을 눌러 등록된 고양이와 캣맘·캣대디 활동을 확인하세요.
        </p>
      </section>

      {/* 서울 강조 카드 */}
      <section className="px-5 mt-6">
        <Link
          href={SEOUL_HIGHLIGHT.href}
          className="block rounded-2xl p-4 active:scale-[0.98] transition-transform"
          style={{
            background: "linear-gradient(135deg, #C47E5A 0%, #A8684A 100%)",
            boxShadow: "0 8px 24px rgba(196,126,90,0.30)",
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold tracking-[0.12em] text-white/80">SEOUL</p>
              <p className="text-[18px] font-extrabold text-white tracking-tight mt-0.5">{SEOUL_HIGHLIGHT.name}</p>
              <p className="text-[11.5px] text-white/85 mt-0.5">{SEOUL_HIGHLIGHT.desc}</p>
            </div>
            <ArrowRight size={20} className="text-white shrink-0" />
          </div>
        </Link>
      </section>

      {/* 광역시·도 그리드 */}
      <section className="px-5 mt-5">
        <h2 className="text-[13px] font-extrabold text-text-main mb-2.5 px-1">광역시·도</h2>
        <div className="grid grid-cols-2 gap-2">
          {KOREA_SIDOS.map((s) => (
            <Link
              key={s.slug}
              href={`/regions/${s.slug}`}
              className="bg-white rounded-2xl p-3.5 active:scale-[0.97] transition-transform"
              style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}
            >
              <div className="flex items-baseline justify-between">
                <span className="text-[14px] font-extrabold text-text-main">{s.shortName}</span>
                <ArrowRight size={12} className="text-text-light" />
              </div>
              <p className="text-[10.5px] text-text-light mt-1 truncate">{s.name}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* 하단 SEO 본문 */}
      <section className="px-5 mt-7">
        <div className="bg-white rounded-2xl p-4" style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}>
          <p className="text-[12.5px] text-text-sub leading-relaxed">
            <b className="text-text-main">도시공존</b>은 전국 어디서나 길고양이 돌봄 기록을 남길 수 있어요.
            현재 서울은 25개 구·동 단위 상세 페이지를 제공하고, 다른 광역시·도는 지역 단위 안내를
            먼저 운영합니다. 사용자가 늘어나는 지역부터 점진적으로 구·군 단위 페이지를 추가합니다.
            정확한 급식소 위치는 아이들의 안전을 위해 공개되지 않으며, 동 단위로 표시됩니다.
          </p>
        </div>
      </section>
    </div>
  );
}
