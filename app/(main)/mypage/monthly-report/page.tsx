import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight, TrendingUp, BookOpen, Cat, MessageSquare } from "lucide-react";
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
  const total = report.careLogCount + report.newCatCount + report.commentCount;
  const active = hasAnyActivity(report);

  const prev = shiftMonth(year, month, -1);
  const nextRaw = shiftMonth(year, month, 1);
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
  const next = isCurrentMonth ? null : nextRaw;

  const shareText =
    `🐾 도시공존 ${year}년 ${month}월 성장 리포트\n\n` +
    `📓 돌봄다이어리 ${report.careLogCount}회\n` +
    `🐱 새로 등록한 고양이 ${report.newCatCount}마리\n` +
    `💬 커뮤니티 기록 ${report.commentCount}건\n\n` +
    `${pickMonthComment(total)}`;

  return (
    <div className="pb-24 min-h-screen" style={{ background: "var(--color-surface)" }}>
      {/* 헤더 */}
      <div className="px-5 pt-12 pb-5">
        <Link
          href="/mypage"
          className="inline-flex items-center gap-1 text-[13px] font-semibold text-text-sub mb-3"
        >
          <ArrowLeft size={14} />
          마이페이지
        </Link>
        <h1 className="text-[24px] font-bold text-text-main mb-1.5">
          성장 리포트
        </h1>

        {/* 월 이동 */}
        <div className="flex items-center gap-2 mt-3">
          <Link
            href={`/mypage/monthly-report?y=${prev.year}&m=${prev.month}`}
            className="w-8 h-8 rounded-full flex items-center justify-center press-strong transition-transform"
            style={{ border: "1px solid var(--color-border)" }}
          >
            <ChevronLeft size={16} className="text-text-main" />
          </Link>
          <span className="text-[15px] font-semibold text-text-main px-2">
            {year}년 {month}월
          </span>
          {next ? (
            <Link
              href={`/mypage/monthly-report?y=${next.year}&m=${next.month}`}
              className="w-8 h-8 rounded-full flex items-center justify-center press-strong transition-transform"
              style={{ border: "1px solid var(--color-border)" }}
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
          <div className="card p-6 text-center">
            <TrendingUp size={28} className="mx-auto text-text-light mb-3" strokeWidth={1.5} />
            <p className="text-[15px] font-semibold text-text-main mb-1.5">
              {year}년 {month}월엔 기록이 없어요
            </p>
            <p className="text-[13px] text-text-sub leading-relaxed">
              돌봄일지나 고양이 등록이 있으면 리포트가 채워져요.
            </p>
          </div>
        ) : (
          <>
            <p className="text-[13px] text-text-sub leading-relaxed mb-4 text-center">
              {pickMonthComment(total)}
            </p>

            <div className="grid grid-cols-2 gap-3 mb-5">
              <StatTile icon={<BookOpen size={20} strokeWidth={1.8} />} label="돌봄다이어리" value={report.careLogCount} unit="회" />
              <StatTile icon={<Cat size={20} strokeWidth={1.8} />} label="새로 등록한 고양이" value={report.newCatCount} unit="마리" />
              <StatTile icon={<MessageSquare size={20} strokeWidth={1.8} />} label="커뮤니티 기록" value={report.commentCount} unit="건" />
            </div>

            <MonthlyReportShareButton text={shareText} />
          </>
        )}
      </div>
    </div>
  );
}

function StatTile({ icon, label, value, unit }: { icon: React.ReactNode; label: string; value: number; unit: string }) {
  return (
    <div className="card p-4 flex flex-col gap-2">
      <div className="w-9 h-9 flex items-center justify-center text-text-sub">
        {icon}
      </div>
      <div>
        <p className="text-[20px] font-bold text-text-main leading-none">
          {value}<span className="text-[13px] font-medium text-text-sub ml-0.5">{unit}</span>
        </p>
        <p className="text-[13px] text-text-sub mt-1">{label}</p>
      </div>
    </div>
  );
}
