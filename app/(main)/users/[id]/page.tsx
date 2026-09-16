// 공개 프로필 — 2026-09-16 「익숙한 동네앱」 리디자인: 아이보리 바탕·그림자 카드·스탯 틴트 박스·
// 업적 이모지·레벨 노랑 배지 폐지 → 순백 바탕, 원형 아바타, 통계는 헤어라인 행, 회색 선 아이콘.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft, MapPin, PawPrint, CalendarDays, Heart,
  Flame, MessageSquare, MessageCircle, AlertTriangle, Trophy, Award,
} from "lucide-react";
import {
  getUserProfileServer,
  getUserFollowCountsServer,
  getUserCatsServer,
  getUserPublicStatsServer,
  getUserRecentActivityServer,
  getUserRegionsServer,
} from "@/lib/users-server";
import { findAdminTitle, TITLES } from "@/lib/titles";
import { createClient } from "@/lib/supabase/server";
import { computeLevel, computeScore } from "@/lib/cats-repo";
import { sanitizeImageUrl } from "@/lib/url-validate";
import FollowButton from "@/app/components/FollowButton";
import BlockUserButton from "@/app/components/BlockUserButton";

const SITE_URL = "https://dosigongzon.com";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const profile = await getUserProfileServer(id);
  if (!profile) {
    return { title: "프로필을 찾을 수 없어요", robots: { index: false, follow: false } };
  }
  return {
    title: `${profile.nickname}님의 프로필`,
    description: `${profile.nickname}님이 등록한 길고양이와 돌봄 기록`,
    alternates: { canonical: `/users/${profile.id}` },
    openGraph: {
      title: `${profile.nickname}님의 프로필 | 도시공존`,
      description: `${profile.nickname}님이 돌보는 아이들을 만나보세요`,
      url: `${SITE_URL}/users/${profile.id}`,
    },
    robots: { index: false, follow: false }, // 개인 프로필 검색 노출 원치 않음
  };
}

// 회색 태그 (관리자 타이틀·레벨·연속·지역 공통)
const TAG_STYLE: React.CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-square)",
  color: "var(--color-text-sub)",
};

export default async function UserProfilePage({ params }: { params: Params }) {
  const { id } = await params;
  const profile = await getUserProfileServer(id);
  if (!profile) notFound();

  // 로그인 여부 — 활동 지역·최근 활동(시각+장소 패턴)은 비로그인에게 숨긴다.
  // 비로그인 공개 시 "이 사람이 이 동네에서 언제 활동하는지"가 무인증 노출돼 표적화 벡터가 됨
  // (2026-08-29 법률감사 H3). 닉네임·아바타·등록묘·레벨 등 기본 프로필은 그대로 공개.
  const supabase = await createClient();
  const { data: { user: viewer } } = await supabase.auth.getUser();
  const isLoggedIn = !!viewer;

  const [counts, cats, stats, activity, regions] = await Promise.all([
    getUserFollowCountsServer(id),
    getUserCatsServer(id, 30),
    getUserPublicStatsServer(id),
    isLoggedIn ? getUserRecentActivityServer(id, 8) : Promise.resolve([]),
    isLoggedIn ? getUserRegionsServer(id) : Promise.resolve([]),
  ]);
  const careLogCount = stats.careLogCount;

  const adminTitle = findAdminTitle(profile.admin_title);
  const joinedAt = new Date(profile.created_at).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "short",
  });

  // 레벨·업적 계산 — activity_summary 형식으로 래핑
  const activitySummary = {
    catCount: stats.catCount,
    commentCount: stats.commentCount,
    alertCount: stats.alertCount,
    likesReceived: stats.likesReceived,
    careLogCount: stats.careLogCount,
    inviteCount: 0, // 비공개
    currentStreak: stats.currentStreak,
    longestStreak: stats.longestStreak,
    weeklyGoalAchieved: false, // 공개 프로필엔 주간 목표 표시 안 함
    perfectCatchCount: stats.perfectCatchCount,
  };
  const level = computeLevel(computeScore(activitySummary));
  const unlockedTitles = TITLES.filter((t) => t.unlocked(activitySummary)).slice(0, 4);
  const avatar = sanitizeImageUrl(profile.avatar_url, "");

  return (
    <div className="pb-24" style={{ background: "var(--color-surface)", minHeight: "100vh" }}>
      {/* 헤더 */}
      <div className="px-4 pt-12 pb-2 flex items-center gap-2">
        <Link
          href="/"
          className="w-9 h-9 -ml-2 flex items-center justify-center press-strong"
          aria-label="뒤로"
        >
          <ArrowLeft size={20} className="text-text-main" />
        </Link>
      </div>

      {/* 프로필 */}
      <div className="px-4 mt-1">
        <div className="flex items-start gap-4">
          {/* 아바타 — 원형 */}
          <div
            className="w-20 h-20 rounded-full shrink-0 flex items-center justify-center overflow-hidden"
            style={{
              background: avatar ? `url('${avatar}') center/cover` : "var(--color-gray-200)",
            }}
          >
            {!avatar && (
              <span className="text-[28px] font-bold text-text-sub">{profile.nickname.charAt(0)}</span>
            )}
          </div>
          <div className="flex-1 min-w-0 pt-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h1 className="text-[20px] font-bold text-text-main tracking-tight truncate">
                {profile.nickname}
              </h1>
              {adminTitle && (
                <span className="text-[11px] font-medium px-1.5 py-0.5" style={TAG_STYLE}>
                  {adminTitle.name}
                </span>
              )}
            </div>
            {/* 레벨·연속 */}
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <span className="px-2 py-0.5 text-[11px] font-medium flex items-center gap-1" style={TAG_STYLE}>
                Lv.{level.level} {level.title}
              </span>
              {stats.currentStreak >= 2 && (
                <span className="px-2 py-0.5 text-[11px] font-medium flex items-center gap-1" style={TAG_STYLE}>
                  <Flame size={10} />
                  {stats.currentStreak}일 연속
                </span>
              )}
            </div>
            <p className="text-[13px] text-text-sub mt-2 flex items-center gap-1">
              <CalendarDays size={11} />
              {joinedAt} 가입
            </p>
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <FollowButton userId={profile.id} size="md" />
              <BlockUserButton userId={profile.id} userName={profile.nickname ?? undefined} size="md" />
            </div>
          </div>
        </div>

        {/* 통계 — 헤어라인 행 */}
        <div className="mt-5" style={{ borderTop: "1px solid var(--color-divider)" }}>
          <StatRow label="팔로워" value={counts.followers} />
          <StatRow label="팔로잉" value={counts.following} />
          <StatRow label="등록 고양이" value={cats.length} />
          <StatRow label="돌봄 기록" value={careLogCount} />
        </div>

        {/* 활동 지역 */}
        {regions.length > 0 && (
          <div className="mt-4 flex items-center gap-1.5 flex-wrap">
            <MapPin size={11} className="text-text-sub" />
            <span className="text-[11px] font-semibold text-text-sub">활동 지역</span>
            {regions.map((r) => (
              <span
                key={r.name}
                className="px-2 py-0.5 text-[11px] font-medium"
                style={
                  r.is_primary
                    ? { ...TAG_STYLE, borderColor: "var(--color-primary)", color: "var(--color-primary)" }
                    : TAG_STYLE
                }
              >
                {r.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 획득한 업적 */}
      {unlockedTitles.length > 0 && (
        <div className="px-4 mt-6">
          <SectionTitle icon={<Trophy size={14} />} label="획득한 업적" />
          <div>
            {unlockedTitles.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-3 py-3 border-b border-divider last:border-b-0"
                style={{ minHeight: 56 }}
              >
                <Award size={20} strokeWidth={1.8} className="shrink-0 text-text-sub" />
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-semibold text-text-main truncate">{t.name}</p>
                  <p className="text-[13px] text-text-sub truncate leading-tight mt-0.5">{t.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 최근 활동 */}
      {activity.length > 0 && (
        <div className="px-4 mt-6">
          <SectionTitle label="최근 활동" />
          <div>
            {activity.map((item) => {
              const icon =
                item.kind === "care" ? <PawPrint size={16} strokeWidth={1.8} className="text-text-sub" /> :
                item.kind === "comment" ? (item.summary.startsWith("⚠️")
                  ? <AlertTriangle size={16} strokeWidth={1.8} style={{ color: "var(--color-error)" }} />
                  : <MessageCircle size={16} strokeWidth={1.8} className="text-text-sub" />) :
                <MessageSquare size={16} strokeWidth={1.8} className="text-text-sub" />;
              const href =
                item.kind === "post" ? `/community/${item.targetId}` : `/cats/${item.targetId}`;
              const time = formatTimeShort(item.createdAt);
              return (
                <Link
                  key={item.id}
                  href={href}
                  className="flex items-center gap-3 py-3 press border-b border-divider last:border-b-0"
                  style={{ minHeight: 56 }}
                >
                  <div className="shrink-0">{icon}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] text-text-main truncate">
                      <span className="font-semibold">{item.targetName}</span>
                      <span className="mx-1 text-text-light">·</span>
                      <span className="text-text-sub">{item.summary}</span>
                    </p>
                  </div>
                  <span className="text-[11px] text-text-light shrink-0">{time}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* 등록한 고양이 */}
      <div className="px-4 mt-6">
        <SectionTitle label="등록한 고양이" count={cats.length > 0 ? `${cats.length}마리` : undefined} />

        {cats.length === 0 ? (
          <div className="py-10 text-center">
            <PawPrint size={28} className="mx-auto text-text-light mb-2" strokeWidth={1.2} />
            <p className="text-[13px] text-text-sub">아직 등록한 고양이가 없어요</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 pt-3">
            {cats.map((c) => {
              const photo = sanitizeImageUrl(c.photo_url, "");
              return (
                <Link
                  key={c.id}
                  href={`/cats/${c.id}`}
                  className="block press-strong transition-transform"
                >
                  <div
                    className="aspect-square overflow-hidden mb-1.5 flex items-center justify-center"
                    style={{
                      borderRadius: "var(--radius-card-sm)",
                      background: photo ? `url('${photo}') center/cover` : "var(--color-gray-100)",
                    }}
                  >
                    {!photo && <PawPrint size={22} className="text-text-light" strokeWidth={1.5} />}
                  </div>
                  <p className="text-[13px] font-semibold text-text-main truncate text-center tracking-tight">
                    {c.name}
                  </p>
                  {c.region && (
                    <p className="text-[11px] text-text-sub truncate text-center flex items-center justify-center gap-0.5">
                      <MapPin size={9} />
                      {c.region}
                    </p>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* CTA */}
      <div className="px-4 mt-8 text-center">
        <Heart size={18} strokeWidth={1.8} className="mx-auto mb-1 text-text-light" />
        <p className="text-[15px] font-semibold text-text-main">함께 돌봐요</p>
        <p className="text-[13px] text-text-sub mt-0.5">
          {profile.nickname}님과 같은 이웃이 되어 길고양이를 함께 지켜주세요
        </p>
      </div>
    </div>
  );
}

function formatTimeShort(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

function SectionTitle({ icon, label, count }: { icon?: React.ReactNode; label: string; count?: string }) {
  return (
    <div className="flex items-center gap-1.5 pb-1 px-1" style={{ borderBottom: "1px solid var(--color-divider)" }}>
      {icon && <span className="text-text-sub">{icon}</span>}
      <h2 className="text-[15px] font-bold text-text-main tracking-tight">{label}</h2>
      {count && <span className="text-[11px] text-text-light">{count}</span>}
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-divider" style={{ minHeight: 48 }}>
      <span className="text-[15px] text-text-sub">{label}</span>
      <span className="text-[15px] font-semibold text-text-main tabular-nums">{value.toLocaleString()}</span>
    </div>
  );
}
