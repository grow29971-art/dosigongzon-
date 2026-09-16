"use client";

// 관리자 대시보드 (2026-09-16 「익숙한 동네앱」 리디자인)
// 통계 카드 무더기·D-day 그라디언트 카드 → 헤어라인 섹션 + 수치 행(라벨 좌·숫자 우 tabular),
// 메뉴 그리드 → 구분선 리스트(회색 선 아이콘). 색은 토큰만, 틴트·그림자 없음.

import { useEffect, useState } from "react";
import Link from "next/link";
import {
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
  ChevronRight,
  RefreshCcw,
  MapPin as MapPinIcon,
  BarChart3,
  Gift,
  CalendarClock,
  Sparkles,
  Activity,
  Megaphone,
  ShoppingBag,
  PackageCheck,
  HeartHandshake,
  FlaskConical,
} from "lucide-react";
import { isCurrentUserAdmin } from "@/lib/news-repo";
import { getAdminStats, type AdminStats } from "@/lib/admin-stats";
import { AdminForbidden, AdminHeader, AdminLoading, AdminPage, AdminSection, StatRow } from "./_ui";

type MenuItem = {
  href: string;
  title: string;
  subtitle: string;
  Icon: typeof Newspaper;
  badge?: number;
};

export default function AdminDashboardPage() {
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

  if (!authChecked || loading) return <AdminLoading />;
  if (!isAdmin) return <AdminForbidden />;

  const menus: MenuItem[] = [
    { href: "/admin/products", title: "상품 관리", subtitle: "쇼핑몰 상품 등록·수정·재고", Icon: ShoppingBag },
    { href: "/admin/orders", title: "주문 관리", subtitle: "주문 상태·운송장·취소/환불", Icon: PackageCheck },
    { href: "/admin/fund", title: "후원금 관리", subtitle: "지출 등록·금액 조정·정산 카드 갱신", Icon: HeartHandshake },
    { href: "/admin/cats", title: "고양이 관리", subtitle: "지도 고양이 검색·숨김·일괄 삭제", Icon: CatIcon },
    { href: "/admin/event-keyring", title: "이벤트 응모자", subtitle: "1000명 키링 추첨 응모 관리", Icon: Gift },
    { href: "/admin/insights", title: "분석 대시보드", subtitle: "가입·활동·인기 지표", Icon: BarChart3 },
    { href: "/admin/experiments", title: "동네 돌봄 실험", subtitle: "14일 지역 실험 생성·전환 지표", Icon: FlaskConical },
    {
      href: "/admin/inbox",
      title: "신고·문의 관리",
      subtitle: "유저 신고와 문의를 처리",
      Icon: Inbox,
      badge: (stats?.pendingReports ?? 0) + (stats?.pendingInquiries ?? 0),
    },
    { href: "/admin/zones", title: "QR 지킴판", subtitle: "돌봄 구역 QR 생성·익명 제보 확인·이관", Icon: Shield },
    { href: "/admin/users", title: "가입자 관리", subtitle: "전체 회원 조회·정지 현황", Icon: UserIcon },
    { href: "/admin/activation", title: "활성도 코호트", subtitle: "활성·휴면·이탈·첫 등록 미완료 분류", Icon: Activity },
    { href: "/admin/broadcast", title: "전체 쪽지 발송", subtitle: "코호트별 일괄 환영·재참여 메시지", Icon: Megaphone },
    { href: "/admin/announcement", title: "접속 팝업 공지", subtitle: "접속 시 뜨는 팝업 공지 등록·내리기", Icon: Megaphone },
    {
      href: "/admin/auth-errors",
      title: "로그인 실패 로그",
      subtitle: "OAuth·매직링크 실패 원인",
      Icon: AlertTriangle,
      badge: stats?.todayErrors ?? 0,
    },
    { href: "/admin/news", title: "뉴스 관리", subtitle: "홈 화면 소식·일정", Icon: Newspaper },
    { href: "/admin/tips", title: "꿀팁게시판 관리", subtitle: "정보글 작성·발행·수정", Icon: Sparkles },
    { href: "/admin/weekly-issues", title: "이번 주 이슈", subtitle: "주간 동네 이슈 큐레이션", Icon: CalendarClock },
    { href: "/admin/hospitals", title: "병원 관리", subtitle: "구조동물 치료 도움병원", Icon: Stethoscope },
    { href: "/admin/pharmacy-guide", title: "약품 가이드", subtitle: "약품·영양제 정보", Icon: Pill },
    { href: "/admin/push", title: "푸시 알림 발송", subtitle: "전체 사용자에게 공지", Icon: Bell },
    { href: "/admin/location-logs", title: "위치 변경 이력", subtitle: "고양이 좌표 변경 감지", Icon: MapPinIcon },
  ];

  const dday =
    stats && stats.daysUntilLaunch > 0
      ? `D-${stats.daysUntilLaunch}`
      : stats && stats.daysUntilLaunch === 0
        ? "D-Day"
        : stats
          ? `+${Math.abs(stats.daysUntilLaunch)}일`
          : "";

  return (
    <AdminPage>
      <AdminHeader
        title="관리자 대시보드"
        description="도시공존 운영 관리"
        back="/mypage"
        backLabel="마이페이지"
        right={
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="w-9 h-9 rounded-full flex items-center justify-center press-strong disabled:opacity-50 text-text-sub"
            style={{ border: "1px solid var(--color-border)" }}
            aria-label="새로고침"
          >
            {refreshing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
          </button>
        }
      />

      {/* 오늘 */}
      {stats && (
        <AdminSection title="오늘" padding={false}>
          <StatRow label="신규 가입" sub={`어제 ${stats.newUsersYesterday}명`} value={`+${stats.newUsersToday}`} />
          <StatRow label="신규 등록 고양이" value={`+${stats.newCatsToday}`} />
          <StatRow label="방문자" value={stats.todayVisits.toLocaleString()} />
          <StatRow label="출시(2026-06-01) 기준" value={dday} />
        </AdminSection>
      )}

      {/* 누적 */}
      {stats && (
        <AdminSection title="누적" padding={false}>
          <StatRow
            label="전체 가입자"
            sub={stats.suspendedUsers > 0 ? `정지 ${stats.suspendedUsers}명` : undefined}
            value={stats.totalUsers.toLocaleString()}
          />
          <StatRow label="등록 고양이" value={stats.totalCats.toLocaleString()} />
          <StatRow
            label="커뮤니티 글"
            sub={`댓글 ${stats.totalComments.toLocaleString()}`}
            value={stats.totalPosts.toLocaleString()}
          />
        </AdminSection>
      )}

      {/* 처리 필요 */}
      {stats && (stats.pendingReports > 0 || stats.pendingInquiries > 0 || stats.errors7d > 0) && (
        <AdminSection title="처리 필요" padding={false}>
          {(stats.pendingReports > 0 || stats.pendingInquiries > 0) && (
            <StatRow
              label="미처리 신고·문의"
              sub={`신고 ${stats.pendingReports} · 문의 ${stats.pendingInquiries}`}
              value={stats.pendingReports + stats.pendingInquiries}
              tone="error"
            />
          )}
          {stats.errors7d > 0 && (
            <StatRow label="7일 로그인 실패" sub={`오늘 ${stats.todayErrors}건`} value={stats.errors7d} tone="warning" />
          )}
        </AdminSection>
      )}

      {/* 관리 메뉴 — 구분선 리스트 */}
      <AdminSection title="관리 메뉴" padding={false}>
        {menus.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="flex items-center gap-3 px-4 py-3 border-b border-divider last:border-b-0 press"
            style={{ minHeight: 56 }}
          >
            <m.Icon size={20} className="shrink-0 text-text-sub" strokeWidth={1.8} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-[15px] font-semibold text-text-main">{m.title}</p>
                {m.badge !== undefined && m.badge > 0 && (
                  <span
                    className="text-[11px] font-semibold px-1.5 py-0.5 tabular-nums"
                    style={{
                      borderRadius: "var(--radius-square)",
                      background: "var(--color-error-soft)",
                      color: "var(--color-error)",
                    }}
                  >
                    {m.badge}
                  </span>
                )}
              </div>
              <p className="text-[13px] text-text-sub mt-0.5 truncate">{m.subtitle}</p>
            </div>
            <ChevronRight size={18} className="shrink-0" style={{ color: "var(--color-text-muted)" }} />
          </Link>
        ))}
      </AdminSection>

      <p className="px-1 text-[13px] text-text-light leading-relaxed">
        이상 감지 시 로그인 실패 로그와 신고·문의함을 먼저 확인하세요.
      </p>
    </AdminPage>
  );
}
