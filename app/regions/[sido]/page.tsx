import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, Heart, PawPrint, Stethoscope } from "lucide-react";
import { KOREA_SIDOS, findSidoBySlug } from "@/lib/korea-regions";
import { sanitizeImageUrl } from "@/lib/url-validate";
import { createAnonClient } from "@/lib/supabase/anon";
import { HEALTH_MAP } from "@/lib/cats-repo";
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

async function getSidoData(matchKeywords: string[]) {
  try {
    const supabase = createAnonClient();
    // region에 매칭 키워드 중 하나라도 포함된 cats
    const orFilter = matchKeywords
      .map((kw) => `region.ilike.%${kw}%`)
      .join(",");

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
        .or(matchKeywords.map((kw) => `address.ilike.%${kw}%`).join(","))
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

  const { catCount } = await getSidoData(region.matchKeywords);
  const title = `${region.shortName} 길고양이 돌봄 지도`;
  const description = catCount > 0
    ? `${region.name}에 등록된 길고양이 ${catCount}마리의 돌봄 기록. 동네 캣맘·캣대디와 함께 TNR·구조·급식을 실시간 공유하는 도시공존.`
    : `${region.name} 길고양이 돌봄 지도. 첫 돌봄 기록을 남겨보세요.`;

  return {
    title,
    description,
    alternates: { canonical: `/regions/${sido}` },
    keywords: [
      `${region.shortName} 길고양이`,
      `${region.shortName} 캣맘`,
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

  const { cats, catCount, hospitals } = await getSidoData(region.matchKeywords);
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
    <div className="min-h-dvh pb-16" style={{ background: "#F7F4EE" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />

      <div className="px-4 pt-12 pb-2 flex items-center gap-2">
        <Link
          href="/regions"
          className="w-9 h-9 rounded-full bg-white flex items-center justify-center active:scale-90"
          style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}
          aria-label="전국 지역"
        >
          <ArrowLeft size={18} className="text-text-main" />
        </Link>
        <span className="text-[12px] font-semibold text-text-sub">전국</span>
      </div>

      <section className="px-5 pt-4">
        <div className="flex items-center gap-1.5 mb-1.5">
          <MapPin size={14} style={{ color: "#C47E5A" }} />
          <span className="text-[11.5px] font-bold" style={{ color: "#C47E5A" }}>{region.name}</span>
        </div>
        <h1 className="text-[26px] font-extrabold text-text-main leading-tight tracking-tight">
          {region.shortName} 길고양이 돌봄 지도
        </h1>
        <p className="text-[13.5px] text-text-sub mt-2 leading-relaxed">
          {region.name}에 등록된 길고양이 <b style={{ color: "#C47E5A" }}>{catCount}마리</b>의 돌봄 기록.
          {urgent > 0 && (
            <> 지금 도움이 필요한 아이 <b style={{ color: "#D85555" }}>{urgent}마리</b>.</>
          )}
        </p>

        <div className="flex gap-2 mt-4">
          <Link
            href="/map"
            className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-2xl bg-primary text-white active:scale-[0.98] transition-transform"
            style={{ boxShadow: "0 4px 14px rgba(196,126,90,0.3)" }}
          >
            <PawPrint size={14} />
            <span className="text-[13px] font-extrabold">지도에서 보기</span>
          </Link>
          <Link
            href="/signup"
            className="flex-1 flex items-center justify-center py-3 rounded-2xl active:scale-[0.98] transition-transform"
            style={{ backgroundColor: "#FFF", color: "#C47E5A", border: "1.5px solid #E8D4BD", fontSize: 13, fontWeight: 800 }}
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
        <h2 className="text-[16px] font-extrabold text-text-main mb-3 flex items-center gap-1.5">
          <Heart size={15} style={{ color: "#E86B8C" }} />
          {region.shortName} 고양이들
        </h2>
        {cats.length === 0 ? (
          <div
            className="py-10 text-center text-[13px] text-text-light bg-white rounded-2xl"
            style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}
          >
            아직 {region.shortName}에 등록된 아이가 없어요.
            <br />
            <Link href="/login?next=/map" className="font-bold mt-2 inline-block" style={{ color: "#C47E5A" }}>
              첫 번째 돌봄 기록 남기기 →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {cats.map((c) => {
              const photo = sanitizeImageUrl(c.photo_url, "https://placehold.co/400x400/EEEAE2/2A2A28?text=%3F");
              const u = c.health_status === "danger";
              return (
                <Link
                  key={c.id}
                  href={`/cats/${c.id}`}
                  className="block rounded-2xl overflow-hidden bg-white active:scale-[0.98] transition-transform"
                  style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.06)" }}
                >
                  <div className="relative" style={{ aspectRatio: "1 / 1" }}>
                    <Image
                      src={photo}
                      alt={c.name}
                      fill
                      sizes="(max-width: 640px) 50vw, 200px"
                      style={{ objectFit: "cover" }}
                    />
                    {u && (
                      <span
                        className="absolute top-2 left-2 text-[10px] font-extrabold px-2 py-0.5 rounded-lg text-white z-10"
                        style={{ backgroundColor: HEALTH_MAP.danger.color }}
                      >
                        🚨 긴급
                      </span>
                    )}
                  </div>
                  <div className="p-2.5">
                    <p className="text-[13px] font-extrabold text-text-main truncate">{c.name}</p>
                    <div className="flex items-center gap-0.5 mt-0.5">
                      <MapPin size={10} className="text-text-light" />
                      <span className="text-[10.5px] text-text-sub truncate">{c.region ?? region.shortName}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* 인근 병원 */}
      {hospitals.length > 0 && (
        <section className="px-5 mt-7">
          <h2 className="text-[16px] font-extrabold text-text-main mb-3 flex items-center gap-1.5">
            <Stethoscope size={15} style={{ color: "#22B573" }} />
            {region.shortName} 구조동물 치료 병원
          </h2>
          <div className="space-y-2">
            {hospitals.map((h) => (
              <div
                key={h.id}
                className="bg-white rounded-2xl p-3.5"
                style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
              >
                <p className="text-[13.5px] font-extrabold text-text-main">{h.name}</p>
                {h.address && (
                  <p className="text-[11.5px] text-text-sub mt-0.5 leading-snug">{h.address}</p>
                )}
                {h.phone && (
                  <a
                    href={`tel:${h.phone}`}
                    className="text-[11.5px] font-bold mt-1 inline-block"
                    style={{ color: "#22B573" }}
                  >
                    📞 {h.phone}
                  </a>
                )}
              </div>
            ))}
          </div>
          <Link
            href="/hospitals"
            className="block text-center text-[12px] font-bold mt-3"
            style={{ color: "#C47E5A" }}
          >
            전체 병원 보기 →
          </Link>
        </section>
      )}

      {/* 다른 시·도 */}
      <section className="px-5 mt-8">
        <h2 className="text-[14px] font-extrabold text-text-main mb-2.5">다른 지역도 살펴보기</h2>
        <div className="grid grid-cols-3 gap-1.5">
          {KOREA_SIDOS.filter((s) => s.slug !== sido)
            .slice(0, 9)
            .map((s) => (
              <Link
                key={s.slug}
                href={`/regions/${s.slug}`}
                className="text-center py-2 rounded-xl bg-white text-[12px] font-bold active:scale-95 transition-transform"
                style={{ color: "#6B5043", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
              >
                {s.shortName}
              </Link>
            ))}
        </div>
        <Link
          href="/areas"
          className="block text-center text-[12px] font-bold mt-3"
          style={{ color: "#C47E5A" }}
        >
          서울 25개 구 보기 →
        </Link>
      </section>

      {/* 하단 SEO 본문 */}
      <section className="px-5 mt-8">
        <div className="bg-white rounded-2xl p-4" style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}>
          <p className="text-[12.5px] text-text-sub leading-relaxed">
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
