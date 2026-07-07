import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Heart, PawPrint, Users, Sparkles, Trophy } from "lucide-react";
import { createAnonClient } from "@/lib/supabase/anon";

const SITE_URL = "https://dosigongzon.com";

export const metadata: Metadata = {
  title: "🎉 도시공존 정식 출시 — 처음부터 함께해 주셔서 감사합니다",
  description:
    "2026년 6월 1일 도시공존 정식 출시. 길고양이 한 마리를 위한 시민의 손길이 함께 모인 시간들. 케어테이커·시민 여러분, 진심으로 감사드립니다.",
  alternates: { canonical: "/celebrate" },
  openGraph: {
    type: "website",
    title: "🎉 도시공존 정식 출시",
    description: "처음부터 함께해 주셔서 감사합니다.",
    url: `${SITE_URL}/celebrate`,
    images: [{ url: `${SITE_URL}/opengraph-image`, width: 1200, height: 630 }],
  },
};

export const revalidate = 600; // 10분 캐시

async function getStats() {
  try {
    const supabase = createAnonClient();
    const [catsRpc, profilesRes, hospitalsRes] = await Promise.all([
      supabase.rpc("total_cat_count"),
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("rescue_hospitals").select("*", { count: "exact", head: true }).eq("hidden", false),
    ]);
    return {
      cats: Number(catsRpc.data ?? 0),
      users: profilesRes.count ?? 0,
      hospitals: hospitalsRes.count ?? 0,
    };
  } catch {
    return { cats: 0, users: 0, hospitals: 0 };
  }
}

export default async function CelebratePage() {
  const stats = await getStats();

  return (
    <div className="min-h-dvh pb-16" style={{ background: "#F7F4EE" }}>
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

      {/* 히어로 — 출시 축하 */}
      <section className="px-5 pt-8 text-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full mb-4" style={{ background: "rgba(92,141,238,0.12)", color: "#8B6FE0" }}>
          <Sparkles size={12} />
          <span className="text-[10.5px] font-extrabold tracking-[0.18em]">OFFICIAL LAUNCH · 2026.06.01</span>
        </div>
        <h1 className="text-[32px] font-extrabold text-text-main leading-tight tracking-tight">
          🎉 도시공존<br />
          <span style={{ color: "#5C8DEE" }}>정식 출시</span>
        </h1>
        <p className="text-[14px] text-text-sub mt-4 leading-[1.85] max-w-md mx-auto">
          처음부터 함께해 주신 모든 케어테이커와 시민 여러분께
          <br />
          진심으로 감사드립니다.
        </p>
      </section>

      {/* 누적 통계 */}
      <section className="px-5 mt-8">
        <p className="text-[10.5px] font-extrabold tracking-[0.18em] text-center mb-3" style={{ color: "#8B6FE0" }}>
          THIS FAR, TOGETHER
        </p>
        <div className="grid grid-cols-3 gap-2">
          <StatBlock
            icon={<PawPrint size={18} color="#fff" />}
            value={stats.cats.toLocaleString()}
            label="등록된 아이들"
            color="#5C8DEE"
            accent="#8B6FE0"
          />
          <StatBlock
            icon={<Users size={18} color="#fff" />}
            value={stats.users.toLocaleString()}
            label="케어테이커"
            color="#E86B8C"
            accent="#D85577"
          />
          <StatBlock
            icon={<Heart size={18} color="#fff" />}
            value={stats.hospitals.toLocaleString()}
            label="치료 병원"
            color="#6B8E6F"
            accent="#4F6B53"
          />
        </div>
      </section>

      {/* 메시지 — 처음부터 함께한 이야기 */}
      <section className="px-5 mt-8">
        <div
          className="rounded-3xl p-6"
          style={{
            background: "linear-gradient(135deg, #FFF9F2 0%, #FCEFD9 100%)",
            border: "1px solid rgba(92,141,238,0.20)",
          }}
        >
          <p className="text-[13px] leading-[2] text-text-sub">
            매일 저녁 길 한 곳에 사료를 두고 오는 누군가의 발걸음,
            비 오는 밤에 우산을 들고 한참을 기다리는 누군가의 시간,
            처음 본 아이를 사진 한 장으로 기록하는 누군가의 손길.
          </p>
          <p className="text-[13px] leading-[2] text-text-sub mt-4">
            도시공존은 그 흩어진 손들이 헛되지 않게,
            오늘 어디서 누군가가 또 한 마리를 챙기고 있다는 것을
            서로 알 수 있게 하는 작은 도구로 시작했어요.
          </p>
          <p className="text-[13px] leading-[2] text-text-sub mt-4">
            <b className="text-text-main">정식 출시는 끝이 아니라 시작</b>입니다.
            앞으로도 한 분 한 분의 손이 헛되지 않게,
            끝까지 함께하겠습니다.
          </p>
          <p className="text-[12px] mt-5 text-right" style={{ color: "#8B6FE0" }}>
            — 도시공존 운영자 김성우 드림 🐾
          </p>
        </div>
      </section>

      {/* 창립 멤버 안내 — 6/1 전 가입자 */}
      <section className="px-5 mt-6">
        <div
          className="rounded-2xl p-5 text-center"
          style={{
            background: "linear-gradient(135deg, rgba(92,141,238,0.10) 0%, rgba(232,107,140,0.08) 100%)",
            border: "1px solid rgba(92,141,238,0.20)",
          }}
        >
          <Trophy size={22} className="mx-auto mb-2" style={{ color: "#5C8DEE" }} />
          <p className="text-[14px] font-extrabold text-text-main mb-1.5 tracking-tight">
            창립 멤버 (Founding Member)
          </p>
          <p className="text-[12px] text-text-sub leading-relaxed">
            6월 1일 이전 가입하신 케어테이커는<br />
            <b className="text-text-main">FOUNDING MEMBER 타이틀</b>이 영구 부여됐어요.
            <br />
            마이페이지에서 확인하실 수 있어요.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="px-5 mt-7">
        <Link
          href="/map"
          className="block w-full text-center py-3.5 rounded-2xl text-[14px] font-extrabold text-white active:scale-[0.98] transition-transform"
          style={{
            background: "linear-gradient(135deg, #5C8DEE 0%, #8B6FE0 100%)",
            boxShadow: "0 6px 18px rgba(92,141,238,0.35)",
          }}
        >
          🐾 지도 열기 — 우리 동네 아이들 만나러
        </Link>
        <Link
          href="/maker"
          className="block w-full text-center py-2.5 rounded-2xl text-[12.5px] font-bold mt-2 active:scale-[0.98]"
          style={{ background: "#FFFFFF", color: "#8B6FE0", border: "1px solid rgba(92,141,238,0.25)" }}
        >
          운영 이야기 보기
        </Link>
      </section>

      <p className="text-center text-[11px] text-text-light mt-8 px-5 leading-relaxed">
        도시공존 · dosigongzon.com<br />
        광고 없는 무료 시민 참여 길고양이 지도 · 1인 비영리 운영
      </p>
    </div>
  );
}

function StatBlock({
  icon,
  value,
  label,
  color,
  accent,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  color: string;
  accent: string;
}) {
  return (
    <div
      className="rounded-2xl p-3 text-center"
      style={{
        background: `linear-gradient(160deg, ${color}15 0%, ${color}05 100%)`,
        border: `1px solid ${color}30`,
      }}
    >
      <div
        className="w-9 h-9 mx-auto rounded-2xl flex items-center justify-center mb-2"
        style={{ background: `linear-gradient(135deg, ${color} 0%, ${accent} 100%)` }}
      >
        {icon}
      </div>
      <p className="text-[20px] font-extrabold tracking-tight" style={{ color: accent }}>
        {value}
      </p>
      <p className="text-[10.5px] text-text-sub mt-0.5">{label}</p>
    </div>
  );
}
