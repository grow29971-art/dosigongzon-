"use client";

// 홈 재참여 카드 — 적응형. (HomeAuthed 상단, catCount>0 유저에게만 노출)
//  - 재활성화 모드: 내가 등록했는데 돌봄이 끊긴 고양이 안부 유도 → /cats/[id]
//  - 동네 모드: 우리 동네 고양이 수(누적) + 커뮤니티 최근 글 빠른 진입 → /map, /community
// 신규(catCount 0)는 부모에서 제외 — OnboardingCard가 첫 행동을 담당.
// 추가 폴링·Realtime 없음: 부모가 이미 들고 있는 값 + 마운트 1회 fetch한 quietCat만 사용.

import type { CSSProperties } from "react";
import Link from "next/link";
import { Heart, MapPin, MessageCircle, ChevronRight } from "lucide-react";
import { CATEGORY_MAP, type Post } from "@/lib/types";
import { formatRelativeTime } from "@/lib/posts-repo";
import type { QuietCat } from "@/lib/cats-repo";

interface Props {
  quietCat: QuietCat | null;
  regionName: string | null;
  neighborhoodCatCount: number;
  latestPost: Post | null;
}

const cardBox: CSSProperties = {
  background: "linear-gradient(135deg, #FFFFFF 0%, #FCF6EC 100%)",
  borderRadius: 18,
  border: "1px solid rgba(49,130,246,0.18)",
  boxShadow: "0 4px 14px var(--color-primary-softer)",
};

export default function HomeReengageCard({ quietCat, regionName, neighborhoodCatCount, latestPost }: Props) {
  // ══════ 재활성화 모드 (우선) — 멈춘 핵심 돌봄 루프 직격 ══════
  if (quietCat) {
    const neverCared = quietCat.daysSince === null;
    return (
      <Link
        href={`/cats/${quietCat.id}`}
        className="block mb-3 active:scale-[0.99] transition-transform"
        style={{
          background: "linear-gradient(135deg, #FFF3F1 0%, #FFE7E9 100%)",
          borderRadius: 18,
          padding: "13px 14px",
          border: "1px solid rgba(232,107,140,0.22)",
          boxShadow: "0 4px 14px rgba(232,107,140,0.12)",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 text-xl"
            style={{ background: "rgba(232,107,140,0.14)" }}
          >
            🐾
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[9.5px] font-extrabold tracking-[0.15em]" style={{ color: "#D85577" }}>
              안부 한 번
            </p>
            <p className="text-[13.5px] font-extrabold text-text-main leading-tight mt-0.5 truncate">
              {neverCared ? (
                <><b style={{ color: "#D85577" }}>{quietCat.name}</b>에게 첫 안부를 남겨볼까요?</>
              ) : (
                <><b style={{ color: "#D85577" }}>{quietCat.name}</b>, {quietCat.daysSince}일째 기록이 없어요</>
              )}
            </p>
            <p className="text-[11px] text-text-sub mt-0.5 truncate">
              {neverCared ? "밥·물·건강 체크 한 번이면 돼요" : "오늘 밥은 챙겼는지 안부를 남겨봐요"}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Heart size={14} style={{ color: "#E86B8C" }} strokeWidth={2.3} />
            <ChevronRight size={14} style={{ color: "#D85577" }} />
          </div>
        </div>
      </Link>
    );
  }

  // ══════ 동네 모드 — 활동지역 미설정이면 설정 유도 ══════
  if (!regionName) {
    return (
      <Link
        href="/mypage/activity-regions"
        className="block mb-3 active:scale-[0.99] transition-transform"
        style={{ ...cardBox, padding: "13px 14px" }}
      >
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 text-xl" style={{ background: "rgba(49,130,246,0.12)" }}>🗺️</div>
          <div className="flex-1 min-w-0">
            <p className="text-[9.5px] font-extrabold tracking-[0.15em]" style={{ color: "var(--color-primary-dark)" }}>우리 동네</p>
            <p className="text-[13.5px] font-extrabold text-text-main leading-tight mt-0.5">활동 지역을 설정해보세요</p>
            <p className="text-[11px] text-text-sub mt-0.5 truncate">우리 동네 고양이·소식을 모아드려요</p>
          </div>
          <ChevronRight size={14} style={{ color: "var(--color-primary-dark)" }} className="shrink-0" />
        </div>
      </Link>
    );
  }

  // ══════ 동네 모드 — 누적 데이터라 비지 않음 ══════
  const cat = latestPost ? CATEGORY_MAP[latestPost.category] : null;
  return (
    <div className="mb-3" style={{ ...cardBox, overflow: "hidden" }}>
      {/* 우리 동네 고양이 → 지도 */}
      <Link href="/map" className="flex items-center gap-3 px-3.5 py-3 active:scale-[0.99] transition-transform">
        <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-lg" style={{ background: "rgba(49,130,246,0.12)" }}>🗺️</div>
        <div className="flex-1 min-w-0">
          <p className="text-[9.5px] font-extrabold tracking-[0.15em]" style={{ color: "var(--color-primary-dark)" }}>우리 동네 · {regionName}</p>
          <p className="text-[13.5px] font-extrabold text-text-main leading-tight mt-0.5 truncate">
            {neighborhoodCatCount > 0 ? (
              <>돌보는 고양이 <b style={{ color: "var(--color-primary)" }}>{neighborhoodCatCount}마리</b> 지도에서 보기</>
            ) : (
              <>내 주변 고양이 지도 둘러보기</>
            )}
          </p>
        </div>
        <MapPin size={15} style={{ color: "var(--color-primary)" }} className="shrink-0" />
      </Link>

      {latestPost && cat && (
        <>
          <div className="h-px mx-3.5" style={{ background: "rgba(49,130,246,0.14)" }} />
          {/* 커뮤니티 최근 글 → 글 상세 */}
          <Link href={`/community/${latestPost.id}`} className="flex items-center gap-3 px-3.5 py-3 active:scale-[0.99] transition-transform">
            <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-base" style={{ background: `${cat.color}1A` }}>{cat.emoji}</div>
            <div className="flex-1 min-w-0">
              <p className="text-[9.5px] font-extrabold tracking-[0.15em]" style={{ color: cat.color }}>커뮤니티 · {cat.label}</p>
              <p className="text-[13px] font-extrabold text-text-main leading-tight mt-0.5 truncate">{latestPost.title}</p>
              <p className="text-[10.5px] text-text-sub mt-0.5">{formatRelativeTime(latestPost.createdAt)}</p>
            </div>
            <MessageCircle size={15} style={{ color: cat.color }} className="shrink-0" />
          </Link>
        </>
      )}
    </div>
  );
}
