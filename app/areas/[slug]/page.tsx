import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, Heart, PawPrint, Stethoscope } from "lucide-react";
import { SEOUL_GUS, findGuBySlug } from "@/lib/seoul-regions";
import { getCatsByRegionServer, getCatCountByRegionServer } from "@/lib/cats-server";
import { sanitizeImageUrl } from "@/lib/url-validate";
import { createAnonClient } from "@/lib/supabase/anon";
import { HEALTH_MAP } from "@/lib/cats-repo";
import ShareAreaButton from "@/app/components/ShareAreaButton";

const SITE_URL = "https://dosigongzon.com";

// 1시간 ISR (신규 고양이 반영)
export const revalidate = 3600;

type Params = Promise<{ slug: string }>;

export async function generateStaticParams() {
  return SEOUL_GUS.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const gu = findGuBySlug(slug);
  if (!gu) {
    return { title: "지역을 찾을 수 없어요", robots: { index: false, follow: false } };
  }

  const count = await getCatCountByRegionServer(gu.name, gu.dongs);
  const title = `서울 ${gu.name} 길고양이 돌봄 지도`;
  const description = count > 0
    ? `${gu.name}에 등록된 길고양이 ${count}마리의 돌봄 기록을 확인하세요. 동네 캣맘/캣대디와 함께 TNR·구조·급식을 실시간 공유하는 도시공존.`
    : `${gu.name} 지역의 길고양이 돌봄 지도. 동네의 첫 번째 돌봄 기록을 남겨보세요.`;

  return {
    title,
    description,
    alternates: { canonical: `/areas/${slug}` },
    keywords: [
      `${gu.name} 길고양이`,
      `${gu.name} 캣맘`,
      `${gu.name} 고양이 구조`,
      `${gu.name} TNR`,
      `서울 길고양이 지도`,
      ...gu.dongs.slice(0, 5).map((d) => `${d} 길고양이`),
    ],
    openGraph: {
      type: "website",
      title: `${title} | 도시공존`,
      description,
      url: `${SITE_URL}/areas/${slug}`,
      images: [{ url: `${SITE_URL}/opengraph-image`, width: 1200, height: 630 }],
    },
  };
}

export default async function AreaLandingPage({ params }: { params: Params }) {
  const { slug } = await params;
  const gu = findGuBySlug(slug);
  if (!gu) notFound();

  const [cats, catCount, hospitalsRes] = await Promise.all([
    getCatsByRegionServer(gu.name, gu.dongs, 24),
    getCatCountByRegionServer(gu.name, gu.dongs),
    (async () => {
      const supabase = createAnonClient();
      const { data } = await supabase
        .from("rescue_hospitals")
        .select("id, name, address, phone, district")
        .eq("district", gu.name)
        .eq("hidden", false)
        .order("pinned", { ascending: false })
        .limit(6);
      return data ?? [];
    })(),
  ]);

  const urgent = cats.filter((c) => c.health_status === "danger").length;

  // JSON-LD: Place + ItemList
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Place",
    name: `${gu.name} 길고양이 돌봄 지도`,
    description: `서울 ${gu.name}에 등록된 길고양이 ${catCount}마리의 돌봄 기록`,
    url: `${SITE_URL}/areas/${slug}`,
    geo: {
      "@type": "GeoCoordinates",
      latitude: gu.latlng[0],
      longitude: gu.latlng[1],
    },
    containedInPlace: {
      "@type": "City",
      name: "서울특별시",
    },
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "도시공존", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "지역", item: `${SITE_URL}/areas` },
      { "@type": "ListItem", position: 3, name: gu.name, item: `${SITE_URL}/areas/${slug}` },
    ],
  };

  return (
    <div className="min-h-dvh pb-16" style={{ background: "#F7F4EE" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />

      {/* 헤더 */}
      <div className="px-4 pt-12 pb-2 flex items-center gap-2">
        <Link
          href="/areas"
          className="w-9 h-9 rounded-full bg-white flex items-center justify-center active:scale-90"
          style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}
          aria-label="지역 목록"
        >
          <ArrowLeft size={18} className="text-text-main" />
        </Link>
        <span className="text-[12px] font-semibold text-text-sub">지역</span>
      </div>

      {/* 히어로 */}
      <section className="px-5 pt-4">
        <div className="flex items-center gap-1.5 mb-1.5">
          <MapPin size={14} style={{ color: "#C47E5A" }} />
          <span className="text-[11.5px] font-bold" style={{ color: "#C47E5A" }}>서울특별시 {gu.name}</span>
        </div>
        <h1 className="text-[26px] font-extrabold text-text-main leading-tight tracking-tight">
          {gu.name} 길고양이 돌봄 지도
        </h1>
        <p className="text-[13.5px] text-text-sub mt-2 leading-relaxed">
          {gu.name}에 등록된 길고양이 <b style={{ color: "#C47E5A" }}>{catCount}마리</b>의 돌봄 기록.
          {urgent > 0 && (
            <> 지금 도움이 필요한 아이 <b style={{ color: "#D85555" }}>{urgent}마리</b>.</>
          )}
        </p>

        {/* CTA */}
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
            guName={gu.name}
            slug={gu.slug}
            catCount={catCount}
            urgentCount={urgent}
          />
        </div>
      </section>

      {/* 고양이 그리드 */}
      <section className="px-5 mt-7">
        <h2 className="text-[16px] font-extrabold text-text-main mb-3 flex items-center gap-1.5">
          <Heart size={15} style={{ color: "#E86B8C" }} />
          {gu.name} 고양이들
        </h2>
        {cats.length === 0 ? (
          <div className="py-10 text-center text-[13px] text-text-light bg-white rounded-2xl" style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}>
            아직 {gu.name}에 등록된 아이가 없어요.
            <br />
            <Link href="/login?next=/map" className="font-bold mt-2 inline-block" style={{ color: "#C47E5A" }}>
              첫 번째 돌봄 기록 남기기 →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {cats.map((c) => {
              const photo = sanitizeImageUrl(c.photo_url, "https://placehold.co/400x400/EEEAE2/2A2A28?text=%3F");
              const urgent = c.health_status === "danger";
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
                    {urgent && (
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
                      <span className="text-[10.5px] text-text-sub truncate">{c.region ?? gu.name}</span>
                    </div>
                    {c.description && (
                      <p className="text-[11px] text-text-light line-clamp-2 mt-1 leading-snug">
                        {c.description}
                      </p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* 동네 병원 */}
      {hospitalsRes.length > 0 && (
        <section className="px-5 mt-7">
          <h2 className="text-[16px] font-extrabold text-text-main mb-3 flex items-center gap-1.5">
            <Stethoscope size={15} style={{ color: "#22B573" }} />
            {gu.name} 구조동물 치료 병원
          </h2>
          <div className="space-y-2">
            {hospitalsRes.map((h) => (
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

      {/* 주요 동네 */}
      <section className="px-5 mt-7">
        <h2 className="text-[16px] font-extrabold text-text-main mb-3">
          {gu.name} 주요 동네
        </h2>
        <div className="flex flex-wrap gap-1.5">
          {gu.dongs.slice(0, 20).map((d) => (
            <span
              key={d}
              className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-white"
              style={{ color: "#8B6844", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
            >
              {d}
            </span>
          ))}
        </div>
      </section>

      {/* 다른 구로 이동 */}
      <section className="px-5 mt-8">
        <h2 className="text-[14px] font-extrabold text-text-main mb-2.5">
          다른 지역도 살펴보기
        </h2>
        <div className="grid grid-cols-3 gap-1.5">
          {SEOUL_GUS.filter((g) => g.slug !== gu.slug)
            .slice(0, 12)
            .map((g) => (
              <Link
                key={g.slug}
                href={`/areas/${g.slug}`}
                className="text-center py-2 rounded-xl bg-white text-[12px] font-bold active:scale-95 transition-transform"
                style={{ color: "#6B5043", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
              >
                {g.name}
              </Link>
            ))}
        </div>
        <Link
          href="/areas"
          className="block text-center text-[12px] font-bold mt-3"
          style={{ color: "#C47E5A" }}
        >
          서울 25개 구 전체 보기 →
        </Link>
      </section>

      {/* 하단 설명 (SEO 본문) */}
      <section className="px-5 mt-8">
        <div className="bg-white rounded-2xl p-4" style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}>
          <p className="text-[12.5px] text-text-sub leading-relaxed">
            <b className="text-text-main">도시공존</b>은 {gu.name}을 포함한 서울 전역의 길고양이를 기록하고 돌보는 시민 참여 플랫폼입니다.
            캣맘·캣대디가 실시간으로 TNR 상태, 급식소 위치(비공개), 건강 상태를 공유하고,
            긴급 구조가 필요한 아이에게는 동네 이웃이 빠르게 달려갈 수 있도록 돕습니다.
            {gu.name} 주민이라면 회원가입 후 동네 고양이를 등록해주세요. 정확한 위치는 보안을 위해 공개되지 않습니다.
          </p>
        </div>
      </section>
    </div>
  );
}
