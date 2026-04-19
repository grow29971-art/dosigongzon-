import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, PawPrint, Users as UsersIcon, CalendarDays, Heart } from "lucide-react";
import {
  getUserProfileServer,
  getUserFollowCountsServer,
  getUserCatsServer,
  getUserCareLogCountServer,
} from "@/lib/users-server";
import { findAdminTitle } from "@/lib/titles";
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

  const [counts, cats, careLogCount] = await Promise.all([
    getUserFollowCountsServer(id),
    getUserCatsServer(id, 30),
    getUserCareLogCountServer(id),
  ]);

  const adminTitle = findAdminTitle(profile.admin_title);
  const joinedAt = new Date(profile.created_at).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "short",
  });

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
              <p className="text-[11.5px] text-text-sub mt-1 flex items-center gap-1">
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
        </div>
      </div>

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
