import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { ArrowLeft, MapPin, PawPrint, MessageCircle, UserPlus, User } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { listNearbyCaretakersServer } from "@/lib/users-server";
import { sanitizeImageUrl } from "@/lib/url-validate";
import { thumbnailUrl } from "@/lib/cats-repo";

export const metadata: Metadata = {
  title: "동네 길집사 찾기",
  description: "내 활동 지역에서 함께 활동하는 길집사를 만나보세요.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const day = Math.floor(ms / 86400000);
  if (day === 0) return "오늘 활동";
  if (day === 1) return "어제 활동";
  if (day < 7) return `${day}일 전 활동`;
  if (day < 30) return `${Math.floor(day / 7)}주 전 활동`;
  if (day < 365) return `${Math.floor(day / 30)}개월 전 활동`;
  return `${Math.floor(day / 365)}년 전 활동`;
}

export default async function CaretakersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/caretakers");

  // 본인의 활동 지역 표시용
  const { data: myRegionsRaw } = await supabase
    .from("user_activity_regions")
    .select("name")
    .eq("user_id", user.id);
  const myRegions = (myRegionsRaw ?? []).map((r) => (r as { name: string }).name);

  const caretakers = await listNearbyCaretakersServer(user.id);

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
        <h1 className="text-[24px] font-bold text-text-main mb-1">
          동네 길집사 찾기
        </h1>
        <p className="text-[13px] text-text-sub leading-relaxed">
          내 활동 지역에서 함께 길고양이를 챙기는 분들을 만나보세요.
        </p>
      </div>

      {/* 본문 */}
      <div className="px-4">
        {myRegions.length === 0 ? (
          <EmptyNoRegion />
        ) : caretakers.length === 0 ? (
          <EmptyNoMatch myRegions={myRegions} />
        ) : (
          <>
            <p className="mb-2 px-1 text-[13px] font-semibold text-text-sub">
              {myRegions.join(" · ")}에서 활동하는 {caretakers.length}분
            </p>

            <div className="card px-4">
              {caretakers.map((c) => (
                <CaretakerCard key={c.id} caretaker={c} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function CaretakerCard({
  caretaker,
}: {
  caretaker: Awaited<ReturnType<typeof listNearbyCaretakersServer>>[number];
}) {
  const rawAvatar = sanitizeImageUrl(caretaker.avatar_url, "");
  const avatar = thumbnailUrl(rawAvatar, 96) ?? rawAvatar;
  const presetMsg = encodeURIComponent(
    `안녕하세요! 같은 동네에서 길고양이 챙기시는 것 같아 인사드려요. 같이 정보 나누면 좋을 것 같습니다.`,
  );

  return (
    <div className="py-4 border-b border-divider last:border-b-0">
      <div className="flex items-center gap-3">
        <Link
          href={`/users/${caretaker.id}`}
          className="shrink-0 w-12 h-12 rounded-full overflow-hidden bg-surface-alt flex items-center justify-center text-text-light"
        >
          {avatar ? (
            <Image
              src={avatar}
              alt={caretaker.nickname}
              width={48}
              height={48}
              className="object-cover w-full h-full"
              unoptimized
            />
          ) : (
            <User size={22} strokeWidth={1.6} />
          )}
        </Link>

        <Link href={`/users/${caretaker.id}`} className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-[15px] font-semibold text-text-main truncate">
              {caretaker.nickname}
            </p>
            {caretaker.admin_title && (
              <span
                className="text-[11px] font-medium px-1.5 py-0.5 chip-square shrink-0 text-text-sub"
                style={{ border: "1px solid var(--color-border)" }}
              >
                {caretaker.admin_title}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2.5 mt-0.5 text-[13px] text-text-sub">
            <span className="inline-flex items-center gap-0.5">
              <PawPrint size={11} />
              {caretaker.catCount}마리
            </span>
            <span>돌봄 {caretaker.careLogCount}회</span>
            {caretaker.lastCareAt && (
              <span className="text-text-light">{timeAgo(caretaker.lastCareAt)}</span>
            )}
          </div>
        </Link>
      </div>

      {caretaker.sharedRegions.length > 0 && (
        <div className="mt-2.5 flex items-center gap-1 flex-wrap">
          <MapPin size={11} className="text-text-light" />
          {caretaker.sharedRegions.slice(0, 3).map((r) => (
            <span
              key={r}
              className="text-[11px] font-medium px-1.5 py-0.5 chip-square text-text-sub"
              style={{ border: "1px solid var(--color-border)" }}
            >
              {r}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <Link
          href={`/users/${caretaker.id}`}
          className="flex-1 h-9 rounded-lg text-center text-[13px] font-semibold press-strong transition-transform inline-flex items-center justify-center"
          style={{ background: "var(--color-gray-100)", color: "var(--color-text-main)" }}
        >
          프로필 보기
        </Link>
        <Link
          href={`/messages?to=${caretaker.id}&name=${encodeURIComponent(caretaker.nickname)}&preset=${presetMsg}`}
          className="flex-1 h-9 rounded-lg text-center text-[13px] font-semibold press-strong transition-transform inline-flex items-center justify-center gap-1.5"
          style={{ background: "var(--color-primary)", color: "var(--color-surface)" }}
        >
          <MessageCircle size={14} />
          쪽지 보내기
        </Link>
      </div>
    </div>
  );
}

function EmptyNoRegion() {
  return (
    <div className="card p-6 text-center">
      <MapPin size={32} className="mx-auto text-text-light mb-3" strokeWidth={1.5} />
      <p className="text-[15px] font-semibold text-text-main mb-1.5">
        먼저 활동 지역을 등록해주세요
      </p>
      <p className="text-[13px] text-text-sub leading-relaxed mb-4">
        활동 지역을 설정하면 같은 동네 길집사를 찾아드려요.
      </p>
      <Link
        href="/mypage/activity-regions"
        className="inline-flex items-center px-5 h-10 rounded-lg bg-primary text-surface text-[13px] font-semibold press"
      >
        활동 지역 설정
      </Link>
    </div>
  );
}

function EmptyNoMatch({ myRegions }: { myRegions: string[] }) {
  return (
    <div className="card p-6 text-center">
      <UserPlus size={32} className="mx-auto text-text-light mb-3" strokeWidth={1.5} />
      <p className="text-[15px] font-semibold text-text-main mb-1.5">
        아직 같은 동네 길집사가 없어요
      </p>
      <p className="text-[13px] text-text-sub leading-relaxed">
        {myRegions.join(", ")} 지역에 등록된 다른 분이 없어요.
      </p>
    </div>
  );
}
