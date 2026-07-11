import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight, TrendingUp, BookOpen, CatIcon, Swords, MessageSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getMonthlyGrowthReport, hasAnyActivity, pickMonthComment } from "@/lib/monthly-report-server";
import MonthlyReportShareButton from "@/app/components/MonthlyReportShareButton";

export const metadata: Metadata = {
  title: "이번 달 성장 리포트",
  description: "이번 달 내가 얼마나 채웠는지 한눈에 보기",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function shiftMonth(year: number, month: number, delta: number) {
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

export default async function MonthlyReportPage({
  searchParams,
}: {
  searchParams: Promise<{ y?: string; m?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/mypage/monthly-report");

  const now = new Date();
  const sp = await searchParams;
  const year = Number(sp.y) || now.getFullYear();
  const month = Number(sp.m) || now.getMonth() + 1;

  const report = await getMonthlyGrowthReport(user.id, year, month);
  const total = report.careLogCount + report.newCatCount + report.commentCount + report.battleWinCount;
  const active = hasAnyActivity(report);

  const prev = shiftMonth(year, month, -1);
  const nextRaw = shiftMonth(year, month, 1);
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
  const next = isCurrentMonth ? null : nextRaw;

  const shareText =
    `🐾 도시공존 ${year}년 ${month}월 성장 리포트\n\n` +
    `📓 돌봄다이어리 ${report.careLogCount}회\n` +
    `🐱 새로 등록한 고양이 ${report.newCatCount}마리\n` +
    `💬 커뮤니티 기록 ${report.commentCount}건\n` +
    `⚔️ PVP 승리 ${report.battleWinCount}회\n\n` +
    `${pickMonthComment(total)}`;

  return (
    <div className="pb-24 min-h-screen" style={{ background: "#F7F4EE" }}>
      {/* 헤더 */}
      <div
        className="px-5 pt-12 pb-7"
        style={{ background: "linear-gradient(160deg, #F0FAF3 0%, #DCF0E4 50%, #F7F4EE 100%)" }}
      >
        <Link
          href="/mypage"
          className="inline-flex items-center gap-1 text-[12px] font-semibold text-text-sub mb-3"
        >
          <ArrowLeft size={14} />
          마이페이지
        </Link>
        <div className="flex items-center gap-2 mb-1.5">
          <TrendingUp size={20} color="#5BA876" strokeWidth={2.2} />
          <h1 className="text-[24px] font-extrabold tracking-tight text-text-main">
            성장 리포트
          </h1>
        </div>

        {/* 월 이동 */}
        <div className="flex items-center gap-2 mt-3">
          <Link
            href={`/mypage/monthly-report?y=${prev.year}&m=${prev.month}`}
            className="w-8 h-8 rounded-full flex items-center justify-center active:scale-90 transition-transform"
            style={{ background: "#FFFFFF", boxShadow: "var(--shadow-raised)" }}
          >
            <ChevronLeft size={16} className="text-text-main" />
          </Link>
          <span className="text-[15px] font-extrabold text-text-main tracking-tight px-2">
            {year}년 {month}월
          </span>
          {next ? (
            <Link
              href={`/mypage/monthly-report?y=${next.year}&m=${next.month}`}
              className="w-8 h-8 rounded-full flex items-center justify-center active:scale-90 transition-transform"
              style={{ background: "#FFFFFF", boxShadow: "var(--shadow-raised)" }}
            >
              <ChevronRight size={16} className="text-text-main" />
            </Link>
          ) : (
            <span className="w-8 h-8 rounded-full flex items-center justify-center" style={{ opacity: 0.25 }}>
              <ChevronRight size={16} className="text-text-main" />
            </span>
          )}
        </div>
      </div>

      <div className="px-5 pt-5">
        {!active ? (
          <div
            className="rounded-2xl p-6 text-center"
            style={{ background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.04)", boxShadow: "var(--shadow-card)" }}
          >
            <TrendingUp size={28} className="mx-auto text-text-light mb-3" strokeWidth={1.5} />
            <p className="text-[14px] font-extrabold text-text-main mb-1.5">
              {year}년 {month}월엔 기록이 없어요
            </p>
            <p className="text-[12px] text-text-sub leading-relaxed">
              돌봄일지를 남기거나 고양이를 등록하면 이 달의 리포트가 채워져요.
            </p>
          </div>
        ) : (
          <>
            <p className="text-[13px] text-text-sub leading-relaxed mb-4 text-center">
              {pickMonthComment(total)}
            </p>

            <div className="grid grid-cols-2 gap-3 mb-5">
              <StatTile icon={<BookOpen size={18} color="#3182F6" />} label="돌봄다이어리" value={report.careLogCount} unit="회" tint="#FFF5E0" />
              <StatTile icon={<CatIcon size={18} color="#5BA876" />} label="새로 등록한 고양이" value={report.newCatCount} unit="마리" tint="#EAF6EF" />
              <StatTile icon={<MessageSquare size={18} color="#4A7BA8" />} label="커뮤니티 기록" value={report.commentCount} unit="건" tint="#E5EDF5" />
              <StatTile icon={<Swords size={18} color="#8B3A3A" />} label="PVP 승리" value={report.battleWinCount} unit="회" tint="#FBE5DC" />
            </div>

            <MonthlyReportShareButton text={shareText} />
          </>
        )}
      </div>
    </div>
  );
}

function StatTile({ icon, label, value, unit, tint }: { icon: React.ReactNode; label: string; value: number; unit: string; tint: string }) {
  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-2"
      style={{ background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.04)", boxShadow: "var(--shadow-card)" }}
    >
      <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: tint }}>
        {icon}
      </div>
      <div>
        <p className="text-[20px] font-extrabold text-text-main tracking-tight leading-none">
          {value}<span className="text-[12px] font-bold text-text-sub ml-0.5">{unit}</span>
        </p>
        <p className="text-[11px] text-text-sub mt-1">{label}</p>
      </div>
    </div>
  );
}
