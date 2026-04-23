"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, TrendingUp, Users, Cat as CatIcon, MessageSquare,
  Activity, AlertTriangle, Eye, Crown, Loader2, BarChart3,
} from "lucide-react";
import { isCurrentUserAdmin } from "@/lib/news-repo";
import type { InsightsSnapshot } from "@/lib/insights-repo";

export default function AdminInsightsPage() {
  const router = useRouter();
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

  if (checking) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center px-6 text-center">
        <p className="text-[15px] font-extrabold text-text-main mb-2">권한 없음</p>
        <p className="text-[12px] text-text-sub">관리자만 접근할 수 있어요.</p>
        <Link href="/mypage" className="inline-block mt-4 text-[13px] font-bold text-primary">
          마이페이지로
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-dvh pb-16" style={{ background: "#F7F4EE" }}>
      {/* ── 헤더 ── */}
      <div className="px-4 pt-12 pb-4 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 rounded-full bg-white flex items-center justify-center active:scale-90"
          style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}
          aria-label="뒤로"
        >
          <ArrowLeft size={18} className="text-text-main" />
        </button>
        <div>
          <h1 className="text-[22px] font-extrabold text-text-main tracking-tight">분석</h1>
          <p className="text-[11.5px] text-text-sub">운영 지표 스냅샷</p>
        </div>
      </div>

      {loading && (
        <div className="py-20 flex justify-center">
          <Loader2 size={22} className="animate-spin text-primary" />
        </div>
      )}

      {error && (
        <div className="mx-4 rounded-xl p-3" style={{ background: "#FBEAEA" }}>
          <p className="text-[12.5px] font-semibold" style={{ color: "#B84545" }}>{error}</p>
        </div>
      )}

      {data && (
        <div className="px-4 space-y-5">
          {/* ── 누적 지표 ── */}
          <Section icon={<TrendingUp size={14} />} label="누적">
            <div className="grid grid-cols-2 gap-2.5">
              <StatCard icon={<Users size={16} />} label="총 가입자" value={data.totalUsers} delta={data.newUsersToday} accent="#4A7BA8" />
              <StatCard icon={<CatIcon size={16} />} label="등록 고양이" value={data.totalCats} delta={data.newCatsToday} accent="#C47E5A" />
              <StatCard icon={<MessageSquare size={16} />} label="총 게시글" value={data.totalPosts} delta={data.newPostsToday} accent="#8B65B8" />
              <StatCard icon={<Activity size={16} />} label="돌봄 기록" value={data.totalCareLogs} delta={data.newCareLogsToday} accent="#5BA876" />
            </div>
          </Section>

          {/* ── 이번 주 ── */}
          <Section icon={<BarChart3 size={14} />} label="이번 주 (월~오늘 KST)">
            <div className="grid grid-cols-2 gap-2.5">
              <MiniCard label="신규 가입" value={data.newUsersWeek} />
              <MiniCard label="신규 고양이" value={data.newCatsWeek} />
              <MiniCard label="신규 게시글" value={data.newPostsWeek} />
              <MiniCard label="신규 돌봄" value={data.newCareLogsWeek} />
            </div>
          </Section>

          {/* ── 방문자 ── */}
          <Section icon={<Eye size={14} />} label="방문자">
            <div className="grid grid-cols-2 gap-2.5">
              <MiniCard label="오늘" value={data.visitsToday} />
              <MiniCard label="이번 주" value={data.visitsWeek} />
            </div>
          </Section>

          {/* ── 에러 ── */}
          <Section icon={<AlertTriangle size={14} />} label="로그인/인증 에러 (7일)">
            <div
              className="rounded-2xl bg-white p-3.5"
              style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
            >
              <div className="flex items-baseline justify-between mb-2.5">
                <span className="text-[11.5px] text-text-sub">총 실패</span>
                <span className="text-[18px] font-extrabold text-text-main">{data.authErrorsWeek}</span>
              </div>
              {data.authErrorTopCodes.length === 0 ? (
                <p className="text-[11.5px] text-text-light">기록 없음</p>
              ) : (
                <div className="space-y-1.5">
                  {data.authErrorTopCodes.map((e) => (
                    <div key={e.code} className="flex items-center justify-between">
                      <code className="text-[11px] text-text-sub">{e.code}</code>
                      <span className="text-[12px] font-bold text-text-main">{e.count}</span>
                    </div>
                  ))}
                </div>
              )}
              <Link
                href="/admin/auth-errors"
                className="inline-block mt-2 text-[11.5px] font-bold"
                style={{ color: "#C47E5A" }}
              >
                전체 로그 보기 →
              </Link>
            </div>
          </Section>

          {/* ── 인기 고양이 TOP 5 ── */}
          <Section icon={<Crown size={14} />} label="인기 고양이 TOP 5">
            {data.topCats.length === 0 ? (
              <p className="text-[12px] text-text-light px-2">아직 좋아요 기록 없음</p>
            ) : (
              <div className="space-y-1.5">
                {data.topCats.map((c, i) => (
                  <Link
                    key={c.id}
                    href={`/cats/${c.id}`}
                    className="flex items-center justify-between bg-white rounded-xl px-3.5 py-2.5 active:scale-[0.99]"
                    style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[11px] font-extrabold w-4 shrink-0" style={{ color: "#C47E5A" }}>
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[13px] font-bold text-text-main truncate">{c.name}</p>
                        <p className="text-[10.5px] text-text-light truncate">{c.region ?? "지역 미정"}</p>
                      </div>
                    </div>
                    <span className="text-[12px] font-extrabold" style={{ color: "#E86B8C" }}>
                      ♥ {c.like_count}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </Section>

          {/* ── 활성 유저 TOP 5 ── */}
          <Section icon={<Crown size={14} />} label="이번 주 활성 돌봄 TOP 5">
            {data.topCaretakers.length === 0 ? (
              <p className="text-[12px] text-text-light px-2">아직 기록 없음</p>
            ) : (
              <div className="space-y-1.5">
                {data.topCaretakers.map((u, i) => (
                  <Link
                    key={u.user_id}
                    href={`/users/${u.user_id}`}
                    className="flex items-center justify-between bg-white rounded-xl px-3.5 py-2.5 active:scale-[0.99]"
                    style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[11px] font-extrabold w-4 shrink-0" style={{ color: "#C47E5A" }}>
                        {i + 1}
                      </span>
                      <p className="text-[13px] font-bold text-text-main truncate">{u.name}</p>
                    </div>
                    <span className="text-[12px] font-extrabold text-text-main">
                      {u.count}건
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center gap-1.5 mb-2.5 px-1">
        <span style={{ color: "#C47E5A" }}>{icon}</span>
        <h2 className="text-[13px] font-extrabold text-text-main tracking-tight">{label}</h2>
      </div>
      {children}
    </section>
  );
}

function StatCard({
  icon, label, value, delta, accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  delta: number;
  accent: string;
}) {
  return (
    <div
      className="rounded-2xl bg-white p-3.5"
      style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.03)" }}
    >
      <div className="flex items-center gap-1.5 mb-1.5" style={{ color: accent }}>
        {icon}
        <span className="text-[11px] font-bold">{label}</span>
      </div>
      <p className="text-[22px] font-extrabold text-text-main tabular-nums tracking-tight">
        {value.toLocaleString()}
      </p>
      {delta > 0 && (
        <p className="text-[10.5px] font-bold mt-0.5" style={{ color: "#5BA876" }}>
          +{delta} 오늘
        </p>
      )}
    </div>
  );
}

function MiniCard({ label, value }: { label: string; value: number }) {
  return (
    <div
      className="rounded-2xl bg-white px-3.5 py-2.5"
      style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
    >
      <p className="text-[10.5px] font-semibold text-text-sub">{label}</p>
      <p className="text-[18px] font-extrabold text-text-main tabular-nums tracking-tight mt-0.5">
        {value.toLocaleString()}
      </p>
    </div>
  );
}
