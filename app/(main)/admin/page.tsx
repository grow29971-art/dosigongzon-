"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  Shield,
  Newspaper,
  Inbox,
  Stethoscope,
  User as UserIcon,
  Pill,
  Bell,
  AlertTriangle,
  Cat as CatIcon,
  MessageSquare,
  Eye,
  Users as UsersIcon,
  Ban,
  ChevronRight,
  RefreshCcw,
} from "lucide-react";
import { isCurrentUserAdmin } from "@/lib/news-repo";
import { getAdminStats, type AdminStats } from "@/lib/admin-stats";

type MenuItem = {
  href: string;
  title: string;
  subtitle: string;
  Icon: typeof Newspaper;
  color: string;
  badge?: number;
};

export default function AdminDashboardPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    try {
      const s = await getAdminStats();
      setStats(s);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    (async () => {
      const admin = await isCurrentUserAdmin();
      setIsAdmin(admin);
      setAuthChecked(true);
      if (admin) {
        await refresh();
      }
      setLoading(false);
    })();
  }, []);

  if (!authChecked || loading) {
    return (
      <div className="flex justify-center pt-20">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="px-5 pt-20 text-center">
        <Shield size={40} className="mx-auto text-text-light mb-3" strokeWidth={1.5} />
        <p className="text-[14px] font-bold text-text-main mb-1">관리자 전용 페이지예요</p>
        <p className="text-[12px] text-text-sub">접근 권한이 없어요.</p>
        <Link href="/mypage" className="inline-block mt-4 text-[13px] font-bold text-primary">
          마이페이지로 돌아가기
        </Link>
      </div>
    );
  }

  const menus: MenuItem[] = [
    {
      href: "/admin/inbox",
      title: "신고·문의 관리",
      subtitle: "유저 신고와 문의를 처리",
      Icon: Inbox,
      color: "#D85555",
      badge: (stats?.pendingReports ?? 0) + (stats?.pendingInquiries ?? 0),
    },
    {
      href: "/admin/users",
      title: "가입자 관리",
      subtitle: "전체 회원 조회·정지 현황",
      Icon: UserIcon,
      color: "#4A7BA8",
    },
    {
      href: "/admin/auth-errors",
      title: "로그인 실패 로그",
      subtitle: "OAuth·매직링크 실패 원인",
      Icon: AlertTriangle,
      color: "#E88D5A",
      badge: stats?.todayErrors ?? 0,
    },
    {
      href: "/admin/news",
      title: "뉴스 관리",
      subtitle: "홈 화면 소식·일정",
      Icon: Newspaper,
      color: "#7A6B8E",
    },
    {
      href: "/admin/hospitals",
      title: "병원 관리",
      subtitle: "구조동물 치료 도움병원",
      Icon: Stethoscope,
      color: "#6B8E6F",
    },
    {
      href: "/admin/pharmacy-guide",
      title: "약품 가이드",
      subtitle: "약품·영양제 정보",
      Icon: Pill,
      color: "#9B6DD7",
    },
    {
      href: "/admin/push",
      title: "푸시 알림 발송",
      subtitle: "전체 사용자에게 공지",
      Icon: Bell,
      color: "#C47E5A",
    },
  ];

  return (
    <div className="pb-24 min-h-screen" style={{ background: "#F7F4EE" }}>
      {/* 헤더 (다크 톤 — 일반 페이지와 구분) */}
      <div
        className="px-5 pt-12 pb-5"
        style={{
          background: "linear-gradient(135deg, #2C2C2C 0%, #3F3F3F 100%)",
          color: "#fff",
        }}
      >
        <button
          onClick={() => router.push("/mypage")}
          className="flex items-center gap-1 text-[12px] font-semibold mb-3 opacity-80 active:scale-95"
        >
          <ArrowLeft size={14} />
          마이페이지
        </button>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-baseline gap-2">
            <Shield size={20} />
            <h1 className="text-[22px] font-extrabold tracking-tight">
              관리자 대시보드
            </h1>
            <span className="text-[10px] font-semibold opacity-50">Admin</span>
          </div>
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="w-9 h-9 rounded-xl flex items-center justify-center active:scale-90 disabled:opacity-50"
            style={{ background: "rgba(255,255,255,0.12)" }}
            aria-label="새로고침"
          >
            {refreshing ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <RefreshCcw size={14} />
            )}
          </button>
        </div>
        <p className="text-[12px] opacity-70">
          도시공존 운영 관리 · 통계와 메뉴를 한 곳에
        </p>
      </div>

      {/* 통계 카드 */}
      {stats && (
        <div className="px-4 -mt-6 mb-5 grid grid-cols-2 gap-2">
          <StatCard
            Icon={UsersIcon}
            label="전체 가입자"
            value={stats.totalUsers}
            color="#4A7BA8"
            sub={stats.suspendedUsers > 0 ? `정지 ${stats.suspendedUsers}명` : undefined}
            subColor="#B84545"
          />
          <StatCard
            Icon={CatIcon}
            label="등록 고양이"
            value={stats.totalCats}
            color="#C47E5A"
          />
          <StatCard
            Icon={MessageSquare}
            label="커뮤니티 글"
            value={stats.totalPosts}
            color="#8B65B8"
            sub={`댓글 ${stats.totalComments.toLocaleString()}`}
          />
          <StatCard
            Icon={Eye}
            label="오늘 방문자"
            value={stats.todayVisits}
            color="#6B8E6F"
          />
          {(stats.pendingReports > 0 || stats.pendingInquiries > 0) && (
            <StatCard
              Icon={Inbox}
              label="미처리 신고·문의"
              value={stats.pendingReports + stats.pendingInquiries}
              color="#D85555"
              sub={`신고 ${stats.pendingReports} · 문의 ${stats.pendingInquiries}`}
              highlight
            />
          )}
          {stats.errors7d > 0 && (
            <StatCard
              Icon={AlertTriangle}
              label="7일 로그인 실패"
              value={stats.errors7d}
              color="#E88D5A"
              sub={`오늘 ${stats.todayErrors}건`}
            />
          )}
        </div>
      )}

      {/* 메뉴 그리드 */}
      <div className="px-4">
        <div className="flex items-center gap-2 mb-3 px-1">
          <div className="w-1 h-4 rounded-full" style={{ backgroundColor: "#2C2C2C" }} />
          <h2 className="text-[14px] font-extrabold text-text-main tracking-tight">
            관리 메뉴
          </h2>
        </div>
        <div className="space-y-2">
          {menus.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className="flex items-center gap-3 px-4 py-3.5 active:scale-[0.99] transition-transform"
              style={{
                background: "#FFFFFF",
                borderRadius: 16,
                boxShadow: `0 4px 14px ${m.color}10, 0 1px 2px rgba(0,0,0,0.02)`,
                border: "1px solid rgba(0,0,0,0.04)",
              }}
            >
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${m.color}15` }}
              >
                <m.Icon size={19} color={m.color} strokeWidth={2} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-[14px] font-extrabold text-text-main tracking-tight">
                    {m.title}
                  </p>
                  {m.badge !== undefined && m.badge > 0 && (
                    <span
                      className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-md"
                      style={{
                        background: m.color,
                        color: "#fff",
                      }}
                    >
                      {m.badge}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-text-sub mt-0.5 truncate">
                  {m.subtitle}
                </p>
              </div>
              <ChevronRight size={16} className="shrink-0" style={{ color: m.color, opacity: 0.6 }} />
            </Link>
          ))}
        </div>

        {/* 위험 액션 */}
        <div className="mt-6">
          <div className="flex items-center gap-2 mb-3 px-1">
            <div className="w-1 h-4 rounded-full" style={{ backgroundColor: "#B84545" }} />
            <h2 className="text-[13px] font-extrabold text-text-main tracking-tight">
              빠른 정보
            </h2>
          </div>
          <div
            className="bg-white rounded-2xl p-4 text-[11px] text-text-sub leading-relaxed"
            style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
          >
            <p className="mb-1"><b>도시공존</b> · 길고양이 돌봄 시민 참여 플랫폼</p>
            <p>운영 중 이상 감지 시 로그인 실패 로그와 신고·문의함을 먼저 확인해주세요.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  Icon,
  label,
  value,
  color,
  sub,
  subColor,
  highlight,
}: {
  Icon: typeof Newspaper;
  label: string;
  value: number;
  color: string;
  sub?: string;
  subColor?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className="rounded-2xl p-3"
      style={{
        background: highlight ? `linear-gradient(135deg, ${color}15 0%, ${color}08 100%)` : "#FFFFFF",
        border: highlight ? `1px solid ${color}30` : "1px solid rgba(0,0,0,0.04)",
        boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
      }}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <Icon size={12} style={{ color }} />
        <span className="text-[10px] font-bold text-text-sub">{label}</span>
      </div>
      <p className="text-[22px] font-extrabold tracking-tight" style={{ color }}>
        {value.toLocaleString()}
      </p>
      {sub && (
        <p className="text-[10px] mt-0.5" style={{ color: subColor ?? "#999" }}>
          {sub}
        </p>
      )}
    </div>
  );
}
