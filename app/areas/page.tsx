import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, MapPin } from "lucide-react";
import { SEOUL_GUS } from "@/lib/seoul-regions";
import { createAnonClient } from "@/lib/supabase/anon";

const SITE_URL = "https://dosigongzon.com";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "서울 길고양이 돌봄 지도 — 25개 구별 현황",
  description:
    "서울특별시 25개 자치구의 길고양이 돌봄 현황을 한눈에. 강남구·서초구·마포구 등 구별 등록 고양이 수, 긴급 돌봄 필요 아이, 구조동물 치료 병원을 확인하세요.",
  alternates: { canonical: "/areas" },
  keywords: [
    "서울 길고양이 지도",
    "서울 캣맘",
    "강남구 길고양이",
    "마포구 길고양이",
    "서초구 길고양이",
    "TNR 지도",
    "길고양이 구조",
    "도시공존",
  ],
  openGraph: {
    type: "website",
    title: "서울 25개 구 길고양이 돌봄 지도 | 도시공존",
    description: "서울 전역의 길고양이 돌봄 현황을 구별로 확인하세요.",
    url: `${SITE_URL}/areas`,
    images: [{ url: `${SITE_URL}/opengraph-image`, width: 1200, height: 630 }],
  },
};

async function getCountsByGu(): Promise<Record<string, number>> {
  try {
    const supabase = createAnonClient();
    // 모든 cats의 region만 뽑아서 구별로 카운트
    const { data } = await supabase
      .from("cats")
      .select("region")
      .limit(50000);

    const counts: Record<string, number> = {};
    for (const row of (data ?? []) as { region: string | null }[]) {
      if (!row.region) continue;
      // gu 이름이 직접 포함된 경우 (최우선)
      const matchedGu = SEOUL_GUS.find((g) => row.region!.includes(g.name));
      if (matchedGu) {
        counts[matchedGu.slug] = (counts[matchedGu.slug] ?? 0) + 1;
        continue;
      }
      // dong 이름으로 매칭
      for (const g of SEOUL_GUS) {
        if (g.dongs.some((d) => row.region!.includes(d))) {
          counts[g.slug] = (counts[g.slug] ?? 0) + 1;
          break;
        }
      }
    }
    return counts;
  } catch {
    return {};
  }
}

export default async function AreasIndexPage() {
  const counts = await getCountsByGu();
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "서울 25개 구 길고양이 돌봄 지도",
    numberOfItems: SEOUL_GUS.length,
    itemListElement: SEOUL_GUS.map((g, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: g.name,
      url: `${SITE_URL}/areas/${g.slug}`,
    })),
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
          <span className="text-[11.5px] font-bold" style={{ color: "#C47E5A" }}>서울특별시</span>
        </div>
        <h1 className="text-[24px] font-extrabold text-text-main leading-tight tracking-tight">
          서울 25개 구 <br />길고양이 돌봄 지도
        </h1>
        <p className="text-[13px] text-text-sub mt-2 leading-relaxed">
          전체 등록 고양이 <b style={{ color: "#C47E5A" }}>{total.toLocaleString()}마리</b>.
          내 동네를 눌러 돌봄 기록과 긴급 구조가 필요한 아이를 확인하세요.
        </p>
      </section>

      <section className="px-5 mt-6">
        <div className="grid grid-cols-2 gap-2">
          {SEOUL_GUS.map((g) => {
            const n = counts[g.slug] ?? 0;
            return (
              <Link
                key={g.slug}
                href={`/areas/${g.slug}`}
                className="bg-white rounded-2xl p-3.5 active:scale-[0.97] transition-transform"
                style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}
              >
                <div className="flex items-baseline justify-between">
                  <span className="text-[14px] font-extrabold text-text-main">{g.name}</span>
                  {n > 0 && (
                    <span className="text-[11px] font-bold" style={{ color: "#C47E5A" }}>
                      {n}마리
                    </span>
                  )}
                </div>
                <p className="text-[10.5px] text-text-light mt-1 line-clamp-1">
                  {g.dongs.slice(0, 3).join(" · ")}
                </p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* 다른 도시 진입점 */}
      <section className="px-5 mt-7">
        <Link
          href="/regions"
          className="block rounded-2xl p-4 active:scale-[0.98] transition-transform"
          style={{
            background: "linear-gradient(135deg, #FFF8F2 0%, #F7F4EE 100%)",
            border: "1.5px solid rgba(196,126,90,0.25)",
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold tracking-[0.12em]" style={{ color: "#C47E5A" }}>NATIONWIDE</p>
              <p className="text-[15px] font-extrabold text-text-main mt-0.5">서울 외 다른 도시도 보기</p>
              <p className="text-[11.5px] text-text-sub mt-0.5">부산·인천·대구·대전·광주·울산·세종·제주·경기</p>
            </div>
            <span className="text-[18px]" style={{ color: "#C47E5A" }}>→</span>
          </div>
        </Link>
      </section>

      <section className="px-5 mt-5">
        <div className="bg-white rounded-2xl p-4" style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}>
          <p className="text-[12.5px] text-text-sub leading-relaxed">
            <b className="text-text-main">도시공존</b>은 서울 전역의 길고양이를 기록하고 돌보는 시민 참여 플랫폼입니다.
            각 구별 페이지에서 동네에 등록된 고양이의 돌봄 기록, TNR 상태, 긴급 구조 요청을 확인할 수 있습니다.
            정확한 급식소 위치는 아이들의 안전을 위해 공개되지 않습니다.
          </p>
        </div>
      </section>
    </div>
  );
}
