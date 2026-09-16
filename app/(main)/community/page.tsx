"use client";

// 커뮤니티 — 피드형 (2026-09-16 사장님 지시: 카페 피드 레퍼런스).
// 상단 카테고리 칩(가로 스크롤, UIChip 6px 사각) + 카드 없는 전폭 피드 + "글쓰기" 확장 FAB.
// 이전 구조(카테고리 그룹 리스트·인기 글·안내 배너·방문자 수·글감 프롬프트)는 삭제가 아니라
// SHOW_COMMUNITY_LEGACY 플래그로 숨김. 카테고리별 라우트(/community/category/*)는 딥링크용으로 유지.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MapPin, PenLine, Search, Siren, HandHeart, Flame, MessagesSquare, Pin, ChevronDown } from "lucide-react";
import PageIntroModal from "@/app/components/PageIntroModal";
import type { Post, PostCategory } from "@/lib/types";
import { CATEGORY_MAP } from "@/lib/types";
import { listPosts, updatePostVote } from "@/lib/posts-repo";
import { listFirstCommentsForPosts, type PostComment } from "@/lib/post-comments-repo";
import { isCurrentUserAdmin } from "@/lib/news-repo";
import { getMyPostVotes, setMyPostVote, type PostVote } from "@/lib/store";
import { listMyActivityRegions, type ActivityRegion } from "@/lib/activity-regions-repo";
import { useAuth } from "@/lib/auth-context";
import LoginRequired from "@/app/components/LoginRequired";
import PageIntroBanner from "@/app/components/PageIntroBanner";
import CommunityWritePrompt from "@/app/components/CommunityWritePrompt";
import CareTeamCard from "@/app/components/CareTeamCard";
import CommunityFeedItem from "@/app/components/CommunityFeedItem";
import UIChip from "@/app/components/ui/Chip";
import { isCoreJourneyEnabled } from "@/lib/core-journey-flags";

// 이전 커뮤니티 홈 섹션(안내 모달·배너·글감·돌봄팀 카드) — 피드 전환으로 숨김, 코드는 보존
const SHOW_COMMUNITY_LEGACY = false;

type FilterKey = "all" | PostCategory | "popular";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "emergency", label: CATEGORY_MAP.emergency.label },
  { key: "sitter", label: CATEGORY_MAP.sitter.label },
  { key: "free", label: CATEGORY_MAP.free.label },
  { key: "foster", label: CATEGORY_MAP.foster.label },
  { key: "adoption", label: CATEGORY_MAP.adoption.label },
  { key: "market", label: CATEGORY_MAP.market.label },
  { key: "popular", label: "인기" },
];

const popularityScore = (p: Post) => p.likeCount * 3 + p.commentCount * 2 + p.viewCount;

export default function CommunityPage() {
  const { user, loading: authLoading } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [firstComments, setFirstComments] = useState<Record<string, PostComment>>({});
  const [myVotes, setMyVotes] = useState<Record<string, PostVote>>({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [myRegions, setMyRegions] = useState<ActivityRegion[]>([]);
  const [neighborhoodOnly, setNeighborhoodOnly] = useState(false);
  const [noticesOpen, setNoticesOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!user) return;
    setMyVotes(getMyPostVotes());

    // sessionStorage 5분 캐시 → 즉시 표시 후 백그라운드 새로고침
    const CACHE_KEY = "dosi_community_posts_v1";
    const TTL = 5 * 60 * 1000;
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        const { ts, data } = JSON.parse(cached);
        if (Date.now() - ts < TTL) setPosts(data);
      }
    } catch {}
    listPosts().then((data) => {
      setPosts(data);
      try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
      } catch {}
      // 첫 댓글 미리보기 — 댓글 있는 글만
      const ids = data.filter((p) => p.commentCount > 0).map((p) => p.id);
      listFirstCommentsForPosts(ids).then(setFirstComments).catch(() => {});
    });

    const idle =
      (window as unknown as { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback
      ?? ((cb: () => void) => setTimeout(cb, 800));
    idle(() => {
      listMyActivityRegions().then(setMyRegions).catch(() => {});
      isCurrentUserAdmin().then(setIsAdmin).catch(() => {});
    });
  }, [user]);

  // 공지(pinned)는 피드에 섞지 않고 상단 접힌 블록으로 — 실제 글이 첫 화면에 오도록
  const pinnedPosts = useMemo(() => {
    const pinned = posts.filter((p) => p.isPinned);
    if (filter === "all" || filter === "popular") return pinned;
    return pinned.filter((p) => p.category === filter);
  }, [posts, filter]);

  const visiblePosts = useMemo(() => {
    let list = posts.filter((p) => !p.isPinned);
    if (filter === "popular") {
      list = [...list].sort((a, b) => popularityScore(b) - popularityScore(a)).slice(0, 20);
    } else if (filter !== "all") {
      list = list.filter((p) => p.category === filter);
    }
    if (neighborhoodOnly) {
      list = list.filter(
        (p) => !!p.region && myRegions.some((r) => r.name.includes(p.region!) || p.region!.includes(r.name)),
      );
    }
    return list;
  }, [posts, filter, neighborhoodOnly, myRegions]);

  // 비로그인 가드
  if (mounted && !authLoading && !user) {
    return <LoginRequired from="/community" />;
  }

  // 좋아요 토글 — category/[cat]/page.tsx와 동일 규칙(관리자는 누적, 일반은 토글·롤백)
  const handleLike = async (postId: string) => {
    const patch = (dLike: -1 | 0 | 1) =>
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, likeCount: Math.max(0, p.likeCount + dLike) } : p)),
      );

    if (isAdmin) {
      patch(1);
      try {
        await updatePostVote(postId, 1, 0);
      } catch {
        patch(-1);
      }
      return;
    }

    const prev = myVotes[postId] ?? 0;
    const next: PostVote | 0 = prev === 1 ? 0 : 1;
    let dLike: -1 | 0 | 1 = 0;
    let dDislike: -1 | 0 | 1 = 0;
    if (prev === 1) dLike = -1;
    if (prev === -1) dDislike = -1;
    if (next === 1) dLike = (dLike + 1) as -1 | 0 | 1;

    patch(dLike);
    setMyPostVote(postId, next);
    setMyVotes(getMyPostVotes());
    try {
      await updatePostVote(postId, dLike, dDislike);
    } catch {
      patch(dLike === 0 ? 0 : ((-dLike) as -1 | 1));
      setMyPostVote(postId, prev);
      setMyVotes(getMyPostVotes());
    }
  };

  if (!mounted) return null;

  const showCareTeam = SHOW_COMMUNITY_LEGACY && isCoreJourneyEnabled("P4");
  const writeHref = filter !== "all" && filter !== "popular" ? `/community/write?category=${filter}` : "/community/write";

  return (
    <div className="pb-24" style={{ background: "var(--color-surface-alt)" }}>
      {SHOW_COMMUNITY_LEGACY && (
        <PageIntroModal
          storageKey="dosigongzon_intro_community"
          badge="커뮤니티"
          headerEmoji=""
          title="이웃 길집사와 이야기 나눠요"
          items={[
            { emoji: "", text: <>동네 돌봄 소식·꿀팁·질문을 자유롭게 나눠요.</> },
            { emoji: "", text: <>댓글은 <b className="text-text-main">비밀 댓글</b>로 글쓴이에게만 조용히 남길 수도 있어요.</> },
            { emoji: "", text: <>우하단 글쓰기 버튼으로 첫 글을 남겨보세요.</> },
          ]}
        />
      )}

      {/* ── 상단: 제목 + 검색, 카테고리 칩 (sticky) ── */}
      <div className="sticky top-0 z-30" style={{ background: "var(--color-surface)", borderBottom: "1px solid var(--color-divider)" }}>
        <div className="px-4 pt-12 pb-2 flex items-center justify-between">
          <h1 className="text-[20px] font-bold text-text-main tracking-tight">커뮤니티</h1>
          <Link
            href="/search"
            className="w-9 h-9 -mr-2 flex items-center justify-center text-text-sub press"
            aria-label="통합 검색"
          >
            <Search size={20} />
          </Link>
        </div>
        <div className="flex items-center gap-2 px-4 pb-3 overflow-x-auto no-scrollbar">
          {FILTERS.map((f) => (
            <UIChip
              key={f.key}
              active={filter === f.key}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </UIChip>
          ))}
          {myRegions.length > 0 && (
            <UIChip
              active={neighborhoodOnly}
              activeColor="var(--color-text-main)"
              onClick={() => setNeighborhoodOnly((v) => !v)}
              icon={<MapPin size={12} />}
            >
              내 동네
            </UIChip>
          )}
        </div>
      </div>

      {SHOW_COMMUNITY_LEGACY && (
        <div className="px-4 pt-3">
          <PageIntroBanner
            id="community"
            title="커뮤니티에서 할 수 있는 것"
            description="긴급 구조·임보·입양·나눔·일상 대화를 카테고리별로 나눠요."
            ctaLabel="자세한 사용법"
            ctaHref="/guide"
          />
          <CommunityWritePrompt />
          {showCareTeam && <CareTeamCard />}
        </div>
      )}

      {/* ── 공지 (접힘) ── */}
      {pinnedPosts.length > 0 && (
        <div className="mb-2" style={{ background: "var(--color-surface)", borderBottom: "1px solid var(--color-divider)" }}>
          <button
            type="button"
            onClick={() => setNoticesOpen((v) => !v)}
            className="w-full flex items-center gap-2 px-4 py-3 text-left press"
            aria-expanded={noticesOpen}
          >
            <Pin size={14} className="text-primary shrink-0" />
            <span className="text-[13px] font-semibold text-text-main flex-1 truncate">
              {noticesOpen ? `공지 ${pinnedPosts.length}개` : pinnedPosts[0].title}
            </span>
            {!noticesOpen && pinnedPosts.length > 1 && (
              <span className="text-[12px] text-text-light shrink-0">+{pinnedPosts.length - 1}</span>
            )}
            <ChevronDown
              size={16}
              className="text-text-light shrink-0 transition-transform"
              style={{ transform: noticesOpen ? "rotate(180deg)" : undefined }}
            />
          </button>
          {noticesOpen &&
            pinnedPosts.map((p) => (
              <Link
                key={p.id}
                href={`/community/${p.id}`}
                className="flex items-center gap-2 px-4 py-2.5 press"
                style={{ borderTop: "1px solid var(--color-divider)" }}
              >
                <span className="text-[11px] font-semibold text-text-light shrink-0">{CATEGORY_MAP[p.category].label}</span>
                <span className="text-[13px] text-text-main flex-1 truncate">{p.title}</span>
              </Link>
            ))}
        </div>
      )}

      {/* ── 피드 ── */}
      {visiblePosts.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-text-light" style={{ background: "var(--color-surface)" }}>
          {filter === "emergency" ? (
            <Siren size={40} strokeWidth={1.2} />
          ) : filter === "sitter" ? (
            <HandHeart size={40} strokeWidth={1.2} />
          ) : filter === "popular" ? (
            <Flame size={40} strokeWidth={1.2} />
          ) : (
            <MessagesSquare size={40} strokeWidth={1.2} />
          )}
          <p className="text-[15px] mt-4 text-text-sub font-semibold">
            {neighborhoodOnly ? "내 동네 글이 아직 없어요" : "아직 글이 없어요"}
          </p>
          <p className="text-[13px] mt-1">첫 번째 글을 남겨보세요</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {visiblePosts.map((post) => (
            <CommunityFeedItem
              key={post.id}
              post={post}
              liked={myVotes[post.id] === 1}
              firstComment={firstComments[post.id]}
              onLike={handleLike}
            />
          ))}
        </div>
      )}

      {/* ── 글쓰기 FAB ── */}
      <Link
        href={writeHref}
        className="fixed bottom-24 right-5 h-14 px-6 rounded-full bg-primary flex items-center gap-2 fab-shadow press-strong transition-transform z-40"
        aria-label="글쓰기"
      >
        <PenLine size={20} color="var(--color-surface)" strokeWidth={2.2} />
        <span className="text-[17px] font-bold" style={{ color: "var(--color-surface)" }}>글쓰기</span>
      </Link>
    </div>
  );
}
