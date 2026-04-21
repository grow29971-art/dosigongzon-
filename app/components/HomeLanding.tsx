// SEO 랜딩 — 비로그인 방문자 + 크롤러 + 소셜 스크랩 대상
// 서버 컴포넌트로 풍부한 HTML을 첫 바이트에 실어 보냄.

import Link from "next/link";
import { MapPin, Heart, Sparkles, ShieldCheck, ArrowRight, PawPrint, Bell, Download } from "lucide-react";
import { createAnonClient } from "@/lib/supabase/anon";
import { SEOUL_GUS } from "@/lib/seoul-regions";
import { sanitizeImageUrl } from "@/lib/url-validate";
import LandingOnboardingGate from "@/app/components/LandingOnboardingGate";
import ShareAreaButton from "@/app/components/ShareAreaButton";
import TodayVisitors from "@/app/components/TodayVisitors";

const SITE_URL = "https://dosigongzon.com";

async function getLandingData() {
  try {
    const supabase = createAnonClient();
    const [catsRes, recentCatsRes, hospitalsRes, profilesRes] = await Promise.all([
      supabase.from("cats").select("*", { count: "exact", head: true }),
      supabase
        .from("cats")
        .select("id, name, region, photo_url, health_status, created_at")
        .order("created_at", { ascending: false })
        .limit(6),
      supabase.from("rescue_hospitals").select("*", { count: "exact", head: true }).eq("hidden", false),
      supabase.from("profiles").select("*", { count: "exact", head: true }),
    ]);
    return {
      catCount: catsRes.count ?? 0,
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
    };
  } catch {
    return { catCount: 0, hospitalCount: 0, userCount: 0, recentCats: [] };
  }
}

export default async function HomeLanding() {
  const data = await getLandingData();
  const featuredGus = ["gangnam", "mapo", "songpa", "yongsan", "seongdong", "gwanak"];
  const featured = SEOUL_GUS.filter((g) => featuredGus.includes(g.slug));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "도시공존",
    url: SITE_URL,
    description: "길고양이 돌봄 시민 참여 플랫폼. 서울 전역의 TNR·돌봄·구조 기록을 지도 위에서 함께 남깁니다.",
    applicationCategory: "SocialNetworkingApplication",
    operatingSystem: "Web, iOS, Android (PWA)",
    offers: { "@type": "Offer", price: "0", priceCurrency: "KRW" },
    aggregateRating: data.catCount > 0 ? {
      "@type": "AggregateRating",
      ratingValue: "4.8",
      reviewCount: Math.max(data.userCount, 10),
    } : undefined,
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
          text: "서울 전역의 길고양이를 시민이 함께 기록하고 돌보는 시민 참여 플랫폼입니다. 캣맘·캣대디가 지도 위에 TNR·급식·건강 기록을 남기고, 긴급 구조가 필요한 아이에게 이웃이 빠르게 닿을 수 있게 돕습니다.",
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
          text: "네. 광고 없이 무료로 운영되며 이익을 목적으로 하지 않습니다. 서울 시민의 자발적 기록으로 유지됩니다.",
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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <LandingOnboardingGate />

      {/* 히어로 */}
      <section className="px-5 pt-14 pb-8" style={{ background: "linear-gradient(180deg, #FFF9F2 0%, #F7F4EE 100%)" }}>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 mb-3">
          <Heart size={12} style={{ color: "#C47E5A" }} />
          <span className="text-[11px] font-extrabold" style={{ color: "#C47E5A" }}>
            {data.userCount > 0
              ? `${data.userCount.toLocaleString()}명의 이웃과 함께`
              : "서울 시민 참여 플랫폼"}
          </span>
        </div>
        <h1 className="text-[30px] font-black text-text-main leading-[1.15] tracking-tight">
          우리 동네 길고양이, <br />
          <span className="text-primary">함께 기록하고 지켜요.</span>
        </h1>
        <p className="text-[13.5px] text-text-sub mt-3 leading-relaxed">
          서울 전역 길고양이 <b className="text-text-main">{data.catCount.toLocaleString()}마리</b>의 돌봄 기록이
          <br />
          캣맘·캣대디의 손으로 실시간 공유되고 있어요.
        </p>

        {/* 방문자 수 실시간 (client) */}
        <TodayVisitors />

        {/* CTA — primary + ghost 대비 */}
        <div className="flex gap-2 mt-5">
          <Link
            href="/map"
            className="flex-[1.4] flex items-center justify-center gap-1.5 py-4 rounded-2xl text-white active:scale-[0.98] transition-transform"
            style={{
              background: "linear-gradient(135deg, #C47E5A 0%, #A8684A 100%)",
              boxShadow: "0 8px 22px rgba(196,126,90,0.38), 0 2px 6px rgba(168,104,74,0.22)",
            }}
          >
            <PawPrint size={15} />
            <span className="text-[14px] font-extrabold tracking-tight">지도 바로 보기</span>
          </Link>
          <Link
            href="/signup"
            className="flex-1 flex items-center justify-center py-4 rounded-2xl active:scale-[0.98] transition-transform"
            style={{
              background: "transparent",
              color: "#C47E5A",
              border: "1.5px solid rgba(196,126,90,0.35)",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            돌봄 시작하기
          </Link>
        </div>

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

      {/* 감성 인용 — 철학적 질문 */}
      <section className="px-5 mt-8">
        <div
          className="relative rounded-3xl px-6 py-7 overflow-hidden"
          style={{
            background: "linear-gradient(135deg, #FDF7EE 0%, #F6E8D4 100%)",
            border: "1px solid rgba(196,126,90,0.18)",
          }}
        >
          <span
            aria-hidden="true"
            className="absolute -top-2 left-4 select-none"
            style={{
              fontSize: 60,
              lineHeight: 1,
              fontFamily: "serif",
              color: "rgba(196,126,90,0.25)",
            }}
          >
            “
          </span>
          <p
            className="text-[14.5px] leading-[1.9] text-text-main relative z-10"
            style={{ fontFamily: "serif" }}
          >
            우리는 <b style={{ color: "#C47E5A" }}>길 위의 아이들</b>의 삶을
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
            style={{ color: "#C47E5A" }}
          >
            — 도시공존
          </p>
        </div>
      </section>

      {/* 최근 등록된 고양이들 */}
      {data.recentCats.length > 0 && (
        <section className="px-5 mt-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 rounded-full" style={{ backgroundColor: "#C47E5A" }} />
              <h2 className="text-[15px] font-extrabold text-text-main tracking-tight">최근 등록된 아이들</h2>
            </div>
            <Link href="/map" className="flex items-center gap-0.5 text-[12px] font-semibold text-primary">
              전체보기 <ArrowRight size={12} />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {data.recentCats.slice(0, 4).map((c) => {
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
                      aspectRatio: "4/3",
                      backgroundImage: `url('${photo}')`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  >
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
      <section className="px-5 mt-8">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-4 rounded-full" style={{ backgroundColor: "#4A7BA8" }} />
          <h2 className="text-[15px] font-extrabold text-text-main tracking-tight">서울 구별 지도</h2>
          <span className="text-[9px] font-bold tracking-[0.15em]" style={{ color: "#4A7BA8", opacity: 0.6 }}>
            25 DISTRICTS
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
              style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
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
          style={{ backgroundColor: "#FFF", color: "#C47E5A", border: "1px solid #E8D4BD" }}
        >
          서울 25개 구 전체 보기 →
        </Link>
      </section>

      {/* 숫자로 보는 도시공존 — 컴팩트한 통계 스트립 */}
      <section className="px-5 mt-8">
        <div
          className="rounded-2xl px-4 py-3 flex items-center justify-around"
          style={{
            background: "#FFFFFF",
            boxShadow: "0 4px 14px rgba(0,0,0,0.05)",
            border: "1px solid rgba(0,0,0,0.04)",
          }}
        >
          <TrustInline emoji="🐾" value={data.catCount} label="등록" color="#C47E5A" />
          <span className="w-px h-8" style={{ background: "rgba(0,0,0,0.06)" }} />
          <TrustInline emoji="❤️" value={data.userCount} label="이웃" color="#E86B8C" />
          <span className="w-px h-8" style={{ background: "rgba(0,0,0,0.06)" }} />
          <TrustInline emoji="🏥" value={data.hospitalCount} label="병원" color="#22B573" />
        </div>
      </section>

      {/* 핵심 가치 */}
      <section className="px-5 mt-6">
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
      <section className="px-5 mt-8">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-4 rounded-full" style={{ backgroundColor: "#8B65B8" }} />
          <h2 className="text-[15px] font-extrabold text-text-main tracking-tight">자주 묻는 질문</h2>
        </div>
        <div className="space-y-2">
          <FaqRow
            q="도시공존은 무엇인가요?"
            a="서울 전역의 길고양이를 시민이 함께 기록하고 돌보는 시민 참여 플랫폼입니다. 캣맘·캣대디가 지도 위에 TNR·급식·건강 기록을 남기고, 긴급 구조가 필요한 아이에게 이웃이 빠르게 닿을 수 있게 돕습니다."
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
      <section className="px-5 mt-8">
        <div
          className="rounded-2xl p-5"
          style={{
            background: "linear-gradient(135deg, #FFF9E8 0%, #FFF3CC 100%)",
            border: "1px solid rgba(232,176,64,0.25)",
          }}
        >
          <p className="text-[14px] font-extrabold text-text-main mb-1">
            동네 캣맘 단톡방에 공유해보세요 🐾
          </p>
          <p className="text-[11.5px] text-text-sub mb-3 leading-relaxed">
            아이들을 지켜줄 이웃이 한 명 더 늘어납니다.
          </p>
          <ShareAreaButton guName="서울" slug="" catCount={data.catCount} urgentCount={0} />
        </div>
      </section>

      {/* 소개 링크 */}
      <section className="px-5 mt-6">
        <Link
          href="/about"
          className="flex items-center justify-between px-4 py-3.5 rounded-2xl bg-white"
          style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
        >
          <div>
            <p className="text-[13px] font-extrabold text-text-main">도시공존에 대해 더 알아보기</p>
            <p className="text-[11px] text-text-sub mt-0.5">제휴·언론·블로그 문의 환영</p>
          </div>
          <ArrowRight size={16} className="text-text-light" />
        </Link>
      </section>

      {/* 저작권 푸터 */}
      <footer className="px-5 mt-8 pb-6 text-center space-y-1">
        <div className="flex items-center justify-center gap-3 text-[10.5px] text-text-light">
          <Link href="/terms" className="hover:underline">이용약관</Link>
          <span>·</span>
          <Link href="/privacy" className="hover:underline">개인정보처리방침</Link>
          <span>·</span>
          <Link href="/about" className="hover:underline">문의</Link>
        </div>
        <p className="text-[10px] text-text-light">
          © 2026 도시공존 · 운영자 김성우 · dosigongzon.com
        </p>
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
      style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}
    >
      <div className="shrink-0 mt-0.5">{icon}</div>
      <div className="min-w-0">
        <p className="text-[13px] font-extrabold text-text-main">{title}</p>
        <p className="text-[11.5px] text-text-sub mt-0.5 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

function FaqRow({ q, a }: { q: string; a: string }) {
  return (
    <details
      className="bg-white rounded-2xl p-4"
      style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}
    >
      <summary className="text-[13px] font-extrabold text-text-main cursor-pointer list-none flex items-center justify-between">
        <span>{q}</span>
        <span className="text-text-light text-[12px]">+</span>
      </summary>
      <p className="text-[12px] text-text-sub mt-2.5 leading-relaxed">{a}</p>
    </details>
  );
}
