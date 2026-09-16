import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getMyJourneyServer, type Milestone } from "@/lib/journey-server";
import EmptyState from "@/app/components/ui/EmptyState";

export const metadata: Metadata = {
  title: "당신의 여정",
  description: "도시공존에서 쌓아온 발자취와 따뜻한 순간들",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

// 카테고리별 색 채움은 리디자인(2026-09-16)으로 폐지 — 점·카드 전부 회색 헤어라인.

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
          당신의 여정
        </h1>
        <p className="text-[13px] text-text-sub leading-relaxed">
          총 {items.length}개의 순간이 모였어요.
        </p>
      </div>

      {/* 타임라인 */}
      <div className="px-5 pt-5">
        {items.length === 0 ? (
          <EmptyState
            className="card p-6"
            icon={<Sparkles size={28} strokeWidth={1.5} />}
            title="여정이 막 시작됐어요"
            desc="고양이를 등록하거나 댓글을 남기면 여기에 쌓여요."
          />
        ) : (
          <div className="relative">
            {/* 세로 선 */}
            <div
              className="absolute left-[20px] top-2 bottom-2 w-[1px]"
              style={{ background: "var(--color-border)" }}
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
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    m.catId ? (
      <Link href={`/cats/${m.catId}`} className="block press transition-transform">
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
          className="relative shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <span className="w-2 h-2 rounded-full" style={{ background: "var(--color-primary)" }} />
        </div>
        {/* 카드 */}
        <div className="flex-1 min-w-0 card p-3.5">
          <p className="text-[11px] font-medium text-text-light">
            {fmtDate(m.date)}
          </p>
          <p className="mt-0.5 text-[15px] font-semibold text-text-main leading-tight">
            {m.title}
          </p>
          <p className="mt-1 text-[13px] text-text-sub leading-relaxed">{m.desc}</p>
        </div>
      </div>
    </Wrapper>
  );
}
