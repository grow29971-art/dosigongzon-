"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PageIntroModal from "@/app/components/PageIntroModal";
import {
  Siren,
  Home,
  Heart,
  ShoppingBag,
  MessagesSquare,
  TrendingUp,
  Plus,
  Eye,
  Search,
  Flame,
} from "lucide-react";
import type { Post, PostCategory } from "@/lib/types";
import { listPosts, formatRelativeTime } from "@/lib/posts-repo";
import {
  listMyActivityRegions,
  type ActivityRegion,
} from "@/lib/activity-regions-repo";
import { MapPin } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import LoginRequired from "@/app/components/LoginRequired";
import PageIntroBanner from "@/app/components/PageIntroBanner";
import CommunityWritePrompt from "@/app/components/CommunityWritePrompt";
import UIListRow from "@/app/components/ui/ListRow";
import CatPetitionSection from "@/app/components/CatPetitionSection";

/* ═══ 카테고리 카드 데이터 ═══ */
type CategoryCard = {
  // "popular"은 가상 카테고리 — DB에는 없고 /community/popular로 라우팅
  key: PostCategory | "popular";
  title: string;
  subtitle: string;
  Icon: typeof Siren;
  iconBg: string;
  glowColor: string;
  highlight?: boolean;
};

const CATEGORIES: CategoryCard[] = [
  {
    key: "emergency",
    title: "긴급",
    subtitle: "학대 · 실종 · 응급 구조 제보",
    Icon: Siren,
    iconBg: "#D85555",
    glowColor: "216,85,85",
    highlight: true,
  },
  {
    key: "foster",
    title: "임보",
    subtitle: "임시보호 요청 · 제안",
    Icon: Home,
    iconBg: "#E88D5A",
    glowColor: "232,141,90",
  },
  {
    key: "adoption",
    title: "입양",
    subtitle: "새 가족을 찾아요",
    Icon: Heart,
    iconBg: "#E86B8C",
    glowColor: "232,107,140",
  },
  {
    key: "market",
    title: "중고마켓",
    subtitle: "용품 거래 · 무료 나눔",
    Icon: ShoppingBag,
    iconBg: "#48A59E",
    glowColor: "72,165,158",
  },
  {
    key: "free",
    title: "자유게시판",
    subtitle: "일상 · 정보 · 수다",
    Icon: MessagesSquare,
    iconBg: "#8B65B8",
    glowColor: "139,101,184",
  },
  // 가상 카테고리 — 실제 PostCategory에는 없고 /community/popular로 라우팅
  {
    key: "popular",
    title: "인기 게시물",
    subtitle: "최근 30일 가장 반응 많은 글",
    Icon: Flame,
    iconBg: "#E55A3C",
    glowColor: "229,90,60",
    highlight: true,
  },
];

/* ═══ 페이지 ═══ */
export default function CommunityPage() {
  const { user, loading: authLoading } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [todayVisit, setTodayVisit] = useState<number | null>(null);
  const [totalUsers, setTotalUsers] = useState<number | null>(null);
  const [myRegions, setMyRegions] = useState<ActivityRegion[]>([]);
  const [neighborhoodOnly, setNeighborhoodOnly] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!user) return;

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
      try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data })); } catch {}
    });

    // 비크리티컬: 첫 페인트 후로
    const idle = (window as unknown as { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback
      ?? ((cb: () => void) => setTimeout(cb, 800));
    idle(() => {
      fetch("/api/visit").then((r) => r.json()).then((d) => {
        setTodayVisit(d.today);
        setTotalUsers(d.total);
      }).catch(() => {});
      listMyActivityRegions().then(setMyRegions).catch(() => {});
    });
  }, [user]);

  // 비로그인 가드
  if (mounted && !authLoading && !user) {
    return <LoginRequired from="/community" />;
  }

  const filterByNeighborhood = (p: Post) => {
    if (!p.region) return false;
    return myRegions.some(
      (r) => p.region && (r.name.includes(p.region) || p.region.includes(r.name)),
    );
  };

  const visiblePosts = neighborhoodOnly ? posts.filter(filterByNeighborhood) : posts;

  if (!mounted) return null;

  // 인기 게시글 3건 — 좋아요 + 댓글 + 조회수 가중 합산
  const popularPosts = [...visiblePosts]
    .sort(
      (a, b) =>
        (b.likeCount * 3 + b.commentCount * 2 + b.viewCount)
        - (a.likeCount * 3 + a.commentCount * 2 + a.viewCount),
    )
    .slice(0, 3);

  return (
    <div className="px-4 pt-14 pb-24">
      <PageIntroModal
        storageKey="dosigongzon_intro_community"
        badge="커뮤니티"
        headerEmoji="💬"
        title="이웃 길집사와 이야기 나눠요"
        headerBg="linear-gradient(160deg, #EDE7F6 0%, #E4DAF3 100%)"
        accent="#8B65B8"
        accentDark="#6E4E96"
        items={[
          { emoji: "🐾", text: <>동네 돌봄 소식·꿀팁·질문을 자유롭게 나눠요.</> },
          { emoji: "🔒", text: <>댓글은 <b className="text-text-main">비밀 댓글</b>로 글쓴이에게만 조용히 남길 수도 있어요.</> },
          { emoji: "✍️", text: <>우하단 글쓰기 버튼으로 첫 글을 남겨보세요.</> },
        ]}
      />
      {/* ── 헤더 ── */}
      <div className="mb-6 px-1 flex items-end justify-between">
        <div>
          <div className="flex items-baseline gap-2 mb-1">
            <h1 className="text-[24px] font-extrabold text-text-main tracking-tight">
              커뮤니티
            </h1>
            <span className="text-[11px] font-semibold text-text-light">
              Community
            </span>
          </div>
          <p className="text-[12.5px] text-text-sub leading-relaxed">
            동네 이웃들과 함께 만드는 공간
          </p>
        </div>
        <Link
          href="/search"
          className="w-10 h-10 rounded-full bg-white flex items-center justify-center active:scale-90 transition-transform"
          style={{ boxShadow: "var(--shadow-raised)" }}
          aria-label="통합 검색"
        >
          <Search size={18} className="text-text-sub" />
        </Link>
      </div>

      {/* 페이지 사용법 안내 (dismiss 가능) */}
      <div className="mb-4">
        <PageIntroBanner
          id="community"
          title="커뮤니티에서 할 수 있는 것"
          description="긴급 구조·임보 요청·입양 공고·용품 나눔·일상 대화까지. 카테고리별로 구별되니 찾기 쉬워요. 우측 하단 + 버튼으로 글쓰기."
          ctaLabel="자세한 사용법"
          ctaHref="/guide"
          accent="#8B65B8"
        />
      </div>

      {/* 글쓰기 유도 — 글감 프롬프트 (빈 페이지 공포 ↓) */}
      <CommunityWritePrompt />

      {/* ── 오늘 방문자 (누적 총 방문자 수) ── */}
      {todayVisit !== null && (
        <div
          className="mb-4 flex items-center justify-center gap-2 py-2.5 rounded-2xl"
          style={{
            background: "var(--color-primary-softer)",
            border: "1px solid rgba(173, 94, 59,0.12)",
          }}
        >
          <Eye size={14} className="text-primary" />
          <span className="text-[12px] text-text-sub">방문자</span>
          <span className="text-[14px] font-extrabold text-primary">{todayVisit.toLocaleString()}</span>
          <span className="text-[12px] text-text-sub">명</span>
        </div>
      )}

      {/* ── 내 동네만 필터 ── */}
      {myRegions.length > 0 && (
        <div className="mb-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setNeighborhoodOnly(false)}
            className="px-3 py-1.5 text-[11px] font-bold active:scale-95 transition-transform"
            style={{
              borderRadius: "var(--radius-square-lg)",
              backgroundColor: !neighborhoodOnly ? "var(--color-text-main)" : "rgba(255,255,255,0.9)",
              color: !neighborhoodOnly ? "#fff" : "var(--color-text-sub)",
              boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
            }}
          >
            전체
          </button>
          <button
            type="button"
            onClick={() => setNeighborhoodOnly(true)}
            className="px-3 py-1.5 text-[11px] font-bold active:scale-95 transition-transform flex items-center gap-1"
            style={{
              borderRadius: "var(--radius-square-lg)",
              background: neighborhoodOnly
                ? "linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)"
                : "rgba(255,255,255,0.9)",
              color: neighborhoodOnly ? "#fff" : "var(--color-text-sub)",
              boxShadow: neighborhoodOnly
                ? "0 2px 8px rgba(173, 94, 59,0.35)"
                : "0 2px 6px rgba(0,0,0,0.05)",
            }}
          >
            <MapPin size={11} />
            내 동네만
            {neighborhoodOnly && (
              <span
                className="ml-0.5 px-1.5 py-0.5 rounded-md text-[9px]"
                style={{ background: "rgba(255,255,255,0.25)" }}
              >
                {visiblePosts.length}
              </span>
            )}
          </button>
          {neighborhoodOnly && visiblePosts.length === 0 && (
            <p className="text-[10px] text-text-light ml-1">
              내 동네({myRegions.map((r) => r.name).join(", ")}) 글이 아직 없어요
            </p>
          )}
        </div>
      )}

      {/* ── 카테고리 — 토스식 그룹 리스트 (2026-07-16): 색색 카드 6장 → 흰 카드 1장 + 행 구분선.
          색은 아이콘 박스에만 남기고 장식(글로우·색 테두리)은 제거 — 타이포·아이콘만으로 위계. ── */}
      <div className="card px-3 py-1">
        {([CATEGORIES[0], CATEGORIES[5], CATEGORIES[1], CATEGORIES[2], CATEGORIES[3], CATEGORIES[4]] as CategoryCard[]).map(
          (card, idx, arr) => (
            <UIListRow
              key={card.key}
              href={card.key === "popular" ? "/community/popular" : `/community/category/${card.key}`}
              icon={<card.Icon size={20} color={card.iconBg} strokeWidth={2} />}
              iconBg={`${card.iconBg}15`}
              title={card.title}
              subtitle={card.subtitle}
              style={idx < arr.length - 1 ? { borderBottom: "1px solid var(--color-divider)" } : undefined}
            />
          ),
        )}
      </div>

      {/* ── 국회 길고양이 청원 (찬반 전체 — 링크 안내만, 2026-07-22 회의) ── */}
      <CatPetitionSection />

      {/* ── 인기 글 ── */}
      {popularPosts.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center gap-1.5 mb-3 px-1">
            <h2 className="text-[17px] font-extrabold text-text-main tracking-tight">
              인기 글
            </h2>
            <TrendingUp size={14} style={{ color: "#C9A961" }} />
          </div>
          <div className="space-y-2.5">
            {popularPosts.map((post) => {
              const cat = CATEGORIES.find((c) => c.key === post.category);
              if (!cat) return null;
              return (
                <Link
                  key={post.id}
                  href={`/community/${post.id}`}
                  className="block active:scale-[0.99] transition-transform"
                >
                  <div
                    className="flex items-center gap-3 px-4 py-3"
                    style={{
                      background: "#FFFFFF",
                      borderRadius: "var(--radius-card-sm)",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.03), 0 1px 2px rgba(0,0,0,0.02)",
                      border: "1px solid rgba(0,0,0,0.04)",
                    }}
                  >
                    <span
                      className="text-[10px] font-extrabold px-2 py-1 shrink-0"
                      style={{
                        backgroundColor: `${cat.iconBg}15`,
                        color: cat.iconBg,
                        borderRadius: "var(--radius-square)",
                      }}
                    >
                      {cat.title}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-text-main truncate">
                        {post.title}
                      </p>
                      <p className="text-[10.5px] text-text-light mt-0.5">
                        {post.authorName} · {formatRelativeTime(post.createdAt)}
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* ── FAB ── */}
      <Link
        href="/community/write"
        className="fixed bottom-24 right-5 w-14 h-14 rounded-full bg-primary flex items-center justify-center fab-shadow active:scale-90 transition-transform z-40"
        style={{ boxShadow: "0 4px 16px rgba(173, 94, 59,0.45), 0 0 0 4px #fff" }}
      >
        <Plus size={28} color="#fff" strokeWidth={2.5} />
      </Link>
    </div>
  );
}

/* ═══ 2칸 그리드용 컴팩트 카드 ═══ */