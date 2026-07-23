// SEO 랜딩 — 비로그인 방문자 + 크롤러 + 소셜 스크랩 대상
// 서버 컴포넌트로 풍부한 HTML을 첫 바이트에 실어 보냄.

import Link from "next/link";
import { unstable_cache } from "next/cache";
import { thumbnailUrl } from "@/lib/cats-repo";
import {
  MapPin,
  Heart,
  Sparkles,
  ShieldCheck,
  ArrowRight,
  ChevronRight,
  PawPrint,
  Bell,
  Download,
  BriefcaseMedical,
  Cat as CatIcon,
  Stethoscope,
  Pill,
  Utensils,
  Home as HomeIcon,
  Hand,
  Code2,
  Bot,
  Lock,
  Radio,
  Mail,
  Trophy,
} from "lucide-react";
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

// 활동 케어테이커 TOP 3 — 광고 LP에 강력한 사회적 증명. 10분 캐시(egress 절감).
const getCachedTopCaretakers = unstable_cache(
  async (): Promise<RankingRow[]> => getTopCaretakersServer(3),
  ["landing-top-caretakers"],
  { revalidate: 600, tags: ["landing-top-caretakers"] },
);

const SITE_URL = "https://dosigongzon.com";

async function getLandingData() {
  try {
    const supabase = createAnonClient();
    const [catsRpcRes, recentCatsRes, hospitalsRes, profilesRes, guCounts] = await Promise.all([
      // visibility 무관 전체 카운트 (RPC SECURITY DEFINER) — private도 통계에는 포함
      supabase.rpc("total_cat_count"),
      supabase
        .from("cats")
        .select("id, name, region, photo_url, health_status, created_at")
        .order("created_at", { ascending: false })
        .limit(6),
      supabase.from("rescue_hospitals").select("*", { count: "exact", head: true }).eq("hidden", false),
      supabase.rpc("total_user_count"),
      getGuCounts(),
    ]);

    return {
      catCount: Number(catsRpcRes.data ?? 0),
      hospitalCount: hospitalsRes.count ?? 0,
      userCount: Number(profilesRes.data ?? 0),
      recentCats: (recentCatsRes.data ?? []) as Array<{
        id: string;
        name: string;
        region: string | null;
        photo_url: string | null;
        health_status: string;
        created_at: string;
      }>,
      guCounts,
    };
  } catch {
    return { catCount: 0, hospitalCount: 0, userCount: 0, recentCats: [], guCounts: {} };
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
          text: "전국 길고양이를 시민이 함께 기록하고 돌보는 시민 참여 플랫폼입니다. 케어테이커가 지도 위에 TNR·급식·건강 기록을 남기고, 긴급 구조가 필요한 아이에게 이웃이 빠르게 닿을 수 있게 돕습니다.",
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
        headerEmoji="🐾"
        title="우리 동네 길고양이를 함께 돌봐요"
        items={[
          { emoji: "🗺️", text: <>지도에서 우리 동네 길고양이를 만나고, 밥·건강을 함께 기록해요.</> },
          { emoji: "💛", text: <>쇼핑 수익 일부는 아이들에게 — <b className="text-text-main">사용처는 함께 투표</b>로 정해요.</> },
          { emoji: "✨", text: <>가입은 무료예요. 우리 동네부터 시작해보세요.</> },
        ]}
        buttonLabel="둘러보기 🐾"
      />

      {/* 도시공존 소개 — 비로그인 방문자(인스타 유입 등)가 최상단에서 바로 이해 */}
      <div className="px-5 pt-14 pb-1">
        <AboutCityCard className="mb-0" />
      </div>

      {/* 히어로 */}
      <section className="px-5 pt-6 pb-8" style={{ background: "linear-gradient(180deg, #FFF9F2 0%, #F7F4EE 100%)" }}>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 mb-3">
          <Heart size={12} style={{ color: "var(--color-primary)" }} />
          <span className="text-[11px] font-extrabold" style={{ color: "var(--color-primary)" }}>
            전국 · {data.userCount > 0
              ? `${data.userCount.toLocaleString()}명의 케어테이커`
              : "케어테이커 시민 참여 플랫폼"}
          </span>
        </div>
        <h1 className="text-[30px] font-black text-text-main leading-[1.15] tracking-tight">
          전국 길고양이 <span className="text-primary">{data.catCount.toLocaleString()}마리</span>,<br />
          <span className="text-primary">한 화면에서 함께 돌봐요.</span>
        </h1>
        <p className="text-[13.5px] text-text-sub mt-3 leading-relaxed">
          케어테이커가 길고양이의
          <b className="text-text-main"> TNR·건강·급식</b> 기록을 실시간으로 남기고,
          긴급한 아이를 동네 이웃과 빠르게 잇는 전국 길고양이 돌봄 지도예요.
        </p>
        <p className="text-[12px] mt-2 leading-relaxed" style={{ color: "#8B7562" }}>
          급식소 정확 좌표는 <b style={{ color: "#6B8E6F" }}>비공개</b> · 광고 없는 무료 운영 · PWA 지원
        </p>

        {/* 방문자 수 실시간 (client) */}
        <TodayVisitors />

        {/* 사회적 증명 — 오늘 활동 유저 + 이번 주 신규 */}
        <SocialProofStrip />

        {/* CTA — primary + ghost 대비 */}
        <div className="flex gap-2 mt-5">
          <Link
            href="/map"
            className="flex-[1.4] flex items-center justify-center gap-1.5 py-4 rounded-2xl text-white active:scale-[0.98] transition-transform"
            style={{
              background: "linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)",
              boxShadow: "0 8px 22px rgba(173, 94, 59,0.38), 0 2px 6px rgba(168,104,74,0.22)",
            }}
          >
            <PawPrint size={15} />
            <span className="text-[14px] font-extrabold tracking-tight">지도 바로 보기</span>
          </Link>
          <Link
            href="/signup"
            className="flex-1 flex items-center justify-center gap-1.5 py-4 rounded-2xl active:scale-[0.98] transition-transform"
            style={{
              background: "rgba(173, 94, 59,0.09)",
              color: "var(--color-primary)",
              border: "1.5px solid rgba(173, 94, 59,0.45)",
            }}
          >
            <Sparkles size={14} />
            <span className="text-[14px] font-extrabold tracking-tight">돌봄 시작하기</span>
          </Link>
        </div>
        <p className="mt-2 text-center text-[11px] font-bold" style={{ color: "rgba(173, 94, 59,0.7)" }}>
          10초 가입 · 광고 없는 무료 운영
        </p>

        {/* 처음이신가요? 가이드 링크 */}
        <Link
          href="/guide"
          className="mt-3 flex items-center justify-center gap-1.5 text-[12px] font-bold active:scale-[0.98] transition-transform"
          style={{ color: "#8B7562" }}
        >
          <span>처음이신가요? 10가지 기능 한눈에 보기</span>
          <ArrowRight size={12} />
        </Link>
      </section>

      {/* 왜 길고양이를 돌봐야 하나 — 히어로 직후 최상단. 비케어테이커 도시민 어필 핵심 카드. */}
      <section className="px-5 mt-8">
        {/* 상단 라벨 */}
        <div className="flex justify-center mb-3">
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold tracking-[0.18em]"
            style={{
              background: "linear-gradient(135deg, rgba(107,142,111,0.14) 0%, rgba(79,107,83,0.10) 100%)",
              color: "#4F6B53",
              border: "1px solid rgba(107,142,111,0.25)",
            }}
          >
            FOR THE CITY
          </span>
        </div>

        {/* 임팩트 헤드라인 */}
        <h2
          className="text-center text-[24px] font-extrabold leading-[1.3] tracking-tight mb-2"
          style={{ color: "#3D2F25" }}
        >
          왜 <span style={{ color: "#4F6B53" }}>함께 돌봐야</span> 할까요?
        </h2>
        <p className="text-center text-[12.5px] text-text-sub mb-5 leading-relaxed">
          관리되는 길고양이 한 마리가
          <br />
          <b style={{ color: "#4F6B53" }}>동네 전체의 평화</b>를 바꿔요.
        </p>

        {/* 메인 카드 — 솔리드 그린 배경으로 임팩트 강화 */}
        <div
          className="rounded-[24px] overflow-hidden"
          style={{
            background: "linear-gradient(160deg, #4F6B53 0%, #6B8E6F 65%, #8FAE92 100%)",
            boxShadow: "0 10px 28px rgba(79,107,83,0.20), 0 3px 8px rgba(79,107,83,0.12)",
          }}
        >
          <ul className="p-5 space-y-4">
            <li className="flex items-start gap-3">
              <span
                className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-extrabold mt-0.5"
                style={{
                  background: "rgba(255,255,255,0.95)",
                  color: "#4F6B53",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
                }}
              >
                01
              </span>
              <div className="flex-1 min-w-0 pt-1">
                <p className="text-[15px] font-extrabold text-white leading-snug tracking-tight">
                  쓰레기봉투를 안 찢어요
                </p>
                <p className="text-[12px] leading-relaxed mt-1" style={{ color: "rgba(255,255,255,0.82)" }}>
                  꾸준한 급식으로 음식물 쓰레기를 뒤지지 않아요.
                </p>
              </div>
            </li>
            <li
              className="h-px"
              style={{ background: "rgba(255,255,255,0.18)" }}
              aria-hidden="true"
            />
            <li className="flex items-start gap-3">
              <span
                className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-extrabold mt-0.5"
                style={{
                  background: "rgba(255,255,255,0.95)",
                  color: "#4F6B53",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
                }}
              >
                02
              </span>
              <div className="flex-1 min-w-0 pt-1">
                <p className="text-[15px] font-extrabold text-white leading-snug tracking-tight">
                  자동차 안에 들어가지 않아요
                </p>
                <p className="text-[12px] leading-relaxed mt-1" style={{ color: "rgba(255,255,255,0.82)" }}>
                  안전한 쉼터가 있으면 차 엔진룸에 숨지 않아요.
                </p>
              </div>
            </li>
            <li
              className="h-px"
              style={{ background: "rgba(255,255,255,0.18)" }}
              aria-hidden="true"
            />
            <li className="flex items-start gap-3">
              <span
                className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-extrabold mt-0.5"
                style={{
                  background: "rgba(255,255,255,0.95)",
                  color: "#4F6B53",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
                }}
              >
                03
              </span>
              <div className="flex-1 min-w-0 pt-1">
                <p className="text-[15px] font-extrabold text-white leading-snug tracking-tight">
                  울음소리가 줄어들어요
                </p>
                <p className="text-[12px] leading-relaxed mt-1" style={{ color: "rgba(255,255,255,0.82)" }}>
                  TNR(중성화)로 발정기 울음과 영역 다툼이 사라져요.
                </p>
              </div>
            </li>
          </ul>

          {/* 풋터 강조 메시지 */}
          <div
            className="px-5 py-4 text-center"
            style={{ background: "rgba(0,0,0,0.16)", backdropFilter: "blur(4px)" }}
          >
            <p className="text-[13.5px] font-extrabold text-white leading-[1.55] tracking-tight">
              <span style={{ color: "#FFF7C4" }}>관리</span>는 곧{" "}
              <span style={{ color: "#FFF7C4" }}>도시의 평화</span>입니다.
            </p>
            <p className="text-[11.5px] mt-1.5 leading-relaxed" style={{ color: "rgba(255,255,255,0.78)" }}>
              도시공존은 그 관리를 <b className="text-white">시민이 함께</b> 합니다.
            </p>
          </div>
        </div>
      </section>

      {/* 지금 활발한 동네 TOP 3 — 사회적 증명 + 지역 호기심 자극 */}
      {activeRegions.length > 0 && (
        <section className="px-5 mt-10">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-4 rounded-full" style={{ backgroundColor: "#E86B8C" }} />
            <h2 className="text-[15px] font-extrabold text-text-main tracking-tight">
              지금 활발한 동네
            </h2>
            <span className="text-[9px] font-bold tracking-[0.15em]" style={{ color: "#E86B8C", opacity: 0.7 }}>
              LIVE · TOP {activeRegions.length}
            </span>
          </div>
          <p className="text-[12px] text-text-sub mb-3 leading-relaxed">
            이번 주 새 친구·케어테이커·치료 병원이 가장 많이 모이는 동네예요.
          </p>
          <div className="space-y-2">
            {activeRegions.map((r, idx) => (
              <Link
                key={r.slug}
                href={`/areas/${r.slug}`}
                className="block rounded-2xl bg-white p-4 active:scale-[0.98] transition-transform"
                style={{ boxShadow: "var(--shadow-card)", border: "1px solid #F0E6D8" }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-extrabold text-white"
                    style={{
                      background:
                        idx === 0
                          ? "linear-gradient(135deg, #E86B8C 0%, #D85577 100%)"
                          : idx === 1
                          ? "linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)"
                          : "linear-gradient(135deg, #6B8E6F 0%, #4F6B53 100%)",
                    }}
                  >
                    {idx === 0 ? "🔥" : `#${idx + 1}`}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-extrabold text-text-main tracking-tight">{r.name}</p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-[11.5px]">
                      {r.recentCats > 0 && (
                        <span style={{ color: "#E86B8C" }}>
                          <b>이번 주 +{r.recentCats}</b>마리
                        </span>
                      )}
                      {r.activeCaretakers > 0 && (
                        <>
                          <span className="text-text-light">·</span>
                          <span style={{ color: "var(--color-primary)" }}>
                            케어테이커 <b>{r.activeCaretakers}</b>명
                          </span>
                        </>
                      )}
                      {r.hospitals > 0 && (
                        <>
                          <span className="text-text-light">·</span>
                          <span style={{ color: "#4F6B53" }}>
                            병원 <b>{r.hospitals}</b>곳
                          </span>
                        </>
                      )}
                      {r.totalCats > 0 && (
                        <>
                          <span className="text-text-light">·</span>
                          <span className="text-text-light">
                            누적 {r.totalCats.toLocaleString()}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <ChevronRight size={16} className="shrink-0 text-text-light" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 안전 정책 — 가입 직전 신뢰 봉합. 학대 우려 케어테이커 대상 핵심 메시지. */}
      <section className="px-5 mt-10">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-4 rounded-full" style={{ backgroundColor: "#4A7BA8" }} />
          <h2 className="text-[15px] font-extrabold text-text-main tracking-tight">
            고양이 위치, 어떻게 지키나요?
          </h2>
          <span className="text-[9px] font-bold tracking-[0.15em]" style={{ color: "#4A7BA8", opacity: 0.7 }}>
            SAFETY
          </span>
        </div>

        {/* 핵심 메시지 카드 */}
        <div
          className="rounded-2xl p-4 mb-3"
          style={{
            background: "linear-gradient(135deg, rgba(74,123,168,0.10) 0%, rgba(74,123,168,0.04) 100%)",
            border: "1px solid rgba(74,123,168,0.22)",
          }}
        >
          <div className="flex items-start gap-2.5">
            <ShieldCheck size={22} className="shrink-0 mt-0.5" style={{ color: "#4A7BA8" }} />
            <div className="min-w-0">
              <p className="text-[14.5px] font-extrabold text-text-main leading-snug mb-1 tracking-tight">
                정확한 자리는 누구도 모릅니다
              </p>
              <p className="text-[12px] text-text-sub leading-relaxed">
                좌표는 <b className="text-text-main">동(洞) 단위</b>까지만 처리됩니다.
                여러 겹의 방어로 더 좁힐 수 없게 막아두었어요.
              </p>
            </div>
          </div>
        </div>

        {/* 🔥 Private Circle — 가장 강한 신뢰 도구. 학대 공포 원천 차단. */}
        <div
          className="rounded-2xl overflow-hidden mb-3"
          style={{
            background: "linear-gradient(160deg, #4F6B53 0%, #6B8E6F 70%, #8FAE92 100%)",
            boxShadow: "0 10px 28px rgba(79,107,83,0.22), 0 3px 8px rgba(79,107,83,0.14)",
          }}
        >
          <div className="p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <Lock size={13} color="#FFF7C4" />
              <span className="text-[10px] font-extrabold tracking-[0.18em]" style={{ color: "#FFF7C4" }}>
                PRIVATE CIRCLE
              </span>
              <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full" style={{ background: "#FFF7C4", color: "#4F6B53" }}>
                NEW
              </span>
            </div>
            <p className="text-[15px] font-extrabold text-white leading-snug mb-2 tracking-tight">
              가장 무서운 건 가입자 중에 학대자가 있을까봐?
            </p>
            <p className="text-[12.5px] leading-[1.85]" style={{ color: "rgba(255,255,255,0.92)" }}>
              그 공포에 대한 답이 <b style={{ color: "#FFF7C4" }}>Private Circle</b>입니다.
              걱정되는 아이는 <b style={{ color: "#FFF7C4" }}>"내 서클"</b>로 설정하면,
              내가 직접 승인한 이웃에게만 보입니다.
            </p>
            <p className="text-[12px] leading-relaxed mt-2" style={{ color: "rgba(255,255,255,0.78)" }}>
              일반 가입자에게도 보이지 않고, 외부인에게는 존재 자체가 노출되지 않습니다.
              믿는 사람들 사이에서만 조용히 함께 돌볼 수 있어요.
            </p>
          </div>
          <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: "rgba(0,0,0,0.18)" }}>
            <span className="text-[11px] font-bold flex-1" style={{ color: "rgba(255,255,255,0.88)" }}>
              등록 시 공개 범위 3단계 · 마이페이지에서 서클 관리
            </span>
            <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.92)", color: "#4F6B53" }}>
              가입 후 사용
            </span>
          </div>
        </div>

        {/* 5개 보호 레이어 */}
        <div className="space-y-1.5 mb-3">
          <SafetyRow
            icon="🎲"
            title="등록 시 좌표 자체를 흐리게"
            body="같은 자리를 두 번 찍어도 매번 다른 값으로 저장돼요. 본인도 역추적 불가."
          />
          <SafetyRow
            icon="👻"
            title="비로그인 외부인 = 도트와 카운트만"
            body="사진·이름·동 이름 일절 비공개. 동 단위 N마리 신호만 노출."
          />
          <SafetyRow
            icon="🚫"
            title="위치 단어 자동 차단"
            body="역·출구·시장·공원·아파트·도로명·학교 등 11종 패턴 등록 차단."
          />
          <SafetyRow
            icon="📷"
            title="사진 GPS 메타데이터 자동 제거"
            body="업로드 시 WebP 재인코딩으로 EXIF 전부 삭제. 좌표 추출 불가."
          />
          <SafetyRow
            icon="🔒"
            title="DB 권한 격리 (RLS)"
            body="본인이 등록한 핀만 수정·삭제. 코드 우회 시도도 DB가 거부."
          />
        </div>

        {/* 정직한 한계 + 철학 */}
        <div
          className="rounded-2xl p-4 mb-3"
          style={{
            background: "linear-gradient(135deg, #FFF9F2 0%, #FCEFD9 100%)",
            border: "1px solid rgba(173, 94, 59,0.20)",
          }}
        >
          <p className="text-[12px] text-text-sub leading-[1.85]">
            <b className="text-text-main">한계도 솔직히 말씀드려요.</b> 100% 안전은 없습니다.
            하지만 학대자들은 도시공존이 있든 없든 골목을 답사합니다.
            가장 위험한 환경은 <b className="text-text-main">동네가 무관심한 상태</b>예요.
          </p>
          <p className="text-[12px] text-text-sub leading-[1.85] mt-2">
            <b style={{ color: "var(--color-primary-dark)" }}>케어테이커와 시민의 시선이 모이는 것</b> — 그게 학대자에게 가장
            강한 억제력입니다. 도시공존은 그 시선을 모으려고 만들어진 도구예요.
          </p>
        </div>

      </section>

      {/* 이렇게 시작해보세요 — 3단계 액션 가이드 */}
      <section className="px-5 mt-10">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-4 rounded-full" style={{ backgroundColor: "var(--color-primary)" }} />
          <h2 className="text-[15px] font-extrabold text-text-main tracking-tight">
            이렇게 시작해보세요
          </h2>
          <span className="text-[9px] font-bold tracking-[0.15em]" style={{ color: "var(--color-primary)", opacity: 0.6 }}>
            3 STEPS
          </span>
        </div>
        <p className="text-[12px] text-text-sub mb-3 leading-relaxed">
          처음이라도 괜찮아요. 1분이면 첫 한 줄을 남길 수 있어요.
        </p>
        <div className="space-y-2">
          <StartStep
            n={1}
            href="/signup"
            color="#AD5E3B"
            title="1초 가입 — 카카오·구글로"
            desc="이메일 따로 안 적어도 돼요. 닉네임만 정하면 끝."
          />
          <StartStep
            n={2}
            href="/map"
            color="#4A7BA8"
            title="우리 동네 지도에서 아이들 찾기"
            desc="구·동을 누르면 그 동네 길고양이만 모아 보여줘요."
          />
          <StartStep
            n={3}
            href="/map"
            color="#E86B8C"
            title="오른쪽 + 버튼으로 첫 한 줄 남기기"
            desc="사진·이름·건강 상태 한 번에. 위치는 자동으로 흐리게 처리돼요."
          />
        </div>
        <Link
          href="/guide"
          className="mt-3 flex items-center justify-center gap-1 text-[12px] font-bold py-2.5 rounded-xl active:scale-[0.98] transition-transform"
          style={{ background: "#FFFFFF", color: "#8B7562", border: "1px solid #E8DED0" }}
        >
          <span>10가지 기능 한 화면에서 보기</span>
          <ArrowRight size={12} />
        </Link>
      </section>

      {/* 1000명 이벤트 배너 — 가입 전환 강력 트리거 */}
      {eventSlot}

      {/* 이번 주 활동 케어테이커 TOP 3 — 살아있는 커뮤니티 사회적 증명 */}
      {topCaretakers.length > 0 && (
        <section className="px-5 mt-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-4 rounded-full" style={{ backgroundColor: "#C9A961" }} />
            <h2 className="text-[15px] font-extrabold text-text-main tracking-tight inline-flex items-center gap-1.5">
              <Trophy size={14} style={{ color: "#C9A961" }} />
              이번 주 활동 케어테이커 TOP 3
            </h2>
            <span className="text-[9px] font-bold tracking-[0.15em]" style={{ color: "#C9A961", opacity: 0.6 }}>
              LEADERBOARD
            </span>
          </div>
          <p className="text-[12px] text-text-sub mb-3 leading-relaxed">
            지금 실제로 동네 길고양이를 돌보고 있는 분들이에요.
          </p>
          <div className="space-y-2">
            {topCaretakers.map((c, idx) => (
              <Link
                key={c.user_id}
                href="/ranking"
                className="flex items-center gap-3 p-3.5 rounded-2xl bg-white active:scale-[0.99] transition-transform"
                style={{ boxShadow: "var(--shadow-card)" }}
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-white font-extrabold text-[13px]"
                  style={{
                    background:
                      idx === 0
                        ? "linear-gradient(135deg, #C9A961 0%, #A88A45 100%)"
                        : idx === 1
                        ? "linear-gradient(135deg, #B8B8B8 0%, #999999 100%)"
                        : "linear-gradient(135deg, #C08860 0%, #8B5A3C 100%)",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
                  }}
                >
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-extrabold text-text-main truncate">
                    {c.nickname || "익명 케어테이커"}
                  </p>
                  <p className="text-[11px] text-text-sub mt-0.5">
                    🐱 {c.cat_count}마리 · 💛 돌봄 {c.care_count}회 · {c.score}점
                  </p>
                </div>
                <ChevronRight size={16} className="text-text-light shrink-0" />
              </Link>
            ))}
          </div>
          <Link
            href="/ranking"
            className="mt-3 flex items-center justify-center gap-1 text-[12px] font-bold py-2.5 rounded-xl active:scale-[0.98] transition-transform"
            style={{ background: "#FFFFFF", color: "#8B7562", border: "1px solid #E8DED0" }}
          >
            <span>전체 랭킹 보기</span>
            <ArrowRight size={12} />
          </Link>
        </section>
      )}

      {/* 감성 인용 — 철학적 질문 */}
      <section className="px-5 mt-8">
        <div
          className="relative rounded-3xl px-6 py-7 overflow-hidden"
          style={{
            background: "linear-gradient(135deg, #FDF7EE 0%, #F6E8D4 100%)",
            border: "1px solid rgba(173, 94, 59,0.18)",
          }}
        >
          <span
            aria-hidden="true"
            className="absolute -top-2 left-4 select-none"
            style={{
              fontSize: 60,
              lineHeight: 1,
              fontFamily: "serif",
              color: "rgba(173, 94, 59,0.25)",
            }}
          >
            “
          </span>
          <p
            className="text-[14.5px] leading-[1.9] text-text-main relative z-10"
            style={{ fontFamily: "serif" }}
          >
            우리는 <b style={{ color: "var(--color-primary)" }}>길 위의 아이들</b>의 삶을
            <br />
            얼마나 이해하고 있을까요?
            <br />
            <span className="text-text-sub">
              사실, 우리는 잘 모릅니다.
            </span>
          </p>
          <p
            className="text-[12.5px] leading-relaxed text-text-sub mt-4 relative z-10"
          >
            어느 골목에서 자는지, 오늘 밥은 먹었는지,
            <br />
            몇 마리가 한 가족인지도 모릅니다.
            <br />
            그래서 <b className="text-text-main">서로의 눈</b>이 되어,
            <br />
            한 줄씩 기록을 나눠요.
          </p>
          <p
            className="text-[12.5px] leading-relaxed text-text-sub mt-4 relative z-10"
          >
            누군가 그들을 <b style={{ color: "#D85555" }}>해치려 할 때</b>
            <br />
            먼저 알아차릴 수 있는 건
            <br />
            매일 얼굴을 아는 이웃뿐이에요.
            <br />
            <span className="text-text-main">
              작은 기록 한 줄이, 어느 날 아이를 지키는 단서가 됩니다.
            </span>
          </p>
          <p
            className="text-[11px] font-extrabold tracking-[0.15em] mt-5 relative z-10"
            style={{ color: "var(--color-primary)" }}
          >
            — 도시공존
          </p>
        </div>
      </section>

      {/* 최근 등록된 고양이들 */}
      {data.recentCats.length > 0 && (
        <section className="px-5 mt-6 cv-auto">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 rounded-full" style={{ backgroundColor: "var(--color-primary)" }} />
              <h2 className="text-[15px] font-extrabold text-text-main tracking-tight">최근 등록된 아이들</h2>
            </div>
            <Link href="/map" className="flex items-center gap-0.5 text-[12px] font-semibold text-primary">
              전체보기 <ArrowRight size={12} />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {data.recentCats.slice(0, 4).map((c) => {
              const safe = sanitizeImageUrl(c.photo_url, "https://placehold.co/400x400/EEEAE2/2A2A28?text=%3F");
              const photo = thumbnailUrl(safe, 400) ?? safe;
              const urgent = c.health_status === "danger";
              return (
                <Link
                  key={c.id}
                  href={`/cats/${c.id}`}
                  className="block rounded-2xl overflow-hidden bg-white active:scale-[0.98] transition-transform"
                  style={{ boxShadow: "var(--shadow-raised)" }}
                >
                  <div className="relative" style={{ aspectRatio: "4/3" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo}
                      alt={c.name}
                      loading="lazy"
                      decoding="async"
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    {urgent && (
                      <span
                        className="absolute top-2 left-2 text-[10px] font-extrabold px-2 py-0.5 rounded-lg text-white"
                        style={{ backgroundColor: "#D85555" }}
                      >
                        🚨 긴급
                      </span>
                    )}
                  </div>
                  <div className="p-2.5">
                    <p className="text-[13px] font-extrabold text-text-main truncate">{c.name}</p>
                    <div className="flex items-center gap-0.5 mt-0.5">
                      <MapPin size={10} className="text-text-light" />
                      <span className="text-[10.5px] text-text-sub truncate">{c.region ?? "우리 동네"}</span>
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
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-4 rounded-full" style={{ backgroundColor: "#4A7BA8" }} />
          <h2 className="text-[15px] font-extrabold text-text-main tracking-tight">동네별 길고양이 지도</h2>
          <span className="text-[9px] font-bold tracking-[0.15em]" style={{ color: "#4A7BA8", opacity: 0.6 }}>
            BY DISTRICTS
          </span>
        </div>
        <p className="text-[12px] text-text-sub mb-3 leading-relaxed">
          내 동네를 눌러 주변 고양이들을 확인하고 돌봄 기록에 참여하세요.
        </p>
        <div className="grid grid-cols-3 gap-1.5 mb-3">
          {featured.map((g) => (
            <Link
              key={g.slug}
              href={`/areas/${g.slug}`}
              className="text-center py-2.5 rounded-xl bg-white active:scale-95 transition-transform"
              style={{ boxShadow: "var(--shadow-card-sm)" }}
            >
              <p className="text-[13px] font-extrabold text-text-main">{g.name}</p>
              <p className="text-[10px] text-text-light mt-0.5 truncate">
                {g.dongs.slice(0, 2).join("·")}
              </p>
            </Link>
          ))}
        </div>
        <Link
          href="/areas"
          className="block text-center text-[12.5px] font-bold py-2.5 rounded-xl"
          style={{ backgroundColor: "#FFF", color: "var(--color-primary)", border: "1px solid #E8D4BD" }}
        >
          전국 구·동별 길고양이 지도 →
        </Link>
      </section>

      {/* 숫자로 보는 도시공존 — 컴팩트한 통계 스트립 */}
      <section className="px-5 mt-8 cv-auto">
        <div
          className="rounded-2xl px-4 py-3 flex items-center justify-around"
          style={{
            background: "#FFFFFF",
            boxShadow: "0 4px 14px rgba(0,0,0,0.05)",
            border: "1px solid rgba(0,0,0,0.04)",
          }}
        >
          <TrustInline emoji="🐾" value={data.catCount} label="등록" color="#AD5E3B" />
          <span className="w-px h-8" style={{ background: "rgba(0,0,0,0.06)" }} />
          <TrustInline emoji="❤️" value={data.userCount} label="이웃" color="#E86B8C" />
          <span className="w-px h-8" style={{ background: "rgba(0,0,0,0.06)" }} />
          <TrustInline emoji="🏥" value={data.hospitalCount} label="병원" color="#22B573" />
        </div>
      </section>

      {/* 케어테이커 필수 가이드 8종 — 보호지침 허브로 유도 (SEO + 체류시간) */}
      <section className="px-5 mt-8 cv-auto">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-1 h-4 rounded-full" style={{ backgroundColor: "#D85555" }} />
            <h2 className="text-[15px] font-extrabold text-text-main tracking-tight">
              케어테이커 필수 가이드 8종
            </h2>
          </div>
          <Link
            href="/protection"
            className="flex items-center gap-0.5 text-[12px] font-semibold text-primary"
          >
            전체보기 <ArrowRight size={12} />
          </Link>
        </div>
        <p className="text-[12px] text-text-sub mb-3 leading-relaxed">
          공공기관 자료 기반의 응급·돌봄·법률 가이드. 동네에서 다친 아이를 만났을 때 바로 펼쳐보세요.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <GuideCard
            href="/protection/emergency-guide"
            icon={<BriefcaseMedical size={18} color="#D85555" />}
            iconBg="#D8555515"
            title="응급 구조"
            sub="안전확보·지혈·이송"
          />
          <GuideCard
            href="/protection/disease-guide"
            icon={<Stethoscope size={18} color="#D85555" />}
            iconBg="#D8555515"
            title="질병 가이드"
            sub="흔한 10가지 질병"
          />
          <GuideCard
            href="/protection/kitten-guide"
            icon={<CatIcon size={18} color="#E8B040" />}
            iconBg="#E8B04015"
            title="냥줍 가이드"
            sub="관찰·체온·급여"
          />
          <GuideCard
            href="/protection/feeding-guide"
            icon={<Utensils size={18} color="#E88D5A" />}
            iconBg="#E88D5A15"
            title="먹이 가이드"
            sub="주면 안 되는 음식"
          />
          <GuideCard
            href="/protection/pharmacy-guide"
            icon={<Pill size={18} color="#D4708F" />}
            iconBg="#D4708F15"
            title="약품 가이드"
            sub="영양제·구충·상처"
          />
          <GuideCard
            href="/protection/shelter-guide"
            icon={<HomeIcon size={18} color="#4A7BA8" />}
            iconBg="#4A7BA815"
            title="쉼터·겨울나기"
            sub="숨숨집 DIY"
          />
          <GuideCard
            href="/protection/trapping-guide"
            icon={<Hand size={18} color="#8BA86B" />}
            iconBg="#8BA86B15"
            title="포획 가이드"
            sub="설치·대기·주의"
          />
          <GuideCard
            href="/protection/legal"
            icon={<ShieldCheck size={18} color="#8B65B8" />}
            iconBg="#8B65B815"
            title="법률 가이드"
            sub="학대 대응 매뉴얼"
          />
        </div>
      </section>

      {/* 꿀팁게시판 — 정보글 큐레이션 (SEO 강화) */}
      {tips.length > 0 && (
        <section className="px-5 mt-8 cv-auto">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 rounded-full" style={{ backgroundColor: "var(--color-primary)" }} />
              <h2 className="text-[15px] font-extrabold text-text-main tracking-tight flex items-center gap-1">
                <Sparkles size={15} className="text-primary" />
                꿀팁게시판
              </h2>
            </div>
            <Link
              href="/tips"
              className="flex items-center gap-0.5 text-[12px] font-semibold text-primary"
            >
              전체보기 <ArrowRight size={12} />
            </Link>
          </div>
          <p className="text-[12px] text-text-sub mb-3 leading-relaxed">
            길고양이 돌봄·TNR·중성화·구조에 도움되는 정보글. 도시공존이 큐레이션해 모았어요.
          </p>
          <div className="space-y-2">
            {tips.slice(0, 4).map((tip) => (
              <TipsRow key={tip.id} tip={tip} />
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
      <section className="px-5 mt-6 cv-auto">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-4 rounded-full" style={{ backgroundColor: "#6B8E6F" }} />
          <h2 className="text-[15px] font-extrabold text-text-main tracking-tight">왜 도시공존인가요?</h2>
        </div>
        <div className="space-y-2.5">
          <ValueRow
            icon={<ShieldCheck size={17} style={{ color: "#6B8E6F" }} />}
            title="급식소 위치는 공개되지 않아요"
            desc="길고양이 안전을 위해 정확 좌표는 내부에서만 근사치로 처리됩니다."
          />
          <ValueRow
            icon={<Bell size={17} style={{ color: "#D85555" }} />}
            title="긴급 돌봄 즉시 공유"
            desc="건강 상태가 위험한 아이는 동네에 빠르게 알려 구조로 이어집니다."
          />
          <ValueRow
            icon={<Sparkles size={17} style={{ color: "#E8B040" }} />}
            title="무료 · 광고 없음"
            desc="광고 없는 무료 서비스. 시민의 자발적 기록으로 운영됩니다."
          />
          <ValueRow
            icon={<Download size={17} style={{ color: "#4A7BA8" }} />}
            title="앱 설치 없이 홈 화면에 추가"
            desc="PWA 지원. 브라우저에서 바로 설치하면 앱처럼 열려요."
          />
        </div>
      </section>

      {/* FAQ (SEO 본문) */}
      <section className="px-5 mt-8 cv-auto">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-4 rounded-full" style={{ backgroundColor: "#8B65B8" }} />
          <h2 className="text-[15px] font-extrabold text-text-main tracking-tight">자주 묻는 질문</h2>
        </div>
        <div className="space-y-2">
          <FaqRow
            q="도시공존은 무엇인가요?"
            a="전국 길고양이를 시민이 함께 기록하고 돌보는 시민 참여 플랫폼입니다. 케어테이커가 지도 위에 TNR·급식·건강 기록을 남기고, 긴급 구조가 필요한 아이에게 이웃이 빠르게 닿을 수 있게 돕습니다."
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

      {/* 공유 CTA */}
      <section className="px-5 mt-8 cv-auto">
        <div
          className="rounded-2xl p-5"
          style={{
            background: "linear-gradient(135deg, #FFF9E8 0%, #FFF3CC 100%)",
            border: "1px solid rgba(232,176,64,0.25)",
          }}
        >
          <p className="text-[14px] font-extrabold text-text-main mb-1">
            동네 케어테이커 단톡방에 공유해보세요 🐾
          </p>
          <p className="text-[11.5px] text-text-sub mb-3 leading-relaxed">
            아이들을 지켜줄 이웃이 한 명 더 늘어납니다.
          </p>
          <ShareAreaButton guName="전국" slug="" catCount={data.catCount} urgentCount={0} />
        </div>
      </section>

      {/* 기술 자산 — 어떻게 만들어졌나 */}
      <section className="px-5 mt-8 cv-auto">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-4 rounded-full" style={{ backgroundColor: "#4A7BA8" }} />
          <h2 className="text-[15px] font-extrabold text-text-main tracking-tight">
            도시공존은 이렇게 만들어져요
          </h2>
        </div>
        <p className="text-[12px] text-text-sub mb-3 leading-relaxed">
          기록 한 줄이 헛되이 흘러가지 않게, 안전하게 오래 쌓일 수 있게 직접 짠 시스템 위에서 돌아갑니다.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <TechCard
            icon={<MapPin size={16} color="#AD5E3B" />}
            iconBg="#AD5E3B15"
            title="전국 구·동 자체 매핑"
            sub="구·동 단위 좌표 직접 정리"
          />
          <TechCard
            icon={<Bot size={16} color="#8B65B8" />}
            iconBg="#8B65B815"
            title="AI 집사 챗봇"
            sub="Google Gemini 기반"
          />
          <TechCard
            icon={<Radio size={16} color="#22B573" />}
            iconBg="#22B57315"
            title="실시간 동기화"
            sub="Supabase Realtime"
          />
          <TechCard
            icon={<Lock size={16} color="#6B8E6F" />}
            iconBg="#6B8E6F15"
            title="좌표 비공개 RLS"
            sub="DB 레벨 권한 분리"
          />
          <TechCard
            icon={<ShieldCheck size={16} color="#4A7BA8" />}
            iconBg="#4A7BA815"
            title="봇·어뷰징 방어"
            sub="Cloudflare Turnstile"
          />
          <TechCard
            icon={<Download size={16} color="#E8B040" />}
            iconBg="#E8B04015"
            title="앱 설치 없이 PWA"
            sub="홈 화면 추가 지원"
          />
        </div>
      </section>

      {/* 만든 사람 — 1인 운영자 정체성 */}
      <section className="px-5 mt-8 cv-auto">
        <div
          className="rounded-3xl p-5"
          style={{
            background: "linear-gradient(135deg, #FFF9F2 0%, #F4E8D8 100%)",
            border: "1px solid rgba(173, 94, 59,0.20)",
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: "rgba(173, 94, 59,0.15)" }}
            >
              <Code2 size={18} style={{ color: "var(--color-primary-dark)" }} />
            </div>
            <div className="min-w-0">
              <p className="text-[10.5px] font-extrabold tracking-[0.12em]" style={{ color: "var(--color-primary-dark)" }}>
                MADE BY ONE NEIGHBOR
              </p>
              <p className="text-[14px] font-extrabold text-text-main">
                만든 사람 · 김성우
              </p>
            </div>
          </div>
          <p className="text-[12.5px] leading-[1.85] text-text-sub">
            도시공존은 <b className="text-text-main">케어테이커 한 분 한 분의 손이 헛되지 않게 하고 싶다</b>는 마음으로
            1인 개발자가 직접 설계하고 운영하는 비영리 플랫폼이에요.
            <br />
            광고도, 수익 모델도 없이 자비로 굴러갑니다.
            서버·도메인·AI 비용까지 전부요.
          </p>
          <div className="flex gap-2 mt-4">
            <Link
              href="/maker"
              className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl text-[12px] font-extrabold active:scale-[0.98] transition-transform"
              style={{
                background: "#FFFFFF",
                color: "var(--color-primary-dark)",
                border: "1px solid rgba(173, 94, 59,0.25)",
              }}
            >
              <span>운영 이야기 보기</span>
              <ArrowRight size={12} />
            </Link>
            <a
              href="mailto:grow29971@gmail.com?subject=%5B%EB%8F%84%EC%8B%9C%EA%B3%B5%EC%A1%B4%5D%20%EC%A0%9C%ED%9C%B4%2F%EB%AC%B8%EC%9D%98"
              className="flex items-center justify-center gap-1 px-4 py-2.5 rounded-xl text-[12px] font-extrabold text-white active:scale-[0.98] transition-transform"
              style={{
                background: "linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)",
                boxShadow: "0 4px 12px rgba(173, 94, 59,0.3)",
              }}
            >
              <Mail size={12} />
              <span>제휴 문의</span>
            </a>
          </div>
        </div>
      </section>

      {/* 저작권 푸터 */}
      <footer className="px-5 mt-8 pb-6 text-center space-y-1">
        <div className="flex items-center justify-center gap-3 text-[10.5px] text-text-light flex-wrap">
          <Link href="/terms" className="hover:underline">이용약관</Link>
          <span>·</span>
          <Link href="/privacy" className="hover:underline">개인정보처리방침</Link>
          <span>·</span>
          <Link href="/about" className="hover:underline">소개</Link>
          <span>·</span>
          <Link href="/maker" className="hover:underline">만든 사람</Link>
        </div>
        <p className="text-[10px] text-text-light">© 2026 도시공존 · dosigongzon.com</p>
      </footer>
    </div>
  );
}

function TrustInline({ emoji, value, label, color }: { emoji: string; value: number; label: string; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span style={{ fontSize: 18 }}>{emoji}</span>
      <div className="flex flex-col leading-tight">
        <span className="text-[15px] font-extrabold" style={{ color }}>
          {value.toLocaleString()}
        </span>
        <span className="text-[9.5px] text-text-sub font-semibold">{label}</span>
      </div>
    </div>
  );
}

function ValueRow({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div
      className="bg-white rounded-2xl p-4 flex items-start gap-3"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="shrink-0 mt-0.5">{icon}</div>
      <div className="min-w-0">
        <p className="text-[13px] font-extrabold text-text-main">{title}</p>
        <p className="text-[11.5px] text-text-sub mt-0.5 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

function GuideCard({
  href,
  icon,
  iconBg,
  title,
  sub,
}: {
  href: string;
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  sub: string;
}) {
  return (
    <Link
      href={href}
      className="block bg-white rounded-2xl p-3 active:scale-[0.98] transition-transform"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="flex items-center gap-2.5">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: iconBg }}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-extrabold text-text-main truncate">{title}</p>
          <p className="text-[10.5px] text-text-sub truncate mt-0.5">{sub}</p>
        </div>
      </div>
    </Link>
  );
}

function TipsRow({ tip }: { tip: Tip }) {
  const photo = sanitizeImageUrl(tip.thumbnail_url, "");
  return (
    <Link
      href={`/tips/${tip.slug}`}
      className="flex gap-3 p-3 bg-white rounded-2xl active:scale-[0.99] transition-transform"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo}
          alt={tip.title}
          width={64}
          height={64}
          loading="lazy"
          className="w-16 h-16 rounded-xl object-cover shrink-0"
        />
      ) : (
        <div
          className="w-16 h-16 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "#F2EBE0" }}
        >
          <Sparkles size={20} className="text-primary opacity-60" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        {tip.tags.length > 0 && (
          <div className="flex gap-1 mb-0.5">
            {tip.tags.slice(0, 2).map((t) => (
              <span
                key={t}
                className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-md"
                style={{ background: "#F2EBE0", color: "#8B6F4E" }}
              >
                #{t}
              </span>
            ))}
          </div>
        )}
        <p className="text-[13px] font-extrabold text-text-main leading-snug line-clamp-2">
          {tip.title}
        </p>
        {tip.description && (
          <p className="text-[11px] text-text-sub line-clamp-1 mt-0.5">
            {tip.description}
          </p>
        )}
      </div>
    </Link>
  );
}

function StartStep({
  n,
  href,
  color,
  title,
  desc,
}: {
  n: number;
  href: string;
  color: string;
  title: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-3.5 py-3 rounded-2xl bg-white active:scale-[0.99] transition-transform"
      style={{
        boxShadow: "var(--shadow-card)",
        border: `1px solid ${color}25`,
      }}
    >
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white text-[13px] font-extrabold"
        style={{
          background: `linear-gradient(135deg, ${color} 0%, ${color}CC 100%)`,
          boxShadow: `0 3px 8px ${color}40`,
        }}
      >
        {n}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-extrabold text-text-main truncate">{title}</p>
        <p className="text-[11px] text-text-sub mt-0.5 leading-snug">{desc}</p>
      </div>
      <ArrowRight size={14} style={{ color, opacity: 0.5 }} className="shrink-0" />
    </Link>
  );
}

function TechCard({
  icon,
  iconBg,
  title,
  sub,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  sub: string;
}) {
  return (
    <div
      className="bg-white rounded-2xl p-3 flex items-center gap-2.5"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: iconBg }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-extrabold text-text-main truncate">{title}</p>
        <p className="text-[10.5px] text-text-sub truncate mt-0.5">{sub}</p>
      </div>
    </div>
  );
}

function FaqRow({ q, a }: { q: string; a: string }) {
  return (
    <details
      className="bg-white rounded-2xl p-4"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <summary className="text-[13px] font-extrabold text-text-main cursor-pointer list-none flex items-center justify-between">
        <span>{q}</span>
        <span className="text-text-light text-[12px]">+</span>
      </summary>
      <p className="text-[12px] text-text-sub mt-2.5 leading-relaxed">{a}</p>
    </details>
  );
}

function SafetyRow({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div
      className="bg-white rounded-xl p-3 flex items-start gap-2.5"
      style={{ boxShadow: "var(--shadow-card-sm)", border: "1px solid #E8DED0" }}
    >
      <span className="text-[18px] shrink-0 leading-none mt-0.5">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-extrabold text-text-main leading-snug tracking-tight">{title}</p>
        <p className="text-[11px] text-text-sub leading-relaxed mt-0.5">{body}</p>
      </div>
    </div>
  );
}
