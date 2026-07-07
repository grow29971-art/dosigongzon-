import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  Mail,
  Heart,
  MapPin,
  Sparkles,
  Shield,
  Users,
  Newspaper,
  Code2,
  Bot,
  Lock,
  Radio,
  ShieldCheck,
  Download,
  Compass,
  Eye,
  Wind,
  HandHeart,
  Cpu,
  CircuitBoard,
  Box,
  Wrench,
  Home,
  Flame,
  Thermometer,
  Video,
  BellRing,
  Puzzle,
  HeartCrack,
  Hammer,
} from "lucide-react";
import { createAnonClient } from "@/lib/supabase/anon";
import MediaKit from "@/app/components/MediaKit";

const SITE_URL = "https://dosigongzon.com";
const CONTACT_EMAIL = "grow29971@gmail.com";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "도시공존 소개 — 길고양이와 함께 걷는 시민 참여 플랫폼",
  description:
    "도시공존은 길고양이를 기록하고 돌보는 시민 참여 플랫폼입니다. 전국 케어테이커가 실시간으로 돌봄 기록을 공유하고, IoT 스마트쉼터·고양이난로 같은 돌봄 하드웨어로 길 위의 위험까지 직접 막습니다. 제휴·언론·블로그 문의 환영.",
  alternates: { canonical: "/about" },
  keywords: [
    "도시공존",
    "길고양이 플랫폼",
    "TNR 지도",
    "케어테이커 커뮤니티",
    "길고양이 돌봄",
    "시민 참여 플랫폼",
    "동물보호 플랫폼",
  ],
  openGraph: {
    type: "website",
    title: "도시공존 소개 | 길고양이와 함께 걷는 한 걸음",
    description: "전국 길고양이를 기록·돌봄하는 시민 참여 플랫폼.",
    url: `${SITE_URL}/about`,
    images: [{ url: `${SITE_URL}/opengraph-image`, width: 1200, height: 630 }],
  },
};

async function getStats() {
  try {
    const supabase = createAnonClient();
    const [catsRpc, hospitalsRes, profilesRes] = await Promise.all([
      // private/circle 모두 포함한 전체 카운트
      supabase.rpc("total_cat_count"),
      supabase.from("rescue_hospitals").select("*", { count: "exact", head: true }).eq("hidden", false),
      supabase.from("profiles").select("*", { count: "exact", head: true }),
    ]);
    return {
      cats: Number(catsRpc.data ?? 0),
      hospitals: hospitalsRes.count ?? 0,
      users: profilesRes.count ?? 0,
    };
  } catch {
    return { cats: 0, hospitals: 0, users: 0 };
  }
}

export default async function AboutPage() {
  const stats = await getStats();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "도시공존",
    url: SITE_URL,
    logo: `${SITE_URL}/icons/icon-512.png`,
    description: "길고양이를 기록하고 돌보는 시민 참여 플랫폼",
    email: CONTACT_EMAIL,
    areaServed: { "@type": "Country", name: "대한민국" },
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "홈", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "소개", item: `${SITE_URL}/about` },
    ],
  };

  return (
    <div className="min-h-dvh pb-16" style={{ background: "#F7F4EE" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd).replace(/</g, "\\u003c") }}
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

      {/* 히어로 */}
      <section className="px-5 pt-4">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 mb-3">
          <Heart size={12} style={{ color: "#5C8DEE" }} />
          <span className="text-[11px] font-extrabold" style={{ color: "#5C8DEE" }}>
            전국 · 비영리 시민 참여 플랫폼
          </span>
        </div>
        <h1 className="text-[26px] font-extrabold text-text-main leading-tight tracking-tight">
          전국 길고양이 <span style={{ color: "#5C8DEE" }}>{stats.cats.toLocaleString()}마리</span>의<br />
          돌봄 기록을 한 화면에.
        </h1>
        <p className="text-[13.5px] text-text-sub mt-3 leading-relaxed">
          <b className="text-text-main">도시공존</b>은 케어테이커가
          <b className="text-text-main"> TNR·건강·급식</b> 기록을 실시간으로 남기고,
          긴급 구조가 필요한 아이에게 동네 이웃이 빠르게 닿을 수 있도록 잇는
          전국 길고양이 돌봄 지도입니다.
        </p>
      </section>

      {/* 통계 */}
      <section className="px-5 mt-6">
        <div className="grid grid-cols-3 gap-2">
          <StatCard value={stats.cats} label="등록 고양이" color="#5C8DEE" emoji="🐾" />
          <StatCard value={stats.users} label="동네 이웃" color="#E86B8C" emoji="❤️" />
          <StatCard value={stats.hospitals} label="치료 병원" color="#22B573" emoji="🏥" />
        </div>
      </section>

      {/* 왜 만들었나 — 문제의식 */}
      <section className="px-5 mt-8">
        <h2 className="text-[16px] font-extrabold text-text-main mb-1">
          왜 도시공존을 만들었을까요
        </h2>
        <p className="text-[12px] text-text-sub mb-3 leading-relaxed">
          길 위의 아이들을 돌보는 일은 따뜻하지만, 돌보는 사람은 늘 외롭고 막막했어요.
          그 막막함의 정체를 들여다보니 세 가지 문제가 있었습니다.
        </p>
        <div className="space-y-2.5">
          <ProblemRow
            n={1}
            icon={<Puzzle size={18} color="#FFFFFF" />}
            title="정보의 파편화"
            desc="어느 골목 어떤 아이가 TNR이 됐는지, 어디가 급식소인지, 가까운 병원·약국은 어딘지 — 정작 필요한 정보는 카페 글, 단톡방, 누군가의 메모장에 흩어져 매번 처음부터 다시 찾아야 했어요."
          />
          <ProblemRow
            n={2}
            icon={<HeartCrack size={18} color="#FFFFFF" />}
            title="활동의 외로움"
            desc="대부분의 케어테이커는 혼자 묵묵히 길을 돕니다. 같은 동네에 누가 함께 돌보는지 몰라 손길이 겹치거나 비고, 힘든 순간에 기대고 안부를 나눌 이웃이 곁에 없어 쉽게 지쳤어요."
          />
          <ProblemRow
            n={3}
            icon={<Hammer size={18} color="#FFFFFF" />}
            title="도구의 부재"
            desc="기록은 종이와 기억에, 위급 상황은 발 빠른 운에 기대야 했어요. 흩어진 마음을 모으고 길 위의 위험을 실제로 막아줄, 손에 쥘 제대로 된 도구가 없었습니다."
          />
        </div>
        <div
          className="rounded-2xl p-4 mt-3 flex items-start gap-2.5"
          style={{ background: "linear-gradient(135deg, #FFF9F2 0%, #FCEFD9 100%)", border: "1px solid rgba(92,141,238,0.20)" }}
        >
          <Heart size={15} style={{ color: "#5C8DEE" }} className="shrink-0 mt-0.5" />
          <p className="text-[12.5px] leading-relaxed text-text-sub">
            <b className="text-text-main">그래서 도시공존을 만들었어요.</b> 흩어진 정보를 한 화면에 모으고,
            혼자였던 케어테이커를 같은 동네 이웃과 잇고, 화면 안팎으로 길 위의 아이들을 지킬 도구가 되기 위해서요.
          </p>
        </div>
      </section>

      {/* 핵심 기능 */}
      <section className="px-5 mt-8">
        <h2 className="text-[16px] font-extrabold text-text-main mb-3">
          우리가 하는 일
        </h2>
        <div className="space-y-2.5">
          <FeatureRow
            icon={<MapPin size={18} style={{ color: "#5C8DEE" }} />}
            title="동네 길고양이 지도"
            desc="TNR, 건강, 급식 상태를 지도 위에 실시간으로 기록. 급식소 위치는 안전을 위해 비공개."
          />
          <FeatureRow
            icon={<Sparkles size={18} style={{ color: "#D85555" }} />}
            title="긴급 구조 알림"
            desc="건강 상태가 위험한 아이는 즉시 동네 이웃에게 공유되어 빠른 구조로 이어집니다."
          />
          <FeatureRow
            icon={<Users size={18} style={{ color: "#4A7BA8" }} />}
            title="동네 커뮤니티"
            desc="케어테이커끼리 실시간 채팅, 커뮤니티 게시판, 1:1 쪽지로 정보와 안부를 나눠요."
          />
          <FeatureRow
            icon={<Shield size={18} style={{ color: "#6B8E6F" }} />}
            title="보호 지침 · 약품 가이드"
            desc="초보 케어테이커를 위한 응급처치, TNR, 새끼 구조, 법률 가이드를 한 곳에."
          />
        </div>
      </section>

      {/* 철학 — Mission / Vision / Values */}
      <section className="px-5 mt-8">
        <h2 className="text-[16px] font-extrabold text-text-main mb-3">철학과 가치</h2>

        {/* Mission */}
        <div
          className="rounded-3xl p-5 mb-3"
          style={{
            background: "linear-gradient(135deg, #FFF9F2 0%, #FCEFD9 100%)",
            border: "1px solid rgba(92,141,238,0.20)",
          }}
        >
          <div className="flex items-center gap-1.5 mb-3">
            <Compass size={14} style={{ color: "#5C8DEE" }} />
            <span
              className="text-[10px] font-extrabold tracking-[0.18em]"
              style={{ color: "#5C8DEE" }}
            >
              MISSION
            </span>
          </div>
          <p className="text-[15.5px] font-extrabold text-text-main leading-[1.55] mb-2.5 tracking-tight">
            언제나 어디서든 모두가<br />
            느낄 수 있는 새로운 형태의 자연을 제공합니다.
          </p>
          <p className="text-[12.5px] text-text-sub leading-relaxed">
            우리는 자연을 과학과 접목하여 발전시키고, 자연의 사전적 의미를 재정립합니다.
          </p>
        </div>

        {/* Vision */}
        <div
          className="rounded-3xl p-5 mb-3"
          style={{
            background: "linear-gradient(135deg, #F2F7F0 0%, #E5EDDD 100%)",
            border: "1px solid rgba(107,142,111,0.22)",
          }}
        >
          <div className="flex items-center gap-1.5 mb-3">
            <Eye size={14} style={{ color: "#4F6B53" }} />
            <span
              className="text-[10px] font-extrabold tracking-[0.18em]"
              style={{ color: "#4F6B53" }}
            >
              VISION
            </span>
          </div>
          <p className="text-[12.5px] text-text-sub leading-[1.95]">
            현재 인류에게는 자연이 주는 <b className="text-text-main">정서적 안정</b>이 필요합니다.
            지금까지 인류는 발전을 위해 자연을 정복하고 파괴해왔습니다.
            이제는 자연과 <b className="text-text-main">균형과 조화</b>를 맞춰야 할 때입니다.
          </p>
          <p className="text-[12.5px] text-text-sub leading-[1.95] mt-3">
            자연은 우리 삶의 기초가 되는 터전이며, 우리의 모든 것은 자연에서 시작되었습니다.
            자연이 주는 즐거움과 안정감을 함께 함으로써 자연과 인류 간 조화로운 미래를 만들기 위해,
            혁신적인 제품을 연구하고 사람들에게 제공하여 자연에 대한 이해와 경험을 모두와 나누고자 합니다.
          </p>
          <p className="text-[12.5px] text-text-sub leading-[1.95] mt-3">
            우리는 <b className="text-text-main">자연친화적인 세상</b>을 만들어 인류사회에 공헌합니다.
          </p>
        </div>

        {/* Values — 3 핵심 가치 */}
        <div className="flex items-center gap-1.5 mb-2 ml-1 mt-4">
          <Sparkles size={14} style={{ color: "#8B6FE0" }} />
          <span
            className="text-[10px] font-extrabold tracking-[0.18em]"
            style={{ color: "#8B6FE0" }}
          >
            VALUES
          </span>
        </div>
        <div className="space-y-2">
          <ValueCard
            n={1}
            icon={<Users size={16} color="#FFFFFF" />}
            accent="#5C8DEE"
            accentDark="#8B6FE0"
            title="연대"
            body="우리는 저마다 다른 문화·환경에서 각기 다른 삶을 살아왔지만, 인류라는 공통점을 가진 형제들이다. 항상 서로의 생각·개성·성향을 존중하고 형제애를 중요시한다."
          />
          <ValueCard
            n={2}
            icon={<Wind size={16} color="#FFFFFF" />}
            accent="#4A7BA8"
            accentDark="#3A6086"
            title="자유와 몰입"
            body="새로운 생각을 가로막는 고정 관념·관습·틀에서 벗어나 자연의 일부가 되어 한계를 초월하고 자유롭게 사고하며, 자연의 천재지변과 같이 매섭게 행동한다."
          />
          <ValueCard
            n={3}
            icon={<HandHeart size={16} color="#FFFFFF" />}
            accent="#6B8E6F"
            accentDark="#4F6B53"
            title="봉사"
            body="우리는 지구촌 형제들의 보급선이다. 우리는 모두에게 형제를 대하는 마음으로 서비스와 제품을 제공한다."
          />
        </div>
      </section>

      {/* 가치 */}
      <section className="px-5 mt-8">
        <div className="bg-white rounded-2xl p-5" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
          <h2 className="text-[15px] font-extrabold text-text-main mb-2">
            우리가 지키는 원칙
          </h2>
          <ul className="space-y-2 text-[12.5px] text-text-sub leading-relaxed">
            <li>
              <b className="text-text-main">안전 우선.</b> 길고양이의 급식소·숨숨집 정확 좌표는 절대 공개하지 않습니다.
            </li>
            <li>
              <b className="text-text-main">중립적 기록.</b> 특정 단체·정당과 무관하며 시민 누구나 참여할 수 있는 열린 플랫폼입니다.
            </li>
            <li>
              <b className="text-text-main">공신력 있는 자료 기반.</b> 보호 지침과 약품 정보는 농림축산식품부, 동물보호관리시스템 등 공공기관 공개 자료와 동물약국 표시사항을 바탕으로 정리하며, 긴급·의료 판단은 반드시 실제 수의사와 상의해주세요.
            </li>
            <li>
              <b className="text-text-main">광고 없는 무료 운영.</b> 광고·수익 모델 없이 전국 시민의 자발적 기록으로 유지됩니다.
            </li>
          </ul>
        </div>
      </section>

      {/* 만든 사람 — 1인 운영자 정체성 */}
      <section className="px-5 mt-8">
        <h2 className="text-[16px] font-extrabold text-text-main mb-3">만든 사람</h2>
        <div
          className="rounded-3xl p-5"
          style={{
            background: "linear-gradient(135deg, #FFF9F2 0%, #F4E8D8 100%)",
            border: "1px solid rgba(92,141,238,0.20)",
          }}
        >
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
              style={{ background: "rgba(92,141,238,0.15)" }}
            >
              <Code2 size={22} style={{ color: "#8B6FE0" }} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10.5px] font-extrabold tracking-[0.12em]" style={{ color: "#8B6FE0" }}>
                MADE BY ONE NEIGHBOR
              </p>
              <p className="text-[15px] font-extrabold text-text-main">김성우 · 1인 풀스택 메이커</p>
              <p className="text-[10.5px] text-text-sub mt-0.5">
                Software · Hardware · Product · Operations
              </p>
            </div>
          </div>

          <p className="text-[12.5px] leading-[1.9] text-text-sub">
            도시공존은 <b className="text-text-main">케어테이커 한 분의 손이 헛되지 않게</b>,
            그리고 길 위의 아이들이 매일 다시 보일 수 있게 하고 싶어,
            한 명이 직접 <b className="text-text-main">설계·개발·운영</b>까지 모두 떠안고 굴리는
            비영리 플랫폼이에요.
          </p>

          <p className="text-[12.5px] leading-[1.9] text-text-sub mt-3">
            소프트웨어만 다루지 않습니다. <b className="text-text-main">물리적인 손이 닿는 영역</b>까지
            직접 만들 줄 알기 때문에, 화면 너머 길 위의 문제를 도구로 해결하는 데 익숙해요.
            "코드로 끝나지 않는 서비스"를 만들 수 있는 이유이기도 합니다.
          </p>

          {/* 메이커 역량 4 카드 */}
          <div className="grid grid-cols-2 gap-2 mt-4">
            <SkillBadge
              icon={<Code2 size={13} />}
              title="풀스택 개발"
              sub="웹·앱·API·DB·인프라"
            />
            <SkillBadge
              icon={<Cpu size={13} />}
              title="임베디드·IoT"
              sub="Arduino·ESP·센서·통신"
            />
            <SkillBadge
              icon={<CircuitBoard size={13} />}
              title="PCB·회로"
              sub="설계·납땜·디버깅"
            />
            <SkillBadge
              icon={<Box size={13} />}
              title="3D 프린팅·CAD"
              sub="외형·케이스·프로토타입"
            />
            <SkillBadge
              icon={<Wrench size={13} />}
              title="기구·메카트로닉스"
              sub="모터·액츄에이터·조립"
            />
            <SkillBadge
              icon={<Bot size={13} />}
              title="AI 통합"
              sub="LLM·비전·자동화"
            />
          </div>

          <p className="text-[12.5px] leading-[1.9] text-text-sub mt-4">
            <b className="text-text-main">광고도, 유료 구독도, 데이터 판매도 없이</b>{" "}
            서버·도메인·AI 사용료·하드웨어 부품비까지 모두 운영자가 자비로 부담하며
            굴리고 있습니다. 서비스가 단체·정당·기업과 무관하게 중립을 지킬 수 있는
            이유이기도 해요.
          </p>

          <p className="text-[12.5px] leading-[1.9] text-text-sub mt-3">
            소프트웨어 한 줄, 회로 한 가닥, 도면 한 장이 모여
            길 위의 아이들에게 닿을 수 있다고 믿어요.
            이 플랫폼은 그 믿음에서 출발했습니다.
          </p>

          <a
            href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("[도시공존] 안녕하세요")}`}
            className="mt-4 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[12.5px] font-extrabold text-white active:scale-[0.98] transition-transform"
            style={{
              background: "linear-gradient(135deg, #5C8DEE 0%, #8B6FE0 100%)",
              boxShadow: "0 4px 12px rgba(92,141,238,0.3)",
            }}
          >
            <Mail size={13} />
            <span>운영자에게 직접 메일 보내기</span>
          </a>
        </div>
      </section>

      {/* 직접 만드는 돌봄 하드웨어 */}
      <section className="px-5 mt-8">
        <h2 className="text-[16px] font-extrabold text-text-main mb-1">
          화면 밖에서도, 직접 만듭니다
        </h2>
        <p className="text-[12px] text-text-sub mb-3 leading-relaxed">
          겨울철 동사, 차량 사고처럼 코드만으로는 닿지 않는 길 위의 위험이 있어요.
          그래서 도시공존은 소프트웨어를 넘어, 아이들을 실제로 지켜줄
          <b className="text-text-main"> 돌봄 하드웨어</b>를 직접 설계하고 만들고 있습니다.
        </p>
        <div className="space-y-2.5">
          <ProductCard
            icon={<Home size={22} color="#FFFFFF" />}
            accent="#4A7BA8"
            accentDark="#3A6086"
            badge="IoT · 개발 중"
            title="IoT 스마트쉼터"
            desc={
              <>
                추위와 위험으로부터 아이들을 지키는 <b className="text-text-main">발열 IoT 쉼터</b>예요.
                내부 온도를 따뜻하게 유지하고, 카메라·센서로 출입과 이상을 감지해
                도시공존 앱으로 실시간 알림을 보냅니다. 운영자 한 명이 감시하는 게 아니라,
                <b className="text-text-main"> 같은 동네 케어테이커가 직접 모니터링</b>하는 구조로 설계했어요.
              </>
            }
            pills={[
              { icon: <Thermometer size={11} />, label: "발열 보온" },
              { icon: <Video size={11} />, label: "CCTV 모니터링" },
              { icon: <Cpu size={11} />, label: "출입·이상 감지" },
              { icon: <BellRing size={11} />, label: "실시간 알림" },
            ]}
          />
          <ProductCard
            icon={<Flame size={22} color="#FFFFFF" />}
            accent="#5C8DEE"
            accentDark="#8B6FE0"
            badge="개발 중"
            title="고양이난로"
            desc={
              <>
                혹한에 길 위의 아이들이 얼지 않도록 만드는 <b className="text-text-main">저전력 전자 온열 기구</b>예요.
                스마트쉼터보다 가볍게, 급식소나 숨숨집 곁에 두고 쓸 수 있게 설계하고 있어요.
                안전한 발열과 과열 차단을 1순위로, <b className="text-text-main">겨울철 동사를 막는 가장 작은 한 걸음</b>을 목표로 합니다.
              </>
            }
            pills={[
              { icon: <Thermometer size={11} />, label: "저전력 발열" },
              { icon: <Box size={11} />, label: "급식소 곁 설치" },
              { icon: <Wrench size={11} />, label: "과열 차단 안전 설계" },
            ]}
          />
        </div>
        <p className="text-[11.5px] text-text-light mt-3 leading-relaxed">
          ※ 하드웨어는 현재 설계·시제품 단계이며, KC 인증을 거쳐 순차적으로 선보일 예정이에요.
        </p>
      </section>

      {/* 기술 자산 — 어떻게 만들어졌나 */}
      <section className="px-5 mt-8">
        <h2 className="text-[16px] font-extrabold text-text-main mb-1">
          이 플랫폼은 어떻게 만들어졌나요
        </h2>
        <p className="text-[12px] text-text-sub mb-3 leading-relaxed">
          기록 한 줄이 헛되이 흘러가지 않게, 그리고 아이들의 좌표가 오용되지 않게.
          도시공존은 안전과 정확성을 1순위로 두고 직접 짠 시스템 위에서 돌아갑니다.
        </p>
        <div className="space-y-2">
          <TechRow
            icon={<MapPin size={18} style={{ color: "#5C8DEE" }} />}
            title="전국 구·동 자체 좌표 매핑"
            desc="구·동 단위 좌표를 직접 정리한 자체 데이터셋. 외부 행정 API 없이도 한 화면에 모든 자치구가 즉시 뜹니다."
          />
          <TechRow
            icon={<Bot size={18} style={{ color: "#8B65B8" }} />}
            title="AI 집사 챗봇 (Google Gemini)"
            desc="응급·구조·식이 질문에 즉시 답하는 케어테이커 보조 AI. 호칭과 상황을 사용자에 맞춰 실시간 생성합니다."
          />
          <TechRow
            icon={<Radio size={18} style={{ color: "#22B573" }} />}
            title="실시간 동기화 (Supabase Realtime)"
            desc="누군가 새 기록을 남기면 같은 동네 케어테이커 화면에 즉시 반영. 1:1 쪽지·구조 신호도 같은 채널로 흐릅니다."
          />
          <TechRow
            icon={<Lock size={18} style={{ color: "#6B8E6F" }} />}
            title="좌표 비공개 — DB 레벨 권한 분리 (RLS)"
            desc="급식소 정확 좌표는 클라이언트로 절대 내려가지 않습니다. Supabase Row Level Security로 DB가 직접 거절합니다."
          />
          <TechRow
            icon={<ShieldCheck size={18} style={{ color: "#4A7BA8" }} />}
            title="봇·어뷰징 방어 (Cloudflare Turnstile)"
            desc="회원가입과 민감 액션에 캡차를 걸어 사료 광고·악성 도배·계정 양산을 차단합니다."
          />
          <TechRow
            icon={<Download size={18} style={{ color: "#E8B040" }} />}
            title="앱 설치 없이 PWA"
            desc="크롬·사파리에서 홈 화면에 추가하면 별도 앱처럼 열려요. Android는 Play Store 배포도 함께 진행 중입니다."
          />
        </div>
      </section>

      {/* 미디어 키트 — 언론·블로거 즉시 활용 */}
      <section className="px-5 mt-8">
        <h2 className="text-[16px] font-extrabold text-text-main mb-1 flex items-center gap-1.5">
          <Newspaper size={15} style={{ color: "#5C8DEE" }} />
          미디어 키트 · 보도 자료
        </h2>
        <p className="text-[11.5px] text-text-sub mb-3 leading-relaxed">
          블로그·트위터·기사에 도시공존을 소개할 때 그대로 복사해서 쓰실 수 있어요.
        </p>
        <MediaKit cats={stats.cats} users={stats.users} hospitals={stats.hospitals} />
      </section>

      {/* 파트너십/문의 */}
      <section className="px-5 mt-8">
        <h2 className="text-[16px] font-extrabold text-text-main mb-3">
          제휴 · 언론 · 블로그 문의
        </h2>
        <div className="bg-white rounded-2xl p-5" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
          <p className="text-[13px] text-text-sub leading-relaxed mb-4">
            동물병원, 보호단체, 언론사, 지자체, 블로거와의 협력을 환영합니다.
            취재 요청, 스크린샷·로고 요청, 데이터 제공, 지역 파트너십 등
            어떤 주제든 편하게 연락 주세요.
          </p>
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("[도시공존] 제휴/문의")}`}
            className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-primary text-white active:scale-[0.98] transition-transform"
            style={{ boxShadow: "0 4px 14px rgba(92,141,238,0.3)" }}
          >
            <Mail size={16} />
            <span className="text-[13.5px] font-extrabold">{CONTACT_EMAIL}</span>
          </a>
          <p className="text-[11px] text-text-light mt-2.5 text-center">
            운영자: 김성우 · 보통 1~2일 내 회신
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="px-5 mt-8">
        <div className="flex gap-2">
          <Link
            href="/map"
            className="flex-1 flex items-center justify-center py-3 rounded-2xl bg-primary text-white text-[13px] font-extrabold active:scale-[0.98] transition-transform"
            style={{ boxShadow: "0 4px 14px rgba(92,141,238,0.3)" }}
          >
            지도 보러가기
          </Link>
          <Link
            href="/areas"
            className="flex-1 flex items-center justify-center py-3 rounded-2xl active:scale-[0.98] transition-transform"
            style={{ backgroundColor: "#FFF", color: "#5C8DEE", border: "1.5px solid #E8D4BD", fontSize: 13, fontWeight: 800 }}
          >
            우리 동네 보기
          </Link>
        </div>
      </section>
    </div>
  );
}

function StatCard({ value, label, color, emoji }: { value: number; label: string; color: string; emoji: string }) {
  return (
    <div
      className="bg-white rounded-2xl py-4 flex flex-col items-center"
      style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}
    >
      <span style={{ fontSize: 22 }}>{emoji}</span>
      <span className="text-[20px] font-extrabold mt-0.5" style={{ color }}>
        {value.toLocaleString()}
      </span>
      <span className="text-[10.5px] text-text-sub font-semibold mt-0.5">{label}</span>
    </div>
  );
}

function FeatureRow({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div
      className="bg-white rounded-2xl p-4 flex items-start gap-3"
      style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}
    >
      <div className="shrink-0 mt-0.5">{icon}</div>
      <div className="min-w-0">
        <p className="text-[13.5px] font-extrabold text-text-main">{title}</p>
        <p className="text-[12px] text-text-sub mt-1 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

function TechRow({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div
      className="bg-white rounded-2xl p-4 flex items-start gap-3"
      style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}
    >
      <div className="shrink-0 mt-0.5">{icon}</div>
      <div className="min-w-0">
        <p className="text-[13px] font-extrabold text-text-main">{title}</p>
        <p className="text-[11.5px] text-text-sub mt-1 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

function ProblemRow({
  n,
  icon,
  title,
  desc,
}: {
  n: number;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div
      className="bg-white rounded-2xl p-4 flex items-start gap-3"
      style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}
    >
      <div
        className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
        style={{ background: "linear-gradient(135deg, #8A94A6 0%, #6B7689 100%)" }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-extrabold tracking-[0.12em]" style={{ color: "#6B7689" }}>
            0{n}
          </span>
          <p className="text-[13.5px] font-extrabold text-text-main">{title}</p>
        </div>
        <p className="text-[12px] text-text-sub leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

function ProductCard({
  icon,
  accent,
  accentDark,
  badge,
  title,
  desc,
  pills,
}: {
  icon: React.ReactNode;
  accent: string;
  accentDark: string;
  badge: string;
  title: string;
  desc: React.ReactNode;
  pills: { icon: React.ReactNode; label: string }[];
}) {
  return (
    <div
      className="rounded-3xl p-5 bg-white"
      style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.05)", border: `1px solid ${accent}26` }}
    >
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
          style={{ background: `linear-gradient(135deg, ${accent} 0%, ${accentDark} 100%)` }}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-[15px] font-extrabold text-text-main">{title}</p>
            <span
              className="px-1.5 py-0.5 rounded-full text-[9px] font-extrabold tracking-tight"
              style={{ background: `${accent}1A`, color: accentDark }}
            >
              {badge}
            </span>
          </div>
        </div>
      </div>
      <p className="text-[12.5px] leading-[1.9] text-text-sub">{desc}</p>
      <div className="flex flex-wrap gap-1.5 mt-3">
        {pills.map((p, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10.5px] font-bold"
            style={{ background: `${accent}12`, color: accentDark }}
          >
            {p.icon}
            {p.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function SkillBadge({
  icon,
  title,
  sub,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
}) {
  return (
    <div
      className="rounded-xl p-2.5 bg-white"
      style={{ border: "1px solid rgba(92,141,238,0.18)" }}
    >
      <div className="flex items-center gap-1.5 mb-0.5" style={{ color: "#8B6FE0" }}>
        {icon}
        <p className="text-[11.5px] font-extrabold tracking-tight text-text-main">{title}</p>
      </div>
      <p className="text-[10px] text-text-sub leading-tight">{sub}</p>
    </div>
  );
}

function ValueCard({
  n,
  icon,
  accent,
  accentDark,
  title,
  body,
}: {
  n: number;
  icon: React.ReactNode;
  accent: string;
  accentDark: string;
  title: string;
  body: string;
}) {
  return (
    <div
      className="rounded-2xl p-4 flex items-start gap-3 bg-white"
      style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}
    >
      <div
        className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
        style={{ background: `linear-gradient(135deg, ${accent} 0%, ${accentDark} 100%)` }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span
            className="text-[10px] font-extrabold tracking-[0.12em]"
            style={{ color: accentDark }}
          >
            0{n}
          </span>
          <p className="text-[14px] font-extrabold text-text-main tracking-tight">{title}</p>
        </div>
        <p className="text-[12px] text-text-sub leading-relaxed">{body}</p>
      </div>
    </div>
  );
}
