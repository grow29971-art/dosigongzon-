import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft, MapPin, PawPrint, CalendarDays, Heart,
  Flame, MessageSquare, MessageCircle, AlertTriangle, Trophy,
} from "lucide-react";
import {
  getUserProfileServer,
  getUserFollowCountsServer,
  getUserCatsServer,
  getUserPublicStatsServer,
  getUserRecentActivityServer,
  getUserRegionsServer,
} from "@/lib/users-server";
import { findAdminTitle, TITLES, CATEGORY_COLORS } from "@/lib/titles";
import { computeLevel, computeScore } from "@/lib/cats-repo";
import { sanitizeImageUrl } from "@/lib/url-validate";
import FollowButton from "@/app/components/FollowButton";

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

export default async function UserProfilePage({ params }: { params: Params }) {
  const { id } = await params;
  const profile = await getUserProfileServer(id);
  if (!profile) notFound();

  const [counts, cats, stats, activity, regions] = await Promise.all([
    getUserFollowCountsServer(id),
    getUserCatsServer(id, 30),
    getUserPublicStatsServer(id),
    getUserRecentActivityServer(id, 8),
    getUserRegionsServer(id),
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
  };
  const level = computeLevel(computeScore(activitySummary));
  const unlockedTitles = TITLES.filter((t) => t.unlocked(activitySummary)).slice(0, 4);

  return (
    <div className="pb-24" style={{ background: "#F7F4EE", minHeight: "100vh" }}>
      {/* 헤더 */}
      <div className="px-4 pt-12 pb-2 flex items-center gap-2">
        <Link
          href="/"
          className="w-9 h-9 rounded-full bg-white flex items-center justify-center active:scale-90"
          style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}
          aria-label="뒤로"
        >
          <ArrowLeft size={18} className="text-text-main" />
        </Link>
      </div>

      {/* 프로필 카드 */}
      <div className="px-4 mt-2">
        <div
          className="rounded-3xl p-5"
          style={{
            background: "linear-gradient(135deg, #FFFFFF 0%, #FFF9F0 100%)",
            boxShadow: "0 8px 24px rgba(196,126,90,0.15)",
            border: "1px solid rgba(196,126,90,0.1)",
          }}
        >
          <div className="flex items-start gap-4">
            {/* 아바타 */}
            <div
              className="w-20 h-20 rounded-full shrink-0"
              style={{
                background: profile.avatar_url
                  ? `url('${profile.avatar_url}') center/cover`
                  : "linear-gradient(135deg, #C47E5A 0%, #A8684A 100%)",
                border: "3px solid #fff",
                boxShadow: "0 6px 16px rgba(0,0,0,0.1)",
              }}
            >
              {!profile.avatar_url && (
                <div className="w-full h-full flex items-center justify-center text-[28px] font-extrabold text-white">
                  {profile.nickname.charAt(0)}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0 pt-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h1 className="text-[18px] font-extrabold text-text-main tracking-tight truncate">
                  {profile.nickname}
                </h1>
                {adminTitle && (
                  <span
                    className="text-[9.5px] font-extrabold px-1.5 py-0.5 rounded-md"
                    style={{ backgroundColor: adminTitle.color, color: "#fff" }}
                  >
                    {adminTitle.emoji} {adminTitle.name}
                  </span>
                )}
              </div>
              {/* 레벨 배지 */}
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <span
                  className="px-2 py-0.5 rounded-md text-[10px] font-extrabold flex items-center gap-1"
                  style={{
                    background: "linear-gradient(135deg, #FFD93D 0%, #FFAA00 100%)",
                    color: "#fff",
                    boxShadow: "0 2px 6px rgba(255,170,0,0.3)",
                  }}
                >
                  {level.emoji} Lv.{level.level} {level.title}
                </span>
                {stats.currentStreak >= 2 && (
                  <span
                    className="px-2 py-0.5 rounded-md text-[10px] font-extrabold flex items-center gap-1"
                    style={{ background: "#FFE8D5", color: "#C4621E" }}
                  >
                    <Flame size={10} />
                    {stats.currentStreak}일 연속
                  </span>
                )}
              </div>
              <p className="text-[11.5px] text-text-sub mt-2 flex items-center gap-1">
                <CalendarDays size={11} />
                {joinedAt} 가입
              </p>
              <div className="mt-3">
                <FollowButton userId={profile.id} size="md" />
              </div>
            </div>
          </div>

          {/* 스탯 */}
          <div className="grid grid-cols-4 gap-2 mt-5">
            <StatBox label="팔로워" value={counts.followers} color="#4A7BA8" />
            <StatBox label="팔로잉" value={counts.following} color="#8B65B8" />
            <StatBox label="등록 고양이" value={cats.length} color="#C47E5A" />
            <StatBox label="돌봄 기록" value={careLogCount} color="#6B8E6F" />
          </div>

          {/* 활동 지역 */}
          {regions.length > 0 && (
            <div className="mt-4 flex items-center gap-1.5 flex-wrap">
              <MapPin size={11} className="text-text-sub" />
              <span className="text-[10.5px] font-bold text-text-sub">활동 지역</span>
              {regions.map((r) => (
                <span
                  key={r.name}
                  className="px-2 py-0.5 rounded-lg text-[10.5px] font-extrabold"
                  style={{
                    background: r.is_primary ? "#C47E5A" : "#F7F4EE",
                    color: r.is_primary ? "#fff" : "#A38E7A",
                  }}
                >
                  {r.is_primary && "★ "}{r.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 획득한 업적 */}
      {unlockedTitles.length > 0 && (
        <div className="px-4 mt-5">
          <div className="flex items-center gap-2 mb-3 px-1">
            <div className="w-1 h-4 rounded-full" style={{ backgroundColor: "#E8B040" }} />
            <h2 className="text-[14px] font-extrabold text-text-main tracking-tight flex items-center gap-1">
              <Trophy size={14} style={{ color: "#E8B040" }} />
              획득한 업적
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {unlockedTitles.map((t) => (
              <div
                key={t.id}
                className="rounded-2xl p-3 flex items-center gap-2.5"
                style={{
                  background: "#FFFFFF",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                  border: `1px solid ${CATEGORY_COLORS[t.category]}30`,
                }}
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-[18px]"
                  style={{ background: `${CATEGORY_COLORS[t.category]}15` }}
                >
                  {t.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11.5px] font-extrabold text-text-main truncate">
                    {t.name}
                  </p>
                  <p className="text-[9.5px] text-text-sub truncate leading-tight">
                    {t.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 최근 활동 */}
      {activity.length > 0 && (
        <div className="px-4 mt-5">
          <div className="flex items-center gap-2 mb-3 px-1">
            <div className="w-1 h-4 rounded-full" style={{ backgroundColor: "#6B8E6F" }} />
            <h2 className="text-[14px] font-extrabold text-text-main tracking-tight">
              최근 활동
            </h2>
          </div>
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: "#FFFFFF", boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}
          >
            {activity.map((item) => {
              const icon =
                item.kind === "care" ? <PawPrint size={12} style={{ color: "#6B8E6F" }} /> :
                item.kind === "comment" ? (item.summary.startsWith("⚠️")
                  ? <AlertTriangle size={12} style={{ color: "#D85555" }} />
                  : <MessageCircle size={12} style={{ color: "#4A7BA8" }} />) :
                <MessageSquare size={12} style={{ color: "#8B65B8" }} />;
              const href =
                item.kind === "post" ? `/community/${item.targetId}` : `/cats/${item.targetId}`;
              const time = formatTimeShort(item.createdAt);
              return (
                <Link
                  key={item.id}
                  href={href}
                  className="flex items-center gap-2.5 px-4 py-2.5 active:bg-surface-alt border-b border-divider last:border-0"
                >
                  <div className="shrink-0">{icon}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11.5px] font-bold text-text-main truncate">
                      <span style={{ color: "#C47E5A" }}>{item.targetName}</span>
                      <span className="mx-1 text-text-light">·</span>
                      <span className="text-text-sub font-semibold">{item.summary}</span>
                    </p>
                  </div>
                  <span className="text-[10px] text-text-light shrink-0">{time}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* 등록한 고양이 */}
      <div className="px-4 mt-5">
        <div className="flex items-center gap-2 mb-3 px-1">
          <div className="w-1 h-4 rounded-full" style={{ backgroundColor: "#C47E5A" }} />
          <h2 className="text-[14px] font-extrabold text-text-main tracking-tight">
            등록한 고양이
          </h2>
          {cats.length > 0 && (
            <span className="text-[11px] text-text-light">{cats.length}마리</span>
          )}
        </div>

        {cats.length === 0 ? (
          <div
            className="py-10 text-center rounded-2xl bg-white"
            style={{ border: "1px solid rgba(0,0,0,0.05)" }}
          >
            <PawPrint size={28} className="mx-auto text-text-light mb-2" strokeWidth={1.2} />
            <p className="text-[12.5px] text-text-sub">아직 등록한 고양이가 없어요</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {cats.map((c) => (
              <Link
                key={c.id}
                href={`/cats/${c.id}`}
                className="block active:scale-[0.97] transition-transform"
              >
                <div
                  className="aspect-square rounded-2xl overflow-hidden mb-1.5"
                  style={{
                    background: c.photo_url
                      ? `url('${sanitizeImageUrl(c.photo_url, "")}') center/cover`
                      : "#EEE8E0",
                    border: "2px solid #fff",
                    boxShadow: "0 3px 10px rgba(0,0,0,0.06)",
                  }}
                >
                  {!c.photo_url && (
                    <div className="w-full h-full flex items-center justify-center">
                      <PawPrint size={22} style={{ color: "#C47E5A" }} />
                    </div>
                  )}
                </div>
                <p className="text-[12px] font-extrabold text-text-main truncate text-center tracking-tight">
                  {c.name}
                </p>
                {c.region && (
                  <p className="text-[10px] text-text-sub truncate text-center flex items-center justify-center gap-0.5">
                    <MapPin size={9} />
                    {c.region}
                  </p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* CTA */}
      <div className="px-4 mt-6">
        <div
          className="rounded-2xl p-4 text-center"
          style={{
            background: "#FFFFFF",
            boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
            border: "1px solid rgba(0,0,0,0.04)",
          }}
        >
          <Heart size={16} className="mx-auto mb-1" style={{ color: "#E86B8C" }} />
          <p className="text-[12px] font-bold text-text-main">
            함께 돌봐요
          </p>
          <p className="text-[10.5px] text-text-sub mt-0.5">
            {profile.nickname}님과 같은 이웃이 되어 길고양이를 함께 지켜주세요
          </p>
        </div>
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

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      className="rounded-xl p-2.5 text-center"
      style={{ background: `${color}10`, border: `1px solid ${color}20` }}
    >
      <p className="text-[16px] font-extrabold tracking-tight" style={{ color }}>
        {value.toLocaleString()}
      </p>
      <p className="text-[9.5px] text-text-sub font-bold mt-0.5">{label}</p>
    </div>
  );
}
