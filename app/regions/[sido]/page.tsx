import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, Heart, PawPrint, Stethoscope, Phone, ChevronRight } from "lucide-react";
import { KOREA_SIDOS, findSidoBySlug } from "@/lib/korea-regions";
import { sanitizeImageUrl } from "@/lib/url-validate";
import { createAnonClient } from "@/lib/supabase/anon";
import { catArtWalkSvg } from "@/lib/cat-art";
import ShareAreaButton from "@/app/components/ShareAreaButton";

const SITE_URL = "https://dosigongzon.com";

export const revalidate = 3600;

type Params = Promise<{ sido: string }>;

export async function generateStaticParams() {
  return KOREA_SIDOS.map((s) => ({ sido: s.slug }));
}

type SidoCat = {
  id: string;
  name: string;
  region: string | null;
  photo_url: string | null;
  health_status: string;
  description: string | null;
  created_at: string;
};
type SidoHospital = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  district: string | null;
};

/**
 * primary 키워드는 단독 OR로 매칭 (인천/부산/수원 등 unique).
 * district 키워드는 sido shortName과 AND로 묶어 매칭 — 다른 광역시 같은 동명에 잡히는 false positive 차단.
 *  예) 대전 클릭 → "동구"만으로 매칭하면 부산 동구 cats도 잡힘 → "대전 AND 동구"로 한정.
 */
function buildRegionFilter(
  primary: string[],
  districts: string[],
  sidoShort: string,
  field: "region" | "address",
): string {
  const primaryClauses = primary.map((kw) => `${field}.ilike.%${kw}%`);
  const districtClauses = districts.map(
    (kw) => `and(${field}.ilike.%${sidoShort}%,${field}.ilike.%${kw}%)`,
  );
  return [...primaryClauses, ...districtClauses].join(",");
}

async function getSidoData(
  primary: string[],
  districts: string[],
  sidoShort: string,
) {
  try {
    const supabase = createAnonClient();
    const orFilter = buildRegionFilter(primary, districts, sidoShort, "region");
    const orHospitalFilter = buildRegionFilter(primary, districts, sidoShort, "address");

    const [catsRes, countRes, hospitalsRes] = await Promise.allSettled([
      supabase
        .from("cats")
        .select("id, name, region, photo_url, health_status, description, created_at")
        .eq("hidden", false)
        .or(orFilter)
        .order("created_at", { ascending: false })
        .limit(24),
      supabase
        .from("cats")
        .select("*", { count: "exact", head: true })
        .eq("hidden", false)
        .or(orFilter),
      supabase
        .from("rescue_hospitals")
        .select("id, name, address, phone, district")
        .eq("hidden", false)
        .or(orHospitalFilter)
        .order("pinned", { ascending: false })
        .limit(6),
    ]);

    return {
      cats: (catsRes.status === "fulfilled" ? catsRes.value.data : null) as SidoCat[] | null ?? [],
      catCount: (countRes.status === "fulfilled" ? countRes.value.count : null) ?? 0,
      hospitals:
        (hospitalsRes.status === "fulfilled" ? hospitalsRes.value.data : null) as SidoHospital[] | null ?? [],
    };
  } catch (err) {
    console.error("[regions/[sido]] getSidoData error", err);
    return { cats: [] as SidoCat[], catCount: 0, hospitals: [] as SidoHospital[] };
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { sido } = await params;
  const region = findSidoBySlug(sido);
  if (!region) {
    return { title: "지역을 찾을 수 없어요", robots: { index: false, follow: false } };
  }

  const { catCount } = await getSidoData(region.primaryKeywords, region.districtKeywords, region.shortName);
  const title = `${region.shortName} 길고양이 돌봄 지도`;
  const description = catCount > 0
    ? `${region.name}에 등록된 길고양이 ${catCount}마리의 돌봄 기록. 동네 길집사와 함께 TNR·구조·급식을 실시간 공유하는 도시공존.`
    : `${region.name} 길고양이 돌봄 지도. 첫 돌봄 기록을 남겨보세요.`;

  return {
    title,
    description,
    alternates: { canonical: `/regions/${sido}` },
    keywords: [
      `${region.shortName} 길고양이`,
      `${region.shortName} 길집사`,
      `${region.shortName} TNR`,
      `${region.shortName} 길고양이 구조`,
      `${region.name} 길고양이`,
      "전국 길고양이 지도",
      "도시공존",
    ],
    openGraph: {
      type: "website",
      title: `${title} | 도시공존`,
      description,
      url: `${SITE_URL}/regions/${sido}`,
      images: [{ url: `${SITE_URL}/opengraph-image`, width: 1200, height: 630 }],
    },
    robots: catCount === 0 ? { index: false, follow: true } : { index: true, follow: true },
  };
}

export default async function SidoLandingPage({ params }: { params: Params }) {
  const { sido } = await params;
  const region = findSidoBySlug(sido);
  if (!region) notFound();

  const { cats, catCount, hospitals } = await getSidoData(region.primaryKeywords, region.districtKeywords, region.shortName);
  const urgent = cats.filter((c) => c.health_status === "danger").length;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Place",
    name: `${region.name} 길고양이 돌봄 지도`,
    description: `${region.name}에 등록된 길고양이 ${catCount}마리의 돌봄 기록`,
    url: `${SITE_URL}/regions/${sido}`,
    geo: {
      "@type": "GeoCoordinates",
      latitude: region.latlng[0],
      longitude: region.latlng[1],
    },
    containedInPlace: { "@type": "Country", name: "대한민국" },
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "도시공존", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "전국", item: `${SITE_URL}/regions` },
      { "@type": "ListItem", position: 3, name: region.name, item: `${SITE_URL}/regions/${sido}` },
    ],
  };

  return (
    <div className="min-h-dvh pb-16" style={{ background: "var(--color-surface)" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd).replace(/</g, "\\u003c") }} />

      <div className="px-4 pt-12 pb-2 flex items-center gap-2">
        <Link
          href="/regions"
          className="w-9 h-9 rounded-full flex items-center justify-center press-strong"
          style={{ background: "var(--color-gray-100)" }}
          aria-label="전국 지역"
        >
          <ArrowLeft size={18} className="text-text-main" />
        </Link>
        <span className="text-[13px] font-semibold text-text-sub">전국</span>
      </div>

      <section className="px-5 pt-4">
        <div className="flex items-center gap-1.5 mb-1.5">
          <MapPin size={14} className="text-text-light" />
          <span className="text-[13px] font-semibold text-text-sub">{region.name}</span>
        </div>
        <h1 className="text-[24px] font-bold text-text-main leading-tight tracking-tight">
          {region.shortName} 길고양이 돌봄 지도
        </h1>
        <p className="text-[15px] text-text-sub mt-2 leading-relaxed">
          {region.name}에 등록된 길고양이 <b style={{ color: "var(--color-primary)" }}>{catCount}마리</b>의 돌봄 기록.
          {urgent > 0 && (
            <> 지금 도움이 필요한 아이 <b style={{ color: "var(--color-error)" }}>{urgent}마리</b>.</>
          )}
        </p>

        <div className="flex gap-2 mt-4">
          <Link
            href="/map"
            className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-lg bg-primary text-white press"
          >
            <PawPrint size={14} />
            <span className="text-[13px] font-bold">지도에서 보기</span>
          </Link>
          <Link
            href="/signup"
            className="flex-1 flex items-center justify-center py-3 rounded-lg press"
            style={{ background: "var(--color-gray-100)", color: "var(--color-text-main)", fontSize: 13, fontWeight: 700 }}
          >
            돌봄 시작하기
          </Link>
        </div>
        <div className="mt-2">
          <ShareAreaButton
            guName={region.shortName}
            slug={`regions/${sido}`}
            catCount={catCount}
            urgentCount={urgent}
          />
        </div>
      </section>

      {/* 고양이 그리드 */}
      <section className="px-5 mt-7">
        <h2 className="text-[17px] font-bold text-text-main mb-3 flex items-center gap-1.5">
          <Heart size={15} className="text-text-light" />
          {region.shortName} 고양이들
        </h2>
        {cats.length === 0 ? (
          <div className="rounded-xl p-5 text-center" style={{ border: "1px solid var(--color-border)" }}>
            <PawPrint size={28} className="mx-auto mb-2 text-text-light" aria-hidden />
            <p className="text-[15px] font-bold text-text-main leading-tight tracking-tight mb-1.5">
              {region.shortName}의 첫 번째 길집사가 되어주세요
            </p>
            <p className="text-[13px] text-text-sub leading-relaxed mb-4">아직 기록이 없어요. 지금 합류하면 창립 멤버 타이틀을 드려요.</p>
            <div className="flex gap-2">
              <Link
                href={`/signup?next=${encodeURIComponent(`/regions/${sido}`)}`}
                className="flex-[1.5] flex items-center justify-center py-2.5 rounded-lg text-white text-[13px] font-bold press"
                style={{ background: "var(--color-primary)" }}
              >
                무료로 시작하기
              </Link>
              <Link
                href="/regions"
                className="flex-1 flex items-center justify-center py-2.5 rounded-lg text-[13px] font-bold press"
                style={{ background: "var(--color-gray-100)", color: "var(--color-text-main)" }}
              >
                다른 시·도
              </Link>
            </div>
          </div>
        ) : (
          <div className="rounded-xl" style={{ border: "1px solid var(--color-border)" }}>
            {cats.map((c) => {
              const photo = sanitizeImageUrl(c.photo_url);
              const isUrgent = c.health_status === "danger";
              return (
                <Link
                  key={c.id}
                  href={`/cats/${c.id}`}
                  className="flex items-center gap-3 px-4 py-3 press border-b border-divider last:border-b-0"
                  style={{ minHeight: 64 }}
                >
                  <div className="relative w-12 h-12 rounded-full overflow-hidden shrink-0" style={{ background: "var(--color-gray-100)" }}>
                    {photo ? (
                      <Image src={photo} alt={c.name} fill sizes="48px" style={{ objectFit: "cover" }} />
                    ) : (
                      <div
                        className="w-full h-full flex items-center justify-center"
                        aria-hidden
                        dangerouslySetInnerHTML={{ __html: catArtWalkSvg(c.id, 40) }}
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-[15px] font-semibold text-text-main truncate">{c.name}</p>
                      {isUrgent && (
                        <span className="text-[11px] font-semibold shrink-0" style={{ color: "var(--color-error)" }}>긴급</span>
                      )}
                    </div>
                    <p className="text-[13px] text-text-sub truncate mt-0.5">
                      {c.region ?? region.shortName}
                      {c.description ? ` · ${c.description}` : ""}
                    </p>
                  </div>
                  <ChevronRight size={18} className="shrink-0" style={{ color: "var(--color-text-muted)" }} />
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* 인근 병원 */}
      {hospitals.length > 0 && (
        <section className="px-5 mt-7">
          <h2 className="text-[17px] font-bold text-text-main mb-3 flex items-center gap-1.5">
            <Stethoscope size={15} className="text-text-light" />
            {region.shortName} 구조동물 치료 병원
          </h2>
          <div className="rounded-xl" style={{ border: "1px solid var(--color-border)" }}>
            {hospitals.map((h) => (
              <div key={h.id} className="px-4 py-3 border-b border-divider last:border-b-0">
                <p className="text-[15px] font-semibold text-text-main">{h.name}</p>
                {h.address && (
                  <p className="text-[13px] text-text-sub mt-0.5 leading-snug">{h.address}</p>
                )}
                {h.phone && (
                  <a
                    href={`tel:${h.phone}`}
                    className="inline-flex items-center gap-1 text-[13px] font-semibold mt-1"
                    style={{ color: "var(--color-sage)" }}
                  >
                    <Phone size={12} />
                    {h.phone}
                  </a>
                )}
              </div>
            ))}
          </div>
          <Link
            href="/hospitals"
            className="block text-center text-[13px] font-bold mt-3"
            style={{ color: "var(--color-primary)" }}
          >
            전체 병원 보기 →
          </Link>
        </section>
      )}

      {/* 다른 시·도 */}
      <section className="px-5 mt-8 cv-auto">
        <h2 className="text-[15px] font-bold text-text-main mb-2.5">다른 지역도 살펴보기</h2>
        <div className="grid grid-cols-3 gap-1.5">
          {KOREA_SIDOS.filter((s) => s.slug !== sido)
            .slice(0, 9)
            .map((s) => (
              <Link
                key={s.slug}
                href={`/regions/${s.slug}`}
                className="text-center py-2 rounded-lg text-[13px] font-semibold text-text-main press"
                style={{ border: "1px solid var(--color-border)" }}
              >
                {s.shortName}
              </Link>
            ))}
        </div>
        <Link
          href="/areas"
          className="block text-center text-[13px] font-bold mt-3"
          style={{ color: "var(--color-primary)" }}
        >
          전국 구·동별 지도 보기 →
        </Link>
      </section>

      {/* 하단 SEO 본문 */}
      <section className="px-5 mt-8 cv-auto">
        <div className="rounded-xl p-4" style={{ border: "1px solid var(--color-border)" }}>
          <p className="text-[13px] text-text-sub leading-relaxed">
            <b className="text-text-main">도시공존</b>은 {region.name}을 포함한 전국의 길고양이를 기록하고
            돌보는 시민 참여 플랫폼입니다. {region.shortName} 주민이라면 회원가입 후 동네 고양이를
            등록해주세요. 정확한 위치는 보안을 위해 공개되지 않습니다.
            서울 외 지역은 시·도 단위 안내를 먼저 운영하며, 사용자 활동이 늘어나면 구·군 단위로 확장됩니다.
          </p>
        </div>
      </section>
    </div>
  );
}
