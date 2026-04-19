import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Mail, Heart, MapPin, Sparkles, Shield, Users } from "lucide-react";
import { createAnonClient } from "@/lib/supabase/anon";

const SITE_URL = "https://dosigongzon.com";
const CONTACT_EMAIL = "grow29971@gmail.com";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "도시공존 소개 — 길고양이와 함께 걷는 시민 참여 플랫폼",
  description:
    "도시공존은 길고양이를 기록하고 돌보는 시민 참여 플랫폼입니다. 서울 전역의 캣맘·캣대디가 실시간으로 돌봄 기록을 공유하고 긴급 구조를 돕습니다. 제휴·언론·블로그 문의 환영.",
  alternates: { canonical: "/about" },
  keywords: [
    "도시공존",
    "길고양이 플랫폼",
    "TNR 지도",
    "캣맘 커뮤니티",
    "길고양이 돌봄",
    "시민 참여 플랫폼",
    "동물보호 플랫폼",
  ],
  openGraph: {
    type: "website",
    title: "도시공존 소개 | 길고양이와 함께 걷는 한 걸음",
    description: "서울 전역의 길고양이를 기록·돌봄하는 시민 참여 플랫폼.",
    url: `${SITE_URL}/about`,
    images: [{ url: `${SITE_URL}/opengraph-image`, width: 1200, height: 630 }],
  },
};

async function getStats() {
  try {
    const supabase = createAnonClient();
    const [catsRes, hospitalsRes, profilesRes] = await Promise.all([
      supabase.from("cats").select("*", { count: "exact", head: true }),
      supabase.from("rescue_hospitals").select("*", { count: "exact", head: true }).eq("hidden", false),
      supabase.from("profiles").select("*", { count: "exact", head: true }),
    ]);
    return {
      cats: catsRes.count ?? 0,
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
    areaServed: { "@type": "City", name: "서울특별시" },
  };

  return (
    <div className="min-h-dvh pb-16" style={{ background: "#F7F4EE" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
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
          <Heart size={12} style={{ color: "#C47E5A" }} />
          <span className="text-[11px] font-extrabold" style={{ color: "#C47E5A" }}>시민 참여 플랫폼</span>
        </div>
        <h1 className="text-[26px] font-extrabold text-text-main leading-tight tracking-tight">
          길 위의 생명과 함께 걷는 <br />따뜻한 한 걸음
        </h1>
        <p className="text-[13.5px] text-text-sub mt-3 leading-relaxed">
          <b className="text-text-main">도시공존</b>은 서울 전역의 길고양이를 기록하고 돌보는 시민 참여 플랫폼입니다.
          캣맘·캣대디가 실시간으로 TNR 상태, 건강, 급식 기록을 공유하고,
          긴급 구조가 필요한 아이에게 동네 이웃이 빠르게 달려갈 수 있도록 돕습니다.
        </p>
      </section>

      {/* 통계 */}
      <section className="px-5 mt-6">
        <div className="grid grid-cols-3 gap-2">
          <StatCard value={stats.cats} label="등록 고양이" color="#C47E5A" emoji="🐾" />
          <StatCard value={stats.users} label="동네 이웃" color="#E86B8C" emoji="❤️" />
          <StatCard value={stats.hospitals} label="치료 병원" color="#22B573" emoji="🏥" />
        </div>
      </section>

      {/* 핵심 기능 */}
      <section className="px-5 mt-8">
        <h2 className="text-[16px] font-extrabold text-text-main mb-3">
          우리가 하는 일
        </h2>
        <div className="space-y-2.5">
          <FeatureRow
            icon={<MapPin size={18} style={{ color: "#C47E5A" }} />}
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
            desc="캣맘·캣대디끼리 실시간 채팅, 커뮤니티 게시판, 1:1 쪽지로 정보와 안부를 나눠요."
          />
          <FeatureRow
            icon={<Shield size={18} style={{ color: "#6B8E6F" }} />}
            title="보호 지침 · 약품 가이드"
            desc="초보 캣맘을 위한 응급처치, TNR, 새끼 구조, 법률 가이드를 한 곳에."
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
              <b className="text-text-main">검증된 정보.</b> 보호 지침, 약품 정보는 수의사 감수를 거친 자료를 기준으로 제공합니다.
            </li>
            <li>
              <b className="text-text-main">비영리 운영.</b> 광고·수익 모델 없이 서울 시민의 자발적 기록으로 운영됩니다.
            </li>
          </ul>
        </div>
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
            style={{ boxShadow: "0 4px 14px rgba(196,126,90,0.3)" }}
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
            style={{ boxShadow: "0 4px 14px rgba(196,126,90,0.3)" }}
          >
            지도 보러가기
          </Link>
          <Link
            href="/areas"
            className="flex-1 flex items-center justify-center py-3 rounded-2xl active:scale-[0.98] transition-transform"
            style={{ backgroundColor: "#FFF", color: "#C47E5A", border: "1.5px solid #E8D4BD", fontSize: 13, fontWeight: 800 }}
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
