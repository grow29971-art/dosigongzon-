import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, Heart, PawPrint, Stethoscope, Phone, ChevronRight } from "lucide-react";
import { SEOUL_GUS, findGuBySlug } from "@/lib/seoul-regions";
import { getCatsByRegionServer, getCatCountByRegionServer } from "@/lib/cats-server";
import { sanitizeImageUrl } from "@/lib/url-validate";
import { createAnonClient } from "@/lib/supabase/anon";
import { catArtWalkSvg } from "@/lib/cat-art";
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
    ? `${gu.name}에 등록된 길고양이 ${count}마리의 돌봄 기록을 확인하세요. 동네 길집사와 함께 TNR·구조·급식을 실시간 공유하는 도시공존.`
    : `${gu.name} 지역의 길고양이 돌봄 지도. 동네의 첫 번째 돌봄 기록을 남겨보세요.`;

  return {
    title,
    description,
    alternates: { canonical: `/areas/${slug}` },
    keywords: [
      `${gu.name} 길고양이`,
      `${gu.name} 길집사`,
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
      images: [{ url: `${SITE_URL}/areas/${slug}/opengraph-image`, width: 1200, height: 630 }],
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
    <div className="min-h-dvh pb-16" style={{ background: "var(--color-surface)" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd).replace(/</g, "\\u003c") }}
      />

      {/* 헤더 */}
      <div className="px-4 pt-12 pb-2 flex items-center gap-2">
        <Link
          href="/areas"
          className="w-9 h-9 rounded-full flex items-center justify-center press-strong"
          style={{ background: "var(--color-gray-100)" }}
          aria-label="지역 목록"
        >
          <ArrowLeft size={18} className="text-text-main" />
        </Link>
        <span className="text-[13px] font-semibold text-text-sub">지역</span>
      </div>

      {/* 히어로 */}
      <section className="px-5 pt-4">
        <div className="flex items-center gap-1.5 mb-1.5">
          <MapPin size={14} className="text-text-light" />
          <span className="text-[13px] font-semibold text-text-sub">서울특별시 {gu.name}</span>
        </div>
        <h1 className="text-[24px] font-bold text-text-main leading-tight tracking-tight">
          {gu.name} 길고양이 돌봄 지도
        </h1>
        <p className="text-[15px] text-text-sub mt-2 leading-relaxed">
          {gu.name}에 등록된 길고양이 <b style={{ color: "var(--color-primary)" }}>{catCount}마리</b>의 돌봄 기록.
          {urgent > 0 && (
            <> 지금 도움이 필요한 아이 <b style={{ color: "var(--color-error)" }}>{urgent}마리</b>.</>
          )}
        </p>

        {/* CTA */}
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
            guName={gu.name}
            slug={gu.slug}
            catCount={catCount}
            urgentCount={urgent}
          />
        </div>
      </section>

      {/* 고양이 그리드 */}
      <section className="px-5 mt-7">
        <h2 className="text-[17px] font-bold text-text-main mb-3 flex items-center gap-1.5">
          <Heart size={15} className="text-text-light" />
          {gu.name} 고양이들
        </h2>
        {cats.length === 0 ? (
          <div className="rounded-xl p-5 text-center" style={{ border: "1px solid var(--color-border)" }}>
            <PawPrint size={28} className="mx-auto mb-2 text-text-light" aria-hidden />
            <p className="text-[15px] font-bold text-text-main leading-tight tracking-tight mb-1.5">
              {gu.name}의 첫 번째 길집사가 되어주세요
            </p>
            <p className="text-[13px] text-text-sub leading-relaxed mb-4">아직 기록이 없어요. 지금 합류하면 창립 멤버 타이틀을 드려요.</p>
            <div className="flex gap-2">
              <Link
                href={`/signup?next=${encodeURIComponent(`/areas/${slug}`)}`}
                className="flex-[1.5] flex items-center justify-center py-2.5 rounded-lg text-white text-[13px] font-bold press"
                style={{ background: "var(--color-primary)" }}
              >
                무료로 시작하기
              </Link>
              <Link
                href="/areas"
                className="flex-1 flex items-center justify-center py-2.5 rounded-lg text-[13px] font-bold press"
                style={{ background: "var(--color-gray-100)", color: "var(--color-text-main)" }}
              >
                서울 다른 구
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
                      {c.region ?? gu.name}
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

      {/* 동네 병원 */}
      {hospitalsRes.length > 0 && (
        <section className="px-5 mt-7">
          <h2 className="text-[17px] font-bold text-text-main mb-3 flex items-center gap-1.5">
            <Stethoscope size={15} className="text-text-light" />
            {gu.name} 구조동물 치료 병원
          </h2>
          <div className="rounded-xl" style={{ border: "1px solid var(--color-border)" }}>
            {hospitalsRes.map((h) => (
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

      {/* 주요 동네 */}
      <section className="px-5 mt-7 cv-auto">
        <h2 className="text-[17px] font-bold text-text-main mb-3">
          {gu.name} 주요 동네
        </h2>
        <div className="flex flex-wrap gap-1.5">
          {gu.dongs.slice(0, 20).map((d) => (
            <span
              key={d}
              className="text-[12px] font-medium px-2.5 py-1 text-text-sub"
              style={{ borderRadius: "var(--radius-square)", border: "1px solid var(--color-border)" }}
            >
              {d}
            </span>
          ))}
        </div>
      </section>

      {/* 다른 구로 이동 */}
      <section className="px-5 mt-8 cv-auto">
        <h2 className="text-[15px] font-bold text-text-main mb-2.5">
          다른 지역도 살펴보기
        </h2>
        <div className="grid grid-cols-3 gap-1.5">
          {SEOUL_GUS.filter((g) => g.slug !== gu.slug)
            .slice(0, 12)
            .map((g) => (
              <Link
                key={g.slug}
                href={`/areas/${g.slug}`}
                className="text-center py-2 rounded-lg text-[13px] font-semibold text-text-main press"
                style={{ border: "1px solid var(--color-border)" }}
              >
                {g.name}
              </Link>
            ))}
        </div>
        <Link
          href="/areas"
          className="block text-center text-[13px] font-bold mt-3"
          style={{ color: "var(--color-primary)" }}
        >
          전국 구·동별 길고양이 지도 →
        </Link>
      </section>

      {/* 하단 설명 (SEO 본문) */}
      <section className="px-5 mt-8 cv-auto">
        <div className="rounded-xl p-4" style={{ border: "1px solid var(--color-border)" }}>
          <p className="text-[13px] text-text-sub leading-relaxed">
            <b className="text-text-main">도시공존</b>은 {gu.name}을 포함한 전국 길고양이를 기록하고 돌보는 시민 참여 플랫폼입니다.
            길집사가 실시간으로 TNR 상태, 급식소 위치(비공개), 건강 상태를 공유하고,
            긴급 구조가 필요한 아이에게는 동네 이웃이 빠르게 달려갈 수 있도록 돕습니다.
            {gu.name} 주민이라면 회원가입 후 동네 고양이를 등록해주세요. 정확한 위치는 보안을 위해 공개되지 않습니다.
          </p>
        </div>
      </section>
    </div>
  );
}
