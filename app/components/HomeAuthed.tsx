"use client";

import { GEOLOCATION_ENABLED } from "@/lib/geo";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MapPin,
  Wind,
  Sun,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudLightning,
  CloudDrizzle,
  CloudFog,
  Loader2,
  WifiOff,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Bell,
  Bot,
  Search,
  ShoppingBag,
} from "lucide-react";
import dynamic from "next/dynamic";
// 업적 토스트 — 업적 잠금 해제 시에만 보임. ssr 끄고 lazy.
const AchievementToast = dynamic(() => import("@/app/components/AchievementToast"), { ssr: false });
import type { ToastData } from "@/app/components/AchievementToast";
const SocialProofStrip = dynamic(() => import("@/app/components/SocialProofStrip"), { ssr: false });
import { TITLES, CATEGORY_COLORS } from "@/lib/titles";
import HomeStreakCard from "@/app/components/HomeStreakCard";
import SplashLoading from "@/app/components/SplashLoading";
const FoundingMemberBanner = dynamic(() => import("@/app/components/FoundingMemberBanner"), { ssr: false });
import FirstProjectBanner from "@/app/components/FirstProjectBanner";
import PageIntroModal from "@/app/components/PageIntroModal";
const MyCircleQuickEntry = dynamic(() => import("@/app/components/MyCircleQuickEntry"), { ssr: false });
import { countMyAcceptedCircleMembers } from "@/lib/circles-repo";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import {
  getMyActivitySummary,
  getMyQuietestCat,
  computeScore,
  computeLevel,
  getLevelColor,
  type MyActivitySummary,
  type LevelInfo,
  type QuietCat,
} from "@/lib/cats-repo";
import { listPosts, formatRelativeTime } from "@/lib/posts-repo";
import {
  listCurrentWeekIssues,
  type WeeklyIssue,
} from "@/lib/weekly-issues-repo";
import { getUnreadNotificationCount } from "@/lib/notifications-repo";
import { getMyStreakInfo, type StreakInfo } from "@/lib/streak-repo";
import {
  getWeeklyCaretakerRanking,
  getWeeklyPopularCats,
  type CaretakerRank,
  type PopularCat,
} from "@/lib/leaderboard-repo";
import { getRecentFeed, type FeedItem } from "@/lib/live-feed-repo";
import { getTodayAnniversaries, type Anniversary } from "@/lib/anniversaries-repo";
const OnboardingCard = dynamic(() => import("@/app/components/OnboardingCard"), { ssr: false });
// 온보딩→홈 핸드오프 — 온보딩에서 고른 아이 첫 밥 CTA (pending_care 있을 때만 렌더)
const PendingCareHandoff = dynamic(() => import("@/app/components/PendingCareHandoff"), { ssr: false });
const DailyCatBox = dynamic(() => import("@/app/components/DailyCatBox"), { ssr: false });
const DailyCheckinModal = dynamic(() => import("@/app/components/DailyCheckinModal"), { ssr: false });
const FirstCheerCard = dynamic(() => import("@/app/components/FirstCheerCard"), { ssr: false });
const AppOpenGuideModal = dynamic(() => import("@/app/components/AppOpenGuideModal"), { ssr: false });
import MyCatsHero from "@/app/components/MyCatsHero";
import ReturnDigestCard from "@/app/components/ReturnDigestCard";
import ShopPreviewStrip from "@/app/components/ShopPreviewStrip";
import CareTamagotchiHero from "@/app/components/CareTamagotchiHero";
import CatPetitionSection from "@/app/components/CatPetitionSection";
const WeeklyCheckinCard = dynamic(() => import("@/app/components/WeeklyCheckinCard"), { ssr: false });
const PushCareCueOptIn = dynamic(() => import("@/app/components/PushCareCueOptIn"), { ssr: false });
const FeatureTipsCard = dynamic(() => import("@/app/components/FeatureTipsCard"), { ssr: false });
// 푸시 옵트인 카드는 페이지 하단 — 첫 페인트엔 viewport 밖. lazy 안전.
const PushOptInCard = dynamic(() => import("@/app/components/PushOptInCard"), { ssr: false });
// 친구 초대 카드 — 첫 cat 등록한 사용자에게만 홈 하단에 노출. viral 강화.
const InviteSection = dynamic(() => import("@/app/components/InviteSection"), { ssr: false });
import type { Post } from "@/lib/types";
import { listCats, thumbnailUrl, type Cat } from "@/lib/cats-repo";
import {
  listMyActivityRegions,
  distanceMeters,
  type ActivityRegion,
} from "@/lib/activity-regions-repo";
import { sanitizeImageUrl, sanitizeHttpUrl } from "@/lib/url-validate";

import { CAT_FACTS } from "@/lib/cat-facts";

/* ═══ 날씨 아이콘 매핑 ═══ */
const WEATHER_ICONS: Record<string, typeof Sun> = {
  Clear: Sun,
  Clouds: Cloud,
  Rain: CloudRain,
  Drizzle: CloudDrizzle,
  Thunderstorm: CloudLightning,
  Snow: CloudSnow,
  Mist: CloudFog,
  Fog: CloudFog,
  Haze: CloudFog,
};

function getTempColor(temp: number): string {
  if (temp <= 0) return "#5B7A8F";
  if (temp <= 10) return "#7A9BB0";
  if (temp <= 20) return "#2A2A28";
  if (temp <= 30) return "var(--color-primary)";
  return "#B84545";
}

interface WeatherData {
  city: string;
  temp: number;
  feelsLike: number;
  humidity: number;
  weatherMain: string;
  weatherDesc: string;
  windSpeed: number;
}

/* ═══ 로그인 유저 홈(대시보드) ═══ */
export default function HomeAuthed({
  hotSlot,
  adoptionSlot,
  eventSlot,
}: { hotSlot?: React.ReactNode; adoptionSlot?: React.ReactNode; eventSlot?: React.ReactNode } = {}) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [fact, setFact] = useState("");
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [weatherError, setWeatherError] = useState("");
  const [activity, setActivity] = useState<MyActivitySummary | null>(null);
  const [circleMemberCount, setCircleMemberCount] = useState(0);
  const [achievementToasts, setAchievementToasts] = useState<ToastData[]>([]);
  const [rescueCount, setRescueCount] = useState(0);
  const [levelInfo, setLevelInfo] = useState<LevelInfo | null>(null);
  const [popularPosts, setPopularPosts] = useState<Post[]>([]);
  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [allCats, setAllCats] = useState<Cat[]>([]);
  const [myRegions, setMyRegions] = useState<ActivityRegion[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  // 홈 리디자인(2026-07-11): 활동 요약 접기 + 동네 소식 탭
  const [activityOpen, setActivityOpen] = useState(false);
  const [hoodTab, setHoodTab] = useState<"cats" | "posts">("cats");
  // 브리핑 헤드라인 — 오늘 아직 밥 기록이 없는 내 고양이 이름 (없으면 null)
  const [hungryCatName, setHungryCatName] = useState<string | null>(null);
  const [streakInfo, setStreakInfo] = useState<StreakInfo | null>(null);
  const [caretakerRank, setCaretakerRank] = useState<CaretakerRank[]>([]);
  const [popularCats, setPopularCats] = useState<PopularCat[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [anniversaries, setAnniversaries] = useState<Anniversary[]>([]);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const [lastVisitAt, setLastVisitAt] = useState<number | null>(null);
  const [newPostsCount, setNewPostsCount] = useState(0);
  const [weeklyIssues, setWeeklyIssues] = useState<WeeklyIssue[]>([]);
  const [quietCat, setQuietCat] = useState<QuietCat | null>(null);
  // 기능 웰컴 투어(FeatureTourModal, FeatureTourGate가 렌더)와 이 세션에서 안 겹치게
  // AppOpenGuideModal을 억제할지 판단하는 용도 — 실제 모달 렌더는 FeatureTourGate가 담당.
  const [suppressAppOpenGuide, setSuppressAppOpenGuide] = useState(true);

  // 마지막 방문 시각 — 진입 시 비교용으로 저장된 값 복원, 즉시 현재 시각으로 갱신.
  // 다음 방문 시 "지난 방문 이후 새 글 N개" 카운트의 기준이 됨.
  useEffect(() => {
    if (!user) return;
    const key = `dosigongzon_home_lastvisit_${user.id}`;
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const last = parseInt(stored, 10);
        if (Number.isFinite(last)) setLastVisitAt(last);
      }
      localStorage.setItem(key, String(Date.now()));
    } catch {
      // localStorage 차단 등 무시
    }
  }, [user]);

  // 로그인 코인 보너스 — 하루 1회(+8), 중복 지급은 서버가 KST 날짜 선점으로 차단.
  // 코인 경제 부활(2026-07-16)과 함께 복원 — 케어 간식 구매 재원.
  useEffect(() => {
    if (!user) return;
    fetch("/api/coins/daily-login", { method: "POST" }).catch(() => {});
  }, [user]);

  // allPosts 또는 lastVisitAt 갱신 시 새 글 개수 재계산
  useEffect(() => {
    if (lastVisitAt === null || allPosts.length === 0) {
      setNewPostsCount(0);
      return;
    }
    const cnt = allPosts.filter(
      (p) => new Date(p.createdAt).getTime() > lastVisitAt,
    ).length;
    setNewPostsCount(cnt);
  }, [lastVisitAt, allPosts]);

  // 데이터 로드
  useEffect(() => {
    listCurrentWeekIssues().then(setWeeklyIssues).catch(() => {});
    listPosts().then((posts) => {
      setAllPosts(posts);
      const sorted = [...posts].sort(
        (a, b) => (b.likeCount * 3 + b.commentCount * 2 + b.viewCount) - (a.likeCount * 3 + a.commentCount * 2 + a.viewCount),
      );
      setPopularPosts(sorted.slice(0, 3));
    });
    listCats().then(setAllCats).catch(() => {});
  }, []);

  // 활동 지역 로드 (로그인 유저만)
  useEffect(() => {
    if (!user) {
      setMyRegions([]);
      return;
    }
    listMyActivityRegions().then(setMyRegions).catch(() => {});
  }, [user]);

  // streak 로드
  useEffect(() => {
    if (!user) {
      setStreakInfo(null);
      return;
    }
    getMyStreakInfo().then(setStreakInfo).catch(() => {});
  }, [user]);

  // 브리핑 헤드라인 데이터 — MyCatsHero와 동일 쿼리(내 고양이 + 오늘 care_logs), 표시용 1건만
  useEffect(() => {
    if (!user) { setHungryCatName(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const sb = createClient();
        const { data: myCats } = await sb
          .from("cats")
          .select("id, name")
          .eq("caretaker_id", user.id)
          .order("created_at", { ascending: false })
          .limit(10);
        if (!myCats || myCats.length === 0) return;
        const kstDate = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
        const todayStart = new Date(kstDate + "T00:00:00+09:00").toISOString();
        const rows = myCats as { id: string; name: string }[];
        const { data: logs } = await sb
          .from("care_logs")
          .select("cat_id")
          .eq("author_id", user.id)
          .in("cat_id", rows.map((c) => c.id))
          .gte("logged_at", todayStart);
        const fed = new Set((logs ?? []).map((r: { cat_id: string }) => r.cat_id));
        const hungry = rows.find((c) => !fed.has(c.id));
        if (!cancelled) setHungryCatName(hungry?.name ?? null);
      } catch { /* 헤드라인은 폴백 문구 사용 */ }
    })();
    return () => { cancelled = true; };
  }, [user]);

  // 온보딩 dismissal 상태 복원
  useEffect(() => {
    if (!user) return;
    try {
      const key = `dosigongzon_onboarding_dismissed_${user.id}`;
      setOnboardingDismissed(localStorage.getItem(key) === "1");
    } catch { /* localStorage 차단 등 무시 */ }
  }, [user]);

  // 기능 웰컴 투어 완료 여부 확인 — FeatureTourGate와 같은 세션에 AppOpenGuideModal이
  // 겹쳐 뜨지 않게만 판단 (실제 투어 모달 렌더는 FeatureTourGate 담당)
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    createClient()
      .from("profiles")
      .select("feature_tour_completed_at")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }: { data: { feature_tour_completed_at?: string | null } | null }) => {
        if (cancelled) return;
        setSuppressAppOpenGuide(!data?.feature_tour_completed_at);
      })
      .catch(() => { if (!cancelled) setSuppressAppOpenGuide(false); });
    return () => { cancelled = true; };
  }, [user]);

  const handleDismissOnboarding = () => {
    setOnboardingDismissed(true);
    if (user) {
      try {
        localStorage.setItem(`dosigongzon_onboarding_dismissed_${user.id}`, "1");
      } catch { /* no-op */ }
    }
  };

  // 리더보드 로드 (비로그인도 볼 수 있음)
  useEffect(() => {
    getWeeklyCaretakerRanking(3).then(setCaretakerRank).catch(() => {});
    getWeeklyPopularCats(5).then(setPopularCats).catch(() => {});
    getTodayAnniversaries().then(setAnniversaries).catch(() => {});
  }, []);

  // 실시간 피드 로드 + 5분 폴링 (탭 활성 시에만)
  // 이전: 60초 폴링 무조건 실행 → 백그라운드 탭에서도 egress 소모.
  useEffect(() => {
    const primary = myRegions.find((r) => r.is_primary) ?? myRegions[0] ?? null;
    let cancelled = false;
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      getRecentFeed({ region: primary, limit: 10, hours: 24 })
        .then((list) => { if (!cancelled) setFeed(list); })
        .catch(() => {});
    };
    refresh();
    const interval = setInterval(refresh, 300_000); // 5분
    const onVis = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [myRegions]);

  // 알림 카운트 로드 + 2분 폴링 (탭 활성 시에만)
  // 이전: 30초 폴링 무조건. BottomNav가 이미 폴링하므로 빈도 절감 가능.
  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }
    let cancelled = false;
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      getUnreadNotificationCount()
        .then((n) => { if (!cancelled) setUnreadCount(n); })
        .catch(() => {});
    };
    refresh();
    const interval = setInterval(refresh, 120_000); // 2분
    const onVis = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [user]);

  // 내 동네 고양이 (주 활동 지역 반경 내)
  const primaryRegion = myRegions.find((r) => r.is_primary) ?? myRegions[0] ?? null;
  const neighborhoodCats = primaryRegion
    ? allCats
        .filter(
          (c) =>
            distanceMeters({ lat: c.lat, lng: c.lng }, { lat: primaryRegion.lat, lng: primaryRegion.lng }) <=
            primaryRegion.radius_m,
        )
        .slice(0, 6)
    : [];

  // 우리 동네 고양이 누적 수 (재참여 카드 — slice 전 전체 카운트)
  const neighborhoodCatCount = primaryRegion
    ? allCats.filter(
        (c) =>
          distanceMeters({ lat: c.lat, lng: c.lng }, { lat: primaryRegion.lat, lng: primaryRegion.lng }) <=
          primaryRegion.radius_m,
      ).length
    : 0;

  // 신규 첫 응원 후보 — 동네 고양이 우선, 없으면 최근 공개 고양이 중 사진 있는 3마리
  const cheerCats = (neighborhoodCats.length > 0 ? neighborhoodCats : allCats)
    .filter((c) => c.photo_url)
    .slice(0, 3);

  // 내 동네 글 (region 이름이 활동 지역 이름과 일치하는 것)
  const neighborhoodPosts = primaryRegion
    ? allPosts
        .filter((p) => {
          if (!p.region) return false;
          return myRegions.some(
            (r) => p.region && (r.name.includes(p.region) || p.region.includes(r.name)),
          );
        })
        .slice(0, 3)
    : [];

  // 방문자 카운트 (로그인 완료 후 토큰 포함)
  useEffect(() => {
    if (authLoading) return;
    const recordVisit = async () => {
      const headers: Record<string, string> = {};
      if (user) {
        try {
          const { data } = await createClient().auth.getSession();
          if (data.session?.access_token) {
            headers["Authorization"] = `Bearer ${data.session.access_token}`;
          }
        } catch {}
      }
      fetch("/api/visit", { method: "POST", headers }).catch(() => {});
    };
    recordVisit();
  }, [authLoading, user]);

  // 온보딩 체크 — /onboarding은 비로그인(랜딩) 전용이다.
  // 로그인 유저는 이미 가입을 마친 사람이므로 "가입/로그인" 화면인 /onboarding으로
  // 절대 튕기지 않는다(예: 소셜 첫 가입은 /welcome을 거치는데 그 경로는 onboarded 플래그를
  // 세팅하지 않아, 가입 직후 홈 첫 진입에서 랜딩 온보딩으로 새던 버그를 차단).
  useEffect(() => {
    if (authLoading) return;
    try {
      if (user) {
        localStorage.setItem("dosigongzon_onboarded", "true");
      } else if (!localStorage.getItem("dosigongzon_onboarded")) {
        // "지도가 곧 온보딩" (2026-07-22 회의 B안) — 첫 안내는 지도 위 MapIntroSheet가 담당
        router.push("/map");
        return;
      }
    } catch {}
    setOnboardingChecked(true);
  }, [router, authLoading, user]);

  // 온보딩 통과 후 auth 확인 → 로그인 안 되어 있으면 지도(비회원 모드)로
  useEffect(() => {
    if (!onboardingChecked) return;
    if (authLoading) return;
    if (!user) {
      router.push("/map");
    }
  }, [onboardingChecked, authLoading, user, router]);

  useEffect(() => {
    if (!onboardingChecked || authLoading || !user) return;

    setMounted(true);
    setFact(CAT_FACTS[Math.floor(Math.random() * CAT_FACTS.length)]);

    // 긴급 구조 피드 카운트 (체크리스트용)
    fetch("/api/social-proof")
      .then((r) => r.json())
      .then((d) => {
        if (typeof d?.rescueCount === "number") setRescueCount(d.rescueCount);
      })
      .catch(() => {});

    // 내 서클 멤버 수 (서클 단계 표시용)
    countMyAcceptedCircleMembers().then(setCircleMemberCount).catch(() => {});

    // 돌봄이 끊긴 내 고양이 (홈 재참여 카드용) — 마운트 1회
    getMyQuietestCat().then(setQuietCat).catch(() => {});

    // 내 활동 요약 + 레벨 + 레벨업/업적 해제 감지
    getMyActivitySummary().then((s) => {
      setActivity(s);
      const lvl = computeLevel(computeScore(s));
      setLevelInfo(lvl);

      // 축하 토스트 큐
      const newToasts: ToastData[] = [];

      // 1) 레벨업 감지
      try {
        const prevKey = `last-seen-level:${user.id}`;
        const prev = Number(localStorage.getItem(prevKey) ?? "0");
        if (lvl.level > prev && prev > 0) {
          newToasts.push({
            id: `lvl-${lvl.level}`,
            kind: "level_up",
            emoji: lvl.emoji,
            title: `Lv.${lvl.level} ${lvl.title}`,
            subtitle: "레벨이 올랐어요! 새 혜택을 확인해보세요",
            color: "var(--color-primary)",
          });
        }
        localStorage.setItem(prevKey, String(lvl.level));
      } catch {}

      // 2) 새 업적 잠금 해제 감지
      try {
        const key = `unlocked-titles:${user.id}`;
        const prevRaw = localStorage.getItem(key);
        const prevSet = new Set<string>(prevRaw ? JSON.parse(prevRaw) : []);
        const currentUnlocked = TITLES.filter((t) => t.unlocked(s));
        const newlyUnlocked = currentUnlocked.filter((t) => !prevSet.has(t.id));
        // 최초 로드(prevRaw 없음) 시에는 토스트 띄우지 않음 — 과거 업적 몰아치기 방지
        if (prevRaw !== null) {
          for (const t of newlyUnlocked) {
            newToasts.push({
              id: `title-${t.id}`,
              kind: "title_unlock",
              emoji: t.emoji,
              title: t.name,
              subtitle: t.description,
              color: CATEGORY_COLORS[t.category],
            });
          }
        }
        localStorage.setItem(
          key,
          JSON.stringify(currentUnlocked.map((t) => t.id)),
        );
      } catch {}

      if (newToasts.length > 0) {
        setAchievementToasts((prev) => [...prev, ...newToasts]);
      }
    });

    // 날씨 가져오기
    const fetchWeather = async (lat?: number, lon?: number) => {
      try {
        const params = lat && lon ? `?lat=${lat}&lon=${lon}` : "";
        const res = await fetch(`/api/weather${params}`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.debug || data.error || `HTTP ${res.status}`);
        }
        setWeather(data);
      } catch (err) {
        setWeatherError(err instanceof Error ? err.message : "날씨 정보를 가져올 수 없습니다.");
      } finally {
        setWeatherLoading(false);
      }
    };

    if (!GEOLOCATION_ENABLED || !navigator.geolocation) {
      // 측위 OFF(LBS 신고 전) 또는 미지원 → IP 기반으로 서버에서 처리
      fetchWeather();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => fetchWeather(pos.coords.latitude, pos.coords.longitude),
      () => {
        // GPS 거부 → IP 기반으로 서버에서 처리
        fetchWeather();
      },
      // maximumAge 10분 — 홈 다시 진입 시 매번 권한 재확인 팝업 뜨지 않게
      { timeout: 5000, maximumAge: 10 * 60 * 1000 },
    );
  }, [onboardingChecked, authLoading, user]);

  // 로딩 중이거나 auth 체크 전 → 스플래시 로딩 화면
  if (!onboardingChecked || authLoading || !user || !mounted) {
    return <SplashLoading />;
  }

  // ── 홈 간결화 (2026-07-15): 아래 섹션은 잠정 비노출. 되살리려면 해당 플래그 true. ──
  // 기준: 중복(인기 커뮤니티=HOT) · 다른 탭에 존재(꿀팁·동네이슈·새글) · 저빈도(기념일)
  const SHOW_ANNIVERSARY = false;    // 오늘의 기념일 → 냥식으로 충분
  const SHOW_WEEKLY_ISSUES = false;  // 동네 이슈 → 커뮤니티 탭
  const SHOW_NEW_POSTS_BADGE = false;// 지난 방문 새 글 배지 → 커뮤니티 탭
  const SHOW_POPULAR_POSTS = false;  // 인기 커뮤니티 글 → HOT 게시글과 중복
  const SHOW_TIPS_ENTRY = false;     // 꿀팁게시판 진입 → AI집사 탭에 존재

  // ── 홈 3블록화 (2026-07-15): MAU 초기엔 '첫 돌봄' 신호를 흐리는 섹션을 숨긴다. ──
  // 쇼핑/포인트 오픈·인원 확보 후 각 플래그를 true로 되돌리면 복원(라우트·코드는 유지).
  const SHOW_FUND_BANNER = false;         // 첫 프로젝트(펀드) 배너 — 쇼핑 오픈 전 공허
  const SHOW_TODO_CHIPS = false;          // '오늘 할 일' 칩(냥상자·도감·랭킹)
  const SHOW_CHECKIN = true;              // 출석/냥상자/주간출석 — 코인 경제 부활(2026-07-16, 다마고치 케어 간식 재원)
  const SHOW_POPULAR_CATS = true;         // 이번 주 인기 고양이 TOP5 — 관계주의 훅(2026-07-16 회의). length>0 가드로 인원 적으면 자동 숨김
  const SHOW_EVENT_BANNERS = false;       // 파운딩멤버 등 이벤트 배너
  const SHOW_CIRCLE_ENTRY = true;         // 서클 빠른 진입 — "혼자→같이" 리텐션 앵커(2026-07-16 회의)
  const SHOW_INVITE = true;               // 초대 섹션 — 바이럴 유입(catCount>0 가드). (2026-07-16 회의)
  const SHOW_SOCIAL_PROOF = true;         // 사회적 증명 스트립 — 동네 활발함 신호(데이터 없으면 자동 숨김). (2026-07-16 회의)
  const SHOW_WEATHER_SHOP_BRIDGE = true;  // 날씨→쇼핑 카테고리 다리 — 2026-07-21 쇼핑 동선 회의로 ON (한파/폭염/비 조건부 노출)
  const SHOW_SHOP_PREVIEW = true;         // 홈 쇼핑 프리뷰 스트립(찜) — 2026-07-21 쇼핑 동선 회의. 케어 지표 하락 시 이 플래그로 롤백

  return (
    <>
    <PageIntroModal
      storageKey="dosigongzon_intro_home"
      badge="홈"
      headerEmoji="🏠"
      title="우리 동네 길고양이, 여기서 함께 돌봐요"
      items={[
        { emoji: "🐾", text: <>지도에서 <b className="text-text-main">+ 버튼</b>으로 우리 동네 고양이를 등록해요.</> },
        { emoji: "🍚", text: <>매일 <b className="text-text-main">내 아이들</b>에게 밥·물·간식을 1탭으로 기록해요.</> },
        { emoji: "🗺️", text: <>아래로 내리면 우리 동네 고양이·소식이 이어져요.</> },
        { emoji: "😸", text: <>대표 아이와 <b className="text-text-main">다마고치</b>처럼 교감해요. 방치해도 아프거나 떠나지 않으니 부담 없이!</> },
      ]}
    />
    <div className="px-5 pt-5 pb-24">
      {/* ══════ 국회 길고양이 청원 — 접이식 바 (2026-07-23 커뮤니티→홈 최상단 이동) ══════ */}
      <CatPetitionSection />

      {/* ══════ 지역 미설정 유저 — 동네 소식 받기 유도 (2026-07-15) ══════ */}
      {/* 지역설정은 등록의 관문이 아니다 — 첫 등록 전(catCount===0) 유저에겐 등록 유도가
          먼저 오도록, 이 배너는 '등록을 마친 뒤'에만 노출해 동네 소식 연결로 안내. */}
      {user && myRegions.length === 0 && activity && activity.catCount > 0 && (
        <Link
          href="/mypage/activity-regions"
          className="block mb-4 active:scale-[0.99] transition-transform"
          style={{
            background: "linear-gradient(135deg, #AD5E3B 0%, #8A4325 100%)",
            borderRadius: 20,
            boxShadow: "0 8px 24px rgba(173, 94, 59,0.28)",
          }}
        >
          <div className="p-4 flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 text-[22px]" style={{ background: "rgba(255,255,255,0.2)" }}>
              📍
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-extrabold text-white leading-snug">우리 동네부터 알려주세요</p>
              <p className="text-[11.5px] leading-snug mt-0.5" style={{ color: "rgba(255,255,255,0.9)" }}>
                동네를 정하면 우리 동네 고양이·소식이 여기 나타나요
              </p>
            </div>
            <ChevronRight size={18} color="#fff" className="shrink-0" />
          </div>
        </Link>
      )}

      {/* ══════ 첫 구원 프로젝트 — 사용처 투표 유도 배너 (닫기 가능, 2026-07-14) ══════ */}
      {SHOW_FUND_BANNER && <FirstProjectBanner />}

      {/* ══════ 온보딩 핸드오프 — "방금 고른 ○○ 첫 밥 주기" (2026-07-18 회의 1순위, 최상단) ══════ */}
      {user && <PendingCareHandoff />}

      {/* ══════ 귀환 카드 — 다녀간 사이 내 고양이에게 생긴 일 (2026-07-22 리텐션 회의: 보상 먼저) ══════ */}
      {user && <ReturnDigestCard lastVisitAt={lastVisitAt} />}

      {/* ══════ 내 아이들 — 실제 밥 기록 1탭 (2026-07-22 재배치: 행동을 가상 케어보다 위로) ══════ */}
      {user && (
        <div id="my-cats" style={{ scrollMarginTop: 12 }}>
          <MyCatsHero />
        </div>
      )}

      {/* ══════ 다마고치 케어 히어로 — 대표묘와의 가상 교감 (2026-07-22부터 컴팩트 접힘 기본) ══════ */}
      <CareTamagotchiHero />

      {/* ══════ 오늘의 브리핑 카드 — 인사·헤드라인·스트릭·알림 + 날씨를 한 카드로 (홈 리디자인 2차 2026-07-11) ══════ */}
      {/* 브랜드 타이틀은 시안대로 제거 — 앱 아이덴티티는 스플래시/네비가 담당 */}
      <div
        className="mb-4 dark-card-level"
        style={{
          background: "linear-gradient(135deg, #FFFFFF 0%, #FDF9F2 100%)",
          borderRadius: "var(--radius-card)",
          boxShadow: "0 8px 24px rgba(74,123,168,0.08), 0 1px 3px rgba(0,0,0,0.03)",
          border: "1px solid rgba(0,0,0,0.04)",
        }}
      >
        <div className="px-4 pt-4">
          {(() => {
            const h = new Date(
              new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }),
            ).getHours();
            const greet =
              h < 5 ? "늦은 밤에도 수고 많으세요 🌙"
              : h < 11 ? "좋은 아침이에요 ☀️"
              : h < 14 ? "점심은 드셨어요? 🍽️"
              : h < 18 ? "오늘도 고생하세요 🌤️"
              : h < 22 ? "좋은 저녁이에요 🌆"
              : "편안한 밤 되세요 🌙";
            const name =
              (user?.user_metadata?.nickname as string | undefined) ??
              (user?.user_metadata?.full_name as string | undefined) ??
              user?.email?.split("@")[0] ??
              "";
            return (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-[12px] font-bold text-text-sub tracking-tight">{greet}</p>
                  <div className="flex items-center gap-1.5">
                    {streakInfo && streakInfo.streak > 0 && (
                      <span
                        className="flex items-center gap-1 px-2.5 py-1 chip-square text-[11.5px] font-extrabold"
                        style={{ background: "#FFF7ED", border: "1px solid #FED7AA", color: "#EA580C" }}
                      >
                        🔥 {streakInfo.streak}일
                      </span>
                    )}
                    <Link
                      href="/tips"
                      className="w-9 h-9 rounded-xl bg-surface-alt flex items-center justify-center active:scale-90 transition-transform"
                      aria-label="AI 집사"
                    >
                      {/* AI집사 이중 진입점 — 탭 재편(D-day) 시 탭이 빠져도 발견성 유지 (2026-07-21 회의) */}
                      <Bot size={16} className="text-text-sub" />
                    </Link>
                    <Link
                      href="/search"
                      className="w-9 h-9 rounded-xl bg-surface-alt flex items-center justify-center active:scale-90 transition-transform"
                      aria-label="통합 검색"
                    >
                      <Search size={16} className="text-text-sub" />
                    </Link>
                    <Link
                      href="/notifications"
                      className="relative w-9 h-9 rounded-xl bg-surface-alt flex items-center justify-center active:scale-90 transition-transform"
                      aria-label="알림"
                    >
                      <Bell size={16} className={unreadCount > 0 ? "text-primary" : "text-text-sub"} />
                      {unreadCount > 0 && (
                        <span
                          className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full flex items-center justify-center text-[9px] font-extrabold text-white"
                          style={{
                            background: "linear-gradient(135deg, #E86B8C 0%, #D85555 100%)",
                            boxShadow: "0 2px 6px rgba(216,85,85,0.4)",
                          }}
                        >
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </span>
                      )}
                    </Link>
                  </div>
                </div>
                <h1 className="text-[22px] font-extrabold text-text-main tracking-tight leading-snug mt-1.5">
                  {name ? `${name}님, ` : ""}
                  {hungryCatName ? (
                    // 부담·죄책감 대신 초대 톤 — "기다려요"(방치 암시)보다 가볍게 권유
                    <>
                      오늘 <span className="text-primary">{hungryCatName}</span> 밥 챙겨줄까요? 🍚
                    </>
                  ) : (
                    <>오늘도 함께해 주셔서 고마워요 💛</>
                  )}
                </h1>
              </>
            );
          })()}
        </div>

        {/* 구분선 + 날씨 행 */}
        <div className="mx-4 my-3" style={{ height: 1, background: "rgba(0,0,0,0.06)" }} />
        <div className="px-4 pb-4">
        {weatherLoading ? (
          /* 로딩 */
          <div className="flex items-center justify-center py-6 gap-2">
            <Loader2 size={20} className="text-primary animate-spin" />
            <span className="text-[13px] text-text-sub">날씨 정보를 불러오는 중...</span>
          </div>
        ) : weatherError ? (
          /* 에러 */
          <div className="flex items-center gap-3 py-3">
            <div className="w-10 h-10 rounded-full bg-surface-alt flex items-center justify-center shrink-0">
              <WifiOff size={18} className="text-text-muted" />
            </div>
            <div className="flex-1">
              <p className="text-[13px] font-semibold text-text-main">날씨를 불러올 수 없어요</p>
              <p className="text-[11px] text-text-sub mt-0.5">{weatherError}</p>
            </div>
            <button
              onClick={() => { setWeatherError(""); setWeatherLoading(true); window.location.reload(); }}
              className="text-[12px] font-semibold text-primary px-3 py-1.5 rounded-xl bg-primary/10 active:scale-95 transition-transform shrink-0"
            >
              재시도
            </button>
          </div>
        ) : weather ? (
          /* 날씨 데이터 */
          <>
            {/* 상단: 날짜·지역 한 줄 (홈 리디자인 2026-07-11: 밀도 압축) */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <MapPin size={12} className="text-primary shrink-0" />
                <span className="text-[13px] font-bold text-text-main">{weather.city}</span>
                <span className="text-[11px] text-text-light">
                  {new Date().toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" })}
                </span>
              </div>
              <p className="text-[12px] text-text-sub capitalize">{weather.weatherDesc}</p>
            </div>

            {/* 온도 + 아이콘 + 체감·습도·바람 한 줄 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                {(() => {
                  const WeatherIcon = WEATHER_ICONS[weather.weatherMain] ?? Cloud;
                  return <WeatherIcon size={30} className="text-text-light" strokeWidth={1.4} />;
                })()}
                <div className="flex items-end gap-0.5">
                  <span
                    className="text-[30px] font-extrabold leading-none tracking-tight"
                    style={{ color: getTempColor(weather.temp) }}
                  >
                    {weather.temp}
                  </span>
                  <span className="text-[14px] font-bold text-text-light mb-0.5">°C</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[11.5px] font-semibold text-text-sub">
                  체감 {weather.feelsLike}° · 습도 {weather.humidity}%
                </p>
                <p className="text-[11.5px] text-text-light mt-0.5 flex items-center justify-end gap-1">
                  <Wind size={11} className="shrink-0" /> 바람 {weather.windSpeed}m/s
                </p>
              </div>
            </div>

            {/* 돌봄 팁 */}
            {(() => {
              const t = weather.feelsLike;
              const tips: { emoji: string; text: string; color: string }[] = [];

              if (t <= -10) {
                tips.push({ emoji: "🥶", text: "극한 추위! 숨숨집 내부에 핫팩을 넣어주세요. 물이 얼지 않게 자주 교체해주세요.", color: "#4A7BA8" });
              } else if (t <= 0) {
                tips.push({ emoji: "❄️", text: "물이 얼 수 있어요. 따뜻한 물로 하루 2회 이상 교체해주세요.", color: "#5B7A8F" });
                tips.push({ emoji: "🏠", text: "스티로폼 숨숨집에 짚이나 담요를 깔아주세요.", color: "#6B8E6F" });
              } else if (t <= 5) {
                tips.push({ emoji: "🧣", text: "쌀쌀해요. 쉼터 점검하고 입구가 바람을 막는지 확인해주세요.", color: "#7A9BB0" });
              } else if (t >= 33) {
                tips.push({ emoji: "🔥", text: "폭염 주의! 그늘진 곳에 시원한 물을 놓아주세요. 사료가 상하기 쉬워요.", color: "#D85555" });
              } else if (t >= 28) {
                tips.push({ emoji: "☀️", text: "더워요. 물을 자주 갈아주고 그늘에 밥을 놓아주세요.", color: "#E88D5A" });
              }

              if (weather.weatherMain === "Rain" || weather.weatherMain === "Drizzle") {
                tips.push({ emoji: "🌧️", text: "비 오는 날이에요. 밥그릇에 비가 들어가지 않게 지붕 아래에 놓아주세요.", color: "#4A7BA8" });
              } else if (weather.weatherMain === "Snow") {
                tips.push({ emoji: "🌨️", text: "눈이 와요. 쉼터 입구에 눈이 쌓이지 않게 치워주세요.", color: "#5B7A8F" });
              }

              if (weather.humidity >= 85) {
                tips.push({ emoji: "💦", text: "습도가 높아요. 건사료가 눅눅해질 수 있으니 소량만 놓아주세요.", color: "#48A59E" });
              }

              if (weather.windSpeed >= 10) {
                tips.push({ emoji: "💨", text: "바람이 강해요. 밥그릇이 날아가지 않게 무거운 그릇을 사용해주세요.", color: "#8B65B8" });
              }

              if (tips.length === 0 && t >= 10 && t <= 25) {
                tips.push({ emoji: "🐾", text: "돌봄하기 좋은 날씨예요. 오늘도 아이들을 챙겨주셔서 감사해요!", color: "#6B8E6F" });
              }

              // 날씨 조건 → 관련 쇼핑 카테고리 맥락 다리
              const t2 = weather.feelsLike;
              const bridge =
                (t2 <= 5 || weather.weatherMain === "Snow")
                  ? { cat: "shelter", label: "따뜻한 쉼터·보온 용품 보기" }
                  : (t2 >= 28)
                    ? { cat: "shelter", label: "시원한 물그릇·급식 용품 보기" }
                    : (weather.weatherMain === "Rain" || weather.weatherMain === "Drizzle")
                      ? { cat: "shelter", label: "비 막는 급식소·쉼터 용품 보기" }
                      : null;

              return tips.length > 0 ? (
                <div className="mt-3 space-y-1.5">
                  {/* 홈 리디자인 시안(2026-07-13): 팁은 1개만 — 밀도 압축 */}
                  {tips.slice(0, 1).map((tip, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 px-3 py-2 rounded-xl"
                      style={{ backgroundColor: `${tip.color}10` }}
                    >
                      <span className="text-[14px] shrink-0">{tip.emoji}</span>
                      <p className="text-[11.5px] font-semibold leading-snug" style={{ color: tip.color }}>
                        {tip.text}
                      </p>
                    </div>
                  ))}
                  {SHOW_WEATHER_SHOP_BRIDGE && bridge && (
                    <Link
                      href={`/shop?category=${bridge.cat}`}
                      className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl active:scale-[0.98] transition-transform"
                      style={{ background: "var(--color-primary-softer)", border: "1px solid rgba(173, 94, 59,0.15)" }}
                    >
                      <span className="flex items-center gap-1.5 text-[11.5px] font-extrabold" style={{ color: "var(--color-primary-dark)" }}>
                        <ShoppingBag size={13} />
                        {bridge.label}
                      </span>
                      <ChevronRight size={14} style={{ color: "var(--color-primary-dark)" }} />
                    </Link>
                  )}
                </div>
              ) : null;
            })()}
          </>
        ) : null}
        </div>
      </div>

      {/* (내 아이들 섹션은 2026-07-22 재배치로 상단 이동 — #my-cats 앵커 포함) */}

      {/* ══════ 쇼핑 프리뷰 — 케어 섹션 뒤 배치 (2026-07-21 쇼핑 동선 회의, 케어 위계 유지) ══════ */}
      {SHOW_SHOP_PREVIEW && user && <ShopPreviewStrip />}

      {/* ══════ 일일 출석체크 모달 — 코인·카드 EXP·계정 레벨 보상 ══════ */}
      {SHOW_CHECKIN && user && <DailyCheckinModal />}

      {/* ══════ 첫 응원 카드 — 활성화 1단: 1탭 응원 → 등록 escalation (catCount===0) ══════ */}
      {user && activity && activity.catCount === 0 && cheerCats.length > 0 && (
        <FirstCheerCard cats={cheerCats} regionName={primaryRegion?.name ?? null} />
      )}

      {/* 스트릭 카드는 브리핑 칩으로 대체, 프리즈 기능 보존 위해 하단 부가 영역으로 이동 (2026-07-11) */}

      {/*
        신규 가입자(아직 첫 등록 안 한 유저) → 시작 가이드만 노출
        기존 유저(첫 등록 완료) → 내 서클 빠른 진입만 노출
        창립 멤버 배너는 신규/기존 무관 활동 지역 있는 유저만
      */}
      {user && activity && !onboardingDismissed && activity.catCount === 0 ? (
        <OnboardingCard
          hasActivityRegion={myRegions.length > 0}
          hasMyCat={activity.catCount > 0}
          hasCareLog={activity.careLogCount > 0}
          hasCircleMember={circleMemberCount > 0}
          onDismiss={handleDismissOnboarding}
        />
      ) : (
        <>
          {SHOW_CIRCLE_ENTRY && user && <MyCircleQuickEntry />}
          {SHOW_EVENT_BANNERS && user && myRegions.length > 0 && <FoundingMemberBanner />}
        </>
      )}

      {/* ══════ 내 동네 소식 ══════ */}
      {user && (
        <div className="mb-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 px-1">
              <h2 className="text-[17px] font-extrabold text-text-main tracking-tight">
                내 동네 소식
              </h2>
              {primaryRegion && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg" style={{ background: "rgba(173, 94, 59,0.12)", color: "var(--color-primary)" }}>
                  📍 {primaryRegion.name}
                </span>
              )}
            </div>
            <Link
              href={primaryRegion ? "/map" : "/mypage/activity-regions"}
              className="flex items-center gap-0.5 text-[12px] font-semibold text-primary"
            >
              {primaryRegion ? "지도에서 보기" : "지역 설정"} <ChevronRight size={14} />
            </Link>
          </div>

          {!primaryRegion ? (
            <Link
              href="/mypage/activity-regions"
              className="block active:scale-[0.99] transition-transform"
            >
              <div
                className="px-4 py-4 flex items-center gap-3"
                style={{
                  background: "linear-gradient(135deg, var(--color-primary-softer) 0%, rgba(168,104,74,0.04) 100%)",
                  borderRadius: 18,
                  border: "1px dashed rgba(173, 94, 59,0.3)",
                }}
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: "rgba(173, 94, 59,0.15)" }}
                >
                  <MapPin size={18} color="#AD5E3B" strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-extrabold text-text-main">활동 지역을 설정해보세요</p>
                  <p className="text-[11px] text-text-sub mt-0.5">우리 동네 고양이 소식을 모아 볼 수 있어요</p>
                </div>
                <ChevronRight size={16} style={{ color: "var(--color-primary)" }} />
              </div>
            </Link>
          ) : (
            <div className="space-y-2.5">
              {/* 동네 소식 카드 — 고양이/이야기 세그먼트 탭 (홈 리디자인 2026-07-11) */}
              {neighborhoodCats.length > 0 ? (
                <div
                  className="px-4 py-3.5"
                  style={{
                    background: "#FFFFFF",
                    borderRadius: 18,
                    boxShadow: "var(--shadow-card)",
                    border: "1px solid rgba(0,0,0,0.04)",
                  }}
                >
                  {/* 세그먼트 탭 */}
                  <div className="flex items-center gap-1 p-1 rounded-xl mb-2.5" style={{ background: "var(--color-warm-white)" }}>
                    {([
                      ["cats", `🐾 동네 고양이 ${neighborhoodCats.length}`],
                      ["posts", "💬 동네 이야기"],
                    ] as const).map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setHoodTab(key)}
                        className="flex-1 py-2 rounded-lg text-[11.5px] font-extrabold transition-colors"
                        style={{
                          background: hoodTab === key ? "#fff" : "transparent",
                          color: hoodTab === key ? "var(--color-text-main)" : "var(--color-text-light)",
                          boxShadow: hoodTab === key ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {hoodTab === "cats" ? (
                  <Link href="/map" className="block active:scale-[0.99] transition-transform">
                    <p className="text-[10px] text-text-light mb-2">
                      반경 {primaryRegion.radius_m >= 1000 ? `${primaryRegion.radius_m / 1000}km` : `${primaryRegion.radius_m}m`} · 탭하면 지도에서 볼 수 있어요
                    </p>
                    <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
                      {neighborhoodCats.map((c) => {
                        const safe = sanitizeImageUrl(c.photo_url, "https://placehold.co/100x100/EEEAE2/2A2A28?text=%3F");
                        const avatar = thumbnailUrl(safe, 100) ?? safe;
                        return (
                        <div
                          key={c.id}
                          className="shrink-0 text-center"
                          style={{ width: 56 }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={avatar}
                            alt={c.name}
                            loading="lazy"
                            decoding="async"
                            className="w-12 h-12 rounded-full mx-auto object-cover"
                            style={{
                              border: "2px solid #fff",
                              boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
                            }}
                          />
                          <p className="text-[10px] font-bold text-text-main mt-1 truncate">
                            {c.name}
                          </p>
                        </div>
                        );
                      })}
                    </div>
                  </Link>
                  ) : neighborhoodPosts.length > 0 ? (
                    /* 동네 이야기 탭 */
                    <div className="space-y-1.5">
                      {neighborhoodPosts.map((p) => (
                        <Link
                          key={p.id}
                          href={`/community/${p.id}`}
                          className="flex items-center gap-2 py-1.5 active:opacity-70"
                        >
                          <span
                            className="text-[10px] font-extrabold px-2 py-0.5 rounded-md shrink-0"
                            style={{ backgroundColor: "rgba(173, 94, 59,0.12)", color: "var(--color-primary)" }}
                          >
                            {p.region}
                          </span>
                          <p className="text-[12.5px] font-bold text-text-main truncate flex-1">
                            {p.title}
                          </p>
                          <span className="text-[10px] text-text-light shrink-0">
                            {formatRelativeTime(p.createdAt)}
                          </span>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[12px] text-text-sub text-center py-4">
                      아직 우리 동네 이야기가 없어요 — 첫 글을 남겨보세요!
                    </p>
                  )}
                </div>
              ) : (
                <div
                  className="px-4 py-4"
                  style={{
                    background: "#FFFFFF",
                    borderRadius: 18,
                    boxShadow: "var(--shadow-card)",
                    border: "1px solid rgba(0,0,0,0.04)",
                  }}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-[18px]"
                      style={{ backgroundColor: "rgba(173, 94, 59,0.15)" }}
                    >
                      🐾
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-extrabold text-text-main mb-0.5">
                        {primaryRegion.name}의 첫 등록자가 되어주세요
                      </p>
                      <p className="text-[11.5px] text-text-sub leading-relaxed">
                        첫 한 마리를 등록하면 동네 이웃이 함께 돌볼 수 있어요.
                      </p>
                    </div>
                  </div>

                  {popularCats.length > 0 && (
                    <div
                      className="pt-3 mb-3"
                      style={{ borderTop: "1px dashed rgba(0,0,0,0.06)" }}
                    >
                      <p className="text-[10.5px] text-text-light font-bold mb-2">
                        다른 동네 인기 고양이 둘러보기
                      </p>
                      <div className="flex gap-1.5">
                        {popularCats.slice(0, 4).map((c) => {
                          const safe = sanitizeImageUrl(
                            c.photo_url,
                            "https://placehold.co/100x100/EEEAE2/2A2A28?text=%3F",
                          );
                          const avatar = thumbnailUrl(safe, 100) ?? safe;
                          return (
                            <Link
                              key={c.id}
                              href={`/cats/${c.id}`}
                              className="shrink-0 text-center active:scale-[0.97] transition-transform"
                              style={{ width: 56 }}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={avatar}
                                alt={c.name}
                                loading="lazy"
                                decoding="async"
                                className="w-12 h-12 rounded-full mx-auto object-cover"
                                style={{
                                  border: "2px solid #fff",
                                  boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
                                }}
                              />
                              <p className="text-[10px] font-bold text-text-main mt-1 truncate">
                                {c.name}
                              </p>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <Link
                    href="/map"
                    className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-white active:scale-[0.98] transition-transform"
                    style={{
                      background: "linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)",
                      boxShadow: "0 4px 12px rgba(173, 94, 59,0.3)",
                    }}
                  >
                    <span className="text-[12.5px] font-extrabold tracking-tight">
                      지도에서 첫 등록 시작
                    </span>
                    <ChevronRight size={14} />
                  </Link>
                </div>
              )}

              {/* 우리 동네 글 — 고양이 카드가 없을 때만 별도 카드 (있으면 위 탭에 통합) */}
              {neighborhoodCats.length === 0 && neighborhoodPosts.length > 0 && (
                <div
                  className="px-4 py-3"
                  style={{
                    background: "#FFFFFF",
                    borderRadius: 18,
                    boxShadow: "var(--shadow-card)",
                    border: "1px solid rgba(0,0,0,0.04)",
                  }}
                >
                  <p className="text-[12px] font-extrabold text-text-main mb-2">
                    💬 우리 동네 이야기
                  </p>
                  <div className="space-y-1.5">
                    {neighborhoodPosts.map((p) => (
                      <Link
                        key={p.id}
                        href={`/community/${p.id}`}
                        className="flex items-center gap-2 py-1.5 active:opacity-70"
                      >
                        <span
                          className="text-[10px] font-extrabold px-2 py-0.5 rounded-md shrink-0"
                          style={{ backgroundColor: "rgba(173, 94, 59,0.12)", color: "var(--color-primary)" }}
                        >
                          {p.region}
                        </span>
                        <p className="text-[12.5px] font-bold text-text-main truncate flex-1">
                          {p.title}
                        </p>
                        <span className="text-[10px] text-text-light shrink-0">
                          {formatRelativeTime(p.createdAt)}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══════ 실시간 동네 피드 — 동네 소식 바로 아래 배치, 3건 (Figma 4화면 구조 2026-07-13) ══════ */}
      {feed.length > 0 && (() => {
        const primary = myRegions.find((r) => r.is_primary) ?? myRegions[0] ?? null;
        return (
          <div className="mb-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 px-1">
                <h2 className="text-[17px] font-extrabold text-text-main tracking-tight">
                  지금 우리 동네
                </h2>
                <span
                  className="inline-flex items-center gap-1 text-[9px] font-extrabold px-1.5 py-0.5 rounded-md"
                  style={{ backgroundColor: "#48A59E15", color: "#48A59E" }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full animate-pulse"
                    style={{ background: "#48A59E" }}
                  />
                  LIVE
                </span>
              </div>
              {primary && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg" style={{ backgroundColor: "rgba(72,165,158,0.12)", color: "#48A59E" }}>
                  📍 {primary.name}
                </span>
              )}
            </div>
            <div
              className="overflow-hidden"
              style={{
                background: "#FFFFFF",
                borderRadius: "var(--radius-card)",
                boxShadow: "var(--shadow-card)",
                border: "1px solid rgba(72,165,158,0.12)",
              }}
            >
              {feed.slice(0, 3).map((f, i) => {
                const href = `/cats/${f.catId}`;
                return (
                  <Link
                    key={f.id}
                    href={href}
                    className="block active:bg-gray-50 transition-colors"
                    style={{
                      borderTop: i === 0 ? "none" : "1px solid rgba(0,0,0,0.04)",
                    }}
                  >
                    <div className="flex items-center gap-3 px-4 py-3">
                      {/* 고양이 썸네일 */}
                      <div
                        className="w-10 h-10 rounded-xl shrink-0"
                        style={{
                          background: f.catPhoto
                            ? `url('${f.catPhoto}') center/cover`
                            : "#EEE8E0",
                          border: "2px solid #fff",
                          boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] text-text-sub leading-snug truncate">
                          <span className="font-extrabold" style={{ color: "#48A59E" }}>
                            {f.actorName}
                          </span>
                          <span className="text-text-light"> 님이 </span>
                          <span className="font-bold text-text-main">{f.catRegion ?? "동네"} </span>
                          <span className="font-extrabold text-text-main">{f.catName}</span>
                          <span className="text-text-light">에게 </span>
                          <span className="text-text-main">{f.message}</span>
                        </p>
                        <p className="text-[10px] text-text-light mt-0.5">
                          {formatRelativeTime(f.createdAt)}
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ══════ 내 활동 요약 — 기본 접힘, 탭하면 스탯 펼침 (홈 리디자인 2026-07-11) ══════ */}
      {activity && levelInfo && (() => {
        const lc = getLevelColor(levelInfo.level);
        return (
        <div
          className="mb-5 dark-card-level overflow-hidden"
          style={{
            background: "#FFFFFF",
            borderRadius: 22,
            boxShadow: "0 8px 28px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.03)",
            border: "1px solid rgba(0,0,0,0.04)",
          }}
        >
          {/* 헤더(레벨+경험치) = 접기 토글 */}
          <button
            type="button"
            onClick={() => setActivityOpen((v) => !v)}
            aria-expanded={activityOpen}
            className="w-full text-left p-4 flex items-center gap-3 active:scale-[0.99] transition-transform"
          >
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
              style={{ background: `linear-gradient(135deg, ${lc}20 0%, ${lc}10 100%)`, border: `2px solid ${lc}30` }}
            >
              <span className="text-[22px]">{levelInfo.emoji}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-[15px] font-extrabold text-text-main tracking-tight truncate">{levelInfo.title}</p>
                <span
                  className="text-[10px] font-extrabold px-2 py-0.5 rounded-lg text-white shrink-0"
                  style={{ backgroundColor: lc }}
                >
                  Lv.{levelInfo.level}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                <div className="flex-1 h-1.5 rounded-full overflow-hidden max-w-[140px]" style={{ backgroundColor: "#F0EBE4" }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(levelInfo.progress * 100, 4)}%`,
                      background: `linear-gradient(90deg, ${lc} 0%, ${lc}BB 100%)`,
                    }}
                  />
                </div>
                <span className="text-[10px] font-bold text-text-light tabular-nums shrink-0">
                  {levelInfo.score}{levelInfo.next ? `/${levelInfo.next}` : " MAX"}
                </span>
              </div>
            </div>
            {activityOpen
              ? <ChevronUp size={16} className="text-text-light shrink-0" />
              : <ChevronDown size={16} className="text-text-light shrink-0" />}
          </button>

          {/* 펼침: 스탯 4칸 + 마이페이지 링크 */}
          {activityOpen && (
            <div className="px-4 pb-4">
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: "고양이", value: activity.catCount, color: "var(--color-primary)", icon: "🐱" },
                  { label: "돌봄", value: activity.commentCount + activity.careLogCount, color: "#48A59E", icon: "📝" },
                  { label: "신고", value: activity.alertCount, color: "#8B65B8", icon: "🛡️" },
                  { label: "좋아요", value: activity.likesReceived, color: "#E86B8C", icon: "❤️" },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="text-center py-2.5 rounded-2xl"
                    style={{ backgroundColor: `${s.color}08`, border: `1px solid ${s.color}15` }}
                  >
                    <p className="text-[11px] mb-0.5">{s.icon}</p>
                    <p className="text-[17px] font-black" style={{ color: s.color }}>{s.value}</p>
                    <p className="text-[9px] font-semibold text-text-light">{s.label}</p>
                  </div>
                ))}
              </div>
              <Link
                href="/mypage"
                className="mt-3 flex items-center justify-center gap-1 py-2 rounded-xl text-[12px] font-bold text-primary active:scale-[0.98] transition-transform"
                style={{ background: "var(--color-primary-softer)" }}
              >
                업적·타이틀 전체 보기 <ChevronRight size={13} />
              </Link>
            </div>
          )}
        </div>
        );
      })()}

      {/* ══════ 오늘 할 일 — 리추얼·랭킹 칩 행 (Figma 시안 2026-07-13, 가로 스와이프) ══════ */}
      {/* 도감 대형 카드는 칩으로 흡수. 냥 상자/스트릭/랭킹 칩은 아래 해당 카드로 스크롤. */}
      {SHOW_TODO_CHIPS && user && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2.5 px-1">
            <div className="flex items-center gap-2">
              <h2 className="text-[17px] font-extrabold text-text-main tracking-tight">오늘 할 일</h2>
            </div>
            <span className="text-[10px] font-bold text-text-light">매일 리셋</span>
          </div>
          <div className="flex gap-2.5 overflow-x-auto no-scrollbar -mx-5 px-5 pb-1" style={{ scrollSnapType: "x proximity" }}>
            {([
              { emoji: "🎁", title: "냥 상자 열기", sub: "오늘의 랜덤 보상", target: "daily-box", href: null, hot: true },
              streakInfo && streakInfo.streak > 0
                ? { emoji: "🔥", title: `스트릭 ${streakInfo.streak}일째`, sub: "연속 돌봄 지키기", target: "streak-card", href: null, hot: false }
                : { emoji: "🔥", title: "스트릭 시작", sub: "오늘 돌봄 기록하면 1일", target: "my-cats", href: null, hot: false },
              { emoji: "📖", title: "동네 도감", sub: "만난 고양이 모으기", target: null, href: "/collection", hot: false },
              { emoji: "🏆", title: "이번 주 랭킹", sub: "돌봄왕에 도전", target: "weekly-rank", href: null, hot: false },
            ] as { emoji: string; title: string; sub: string; target: string | null; href: string | null; hot: boolean }[]).map((c) =>
              c.href ? (
                <Link
                  key={c.title}
                  href={c.href}
                  className="shrink-0 flex flex-col gap-0.5 active:scale-[0.97] transition-transform"
                  style={{
                    width: 132, padding: "13px 13px 12px", borderRadius: 18, scrollSnapAlign: "start",
                    background: "#FFFFFF", border: "1px solid var(--color-divider)", boxShadow: "var(--shadow-card-sm)",
                  }}
                >
                  <span className="text-[21px] mb-0.5">{c.emoji}</span>
                  <span className="text-[12.5px] font-extrabold text-text-main tracking-tight">{c.title}</span>
                  <span className="text-[10px] font-semibold text-text-light leading-snug">{c.sub}</span>
                </Link>
              ) : (
                <button
                  key={c.title}
                  type="button"
                  onClick={() => document.getElementById(c.target!)?.scrollIntoView({ behavior: "smooth", block: "center" })}
                  className="shrink-0 flex flex-col gap-0.5 text-left active:scale-[0.97] transition-transform"
                  style={{
                    width: 132, padding: "13px 13px 12px", borderRadius: 18, scrollSnapAlign: "start",
                    background: c.hot ? "linear-gradient(150deg, rgba(255,169,39,0.14), #FFFFFF 70%)" : "#FFFFFF",
                    border: "1px solid var(--color-divider)", boxShadow: "var(--shadow-card-sm)",
                  }}
                >
                  <span className="text-[21px] mb-0.5">{c.emoji}</span>
                  <span className="text-[12.5px] font-extrabold text-text-main tracking-tight">{c.title}</span>
                  <span className="text-[10px] font-semibold text-text-light leading-snug">{c.sub}</span>
                </button>
              ),
            )}
          </div>
        </div>
      )}

      {/* 주간 출석 보드 — 스탬프 + 마일스톤 포인트 (쇼핑 할인용) */}
      {SHOW_CHECKIN && user && <WeeklyCheckinCard />}

      {/* 오늘의 냥 상자 — 일일 출석 리추얼 */}
      {SHOW_CHECKIN && user && <div id="daily-box" style={{ scrollMarginTop: 12 }}><DailyCatBox /></div>}

      {/* ══════ 돌봄 연속 일수(스트릭) — 프리즈 UI 보존, 부가 영역으로 이동 (2026-07-11) ══════ */}
      {user && streakInfo && (
        <div id="streak-card" style={{ scrollMarginTop: 12 }}>
          <HomeStreakCard
            streakInfo={streakInfo}
            onFreezeUsed={() => { getMyStreakInfo().then(setStreakInfo).catch(() => {}); }}
          />
        </div>
      )}

      {/* ══════ 이번 주 돌봄 왕 TOP 3 ══════ */}
      {SHOW_POPULAR_CATS && caretakerRank.length > 0 && (
        <div className="mb-5 cv-auto" id="weekly-rank" style={{ scrollMarginTop: 12 }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 px-1">
              <h2 className="text-[17px] font-extrabold text-text-main tracking-tight">
                이번 주 돌봄 왕
              </h2>
              <span className="text-[9px] font-bold tracking-[0.15em]" style={{ color: "#E8B040", opacity: 0.6 }}>
                WEEKLY TOP
              </span>
            </div>
          </div>
          <div
            className="p-4"
            style={{
              background: "linear-gradient(135deg, #FFF9E8 0%, #FFF3CC 100%)",
              borderRadius: 22,
              border: "1px solid rgba(232,176,64,0.25)",
              boxShadow: "0 4px 14px rgba(232,176,64,0.15)",
            }}
          >
            <div className="space-y-2.5">
              {caretakerRank.map((r, idx) => {
                const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉";
                const rankBg = idx === 0 ? "#E8B040" : idx === 1 ? "#B8B8B8" : "#C08860";
                return (
                  <div
                    key={r.userId}
                    className="flex items-center gap-3 px-3 py-2.5"
                    style={{
                      background: "#FFFFFF",
                      borderRadius: "var(--radius-input)",
                      boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
                    }}
                  >
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-[18px]"
                      style={{
                        background: `${rankBg}20`,
                      }}
                    >
                      {medal}
                    </div>
                    <div
                      className="w-9 h-9 rounded-full shrink-0"
                      style={{
                        background: r.avatarUrl
                          ? `url('${r.avatarUrl}') center/cover`
                          : "linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)",
                        border: "2px solid #fff",
                        boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
                      }}
                    >
                      {!r.avatarUrl && (
                        <div className="w-full h-full flex items-center justify-center text-[13px] font-bold text-white">
                          {r.name.slice(0, 1)}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-extrabold text-text-main truncate tracking-tight">
                        {r.name}
                      </p>
                      <p className="text-[10.5px] text-text-sub">
                        이번 주 돌봄 <span className="font-extrabold" style={{ color: "#E88D5A" }}>{r.careCount}</span>회
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ══════ 이번 주 인기 고양이 TOP 5 ══════ */}
      {SHOW_POPULAR_CATS && popularCats.length > 0 && (
        <div className="mb-5 cv-auto">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 px-1">
              <h2 className="text-[17px] font-extrabold text-text-main tracking-tight">
                이번 주 인기 고양이
              </h2>
              <span className="text-[9px] font-bold tracking-[0.15em]" style={{ color: "#E86B8C", opacity: 0.6 }}>
                TRENDING
              </span>
            </div>
            <Link
              href="/map"
              className="flex items-center gap-0.5 text-[12px] font-semibold text-primary"
            >
              지도 <ChevronRight size={14} />
            </Link>
          </div>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
            {popularCats.map((c, idx) => (
              <Link
                key={c.id}
                href={`/cats/${c.id}`}
                className="shrink-0 active:scale-[0.97] transition-transform"
                style={{ width: 112 }}
              >
                <div className="relative">
                  <div
                    className="rounded-2xl overflow-hidden mb-2"
                    style={{
                      aspectRatio: "1/1",
                      background: c.photo_url
                        ? `url('${c.photo_url}') center/cover`
                        : "#EEE8E0",
                      boxShadow: "0 3px 10px rgba(0,0,0,0.1)",
                      border: "2px solid #fff",
                    }}
                  />
                  <div
                    className="absolute top-1.5 left-1.5 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-extrabold text-white"
                    style={{
                      background: idx === 0
                        ? "linear-gradient(135deg, #E8B040 0%, #C08860 100%)"
                        : idx === 1
                        ? "linear-gradient(135deg, #B8B8B8 0%, #888 100%)"
                        : idx === 2
                        ? "linear-gradient(135deg, #C08860 0%, #8B5A3C 100%)"
                        : "rgba(44,44,44,0.7)",
                      boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                    }}
                  >
                    {idx + 1}
                  </div>
                  <div
                    className="absolute bottom-1.5 right-1.5 flex items-center gap-0.5 px-1.5 py-0.5 chip-square"
                    style={{
                      background: "linear-gradient(135deg, #E86B8C 0%, #D85577 100%)",
                      boxShadow: "0 2px 4px rgba(232,107,140,0.4)",
                    }}
                  >
                    <span style={{ fontSize: 9 }}>❤️</span>
                    <span className="text-[9.5px] font-extrabold text-white">{c.like_count}</span>
                  </div>
                </div>
                <p className="text-[12.5px] font-extrabold text-text-main truncate">
                  {c.name}
                </p>
                <p className="text-[10px] text-text-sub truncate">
                  {c.region ?? "우리 동네"}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 오늘의 균형 체크리스트·안부 재참여 카드 — 사용자 요청으로 제거 (2026-07-10) */}

      {/* ══════ 오늘의 냥식 ══════ */}
      <div
        className="flex items-start gap-3.5 px-5 py-4 mb-5"
        style={{
          background: "#FFFFFF",
          borderRadius: 22,
          boxShadow: "0 6px 20px rgba(232,176,64,0.10), 0 1px 3px rgba(0,0,0,0.03)",
          border: "1px solid rgba(0,0,0,0.04)",
        }}
      >
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
          style={{
            background: "linear-gradient(135deg, #E8B040 0%, #C9A961 100%)",
            boxShadow: "0 5px 12px rgba(232,176,64,0.35), inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -2px 4px rgba(0,0,0,0.08)",
          }}
        >
          <Sparkles size={18} color="#fff" strokeWidth={2.3} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-extrabold tracking-[0.12em] mb-0.5" style={{ color: "#C9A961" }}>
            TODAY&apos;S FACT
          </p>
          <p className="text-[13.5px] font-semibold text-text-main leading-relaxed">
            {fact}
          </p>
        </div>
      </div>

      {/* ══════ 입양·임보 기다리는 아이들 (SSR) ══════ */}
      {adoptionSlot}

      {/* ══════ 이번 주 HOT 게시글 (SSR) ══════ */}
      {hotSlot}

      {/* ══════ ↓ 홍보/부가 카드 — 3.5화면 콘텐츠 아래로 (Figma 4화면 구조 2026-07-13) ══════ */}

      {/* ══════ 친구 초대 — 1000명 키링 배너 바로 위 배치 (2026-07-11): 초대→목표 달성 동선 연결 ══════ */}
      {/* catCount > 0인 사용자만. 빈 홈에 카드 쌓아두지 않게 활성 임계 통과시점에 노출. */}
      {SHOW_INVITE && activity && activity.catCount > 0 && <InviteSection />}

      {/* 1000명 이벤트 배너 (SSR) */}
      {SHOW_EVENT_BANNERS && eventSlot}

      {/* 돌봄 cue 푸시 옵트인 — 고양이 보유 + 미구독만 (14일 dismiss) */}
      {user && activity && <PushCareCueOptIn hasCat={activity.catCount > 0} />}

      {/* 사회적 증명 (오늘 활동 이웃 수) */}
      {SHOW_SOCIAL_PROOF && <SocialProofStrip />}

      {/* 기능 가이드 팁 (시작 가이드 종료 유저) */}
      {user && activity && onboardingDismissed && (
        <FeatureTipsCard activity={activity} regions={myRegions} />
      )}

      {/* ══════ 오늘의 기념일 ══════ */}
      {SHOW_ANNIVERSARY && anniversaries.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-3 px-1">
            <h2 className="text-[17px] font-extrabold text-text-main tracking-tight">
              오늘의 기념일
            </h2>
            <span className="text-[9px] font-bold tracking-[0.15em]" style={{ color: "#E86B8C", opacity: 0.6 }}>
              ANNIVERSARY 🎂
            </span>
          </div>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
            {anniversaries.map((a) => {
              const label = a.years === 0
                ? "오늘 구조됐어요"
                : `만난 지 ${a.years}주년 🎉`;
              const bgGradient = a.years >= 3
                ? "linear-gradient(135deg, #E86B8C 0%, #D85577 100%)"
                : a.years >= 1
                ? "linear-gradient(135deg, #F4A5C0 0%, #E86B8C 100%)"
                : "linear-gradient(135deg, #FFD56B 0%, #E8B040 100%)";
              return (
                <Link
                  key={a.catId}
                  href={`/cats/${a.catId}`}
                  className="shrink-0 active:scale-[0.97] transition-transform"
                  style={{ width: 200 }}
                >
                  <div
                    className="relative overflow-hidden"
                    style={{
                      borderRadius: "var(--radius-card)",
                      aspectRatio: "5 / 3",
                      background: a.photoUrl
                        ? `url('${a.photoUrl}') center/cover`
                        : "#EEE8E0",
                      boxShadow: "0 6px 18px rgba(232,107,140,0.25)",
                    }}
                  >
                    {/* 그라디언트 오버레이 */}
                    <div
                      className="absolute inset-0"
                      style={{
                        background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0) 55%)",
                      }}
                    />
                    {/* 상단: 기념일 뱃지 */}
                    <div
                      className="absolute top-2 left-2 right-2 flex items-center justify-between"
                    >
                      <div
                        className="px-2.5 py-1 chip-square flex items-center gap-1"
                        style={{
                          background: bgGradient,
                          boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
                        }}
                      >
                        <span style={{ fontSize: 11 }}>🎂</span>
                        <span className="text-[10px] font-extrabold text-white tracking-tight">
                          {label}
                        </span>
                      </div>
                    </div>
                    {/* 하단: 이름·지역 */}
                    <div className="absolute bottom-0 inset-x-0 px-3 py-2.5">
                      <p className="text-[15px] font-extrabold text-white drop-shadow tracking-tight">
                        {a.name}
                      </p>
                      {a.region && (
                        <p className="text-[10px] text-white/80 drop-shadow">
                          📍 {a.region}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* 레벨업 / 업적 잠금 해제 토스트 */}
      <AchievementToast
        toasts={achievementToasts}
        onDismiss={(id) =>
          setAchievementToasts((prev) => prev.filter((t) => t.id !== id))
        }
      />

      {/* 앱 열 때마다(세션 1회) 안내 모달 — 오늘 이거 해보세요 + 기능 탐색.
          기능 웰컴 투어(FeatureTourGate가 레이아웃 레벨에서 렌더)가 아직 안 끝났으면 안 겹치게 억제 */}
      {user && activity && !suppressAppOpenGuide && (
        <AppOpenGuideModal hasCat={activity.catCount > 0} hasRegion={myRegions.length > 0} />
      )}

      {/* ══════ 푸시 권한 권유 — 첫 cat 등록한 사용자만 ══════ */}
      {/* 가입 직후 prompt는 90% 거부. 등록 후 활동 컨텍스트 묶어서 prompt → 수락률 4~5배. */}
      {activity && activity.catCount > 0 && <PushOptInCard />}

      {/* ══════ 이번 주 동네 이슈 ══════ */}
      {SHOW_WEEKLY_ISSUES && weeklyIssues.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center gap-2 px-1 mb-3">
            <h2 className="text-[17px] font-extrabold text-text-main tracking-tight">
              이번 주 동네 이슈
            </h2>
            <span
              className="text-[9px] font-bold tracking-[0.15em]"
              style={{ color: "#5B7A8F", opacity: 0.6 }}
            >
              THIS WEEK
            </span>
          </div>
          <div className="space-y-2">
            {weeklyIssues.map((issue) => {
              const card = (
                <div
                  className="flex items-start gap-3 px-4 py-3"
                  style={{
                    background: "#FFFFFF",
                    borderRadius: "var(--radius-card-sm)",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.03), 0 1px 2px rgba(0,0,0,0.02)",
                    border: "1px solid rgba(91,122,143,0.18)",
                  }}
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-[18px] shrink-0"
                    style={{
                      background:
                        "linear-gradient(135deg, #F0F4F8 0%, #DCE4EE 100%)",
                    }}
                  >
                    {issue.emoji ?? "📰"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-text-main leading-tight">
                      {issue.title}
                    </p>
                    {issue.body && (
                      <p className="text-[11px] text-text-sub mt-0.5 line-clamp-2">
                        {issue.body}
                      </p>
                    )}
                    {issue.external_url && issue.external_label && (
                      <p className="text-[10.5px] mt-1 font-bold" style={{ color: "#5B7A8F" }}>
                        {issue.external_label} →
                      </p>
                    )}
                  </div>
                </div>
              );
              return issue.external_url && sanitizeHttpUrl(issue.external_url) ? (
                <a
                  key={issue.id}
                  href={sanitizeHttpUrl(issue.external_url, "#")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block active:scale-[0.99] transition-transform"
                >
                  {card}
                </a>
              ) : (
                <div key={issue.id}>{card}</div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══════ 지난 방문 이후 새 글 배지 ══════ */}
      {SHOW_NEW_POSTS_BADGE && newPostsCount > 0 && (
        <Link
          href="/community"
          className="block mb-3 active:scale-[0.99] transition-transform"
        >
          <div
            className="flex items-center justify-between px-4 py-2.5"
            style={{
              background: "linear-gradient(135deg, #FFF6EE 0%, #FFE9D2 100%)",
              borderRadius: "var(--radius-input)",
              border: "1px solid #F2D6B6",
            }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles size={14} style={{ color: "var(--color-primary)" }} />
              <span
                className="text-[12px] font-bold truncate"
                style={{ color: "#8C5A37" }}
              >
                지난 방문 이후 새 글 {newPostsCount}개
              </span>
            </div>
            <ChevronRight size={14} style={{ color: "var(--color-primary)" }} />
          </div>
        </Link>
      )}

      {/* ══════ 인기 커뮤니티 글 ══════ */}
      {SHOW_POPULAR_POSTS && popularPosts.length > 0 && (
        <div className="mb-5 cv-auto">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 px-1">
              <h2 className="text-[17px] font-extrabold text-text-main tracking-tight">
                인기 게시글
              </h2>
            </div>
            <Link
              href="/community/popular"
              className="flex items-center gap-0.5 text-[12px] font-semibold text-primary"
            >
              전체보기 <ChevronRight size={14} />
            </Link>
          </div>
          <div className="space-y-2">
            {popularPosts.map((post) => (
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
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-text-main truncate">
                      {post.title}
                    </p>
                    <p className="text-[10.5px] text-text-light mt-0.5">
                      {post.authorName} · {formatRelativeTime(post.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-[10px] text-text-light">
                    <span>❤️ {post.likeCount}</span>
                    <span>💬 {post.commentCount}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ══════ 꿀팁게시판 진입 카드 ══════ */}
      {SHOW_TIPS_ENTRY && (
      <Link
        href="/tips"
        className="flex items-center gap-3 p-4 mb-4 active:scale-[0.99] transition-transform"
        style={{
          background: "linear-gradient(135deg, #FBF8F3 0%, #F2EBE0 100%)",
          borderRadius: 22,
          boxShadow: "0 4px 16px rgba(173, 94, 59,0.10), 0 1px 3px rgba(0,0,0,0.03)",
          border: "1px solid rgba(173, 94, 59,0.18)",
        }}
      >
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
          style={{ background: "rgba(173, 94, 59,0.15)" }}
        >
          <Sparkles size={22} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-extrabold text-text-main">꿀팁게시판</p>
          <p className="text-[11.5px] text-text-sub mt-0.5">
            길고양이 돌봄·TNR·구조 정보글 모음
          </p>
        </div>
        <ChevronRight size={16} className="text-primary opacity-70" />
      </Link>
      )}

      {/* 고양이 사회 소식 & 일정 섹션 — 사용자 요청으로 제거 (2026-07-13). /news 페이지는 유지 */}
    </div>

    {/* ══════ 플로팅 돌봄 기록 버튼 — 스크롤 내내 따라다님, 탭하면 내 아이들로 (2026-07-11) ══════ */}
    {user && activity && activity.catCount > 0 && (
      <div
        className="fixed left-0 right-0 z-40 px-5 pointer-events-none"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 72px)" }}
      >
        <div className="mx-auto max-w-lg">
          <button
            type="button"
            onClick={() => document.getElementById("my-cats")?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-full text-white text-[14.5px] font-extrabold active:scale-[0.98] transition-transform pointer-events-auto"
            style={{
              background: "linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)",
              boxShadow: "0 6px 20px rgba(173, 94, 59,0.35)",
            }}
          >
            🍚 돌봄 기록하기
          </button>
        </div>
      </div>
    )}
    </>
  );
}
