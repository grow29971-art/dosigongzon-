import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, Heart, PawPrint, Stethoscope, Phone, ChevronRight } from "lucide-react";
import { findGuBySlug } from "@/lib/seoul-regions";
import { sanitizeImageUrl } from "@/lib/url-validate";
import { createAnonClient } from "@/lib/supabase/anon";
import { catArtWalkSvg } from "@/lib/cat-art";

const SITE_URL = "https://dosigongzon.com";

// 동 이름이 한글(예: "역삼동")인데 Next.js ISR이 cache tag를 HTTP 헤더에 set하면서
// 비ASCII 문자로 인해 ERR_INVALID_CHAR 발생 → 24개 동이 5xx로 떨어졌음.
// force-dynamic으로 매 요청 SSR → cache tag 자체를 안 만들어 회피.
// 데이터는 항상 fresh, 매 요청 Supabase 쿼리 3건. 트래픽 적은 동별 페이지라 부담 작음.
export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string; dong: string }>;

type DongCat = {
  id: string;
  name: string;
  region: string | null;
  photo_url: string | null;
  like_count: number | null;
  health_status: string;
  created_at: string;
  description: string | null;
};
type DongHospital = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
};

// 한 쿼리가 실패해도 500으로 터지지 않도록 Promise.allSettled + try/catch.
// SSG/ISR에서 한 번 500이 나면 해당 URL이 stale한 500 상태로 캐시되어
// Google Search Console에 5xx 리포트가 남는다(실제로 2026-04 초 발견).
async function getDongData(guName: string, dongName: string) {
  try {
    const supabase = createAnonClient();
    const pattern = `%${dongName}%`;

    const [catsRes, countRes, hospitalsRes] = await Promise.allSettled([
      supabase
        .from("cats")
        .select("id, name, region, photo_url, like_count, health_status, created_at, description")
        .eq("hidden", false)
        .ilike("region", pattern)
        .order("created_at", { ascending: false })
        .limit(24),
      supabase
        .from("cats")
        .select("*", { count: "exact", head: true })
        .eq("hidden", false)
        .ilike("region", pattern),
      supabase
        .from("rescue_hospitals")
        .select("id, name, address, phone")
        .eq("district", guName)
        .eq("hidden", false)
        .order("pinned", { ascending: false })
        .limit(4),
    ]);

    const catsData =
      catsRes.status === "fulfilled" ? (catsRes.value.data as DongCat[] | null) : null;
    const countData = countRes.status === "fulfilled" ? countRes.value.count : null;
    const hospitalsData =
      hospitalsRes.status === "fulfilled"
        ? (hospitalsRes.value.data as DongHospital[] | null)
        : null;

    // 개별 에러 로깅 (Vercel 로그에서 원인 추적 가능)
    if (catsRes.status === "rejected") console.error("[dong] cats query failed", catsRes.reason);
    if (countRes.status === "rejected") console.error("[dong] count query failed", countRes.reason);
    if (hospitalsRes.status === "rejected") console.error("[dong] hospitals query failed", hospitalsRes.reason);

    return {
      cats: catsData ?? [],
      catCount: countData ?? 0,
      hospitals: hospitalsData ?? [],
    };
  } catch (err) {
    console.error("[dong] getDongData unexpected error", { guName, dongName, err });
    return { cats: [] as DongCat[], catCount: 0, hospitals: [] as DongHospital[] };
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug, dong } = await params;
  const dongName = decodeURIComponent(dong);
  const gu = findGuBySlug(slug);
  if (!gu || !gu.dongs.includes(dongName)) {
    return { title: "지역을 찾을 수 없어요", robots: { index: false, follow: false } };
  }

  const { catCount } = await getDongData(gu.name, dongName);
  const title = `${gu.name} ${dongName} 길고양이 돌봄 지도`;
  const description = catCount > 0
    ? `${gu.name} ${dongName}에 등록된 길고양이 ${catCount}마리의 돌봄 기록. 동네 길집사와 함께 TNR·구조·급식을 실시간 공유하는 도시공존.`
    : `${gu.name} ${dongName} 길고양이 돌봄 지도. 동네 첫 돌봄 기록을 남겨보세요.`;

  return {
    title,
    description,
    alternates: { canonical: `/areas/${slug}/${encodeURIComponent(dongName)}` },
    keywords: [
      `${dongName} 길고양이`,
      `${dongName} 길집사`,
      `${dongName} 고양이 구조`,
      `${gu.name} ${dongName}`,
      `${gu.name} 길고양이`,
      "서울 길고양이 지도",
      "도시공존",
    ],
    openGraph: {
      type: "website",
      title: `${title} | 도시공존`,
      description,
      url: `${SITE_URL}/areas/${slug}/${encodeURIComponent(dongName)}`,
      images: [{ url: `${SITE_URL}/opengraph-image`, width: 1200, height: 630 }],
    },
    // 고양이가 없는 동은 thin content → noindex (데이터 생기면 자동 index)
    robots: catCount === 0 ? { index: false, follow: true } : { index: true, follow: true },
  };
}

export default async function AreaDongPage({ params }: { params: Params }) {
  const { slug, dong } = await params;
  const dongName = decodeURIComponent(dong);
  const gu = findGuBySlug(slug);
  if (!gu || !gu.dongs.includes(dongName)) notFound();

  const { cats, catCount, hospitals } = await getDongData(gu.name, dongName);
  const urgent = cats.filter((c) => c.health_status === "danger").length;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Place",
    name: `${gu.name} ${dongName} 길고양이 돌봄 지도`,
    description: `${gu.name} ${dongName}에 등록된 길고양이 ${catCount}마리의 돌봄 기록`,
    url: `${SITE_URL}/areas/${slug}/${encodeURIComponent(dongName)}`,
    containedInPlace: [
      { "@type": "AdministrativeArea", name: gu.name },
      { "@type": "City", name: "서울특별시" },
    ],
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "서울", item: `${SITE_URL}/areas` },
      { "@type": "ListItem", position: 2, name: gu.name, item: `${SITE_URL}/areas/${slug}` },
      { "@type": "ListItem", position: 3, name: dongName, item: `${SITE_URL}/areas/${slug}/${encodeURIComponent(dongName)}` },
    ],
  };

  const otherDongs = gu.dongs.filter((d) => d !== dongName).slice(0, 12);

  return (
    <div className="min-h-dvh pb-16" style={{ background: "var(--color-surface)" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd).replace(/</g, "\\u003c") }} />

      <div className="px-4 pt-12 pb-2 flex items-center gap-2">
        <Link
          href={`/areas/${slug}`}
          className="w-9 h-9 rounded-full flex items-center justify-center press-strong"
          style={{ background: "var(--color-gray-100)" }}
          aria-label={`${gu.name}으로`}
        >
          <ArrowLeft size={18} className="text-text-main" />
        </Link>
        <span className="text-[13px] font-semibold text-text-sub">
          <Link href="/areas" className="hover:underline">서울</Link>
          {" · "}
          <Link href={`/areas/${slug}`} className="hover:underline">{gu.name}</Link>
        </span>
      </div>

      <section className="px-5 pt-4">
        <div className="flex items-center gap-1.5 mb-1.5">
          <MapPin size={14} className="text-text-light" />
          <span className="text-[13px] font-semibold text-text-sub">
            서울특별시 {gu.name} {dongName}
          </span>
        </div>
        <h1 className="text-[24px] font-bold text-text-main leading-tight tracking-tight">
          {dongName} 길고양이 돌봄 지도
        </h1>
        <p className="text-[15px] text-text-sub mt-2 leading-relaxed">
          {dongName}에 등록된 길고양이 <b style={{ color: "var(--color-primary)" }}>{catCount}마리</b>의 돌봄 기록.
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
      </section>

      {/* 고양이 그리드 */}
      <section className="px-5 mt-7">
        <h2 className="text-[17px] font-bold text-text-main mb-3 flex items-center gap-1.5">
          <Heart size={15} className="text-text-light" />
          {dongName} 고양이들
        </h2>
        {cats.length === 0 ? (
          <div className="rounded-xl p-5 text-center" style={{ border: "1px solid var(--color-border)" }}>
            <PawPrint size={28} className="mx-auto mb-2 text-text-light" aria-hidden />
            <p className="text-[15px] font-bold text-text-main leading-tight tracking-tight mb-1.5">
              {dongName}의 첫 번째 길집사가 되어주세요
            </p>
            <p className="text-[13px] text-text-sub leading-relaxed mb-4">아직 기록이 없어요. 지금 합류하면 창립 멤버 타이틀을 드려요.</p>
            <div className="flex gap-2">
              <Link
                href={`/signup?next=${encodeURIComponent(`/areas/${slug}/${encodeURIComponent(dongName)}`)}`}
                className="flex-[1.5] flex items-center justify-center py-2.5 rounded-lg text-white text-[13px] font-bold press"
                style={{ background: "var(--color-primary)" }}
              >
                무료로 시작하기
              </Link>
              <Link
                href={`/areas/${slug}`}
                className="flex-1 flex items-center justify-center py-2.5 rounded-lg text-[13px] font-bold press"
                style={{ background: "var(--color-gray-100)", color: "var(--color-text-main)" }}
              >
                {gu.name} 둘러보기
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
                      {c.region ?? dongName}
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

      {/* 주변 병원 (구 단위) */}
      {hospitals.length > 0 && (
        <section className="px-5 mt-7">
          <h2 className="text-[17px] font-bold text-text-main mb-3 flex items-center gap-1.5">
            <Stethoscope size={15} className="text-text-light" />
            {gu.name} 치료 병원
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
        </section>
      )}

      {/* 같은 구의 다른 동 */}
      {otherDongs.length > 0 && (
        <section className="px-5 mt-7">
          <h2 className="text-[15px] font-bold text-text-main mb-2.5">
            {gu.name} 다른 동네
          </h2>
          <div className="grid grid-cols-3 gap-1.5">
            {otherDongs.map((d) => (
              <Link
                key={d}
                href={`/areas/${slug}/${encodeURIComponent(d)}`}
                className="text-center py-2 rounded-lg text-[13px] font-semibold text-text-main press"
                style={{ border: "1px solid var(--color-border)" }}
              >
                {d}
              </Link>
            ))}
          </div>
          <Link
            href={`/areas/${slug}`}
            className="block text-center text-[13px] font-bold mt-3"
            style={{ color: "var(--color-primary)" }}
          >
            {gu.name} 전체 보기 →
          </Link>
        </section>
      )}

      {/* 하단 SEO 본문 */}
      <section className="px-5 mt-7">
        <div className="rounded-xl p-4" style={{ border: "1px solid var(--color-border)" }}>
          <p className="text-[13px] text-text-sub leading-relaxed">
            <b className="text-text-main">도시공존</b>은 {gu.name} {dongName}을 포함한
            전국 길고양이를 기록하고 돌보는 시민 참여 플랫폼입니다.
            {dongName} 주민이라면 회원가입 후 동네 고양이를 등록해주세요.
            정확한 급식소 위치는 길고양이 안전을 위해 공개되지 않으며,
            긴급 구조가 필요한 아이에게는 동네 이웃이 빠르게 달려갈 수 있도록 돕습니다.
          </p>
        </div>
      </section>
    </div>
  );
}
