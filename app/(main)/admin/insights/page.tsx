"use client";

// 분석 대시보드 (admin 전용) — 2026-09-16 「익숙한 동네앱」 리디자인:
// 통계 카드 그리드 → 헤어라인 섹션 + 수치 행(라벨 좌·숫자 우 tabular), TOP 목록 → 구분선 리스트. 색은 토큰만.

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Heart } from "lucide-react";
import { isCurrentUserAdmin } from "@/lib/news-repo";
import type { InsightsSnapshot } from "@/lib/insights-repo";
import { SkeletonListRow } from "@/app/components/Skeleton";
import { AdminForbidden, AdminHeader, AdminLoading, AdminPage, AdminSection, EmptyState, StatRow } from "../_ui";

export default function AdminInsightsPage() {
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [data, setData] = useState<InsightsSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    isCurrentUserAdmin()
      .then((isAdmin) => {
        setAuthorized(isAdmin);
        setChecking(false);
      })
      .catch(() => {
        setAuthorized(false);
        setChecking(false);
      });
  }, []);

  useEffect(() => {
    if (!authorized) return;
    setLoading(true);
    setError("");
    fetch("/api/admin/insights")
      .then((r) => r.json())
      .then((json) => {
        if (json.error) {
          setError(json.error);
        } else {
          setData(json);
        }
      })
      .catch((e) => setError(e?.message ?? "집계 실패"))
      .finally(() => setLoading(false));
  }, [authorized]);

  if (checking) return <AdminLoading />;
  if (!authorized) return <AdminForbidden />;

  const todaySub = (n: number) => (n > 0 ? `오늘 +${n}` : undefined);

  return (
    <AdminPage>
      <AdminHeader title="분석" description="운영 지표 스냅샷" />

      {loading && (
        <div className="space-y-1.5">
          {Array.from({ length: 8 }).map((_, i) => <SkeletonListRow key={i} />)}
        </div>
      )}

      {error && (
        <p className="text-[13px] font-semibold mb-3" style={{ color: "var(--color-error)" }}>{error}</p>
      )}

      {data && (
        <>
          <AdminSection title="누적" padding={false}>
            <StatRow label="총 가입자" sub={todaySub(data.newUsersToday)} value={data.totalUsers.toLocaleString()} />
            <StatRow label="등록 고양이" sub={todaySub(data.newCatsToday)} value={data.totalCats.toLocaleString()} />
            <StatRow label="총 게시글" sub={todaySub(data.newPostsToday)} value={data.totalPosts.toLocaleString()} />
            <StatRow label="돌봄 기록" sub={todaySub(data.newCareLogsToday)} value={data.totalCareLogs.toLocaleString()} />
          </AdminSection>

          <AdminSection title="이번 주 (월~오늘 KST)" padding={false}>
            <StatRow label="신규 가입" value={data.newUsersWeek.toLocaleString()} />
            <StatRow label="신규 고양이" value={data.newCatsWeek.toLocaleString()} />
            <StatRow label="신규 게시글" value={data.newPostsWeek.toLocaleString()} />
            <StatRow label="신규 돌봄" value={data.newCareLogsWeek.toLocaleString()} />
          </AdminSection>

          <AdminSection title="방문자" padding={false}>
            <StatRow label="오늘" value={data.visitsToday.toLocaleString()} />
            <StatRow label="이번 주" value={data.visitsWeek.toLocaleString()} />
          </AdminSection>

          <AdminSection
            title="로그인/인증 에러 (7일)"
            padding={false}
            right={
              <Link href="/admin/auth-errors" className="flex items-center text-[13px] font-semibold text-primary">
                전체 로그 <ChevronRight size={14} />
              </Link>
            }
          >
            <StatRow label="총 실패" value={data.authErrorsWeek.toLocaleString()} tone={data.authErrorsWeek > 0 ? "warning" : "neutral"} />
            {data.authErrorTopCodes.length === 0 ? (
              <EmptyState>기록 없음</EmptyState>
            ) : (
              data.authErrorTopCodes.map((e) => (
                <div key={e.code} className="flex items-center justify-between px-4 py-2 border-b border-divider last:border-b-0">
                  <code className="text-[13px] text-text-sub">{e.code}</code>
                  <span className="text-[13px] font-semibold text-text-main tabular-nums">{e.count}</span>
                </div>
              ))
            )}
          </AdminSection>

          <AdminSection title="위급 알림" padding={false}>
            <StatRow label="현재 위급" value={data.urgentCatsTotal.toLocaleString()} tone={data.urgentCatsTotal > 0 ? "error" : "neutral"} />
            <StatRow label="3일 이상 부재" sub="cron 타깃" value={data.urgentCatsStale.toLocaleString()} tone={data.urgentCatsStale > 0 ? "warning" : "neutral"} />
            <StatRow label="7일 푸시 발송" value={data.alertPushesWeek.toLocaleString()} />
            <StatRow label="7일 수신 유저" value={data.alertPushedUsersWeek.toLocaleString()} />
            <p className="px-4 py-2 text-[13px] text-text-light leading-relaxed">
              dedup 적용으로 같은 (유저·고양이) 페어는 24h당 1회만 발송.
            </p>
          </AdminSection>

          <AdminSection title="인기 고양이 TOP 5" padding={false}>
            {data.topCats.length === 0 ? (
              <EmptyState>아직 좋아요 기록 없음</EmptyState>
            ) : (
              data.topCats.map((c, i) => (
                <Link
                  key={c.id}
                  href={`/cats/${c.id}`}
                  className="flex items-center gap-3 px-4 py-3 border-b border-divider last:border-b-0 press"
                >
                  <span className="text-[13px] font-semibold text-text-light w-4 shrink-0 tabular-nums">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-semibold text-text-main truncate">{c.name}</p>
                    <p className="text-[13px] text-text-light truncate">{c.region ?? "지역 미정"}</p>
                  </div>
                  <span className="flex items-center gap-1 text-[13px] font-semibold tabular-nums" style={{ color: "var(--color-like)" }}>
                    <Heart size={13} /> {c.like_count}
                  </span>
                  <ChevronRight size={18} className="shrink-0" style={{ color: "var(--color-text-muted)" }} />
                </Link>
              ))
            )}
          </AdminSection>

          <AdminSection title="이번 주 활성 돌봄 TOP 5" padding={false}>
            {data.topCaretakers.length === 0 ? (
              <EmptyState>아직 기록 없음</EmptyState>
            ) : (
              data.topCaretakers.map((u, i) => (
                <Link
                  key={u.user_id}
                  href={`/users/${u.user_id}`}
                  className="flex items-center gap-3 px-4 py-3 border-b border-divider last:border-b-0 press"
                >
                  <span className="text-[13px] font-semibold text-text-light w-4 shrink-0 tabular-nums">{i + 1}</span>
                  <p className="flex-1 min-w-0 text-[15px] font-semibold text-text-main truncate">{u.name}</p>
                  <span className="text-[13px] font-semibold text-text-main tabular-nums">{u.count}건</span>
                  <ChevronRight size={18} className="shrink-0" style={{ color: "var(--color-text-muted)" }} />
                </Link>
              ))
            )}
          </AdminSection>
        </>
      )}
    </AdminPage>
  );
}
