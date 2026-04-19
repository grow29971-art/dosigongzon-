import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, Heart, PawPrint, Stethoscope } from "lucide-react";
import { SEOUL_GUS, findGuBySlug } from "@/lib/seoul-regions";
import { sanitizeImageUrl } from "@/lib/url-validate";
import { createAnonClient } from "@/lib/supabase/anon";
import { HEALTH_MAP } from "@/lib/cats-repo";

const SITE_URL = "https://dosigongzon.com";

export const revalidate = 3600;

type Params = Promise<{ slug: string; dong: string }>;

/**
 * 구·동 정적 파라미터 생성. 400여 페이지가 생기지만 Next.js가 lazy + ISR로 처리.
 */
export async function generateStaticParams() {
  return SEOUL_GUS.flatMap((g) =>
    g.dongs.map((d) => ({ slug: g.slug, dong: d })),
  );
}

async function getDongData(guName: string, dongName: string) {
  const supabase = createAnonClient();
  const pattern = `%${dongName}%`;

  const [catsRes, countRes, hospitalsRes] = await Promise.all([
    supabase
      .from("cats")
      .select("id, name, region, photo_url, like_count, health_status, created_at, description")
      .ilike("region", pattern)
      .order("created_at", { ascending: false })
      .limit(24),
    supabase
      .from("cats")
      .select("*", { count: "exact", head: true })
      .ilike("region", pattern),
    supabase
      .from("rescue_hospitals")
      .select("id, name, address, phone")
      .eq("district", guName)
      .eq("hidden", false)
      .order("pinned", { ascending: false })
      .limit(4),
  ]);

  return {
    cats: (catsRes.data ?? []) as Array<{
      id: string;
      name: string;
      region: string | null;
      photo_url: string | null;
      like_count: number | null;
      health_status: string;
      created_at: string;
      description: string | null;
    }>,
    catCount: countRes.count ?? 0,
    hospitals: (hospitalsRes.data ?? []) as Array<{
      id: string;
      name: string;
      address: string | null;
      phone: string | null;
    }>,
  };
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
    ? `${gu.name} ${dongName}에 등록된 길고양이 ${catCount}마리의 돌봄 기록. 동네 캣맘·캣대디와 함께 TNR·구조·급식을 실시간 공유하는 도시공존.`
    : `${gu.name} ${dongName} 길고양이 돌봄 지도. 동네 첫 돌봄 기록을 남겨보세요.`;

  return {
    title,
    description,
    alternates: { canonical: `/areas/${slug}/${encodeURIComponent(dongName)}` },
    keywords: [
      `${dongName} 길고양이`,
      `${dongName} 캣맘`,
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
    <div className="min-h-dvh pb-16" style={{ background: "#F7F4EE" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />

      <div className="px-4 pt-12 pb-2 flex items-center gap-2">
        <Link
          href={`/areas/${slug}`}
          className="w-9 h-9 rounded-full bg-white flex items-center justify-center active:scale-90"
          style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}
          aria-label={`${gu.name}으로`}
        >
          <ArrowLeft size={18} className="text-text-main" />
        </Link>
        <span className="text-[12px] font-semibold text-text-sub">
          <Link href="/areas" className="hover:underline">서울</Link>
          {" · "}
          <Link href={`/areas/${slug}`} className="hover:underline">{gu.name}</Link>
        </span>
      </div>

      <section className="px-5 pt-4">
        <div className="flex items-center gap-1.5 mb-1.5">
          <MapPin size={14} style={{ color: "#C47E5A" }} />
          <span className="text-[11.5px] font-bold" style={{ color: "#C47E5A" }}>
            서울특별시 {gu.name} {dongName}
          </span>
        </div>
        <h1 className="text-[25px] font-extrabold text-text-main leading-tight tracking-tight">
          {dongName} 길고양이 돌봄 지도
        </h1>
        <p className="text-[13.5px] text-text-sub mt-2 leading-relaxed">
          {dongName}에 등록된 길고양이 <b style={{ color: "#C47E5A" }}>{catCount}마리</b>의 돌봄 기록.
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
      </section>

      {/* 고양이 그리드 */}
      <section className="px-5 mt-7">
        <h2 className="text-[16px] font-extrabold text-text-main mb-3 flex items-center gap-1.5">
          <Heart size={15} style={{ color: "#E86B8C" }} />
          {dongName} 고양이들
        </h2>
        {cats.length === 0 ? (
          <div className="py-10 text-center text-[13px] text-text-light bg-white rounded-2xl" style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}>
            아직 {dongName}에 등록된 아이가 없어요.
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
                  <div
                    className="relative"
                    style={{
                      aspectRatio: "1 / 1",
                      backgroundImage: `url('${photo}')`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  >
                    {urgent && (
                      <span
                        className="absolute top-2 left-2 text-[10px] font-extrabold px-2 py-0.5 rounded-lg text-white"
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
                      <span className="text-[10.5px] text-text-sub truncate">{c.region ?? dongName}</span>
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

      {/* 주변 병원 (구 단위) */}
      {hospitals.length > 0 && (
        <section className="px-5 mt-7">
          <h2 className="text-[16px] font-extrabold text-text-main mb-3 flex items-center gap-1.5">
            <Stethoscope size={15} style={{ color: "#22B573" }} />
            {gu.name} 치료 병원
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
        </section>
      )}

      {/* 같은 구의 다른 동 */}
      {otherDongs.length > 0 && (
        <section className="px-5 mt-7">
          <h2 className="text-[14px] font-extrabold text-text-main mb-2.5">
            {gu.name} 다른 동네
          </h2>
          <div className="grid grid-cols-3 gap-1.5">
            {otherDongs.map((d) => (
              <Link
                key={d}
                href={`/areas/${slug}/${encodeURIComponent(d)}`}
                className="text-center py-2 rounded-xl bg-white text-[12px] font-bold active:scale-95 transition-transform"
                style={{ color: "#6B5043", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
              >
                {d}
              </Link>
            ))}
          </div>
          <Link
            href={`/areas/${slug}`}
            className="block text-center text-[12px] font-bold mt-3"
            style={{ color: "#C47E5A" }}
          >
            {gu.name} 전체 보기 →
          </Link>
        </section>
      )}

      {/* 하단 SEO 본문 */}
      <section className="px-5 mt-7">
        <div className="bg-white rounded-2xl p-4" style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}>
          <p className="text-[12.5px] text-text-sub leading-relaxed">
            <b className="text-text-main">도시공존</b>은 서울 {gu.name} {dongName}을 포함한
            서울 전역의 길고양이를 기록하고 돌보는 시민 참여 플랫폼입니다.
            {dongName} 주민이라면 회원가입 후 동네 고양이를 등록해주세요.
            정확한 급식소 위치는 길고양이 안전을 위해 공개되지 않으며,
            긴급 구조가 필요한 아이에게는 동네 이웃이 빠르게 달려갈 수 있도록 돕습니다.
          </p>
        </div>
      </section>
    </div>
  );
}
