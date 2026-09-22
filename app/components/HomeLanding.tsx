// SEO 랜딩 — 비로그인 방문자 + 크롤러 + 소셜 스크랩 대상
// 서버 컴포넌트로 풍부한 HTML을 첫 바이트에 실어 보냄.
// 2026-09-16 「익숙한 동네앱」 리디자인(결정 0007): 색 카드·그라디언트·세리프 인용·틴트 아이콘 박스를
// 걷어내고 흰 면 + 헤어라인 섹션 + 구분선 리스트로. h1·JSON-LD·FAQ 본문(SEO)은 문자 그대로 유지.

import Link from "next/link";
import { unstable_cache } from "next/cache";
import { thumbnailUrl } from "@/lib/cats-repo";
import { catArtWalkSvg } from "@/lib/cat-art";
import CatSpotlightRow, { type SpotlightCat } from "@/app/components/CatSpotlightRow";
import { MapPin, Heart, ShieldCheck, ChevronRight, PawPrint, Bell, Download, BriefcaseMedical, Cat as CatIcon, Stethoscope, Pill, Utensils, Home as HomeIcon, Hand, Code2, Bot, Lock, Radio, Mail, Dices, Ghost, Ban, Camera, FileText, BadgeCheck } from "lucide-react";
import { createAnonClient } from "@/lib/supabase/anon";
import { SEOUL_GUS } from "@/lib/seoul-regions";
import { getGuCounts } from "@/lib/region-counts";
import { sanitizeImageUrl } from "@/lib/url-validate";
import AboutCityCard from "@/app/components/AboutCityCard";
import PageIntroModal from "@/app/components/PageIntroModal";
import { listPublishedTipsServer, type Tip } from "@/lib/tips-repo";
import { getTopCaretakersServer, type RankingRow } from "@/lib/ranking-repo";
import { getActiveRegionsTop3 } from "@/lib/region-activity";
import LandingOnboardingGate from "@/app/components/LandingOnboardingGate";
import ShareAreaButton from "@/app/components/ShareAreaButton";
import TodayVisitors from "@/app/components/TodayVisitors";
import SocialProofStrip from "@/app/components/SocialProofStrip";

// 활동 길집사 TOP 3 — 광고 LP에 강력한 사회적 증명. 10분 캐시(egress 절감).
const getCachedTopCaretakers = unstable_cache(
  async (): Promise<RankingRow[]> => getTopCaretakersServer(3),
  ["landing-top-caretakers"],
  { revalidate: 600, tags: ["landing-top-caretakers"] },
);

const SITE_URL = "https://dosigongzon.com";

// 앱/난로/쉼터 3카드 소개 블록 — 2026-09-02 유입 급증 대응으로 숨김(첫인상=라이브 활동 우선)
const SHOW_ABOUT_PILLARS = false;
// 2026-09-18 랜딩 다이어트 — 21섹션·10화면·가입 CTA 4개였다. 첫 방문자 동선(스포트라이트·히어로·안전·시작법·
// 최근 등록·동네·FAQ·만든 사람)만 남기고 나머지는 이 플래그로 숨김(삭제 아님).
const SHOW_LANDING_EXTRAS = false;
// 2026-09-22 디자인 감사(taste-skill 밀도 규칙): 랜딩은 첫인상이다. 기술 용어 5줄(RLS·EXIF·WebP)·3단계 안내·특징 4줄은 히어로와 중복 → 숨김.
// 위치 보호는 두 줄 요약 + FAQ 링크로 대체. 되살리려면 플래그만 true.
const SHOW_SAFETY_DETAIL = false;
const SHOW_START_STEPS = false;
const SHOW_WHY_SECTION = false;

// 공용 스타일 — 흰 면 + 1px 헤어라인 섹션 컨테이너 (그림자 없음)
const PANEL: React.CSSProperties = {
  background: "var(--color-surface)",
  borderRadius: "var(--radius-card)",
  border: "1px solid var(--color-border)",
};
const ROW_DIVIDER = "1px solid var(--color-divider)";

// 골든존 스포트라이트: 최소 필드만(SpotlightCat) — 좌표·지역 등 위치 정보는 아예 조회하지 않는다(프라이버시)
async function getLandingData() {
  try {
    const supabase = createAnonClient();
    const [catsRpcRes, recentCatsRes, hospitalsRes, profilesRes, guCounts, alertCatsRes, fillCatsRes] = await Promise.all([
      // visibility 무관 전체 카운트 (RPC SECURITY DEFINER) — private도 통계에는 포함
      supabase.rpc("total_cat_count"),
      supabase
        .from("cats")
        .select("id, name, region, photo_url, health_status, created_at")
        .order("created_at", { ascending: false })
        .limit(6),
      supabase.from("rescue_hospitals").select("*", { count: "exact", head: true }).eq("hidden", false),
      supabase.from("profiles_public").select("id", { count: "exact", head: true }),
      getGuCounts(),
      // 골든존 스포트라이트 — cats_public_map 뷰 사용 (public·비숨김·고양이별 제외가 뷰에 내장).
      // base cats에 memorial_at 필터를 걸면 anon은 컬럼 권한(42501)으로 거부된다 — 좌표 잠금 계약.
      // ① 위험·주의 우선 (사진 있는 아이만)
      supabase
        .from("cats_public_map")
        .select("id, name, photo_url, health_status")
        .in("health_status", ["danger", "caution"])
        .not("photo_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(12),
      // ② 나머지는 최근 등록순으로 채움
      supabase
        .from("cats_public_map")
        .select("id, name, photo_url, health_status")
        .eq("health_status", "good")
        .not("photo_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(12),
    ]);

    // 위험 → 주의 → 최근 등록 순으로 12마리
    const alerts = ((alertCatsRes.data ?? []) as SpotlightCat[]).sort(
      (a, b) => (a.health_status === "danger" ? 0 : 1) - (b.health_status === "danger" ? 0 : 1),
    );
    const spotlightCats = [...alerts, ...((fillCatsRes.data ?? []) as SpotlightCat[])].slice(0, 12);

    return {
      catCount: Number(catsRpcRes.data ?? 0),
      hospitalCount: hospitalsRes.count ?? 0,
      userCount: profilesRes.count ?? 0,
      recentCats: (recentCatsRes.data ?? []) as Array<{
        id: string;
        name: string;
        region: string | null;
        photo_url: string | null;
        health_status: string;
        created_at: string;
      }>,
      guCounts,
      spotlightCats,
    };
  } catch {
    return { catCount: 0, hospitalCount: 0, userCount: 0, recentCats: [], guCounts: {}, spotlightCats: [] as SpotlightCat[] };
  }
}

export default async function HomeLanding({
  hotSlot,
  adoptionSlot,
  eventSlot,
}: { hotSlot?: React.ReactNode; adoptionSlot?: React.ReactNode; eventSlot?: React.ReactNode } = {}) {
  const [data, tips, topCaretakers, activeRegions] = await Promise.all([
    getLandingData(),
    listPublishedTipsServer(6),
    getCachedTopCaretakers(),
    getActiveRegionsTop3(),
  ]);
  // 등록 고양이 상위 6개 구. 데이터 없으면 인구 많은 대표 구 폴백.
  const FALLBACK_FEATURED = ["gangnam", "mapo", "songpa", "yongsan", "seongdong", "gwanak"];
  const sortedSlugs = Object.entries(data.guCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([slug]) => slug);
  const featuredSlugs = sortedSlugs.length >= 6 ? sortedSlugs.slice(0, 6) : FALLBACK_FEATURED;
  const featured = featuredSlugs
    .map((s) => SEOUL_GUS.find((g) => g.slug === s))
    .filter((g): g is (typeof SEOUL_GUS)[number] => Boolean(g));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "도시공존",
    url: SITE_URL,
    description: "길고양이 돌봄 시민 참여 플랫폼. 전국 TNR·돌봄·구조 기록을 지도 위에서 함께 남깁니다.",
    applicationCategory: "SocialNetworkingApplication",
    operatingSystem: "Web, iOS, Android (PWA)",
    offers: { "@type": "Offer", price: "0", priceCurrency: "KRW" },
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "도시공존은 무엇인가요?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "전국 길고양이를 시민이 함께 기록하고 돌보는 시민 참여 플랫폼입니다. 길집사가 지도 위에 TNR·급식·건강 기록을 남기고, 긴급 구조가 필요한 아이에게 이웃이 빠르게 닿을 수 있게 돕습니다.",
        },
      },
      {
        "@type": "Question",
        name: "급식소 정확한 위치가 공개되나요?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "공개되지 않습니다. 길고양이 안전을 위해 정확한 좌표는 로그인 유저에게만 근사치로 제공되며, 일반 랜딩에서는 구·동 단위로만 표시됩니다.",
        },
      },
      {
        "@type": "Question",
        name: "무료인가요?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "네. 광고 없이 무료로 운영되며 이익을 목적으로 하지 않습니다. 전국 시민의 자발적 기록으로 유지됩니다.",
        },
      },
      {
        "@type": "Question",
        name: "어떤 브라우저에서 쓸 수 있나요?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "크롬·사파리·엣지 등 일반 모바일/PC 브라우저에서 작동하며, 홈 화면에 추가하면 PWA 앱처럼 사용할 수 있습니다. 카카오톡 등 인앱 브라우저에서는 소셜 로그인이 제한됩니다.",
        },
      },
    ],
  };

  return (
    <div className="pb-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c") }} />
      <LandingOnboardingGate />

      <PageIntroModal
        storageKey="dosigongzon_intro_landing"
        badge="도시공존"
        headerEmoji=""
        title="우리 동네 길고양이를 함께 돌봐요"
        items={[
          { emoji: "", text: <>지도에서 우리 동네 길고양이를 만나고, 밥·건강을 함께 기록해요.</> },
          { emoji: "", text: <>쇼핑 수익 일부는 아이들에게 — <b className="text-text-main">사용처는 함께 투표</b>로 정해요.</> },
          { emoji: "", text: <>가입은 무료예요. 우리 동네부터 시작해보세요.</> },
        ]}
        buttonLabel="둘러보기"
      />

      {/* 도시공존 소개(앱/난로/쉼터 3카드) — 2026-09-02 유입 급증 대응으로 숨김:
          첫인상을 카탈로그가 아니라 라이브 활동(LIVE 스트립+CTA)으로. 복원 시 플래그만 켜면 됨 */}
      {SHOW_ABOUT_PILLARS && (
        <div className="px-5 pt-14 pb-1">
          {/* 보신각 집회 배너는 행사 종료로 내림 (2026-08-08) */}
          <AboutCityCard className="mb-0" />
        </div>
      )}

      {/* 골든존 — 고양이 얼굴 12마리 가로 스크롤 + 하트(STEP1·2, 2026-09-02).
          정렬: 위험 → 주의 → 최근 등록. 위치·좌표는 조회조차 안 함(프라이버시). */}
      {data.spotlightCats.length > 0 && (
        <CatSpotlightRow cats={data.spotlightCats} className="pt-14 pb-2" />
      )}

      {/* 히어로 */}
      <section className={`px-5 ${SHOW_ABOUT_PILLARS || data.spotlightCats.length > 0 ? "pt-6" : "pt-14"} pb-8`}>
        <p className="text-[13px] font-medium text-text-light mb-2">
          전국 · {data.userCount > 0
            ? `${data.userCount.toLocaleString()}명의 길집사`
            : "길집사 시민 참여 플랫폼"}
        </p>
        <h1 className="text-[24px] font-bold text-text-main leading-[1.3] tracking-tight">
          전국 길고양이 <span className="text-primary">{data.catCount.toLocaleString()}마리</span>,<br />
          <span className="text-primary">한 화면에서 함께 돌봐요.</span>
        </h1>
        <p className="text-[15px] text-text-sub mt-3 leading-relaxed">
          길집사가 길고양이의
          <b className="font-semibold text-text-main"> TNR·건강·급식</b> 기록을 실시간으로 남기고,
          긴급한 아이를 동네 이웃과 빠르게 잇는 전국 길고양이 돌봄 지도예요.
        </p>
        <p className="text-[13px] mt-2 leading-relaxed text-text-light">
          급식소 정확 좌표는 비공개 · 광고 없는 무료 운영 · PWA 지원
        </p>

        {/* 방문자 수 실시간 (client) */}
        <TodayVisitors />

        {/* 사회적 증명 — 오늘 활동 유저 + 이번 주 신규 */}
        <SocialProofStrip />

        {/* CTA — primary + secondary */}
        <div className="flex gap-2 mt-5">
          <Link
            href="/map"
            className="flex-[1.4] h-12 flex items-center justify-center gap-1.5 press transition-transform"
            style={{
              borderRadius: "var(--radius-input)",
              background: "var(--color-primary)",
              color: "var(--color-surface)",
            }}
          >
            <PawPrint size={16} />
            <span className="text-[15px] font-semibold">우리 동네 고양이 보기</span>
          </Link>
          <Link
            href="/signup"
            className="flex-1 h-12 flex items-center justify-center press transition-transform"
            style={{
              borderRadius: "var(--radius-input)",
              background: "var(--color-gray-100)",
              color: "var(--color-text-main)",
            }}
          >
            <span className="text-[15px] font-semibold">1초 가입하기</span>
          </Link>
        </div>
        <p className="mt-2 text-center text-[11px] text-text-light">
          {/* 같은 페이지 아래(:606)에 "1초 가입"이 있어 숫자가 서로 달랐다.
              카카오·구글 OAuth 한 번이므로 그쪽에 맞춘다. (2026-08-09) */}
          1초 가입 · 광고 없는 무료 운영
        </p>

        {/* 처음이신가요? 가이드 링크 */}
        <Link
          href="/guide"
          className="mt-3 flex items-center justify-center gap-0.5 text-[13px] font-medium press transition-transform"
          style={{ color: "var(--color-text-sub)" }}
        >
          <span>처음이신가요? 10가지 기능 한눈에 보기</span>
          <ChevronRight size={14} />
        </Link>
      </section>

      {/* 2026-09-18 랜딩 다이어트(UX 감사 5번) — 숨김: 왜 돌봐야 하나·활발한 동네 */}
      {SHOW_LANDING_EXTRAS && (<>
      {/* 왜 길고양이를 돌봐야 하나 — 히어로 직후 최상단. 비길집사 도시민 어필 핵심. */}
      <section className="px-5 mt-8">
        <h2 className="text-[20px] font-bold text-text-main leading-snug tracking-tight mb-1">
          왜 함께 돌봐야 할까요?
        </h2>
        <p className="text-[13px] text-text-sub mb-3 leading-relaxed">
          관리되는 길고양이 한 마리가 동네 전체의 평화를 바꿔요.
        </p>

        <div style={PANEL}>
          <ol>
            <li className="flex items-start gap-3 px-4 py-3.5">
              <span className="shrink-0 w-6 text-[15px] font-bold text-text-light tabular-nums">01</span>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-semibold text-text-main leading-snug">
                  쓰레기봉투를 안 찢어요
                </p>
                <p className="text-[13px] text-text-sub leading-relaxed mt-0.5">
                  꾸준한 급식으로 음식물 쓰레기를 뒤지지 않아요.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3 px-4 py-3.5" style={{ borderTop: ROW_DIVIDER }}>
              <span className="shrink-0 w-6 text-[15px] font-bold text-text-light tabular-nums">02</span>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-semibold text-text-main leading-snug">
                  자동차 안에 들어가지 않아요
                </p>
                <p className="text-[13px] text-text-sub leading-relaxed mt-0.5">
                  안전한 쉼터가 있으면 차 엔진룸에 숨지 않아요.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3 px-4 py-3.5" style={{ borderTop: ROW_DIVIDER }}>
              <span className="shrink-0 w-6 text-[15px] font-bold text-text-light tabular-nums">03</span>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-semibold text-text-main leading-snug">
                  울음소리가 줄어들어요
                </p>
                <p className="text-[13px] text-text-sub leading-relaxed mt-0.5">
                  TNR(중성화)로 발정기 울음과 영역 다툼이 사라져요.
                </p>
              </div>
            </li>
          </ol>

          {/* 풋터 메시지 */}
          <div className="px-4 py-3" style={{ borderTop: ROW_DIVIDER, background: "var(--color-gray-50)" }}>
            <p className="text-[13px] font-semibold text-text-main leading-relaxed">
              관리는 곧 도시의 평화입니다.
            </p>
            <p className="text-[13px] text-text-sub mt-0.5 leading-relaxed">
              도시공존은 그 관리를 <b className="font-semibold text-text-main">시민이 함께</b> 합니다.
            </p>
          </div>
        </div>
      </section>

      {/* 지금 활발한 동네 TOP 3 — 사회적 증명 + 지역 호기심 자극 */}
      {activeRegions.length > 0 && (
        <section className="px-5 mt-10">
          <SectionHeader title="지금 활발한 동네" desc="이번 주 새 친구·길집사·치료 병원이 가장 많이 모이는 동네예요." />
          <div style={PANEL}>
            {activeRegions.map((r, idx) => (
              <Link
                key={r.slug}
                href={`/areas/${r.slug}`}
                className="flex items-center gap-3 px-4 press transition-transform"
                style={{ minHeight: 64, borderTop: idx > 0 ? ROW_DIVIDER : "none" }}
              >
                <span
                  className="shrink-0 w-6 text-[17px] font-bold tabular-nums"
                  style={{ color: idx === 0 ? "var(--color-primary)" : "var(--color-text-light)" }}
                >
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0 py-3">
                  <p className="text-[15px] font-semibold text-text-main leading-snug">{r.name}</p>
                  <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-0.5 text-[13px] text-text-sub">
                    {r.recentCats > 0 && (
                      <span>이번 주 +{r.recentCats}마리</span>
                    )}
                    {r.activeCaretakers > 0 && (
                      <>
                        <span className="text-text-muted">·</span>
                        <span>길집사 {r.activeCaretakers}명</span>
                      </>
                    )}
                    {r.hospitals > 0 && (
                      <>
                        <span className="text-text-muted">·</span>
                        <span>병원 {r.hospitals}곳</span>
                      </>
                    )}
                    {r.totalCats > 0 && (
                      <>
                        <span className="text-text-muted">·</span>
                        <span className="text-text-light">누적 {r.totalCats.toLocaleString()}</span>
                      </>
                    )}
                  </div>
                </div>
                <ChevronRight size={18} className="shrink-0" style={{ color: "var(--color-text-muted)" }} />
              </Link>
            ))}
          </div>
        </section>
      )}

      </>)}
      {/* 안전 정책 — 가입 직전 신뢰 봉합. 학대 우려 길집사 대상 핵심 메시지. */}
      <section className="px-5 mt-10">
        <SectionHeader title="고양이 위치, 어떻게 지키나요?" />

        {/* 핵심 메시지 */}
        <div className="p-4 mb-3 flex items-start gap-3" style={PANEL}>
          <ShieldCheck size={22} className="shrink-0 mt-0.5" style={{ color: "var(--color-text-sub)" }} strokeWidth={1.8} />
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-text-main leading-snug mb-1">
              정확한 자리는 누구도 모릅니다
            </p>
            <p className="text-[13px] text-text-sub leading-relaxed">
              등록할 때부터 좌표를 흐려서 저장하고, 사진의 위치 정보는 지웁니다.
              걱정되는 아이는 내가 승인한 이웃에게만 보이게 할 수 있어요.
            </p>
          </div>
        </div>
        {!SHOW_SAFETY_DETAIL && <TextLink href="/faq" label="위치 보호 방식 자세히 보기" />}
        {SHOW_SAFETY_DETAIL && (<>

        {/* Private Circle — 가장 강한 신뢰 도구. 학대 공포 원천 차단. */}
        <div className="mb-3 overflow-hidden" style={PANEL}>
          <div className="p-4">
            {/* 가입 전 방문자에게 "이 앱 가입자 중에 학대자가 있다"는 공포를 먼저 심으면
                전환을 스스로 깎는다. 같은 기능을 위협이 아니라 통제권으로 설명한다. (2026-08-07) */}
            <p className="text-[15px] font-semibold text-text-main leading-snug mb-1">
              위치를 아무에게나 보이고 싶지 않은 아이가 있어요
            </p>
            <p className="text-[13px] text-text-sub leading-relaxed">
              그럴 때 쓰는 게 <b className="font-semibold text-text-main">우리동네 길집사</b>입니다.
              걱정되는 아이는 <b className="font-semibold text-text-main">"내 서클"</b>로 설정하면,
              내가 직접 승인한 이웃에게만 보입니다.
            </p>
            <p className="text-[13px] text-text-sub leading-relaxed mt-2">
              일반 가입자에게도 보이지 않고, 외부인에게는 존재 자체가 노출되지 않습니다.
            </p>
          </div>
          <div className="px-4 py-2.5 flex items-center gap-2" style={{ borderTop: ROW_DIVIDER, background: "var(--color-gray-50)" }}>
            <span className="text-[11px] text-text-light flex-1">
              등록 시 공개 범위 3단계 · 마이페이지에서 서클 관리
            </span>
            <span
              className="text-[11px] font-medium px-1.5 py-0.5 text-text-sub"
              style={{ borderRadius: "var(--radius-square)", border: "1px solid var(--color-border)" }}
            >
              가입 후 사용
            </span>
          </div>
        </div>

        {/* 5개 보호 레이어 — 구분선 리스트 */}
        <div className="mb-3" style={PANEL}>
          <SafetyRow
            icon={<Dices size={20} />}
            title="등록 시 좌표 자체를 흐리게"
            body="같은 자리를 두 번 찍어도 매번 다른 값으로 저장돼요. 본인도 역추적 불가."
          />
          <SafetyRow
            icon={<Ghost size={20} />}
            title="비로그인 외부인 = 도트와 카운트만"
            body="사진·이름·동 이름 일절 비공개. 동 단위 N마리 신호만 노출."
          />
          <SafetyRow
            icon={<Ban size={20} />}
            title="위치 단어 자동 차단"
            body="역·출구·시장·공원·아파트·도로명·학교 등 11종 패턴 등록 차단."
          />
          <SafetyRow
            icon={<Camera size={20} />}
            title="사진 GPS 메타데이터 자동 제거"
            body="업로드 시 WebP 재인코딩으로 EXIF 전부 삭제. 좌표 추출 불가."
          />
          <SafetyRow
            icon={<Lock size={20} />}
            title="DB 권한 격리 (RLS)"
            body="본인이 등록한 핀만 수정·삭제. 코드 우회 시도도 DB가 거부."
          />
        </div>

        {/* 정직한 한계 + 철학 */}
        <div className="p-4 mb-3" style={PANEL}>
          <p className="text-[13px] text-text-sub leading-relaxed">
            <b className="font-semibold text-text-main">한계도 솔직히 말씀드려요.</b> 100% 안전은 없습니다.
            하지만 학대자들은 도시공존이 있든 없든 골목을 답사합니다.
            가장 위험한 환경은 <b className="font-semibold text-text-main">동네가 무관심한 상태</b>예요.
          </p>
          <p className="text-[13px] text-text-sub leading-relaxed mt-2">
            <b className="font-semibold text-text-main">길집사와 시민의 시선이 모이는 것</b> — 그게 학대자에게 가장
            강한 억제력입니다. 도시공존은 그 시선을 모으려고 만들어진 도구예요.
          </p>
        </div>
        </>)}

      </section>

      {/* 이렇게 시작해보세요 — 3단계 액션 가이드 */}
      {SHOW_START_STEPS && (
      <section className="px-5 mt-10">
        <SectionHeader title="이렇게 시작해보세요" desc="처음이라도 괜찮아요. 1분이면 첫 한 줄을 남길 수 있어요." />
        <div style={PANEL}>
          <StartStep
            n={1}
            href="/signup"
            title="1초 가입 — 카카오·구글로"
            desc="이메일 따로 안 적어도 돼요. 닉네임만 정하면 끝."
          />
          <StartStep
            n={2}
            href="/map"
            title="우리 동네 지도에서 아이들 찾기"
            desc="구·동을 누르면 그 동네 길고양이만 모아 보여줘요."
          />
          <StartStep
            n={3}
            href="/map"
            title="오른쪽 + 버튼으로 첫 한 줄 남기기"
            desc="사진·이름·건강 상태 한 번에. 위치는 자동으로 흐리게 처리돼요."
          />
        </div>
        <TextLink href="/guide" label="10가지 기능 한 화면에서 보기" />
      </section>
      )}

      {/* 1000명 이벤트 배너 — 가입 전환 강력 트리거 */}
      {eventSlot}

      {/* 2026-09-18 랜딩 다이어트(UX 감사 5번) — 숨김: 길집사 TOP3·인용문 */}
      {SHOW_LANDING_EXTRAS && (<>
      {/* 이번 주 활동 길집사 TOP 3 — 살아있는 커뮤니티 사회적 증명 */}
      {topCaretakers.length > 0 && (
        <section className="px-5 mt-6">
          <SectionHeader title="이번 주 활동 길집사 TOP 3" desc="지금 실제로 동네 길고양이를 돌보고 있는 분들이에요." />
          <div style={PANEL}>
            {topCaretakers.map((c, idx) => (
              <Link
                key={c.user_id}
                href="/ranking"
                className="flex items-center gap-3 px-4 press transition-transform"
                style={{ minHeight: 60, borderTop: idx > 0 ? ROW_DIVIDER : "none" }}
              >
                <span
                  className="shrink-0 w-6 text-[17px] font-bold tabular-nums"
                  style={{ color: idx === 0 ? "var(--color-primary)" : "var(--color-text-light)" }}
                >
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0 py-3">
                  <p className="text-[15px] font-semibold text-text-main truncate leading-snug">
                    {c.nickname || "익명 길집사"}
                  </p>
                  <p className="text-[13px] text-text-sub mt-0.5">
                    {c.cat_count}마리 · 돌봄 {c.care_count}회 · {c.score}점
                  </p>
                </div>
                <ChevronRight size={18} className="shrink-0" style={{ color: "var(--color-text-muted)" }} />
              </Link>
            ))}
          </div>
          <TextLink href="/ranking" label="전체 랭킹 보기" />
        </section>
      )}

      {/* 인용 — 철학적 질문 */}
      <section className="px-5 mt-8">
        <div className="px-5 py-5" style={PANEL}>
          <p className="text-[15px] leading-[1.8] text-text-main">
            우리는 <b className="font-semibold text-primary">길 위의 아이들</b>의 삶을
            <br />
            얼마나 이해하고 있을까요?
            <br />
            <span className="text-text-sub">
              사실, 우리는 잘 모릅니다.
            </span>
          </p>
          <p className="text-[13px] leading-relaxed text-text-sub mt-4">
            어느 골목에서 자는지, 오늘 밥은 먹었는지,
            <br />
            몇 마리가 한 가족인지도 모릅니다.
            <br />
            그래서 <b className="font-semibold text-text-main">서로의 눈</b>이 되어,
            <br />
            한 줄씩 기록을 나눠요.
          </p>
          <p className="text-[13px] leading-relaxed text-text-sub mt-4">
            누군가 그들을 <b className="font-semibold text-text-main">해치려 할 때</b>
            <br />
            먼저 알아차릴 수 있는 건
            <br />
            매일 얼굴을 아는 이웃뿐이에요.
            <br />
            <span className="text-text-main">
              작은 기록 한 줄이, 어느 날 아이를 지키는 단서가 됩니다.
            </span>
          </p>
          <p className="text-[11px] font-medium mt-4 text-text-light">
            — 도시공존
          </p>
        </div>
      </section>

      </>)}
      {/* 최근 등록된 고양이들 */}
      {data.recentCats.length > 0 && (
        <section className="px-5 mt-6 cv-auto">
          <SectionHeader title="최근 등록된 아이들" moreHref="/map" />
          <div className="grid grid-cols-2 gap-2">
            {data.recentCats.slice(0, 4).map((c) => {
              const safe = sanitizeImageUrl(c.photo_url, "");
              const photo = safe ? thumbnailUrl(safe, 400) ?? safe : "";
              const urgent = c.health_status === "danger";
              return (
                <Link
                  key={c.id}
                  href={`/cats/${c.id}`}
                  className="block overflow-hidden press transition-transform"
                  style={PANEL}
                >
                  <div className="relative" style={{ aspectRatio: "4/3", background: "var(--color-surface-alt)" }}>
                    {photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={photo}
                        alt={c.name}
                        loading="lazy"
                        decoding="async"
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ) : (
                      <div
                        aria-hidden="true"
                        className="absolute inset-0 flex items-center justify-center"
                        dangerouslySetInnerHTML={{ __html: catArtWalkSvg(c.id, 72, { walking: false }) }}
                      />
                    )}
                    {urgent && (
                      <span
                        className="absolute top-2 left-2 text-[11px] font-semibold px-1.5 py-0.5"
                        style={{ borderRadius: "var(--radius-square)", background: "var(--color-error)", color: "var(--color-surface)" }}
                      >
                        긴급
                      </span>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-[15px] font-semibold text-text-main truncate leading-snug">{c.name}</p>
                    <div className="flex items-center gap-0.5 mt-0.5 text-text-light">
                      <MapPin size={11} />
                      <span className="text-[13px] truncate">{c.region ?? "우리 동네"}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* 내 동네 찾기 */}
      <section className="px-5 mt-8 cv-auto">
        <SectionHeader title="동네별 길고양이 지도" desc="내 동네를 눌러 주변 고양이들을 확인하고 돌봄 기록에 참여하세요." />
        <div className="grid grid-cols-3 gap-1.5 mb-3">
          {featured.map((g) => (
            <Link
              key={g.slug}
              href={`/areas/${g.slug}`}
              className="text-center py-2.5 press-strong transition-transform"
              style={{ ...PANEL, borderRadius: "var(--radius-card-sm)" }}
            >
              <p className="text-[15px] font-semibold text-text-main">{g.name}</p>
              <p className="text-[11px] text-text-light mt-0.5 truncate px-1">
                {g.dongs.slice(0, 2).join("·")}
              </p>
            </Link>
          ))}
        </div>
        <TextLink href="/areas" label="전국 구·동별 길고양이 지도" />
      </section>

      {/* 2026-09-18 랜딩 다이어트(UX 감사 5번) — 숨김: 통계·가이드 8종·꿀팁·HOT·임보·핵심 가치 */}
      {SHOW_LANDING_EXTRAS && (<>
      {/* 숫자로 보는 도시공존 — 컴팩트한 통계 스트립 */}
      <section className="px-5 mt-8 cv-auto">
        <div className="px-4 py-3 flex items-center justify-around" style={PANEL}>
          <TrustInline icon={<PawPrint size={18} />} value={data.catCount} label="등록" />
          <span className="w-px h-8" style={{ background: "var(--color-divider)" }} />
          <TrustInline icon={<Heart size={18} />} value={data.userCount} label="이웃" />
          <span className="w-px h-8" style={{ background: "var(--color-divider)" }} />
          <TrustInline icon={<Stethoscope size={18} />} value={data.hospitalCount} label="병원" />
        </div>
      </section>

      {/* 길집사 필수 가이드 8종 — 보호지침 허브로 유도 (SEO + 체류시간) */}
      <section className="px-5 mt-8 cv-auto">
        <SectionHeader
          title="길집사 필수 가이드 8종"
          desc="공공기관 자료 기반의 응급·돌봄·법률 가이드. 다친 아이를 만났을 때 바로 펼쳐보세요."
          moreHref="/protection"
        />
        <div style={PANEL}>
          <GuideRow href="/protection/emergency-guide" icon={<BriefcaseMedical size={20} />} title="응급 구조" sub="안전확보·지혈·이송" />
          <GuideRow href="/protection/disease-guide" icon={<Stethoscope size={20} />} title="질병 가이드" sub="흔한 10가지 질병" />
          <GuideRow href="/protection/kitten-guide" icon={<CatIcon size={20} />} title="냥줍 가이드" sub="관찰·체온·급여" />
          <GuideRow href="/protection/feeding-guide" icon={<Utensils size={20} />} title="먹이 가이드" sub="주면 안 되는 음식" />
          <GuideRow href="/protection/pharmacy-guide" icon={<Pill size={20} />} title="약품 가이드" sub="영양제·구충·상처" />
          <GuideRow href="/protection/shelter-guide" icon={<HomeIcon size={20} />} title="쉼터·겨울나기" sub="숨숨집 DIY" />
          <GuideRow href="/protection/trapping-guide" icon={<Hand size={20} />} title="포획 가이드" sub="설치·대기·주의" />
          <GuideRow href="/protection/legal" icon={<ShieldCheck size={20} />} title="법률 가이드" sub="학대 대응 매뉴얼" />
        </div>
      </section>

      {/* 꿀팁게시판 — 정보글 큐레이션 (SEO 강화) */}
      {tips.length > 0 && (
        <section className="px-5 mt-8 cv-auto">
          <SectionHeader
            title="꿀팁게시판"
            desc="길고양이 돌봄·TNR·중성화·구조에 도움되는 정보글을 모았어요."
            moreHref="/tips"
          />
          <div style={PANEL}>
            {tips.slice(0, 4).map((tip, i) => (
              <TipsRow key={tip.id} tip={tip} first={i === 0} />
            ))}
          </div>
        </section>
      )}

      {/* 이번 주 HOT 게시글 */}
      {hotSlot && (
        <section className="px-5 mt-6">
          {hotSlot}
        </section>
      )}

      {/* 입양·임보 기다리는 아이들 */}
      {adoptionSlot}

      {/* 핵심 가치 */}
      {SHOW_WHY_SECTION && (
      <section className="px-5 mt-6 cv-auto">
        <SectionHeader title="왜 도시공존인가요?" />
        <div style={PANEL}>
          <ValueRow
            icon={<ShieldCheck size={20} />}
            title="급식소 위치는 공개되지 않아요"
            desc="길고양이 안전을 위해 정확 좌표는 내부에서만 근사치로 처리됩니다."
            first
          />
          <ValueRow
            icon={<Bell size={20} />}
            title="긴급 돌봄 즉시 공유"
            desc="건강 상태가 위험한 아이는 동네에 빠르게 알려 구조로 이어집니다."
          />
          <ValueRow
            icon={<BadgeCheck size={20} />}
            title="무료 · 광고 없음"
            desc="광고 없는 무료 서비스. 시민의 자발적 기록으로 운영됩니다."
          />
          <ValueRow
            icon={<Download size={20} />}
            title="앱 설치 없이 홈 화면에 추가"
            desc="PWA 지원. 브라우저에서 바로 설치하면 앱처럼 열려요."
          />
        </div>
      </section>
      )}

      </>)}
      {/* FAQ (SEO 본문) */}
      <section className="px-5 mt-8 cv-auto">
        <SectionHeader title="자주 묻는 질문" />
        <div style={PANEL}>
          <FaqRow
            q="도시공존은 무엇인가요?"
            a="전국 길고양이를 시민이 함께 기록하고 돌보는 시민 참여 플랫폼입니다. 길집사가 지도 위에 TNR·급식·건강 기록을 남기고, 긴급 구조가 필요한 아이에게 이웃이 빠르게 닿을 수 있게 돕습니다."
            first
          />
          <FaqRow
            q="급식소 정확한 위치가 공개되나요?"
            a="공개되지 않습니다. 정확한 좌표는 로그인 유저에게만 근사치로 제공되며, 일반 랜딩에서는 구·동 단위로만 표시됩니다."
          />
          <FaqRow q="무료인가요?" a="네. 광고 없이 무료로 운영되며 이익을 목적으로 하지 않습니다." />
          <FaqRow
            q="카카오톡에서 로그인이 안 돼요"
            a="카카오톡 인앱 브라우저에서는 OAuth 정책상 소셜 로그인이 차단됩니다. 크롬·사파리 등 일반 브라우저로 열어주세요."
          />
        </div>
      </section>

      {/* 2026-09-18 랜딩 다이어트(UX 감사 5번) — 숨김: 공유 CTA·기술 자산 */}
      {SHOW_LANDING_EXTRAS && (<>
      {/* 공유 CTA */}
      <section className="px-5 mt-8 cv-auto">
        <div className="p-4" style={PANEL}>
          <p className="text-[15px] font-semibold text-text-main mb-1">
            동네 길집사 단톡방에 공유해보세요
          </p>
          <p className="text-[13px] text-text-sub mb-3 leading-relaxed">
            아이들을 지켜줄 이웃이 한 명 더 늘어납니다.
          </p>
          <ShareAreaButton guName="전국" slug="" catCount={data.catCount} urgentCount={0} />
        </div>
      </section>

      {/* 기술 자산 — 어떻게 만들어졌나 */}
      <section className="px-5 mt-8 cv-auto">
        <SectionHeader
          title="도시공존은 이렇게 만들어져요"
          desc="기록 한 줄이 안전하게 오래 쌓이도록 직접 짠 시스템 위에서 돌아갑니다."
        />
        <div style={PANEL}>
          <TechRow icon={<MapPin size={20} />} title="전국 구·동 자체 매핑" sub="구·동 단위 좌표 직접 정리" first />
          <TechRow icon={<Bot size={20} />} title="AI 집사 챗봇" sub="Google Gemini 기반" />
          <TechRow icon={<Radio size={20} />} title="실시간 동기화" sub="Supabase Realtime" />
          <TechRow icon={<Lock size={20} />} title="좌표 비공개 RLS" sub="DB 레벨 권한 분리" />
          <TechRow icon={<ShieldCheck size={20} />} title="봇·어뷰징 방어" sub="Cloudflare Turnstile" />
          <TechRow icon={<Download size={20} />} title="앱 설치 없이 PWA" sub="홈 화면 추가 지원" />
        </div>
      </section>

      </>)}
      {/* 만든 사람 — 1인 운영자 정체성 */}
      <section className="px-5 mt-8 cv-auto">
        <div className="p-4" style={PANEL}>
          <div className="flex items-center gap-2 mb-2">
            <Code2 size={20} style={{ color: "var(--color-text-sub)" }} strokeWidth={1.8} />
            <p className="text-[15px] font-semibold text-text-main">
              만든 사람 · 김성우
            </p>
          </div>
          <p className="text-[13px] leading-relaxed text-text-sub">
            도시공존은 <b className="font-semibold text-text-main">길집사 한 분 한 분의 손이 헛되지 않게 하고 싶다</b>는 마음으로
            1인 개발자가 직접 설계하고 운영하는 비영리 플랫폼이에요.
            <br />
            광고도, 수익 모델도 없이 자비로 굴러갑니다.
            서버·도메인·AI 비용까지 전부요.
          </p>
          <div className="flex gap-2 mt-4">
            <Link
              href="/maker"
              className="flex-1 h-10 flex items-center justify-center gap-1 text-[15px] font-semibold press transition-transform"
              style={{
                borderRadius: "var(--radius-input)",
                background: "var(--color-gray-100)",
                color: "var(--color-text-main)",
              }}
            >
              <span>운영 이야기 보기</span>
              <ChevronRight size={14} />
            </Link>
            <a
              href="mailto:grow29971@gmail.com?subject=%5B%EB%8F%84%EC%8B%9C%EA%B3%B5%EC%A1%B4%5D%20%EC%A0%9C%ED%9C%B4%2F%EB%AC%B8%EC%9D%98"
              className="h-10 px-4 flex items-center justify-center gap-1 text-[15px] font-semibold press transition-transform"
              style={{
                borderRadius: "var(--radius-input)",
                background: "var(--color-primary)",
                color: "var(--color-surface)",
              }}
            >
              <Mail size={14} />
              <span>제휴 문의</span>
            </a>
          </div>
        </div>
      </section>

      {/* 저작권 푸터 */}
      <footer className="px-5 mt-8 pb-6 text-center space-y-1">
        <div className="flex items-center justify-center gap-3 text-[11px] text-text-light flex-wrap">
          <Link href="/terms" className="hover:underline">이용약관</Link>
          <span>·</span>
          <Link href="/privacy" className="hover:underline">개인정보처리방침</Link>
          <span>·</span>
          <Link href="/about" className="hover:underline">소개</Link>
          <span>·</span>
          <Link href="/maker" className="hover:underline">만든 사람</Link>
        </div>
        <p className="text-[11px] text-text-light">© 2026 도시공존 · dosigongzon.com</p>
      </footer>
    </div>
  );
}

// ── 섹션 헤더: 17px 700 제목 + 선택 설명 + 우측 "전체보기" 텍스트 링크 (색 막대 장식 없음) ──
function SectionHeader({ title, desc, moreHref }: { title: string; desc?: string; moreHref?: string }) {
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between">
        <h2 className="text-[17px] font-bold text-text-main">{title}</h2>
        {moreHref && (
          <Link href={moreHref} className="flex items-center gap-0.5 text-[13px] font-medium text-text-light">
            전체보기 <ChevronRight size={13} />
          </Link>
        )}
      </div>
      {desc && <p className="text-[13px] text-text-sub mt-1 leading-relaxed">{desc}</p>}
    </div>
  );
}

// 섹션 하단 보조 링크 — 버튼 대신 텍스트 링크
function TextLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="mt-3 flex items-center justify-center gap-0.5 text-[13px] font-semibold py-2 press transition-transform"
      style={{ color: "var(--color-primary)" }}
    >
      <span>{label}</span>
      <ChevronRight size={14} />
    </Link>
  );
}

function TrustInline({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span style={{ color: "var(--color-text-light)" }}>{icon}</span>
      <div className="flex flex-col leading-tight">
        <span className="text-[15px] font-bold text-text-main tabular-nums">
          {value.toLocaleString()}
        </span>
        <span className="text-[11px] text-text-sub">{label}</span>
      </div>
    </div>
  );
}

function ValueRow({ icon, title, desc, first }: { icon: React.ReactNode; title: string; desc: string; first?: boolean }) {
  return (
    <div className="px-4 py-3 flex items-start gap-3" style={{ borderTop: first ? "none" : ROW_DIVIDER }}>
      <span className="shrink-0 mt-0.5" style={{ color: "var(--color-text-light)" }}>{icon}</span>
      <div className="min-w-0">
        <p className="text-[15px] font-semibold text-text-main leading-snug">{title}</p>
        <p className="text-[13px] text-text-sub mt-0.5 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

function GuideRow({
  href,
  icon,
  title,
  sub,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  sub: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 press transition-transform"
      style={{ minHeight: 56, borderTop: ROW_DIVIDER }}
    >
      <span className="shrink-0" style={{ color: "var(--color-text-light)" }}>{icon}</span>
      <div className="min-w-0 flex-1 py-2.5">
        <p className="text-[15px] font-semibold text-text-main truncate leading-snug">{title}</p>
        <p className="text-[13px] text-text-sub truncate mt-0.5">{sub}</p>
      </div>
      <ChevronRight size={18} className="shrink-0" style={{ color: "var(--color-text-muted)" }} />
    </Link>
  );
}

function TipsRow({ tip, first }: { tip: Tip; first?: boolean }) {
  const photo = sanitizeImageUrl(tip.thumbnail_url, "");
  return (
    <Link
      href={`/tips/${tip.slug}`}
      className="flex gap-3 px-4 py-3 press transition-transform"
      style={{ borderTop: first ? "none" : ROW_DIVIDER }}
    >
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo}
          alt={tip.title}
          width={56}
          height={56}
          loading="lazy"
          className="w-14 h-14 object-cover shrink-0"
          style={{ borderRadius: "var(--radius-card-sm)" }}
        />
      ) : (
        <div
          className="w-14 h-14 flex items-center justify-center shrink-0"
          style={{ borderRadius: "var(--radius-card-sm)", background: "var(--color-surface-alt)", color: "var(--color-text-muted)" }}
        >
          <FileText size={20} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-semibold text-text-main leading-snug line-clamp-2">
          {tip.title}
        </p>
        {tip.description && (
          <p className="text-[13px] text-text-sub line-clamp-1 mt-0.5">
            {tip.description}
          </p>
        )}
        {tip.tags.length > 0 && (
          <p className="text-[11px] text-text-light mt-1 truncate">
            {tip.tags.slice(0, 2).map((t) => `#${t}`).join(" ")}
          </p>
        )}
      </div>
    </Link>
  );
}

function StartStep({
  n,
  href,
  title,
  desc,
}: {
  n: number;
  href: string;
  title: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 press transition-transform"
      style={{ minHeight: 60, borderTop: n > 1 ? ROW_DIVIDER : "none" }}
    >
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[13px] font-semibold"
        style={{
          border: "1px solid var(--color-primary)",
          color: "var(--color-primary)",
        }}
      >
        {n}
      </div>
      <div className="min-w-0 flex-1 py-3">
        <p className="text-[15px] font-semibold text-text-main leading-snug">{title}</p>
        <p className="text-[13px] text-text-sub mt-0.5 leading-snug">{desc}</p>
      </div>
      <ChevronRight size={18} className="shrink-0" style={{ color: "var(--color-text-muted)" }} />
    </Link>
  );
}

function TechRow({
  icon,
  title,
  sub,
  first,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
  first?: boolean;
}) {
  return (
    <div className="px-4 py-3 flex items-center gap-3" style={{ borderTop: first ? "none" : ROW_DIVIDER }}>
      <span className="shrink-0" style={{ color: "var(--color-text-light)" }}>{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold text-text-main truncate leading-snug">{title}</p>
        <p className="text-[13px] text-text-sub truncate mt-0.5">{sub}</p>
      </div>
    </div>
  );
}

function FaqRow({ q, a, first }: { q: string; a: string; first?: boolean }) {
  return (
    <details className="px-4 py-3" style={{ borderTop: first ? "none" : ROW_DIVIDER }}>
      <summary className="text-[15px] font-semibold text-text-main cursor-pointer list-none flex items-center justify-between gap-3">
        <span>{q}</span>
        <ChevronRight size={18} className="shrink-0" style={{ color: "var(--color-text-muted)" }} />
      </summary>
      <p className="text-[13px] text-text-sub mt-2 leading-relaxed">{a}</p>
    </details>
  );
}

function SafetyRow({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="px-4 py-3 flex items-start gap-3 first:border-t-0" style={{ borderTop: ROW_DIVIDER }}>
      <span className="shrink-0 mt-0.5" style={{ color: "var(--color-text-light)" }}>{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold text-text-main leading-snug">{title}</p>
        <p className="text-[13px] text-text-sub leading-relaxed mt-0.5">{body}</p>
      </div>
    </div>
  );
}
