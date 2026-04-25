"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Siren,
  Home,
  Heart,
  ShoppingBag,
  MessagesSquare,
  ChevronRight,
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

/* ═══ 카테고리 카드 컴포넌트 ═══ */
function CategoryCardItem({ card }: { card: CategoryCard }) {
  const href = card.key === "popular" ? "/community/popular" : `/community/category/${card.key}`;
  return (
    <Link
      href={href}
      className="block active:scale-[0.98] transition-transform"
    >
      <div
        className="relative overflow-hidden px-5 py-[18px]"
        style={{
          background: "#FFFFFF",
          borderRadius: 22,
          boxShadow: card.highlight
            ? `0 12px 32px rgba(${card.glowColor},0.18), 0 2px 6px rgba(${card.glowColor},0.08)`
            : `0 6px 20px rgba(${card.glowColor},0.10), 0 1px 3px rgba(0,0,0,0.03)`,
          border: card.highlight
            ? `1.5px solid rgba(${card.glowColor},0.30)`
            : "1px solid rgba(0,0,0,0.04)",
        }}
      >
        <div className="flex items-center gap-4">
          <div
            className="w-[48px] h-[48px] rounded-2xl flex items-center justify-center shrink-0 dark-icon-box"
            style={{ backgroundColor: `${card.iconBg}15` }}
          >
            <card.Icon size={22} color={card.iconBg} strokeWidth={2} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[15.5px] font-extrabold text-text-main tracking-tight leading-tight">
              {card.title}
            </p>
            <p className="text-[11.5px] text-text-sub mt-1 leading-snug truncate">
              {card.subtitle}
            </p>
          </div>
          <ChevronRight
            size={18}
            strokeWidth={2.5}
            className="shrink-0"
            style={{ color: card.iconBg, opacity: 0.7 }}
          />
        </div>
      </div>
    </Link>
  );
}

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
          className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center active:scale-90 transition-transform"
          style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
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

      {/* ── 오늘 방문자 (누적 총 방문자 수) ── */}
      {todayVisit !== null && (
        <div
          className="mb-4 flex items-center justify-center gap-2 py-2.5 rounded-2xl"
          style={{
            background: "rgba(196,126,90,0.08)",
            border: "1px solid rgba(196,126,90,0.12)",
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
            className="px-3 py-1.5 rounded-2xl text-[11px] font-bold active:scale-95 transition-transform"
            style={{
              backgroundColor: !neighborhoodOnly ? "#2C2C2C" : "rgba(255,255,255,0.9)",
              color: !neighborhoodOnly ? "#fff" : "#666",
              boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
            }}
          >
            전체
          </button>
          <button
            type="button"
            onClick={() => setNeighborhoodOnly(true)}
            className="px-3 py-1.5 rounded-2xl text-[11px] font-bold active:scale-95 transition-transform flex items-center gap-1"
            style={{
              background: neighborhoodOnly
                ? "linear-gradient(135deg, #C47E5A 0%, #A8684A 100%)"
                : "rgba(255,255,255,0.9)",
              color: neighborhoodOnly ? "#fff" : "#666",
              boxShadow: neighborhoodOnly
                ? "0 2px 8px rgba(196,126,90,0.35)"
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

      {/* ── 카테고리 벤토 그리드 ── */}
      <div className="space-y-3">
        {/* Row 1: 긴급 (wide, highlight) */}
        <CategoryCardItem card={CATEGORIES[0]} />

        {/* Row 1.5: 인기 게시물 (wide, highlight) */}
        <CategoryCardItem card={CATEGORIES[5]} />

        {/* Row 2: 임보 | 입양 */}
        <div className="grid grid-cols-2 gap-3">
          <Link
            href={`/community/category/${CATEGORIES[1].key}`}
            className="block active:scale-[0.98] transition-transform"
          >
            <CompactCard card={CATEGORIES[1]} />
          </Link>
          <Link
            href={`/community/category/${CATEGORIES[2].key}`}
            className="block active:scale-[0.98] transition-transform"
          >
            <CompactCard card={CATEGORIES[2]} />
          </Link>
        </div>

        {/* Row 3: 중고마켓 */}
        <CategoryCardItem card={CATEGORIES[3]} />

        {/* Row 4: 자유게시판 */}
        <CategoryCardItem card={CATEGORIES[4]} />
      </div>

      {/* ── 인기 글 ── */}
      {popularPosts.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center gap-2 mb-3 px-1">
            <div className="w-1 h-4 rounded-full" style={{ backgroundColor: "#C9A961" }} />
            <h2 className="text-[14px] font-extrabold text-text-main tracking-tight">
              인기 글
            </h2>
            <TrendingUp size={13} style={{ color: "#C9A961" }} />
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
                      borderRadius: 16,
                      boxShadow: "0 2px 8px rgba(0,0,0,0.03), 0 1px 2px rgba(0,0,0,0.02)",
                      border: "1px solid rgba(0,0,0,0.04)",
                    }}
                  >
                    <span
                      className="text-[10px] font-extrabold px-2 py-1 rounded-lg shrink-0"
                      style={{
                        backgroundColor: `${cat.iconBg}15`,
                        color: cat.iconBg,
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
        className="fixed bottom-24 right-5 w-14 h-14 rounded-[20px] bg-primary flex items-center justify-center fab-shadow active:scale-90 transition-transform z-40"
      >
        <Plus size={28} color="#fff" strokeWidth={2.5} />
      </Link>
    </div>
  );
}

/* ═══ 2칸 그리드용 컴팩트 카드 ═══ */
function CompactCard({ card }: { card: CategoryCard }) {
  return (
    <div
      className="relative overflow-hidden px-4 py-[18px]"
      style={{
        background: "#FFFFFF",
        borderRadius: 22,
        boxShadow: `0 6px 20px rgba(${card.glowColor},0.10), 0 1px 3px rgba(0,0,0,0.03)`,
        border: "1px solid rgba(0,0,0,0.04)",
      }}
    >
      <div
        className="w-[44px] h-[44px] rounded-2xl flex items-center justify-center mb-3 dark-icon-box"
        style={{ backgroundColor: `${card.iconBg}15` }}
      >
        <card.Icon size={20} color={card.iconBg} strokeWidth={2} />
      </div>
      <p className="text-[15px] font-extrabold text-text-main tracking-tight">
        {card.title}
      </p>
      <p className="text-[11px] text-text-sub mt-0.5 leading-snug">
        {card.subtitle}
      </p>
    </div>
  );
}
