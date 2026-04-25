import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { ArrowLeft, MapPin, PawPrint, MessageCircle, Sparkles, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { listNearbyCaretakersServer } from "@/lib/users-server";
import { sanitizeImageUrl } from "@/lib/url-validate";

export const metadata: Metadata = {
  title: "동네 캣맘 찾기",
  description: "내 활동 지역에서 함께 활동하는 캣맘·캣대디를 만나보세요.",
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
    <div className="pb-24 min-h-screen" style={{ background: "#F7F4EE" }}>
      {/* 헤더 */}
      <div className="px-5 pt-12 pb-5">
        <Link
          href="/mypage"
          className="inline-flex items-center gap-1 text-[12px] font-semibold text-text-sub mb-3"
        >
          <ArrowLeft size={14} />
          마이페이지
        </Link>
        <div className="flex items-baseline gap-2 mb-1">
          <UserPlus size={20} className="text-primary" />
          <h1 className="text-[22px] font-extrabold tracking-tight text-text-main">
            동네 캣맘 찾기
          </h1>
        </div>
        <p className="text-[12.5px] text-text-sub leading-relaxed">
          내 활동 지역에서 함께 길고양이를 챙기는 분들을 만나보세요.
          휴가 갈 때 백업을 부탁하거나 정보 공유도 가능해요.
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
            <div
              className="mb-3 px-3 py-2.5 rounded-xl flex items-center gap-2"
              style={{
                background: "rgba(196,126,90,0.08)",
                border: "1px solid rgba(196,126,90,0.15)",
              }}
            >
              <Sparkles size={13} className="text-primary shrink-0" />
              <p className="text-[11.5px] font-bold text-text-main leading-tight">
                {myRegions.join(" · ")}에서 활동하는 {caretakers.length}분
              </p>
            </div>

            <div className="space-y-2.5">
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
  const avatar = sanitizeImageUrl(caretaker.avatar_url, "");
  const presetMsg = encodeURIComponent(
    `안녕하세요! 같은 동네에서 길고양이 챙기시는 것 같아 인사드려요. 같이 정보 나누면 좋을 것 같습니다.`,
  );

  return (
    <div
      className="rounded-2xl p-4"
      style={{
        background: "#FFFFFF",
        boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
        border: "1px solid rgba(0,0,0,0.04)",
      }}
    >
      <div className="flex items-center gap-3">
        <Link
          href={`/users/${caretaker.id}`}
          className="shrink-0 w-12 h-12 rounded-full overflow-hidden bg-surface-alt flex items-center justify-center"
          style={{ border: "1.5px solid #E5E0D6" }}
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
            <span className="text-[20px]">🙂</span>
          )}
        </Link>

        <Link href={`/users/${caretaker.id}`} className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-[14.5px] font-extrabold text-text-main tracking-tight truncate">
              {caretaker.nickname}
            </p>
            {caretaker.admin_title && (
              <span
                className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-md shrink-0"
                style={{ background: "#C47E5A", color: "#fff" }}
              >
                {caretaker.admin_title}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2.5 mt-0.5 text-[11px] text-text-sub">
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
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
              style={{ background: "rgba(107,142,111,0.12)", color: "#3F5B42" }}
            >
              {r}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <Link
          href={`/users/${caretaker.id}`}
          className="flex-1 py-2 rounded-xl text-center text-[12.5px] font-bold active:scale-[0.97] transition-transform"
          style={{
            background: "rgba(196,126,90,0.08)",
            color: "#C47E5A",
            border: "1px solid rgba(196,126,90,0.18)",
          }}
        >
          프로필 보기
        </Link>
        <Link
          href={`/messages?to=${caretaker.id}&name=${encodeURIComponent(caretaker.nickname)}&preset=${presetMsg}`}
          className="flex-1 py-2 rounded-xl text-center text-[12.5px] font-bold text-white active:scale-[0.97] transition-transform inline-flex items-center justify-center gap-1.5"
          style={{ background: "#C47E5A" }}
        >
          <MessageCircle size={13} />
          쪽지 보내기
        </Link>
      </div>
    </div>
  );
}

function EmptyNoRegion() {
  return (
    <div
      className="rounded-2xl p-6 text-center"
      style={{
        background: "#FFFFFF",
        border: "1px solid rgba(0,0,0,0.04)",
        boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
      }}
    >
      <MapPin size={32} className="mx-auto text-text-light mb-3" strokeWidth={1.5} />
      <p className="text-[14px] font-extrabold text-text-main mb-1.5">
        먼저 활동 지역을 등록해주세요
      </p>
      <p className="text-[12px] text-text-sub leading-relaxed mb-4">
        활동 지역을 설정하면 같은 동네 캣맘 분들을 찾아드려요.
      </p>
      <Link
        href="/mypage/activity-regions"
        className="inline-block px-5 py-2.5 rounded-xl bg-primary text-white text-[13px] font-bold"
      >
        활동 지역 설정
      </Link>
    </div>
  );
}

function EmptyNoMatch({ myRegions }: { myRegions: string[] }) {
  return (
    <div
      className="rounded-2xl p-6 text-center"
      style={{
        background: "#FFFFFF",
        border: "1px solid rgba(0,0,0,0.04)",
        boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
      }}
    >
      <UserPlus size={32} className="mx-auto text-text-light mb-3" strokeWidth={1.5} />
      <p className="text-[14px] font-extrabold text-text-main mb-1.5">
        아직 같은 동네 캣맘이 없어요
      </p>
      <p className="text-[12px] text-text-sub leading-relaxed mb-2">
        {myRegions.join(", ")} 지역에 등록된 다른 분이 없어요.
      </p>
      <p className="text-[11px] text-text-light leading-relaxed">
        주변 분들에게 도시공존을 소개해보세요. 함께하면 더 많은 아이를 챙길 수 있어요.
      </p>
    </div>
  );
}
