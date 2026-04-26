import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getMyJourneyServer, type Milestone, type MilestoneCategory } from "@/lib/journey-server";

export const metadata: Metadata = {
  title: "당신의 여정",
  description: "도시공존에서 쌓아온 발자취와 따뜻한 순간들",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const CAT_COLOR: Record<MilestoneCategory, { bg: string; ring: string; text: string }> = {
  join:     { bg: "#E8ECE5", ring: "#5BA876", text: "#3F5B42" },
  cat:      { bg: "#FFF1E6", ring: "#C47E5A", text: "#7A4A2A" },
  care:     { bg: "#FFF5E0", ring: "#E8B040", text: "#8C6A1F" },
  comment:  { bg: "#F0E8F8", ring: "#8B65B8", text: "#5A3F7E" },
  post:     { bg: "#E5EDF5", ring: "#4A7BA8", text: "#2A4A6B" },
  received: { bg: "#FBE8EE", ring: "#D4708F", text: "#7A3E54" },
  social:   { bg: "#FCEFD9", ring: "#E88D5A", text: "#7A4524" },
  region:   { bg: "#E8F0E8", ring: "#6B8E6F", text: "#3F5B42" },
  streak:   { bg: "#FBE5DC", ring: "#D85555", text: "#7A2A2A" },
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}년 ${m}월 ${day}일`;
}

export default async function JourneyPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/mypage/journey");

  const items = await getMyJourneyServer(user.id);

  return (
    <div className="pb-24 min-h-screen" style={{ background: "#F7F4EE" }}>
      {/* 헤더 */}
      <div
        className="px-5 pt-12 pb-7"
        style={{
          background: "linear-gradient(160deg, #FFF8F2 0%, #FCEFD9 50%, #F7F4EE 100%)",
        }}
      >
        <Link
          href="/mypage"
          className="inline-flex items-center gap-1 text-[12px] font-semibold text-text-sub mb-3"
        >
          <ArrowLeft size={14} />
          마이페이지
        </Link>
        <div className="flex items-center gap-2 mb-1.5">
          <Sparkles size={20} className="text-primary" />
          <h1 className="text-[24px] font-extrabold tracking-tight text-text-main">
            당신의 여정
          </h1>
        </div>
        <p className="text-[13px] text-text-sub leading-relaxed">
          도시공존에서 쌓아온 발자취와 따뜻한 순간들이에요.
        </p>
        <p className="mt-2 text-[11.5px] text-text-light">
          총 {items.length}개의 작은 이야기가 모였습니다.
        </p>
      </div>

      {/* 타임라인 */}
      <div className="px-5 pt-5">
        {items.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="relative">
            {/* 세로 선 */}
            <div
              className="absolute left-[20px] top-2 bottom-2 w-[2px] rounded-full"
              style={{ background: "linear-gradient(to bottom, #C47E5A33 0%, #C47E5A11 100%)" }}
            />

            <div className="space-y-4">
              {items.map((m) => (
                <MilestoneRow key={m.id} m={m} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MilestoneRow({ m }: { m: Milestone }) {
  const c = CAT_COLOR[m.category];
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    m.catId ? (
      <Link href={`/cats/${m.catId}`} className="block active:scale-[0.99] transition-transform">
        {children}
      </Link>
    ) : (
      <div>{children}</div>
    );

  return (
    <Wrapper>
      <div className="flex items-start gap-3">
        {/* 아이콘 (점 위치) */}
        <div
          className="relative shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-[18px]"
          style={{
            background: c.bg,
            border: `2px solid ${c.ring}`,
            boxShadow: `0 4px 12px ${c.ring}33`,
          }}
        >
          {m.emoji}
        </div>
        {/* 카드 */}
        <div
          className="flex-1 min-w-0 rounded-2xl p-3.5"
          style={{
            background: "#FFFFFF",
            boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
            border: "1px solid rgba(0,0,0,0.04)",
          }}
        >
          <p className="text-[10.5px] font-bold tracking-wide" style={{ color: c.text }}>
            {fmtDate(m.date)}
          </p>
          <p className="mt-0.5 text-[14px] font-extrabold text-text-main tracking-tight leading-tight">
            {m.title}
          </p>
          <p className="mt-1 text-[12px] text-text-sub leading-relaxed">{m.desc}</p>
        </div>
      </div>
    </Wrapper>
  );
}

function EmptyState() {
  return (
    <div
      className="rounded-2xl p-6 text-center"
      style={{
        background: "#FFFFFF",
        border: "1px solid rgba(0,0,0,0.04)",
        boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
      }}
    >
      <Sparkles size={28} className="mx-auto text-text-light mb-3" strokeWidth={1.5} />
      <p className="text-[14px] font-extrabold text-text-main mb-1.5">
        여정이 막 시작됐어요
      </p>
      <p className="text-[12px] text-text-sub leading-relaxed">
        지도에서 첫 고양이를 등록하거나 동네 이야기에 응원의 댓글을 남기면
        여기에 따뜻한 순간들이 차곡차곡 쌓여요.
      </p>
    </div>
  );
}
