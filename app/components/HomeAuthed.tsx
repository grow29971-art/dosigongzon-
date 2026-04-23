"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  User,
  MapPin,
  Thermometer,
  Droplets,
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
  Bot,
  Send,
  ChevronRight,
  Sparkles,
  Moon,
  SunMedium,
  Bell,
} from "lucide-react";
import AIChatModal from "@/app/components/AIChatModal";
import SocialProofStrip from "@/app/components/SocialProofStrip";
import AchievementToast, { type ToastData } from "@/app/components/AchievementToast";
import { TITLES, CATEGORY_COLORS } from "@/lib/titles";
import TodayChecklist from "@/app/components/TodayChecklist";
import RescueBanner from "@/app/components/RescueBanner";
import StreakFreezeButton from "@/app/components/StreakFreezeButton";
import SplashLoading from "@/app/components/SplashLoading";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import {
  listNews,
  BADGE_PRESETS,
  resolveDdayLabel,
  type NewsItem,
} from "@/lib/news-repo";
import {
  getMyActivitySummary,
  computeScore,
  computeLevel,
  getLevelColor,
  type MyActivitySummary,
  type LevelInfo,
} from "@/lib/cats-repo";
import { listPosts, formatRelativeTime } from "@/lib/posts-repo";
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
import OnboardingCard from "@/app/components/OnboardingCard";
import FeatureTipsCard from "@/app/components/FeatureTipsCard";
import type { Post } from "@/lib/types";
import { listCats, type Cat } from "@/lib/cats-repo";
import {
  listMyActivityRegions,
  distanceMeters,
  type ActivityRegion,
} from "@/lib/activity-regions-repo";
import { sanitizeImageUrl } from "@/lib/url-validate";

/* ═══ 냥식 ═══ */
const CAT_FACTS = [
  "고양이는 하루 평균 14시간 이상 잠을 자요.",
  "고양이의 골골송은 뼈 재생을 돕는 주파수와 비슷해요.",
  "고양이의 코 무늬는 사람의 지문처럼 모두 달라요.",
  "고양이가 눈을 천천히 깜빡이면 '사랑해'라는 뜻이에요.",
  "고양이는 자기 키의 5배 높이를 점프할 수 있어요.",
  "삼색 고양이는 99% 확률로 암컷이에요.",
  "꼬리를 바짝 세우고 다가오는 건 반갑다는 뜻이에요.",
  "고양이는 단맛을 느끼는 미각 수용체가 없어요.",
  "새끼 고양이는 태어나서 약 10일 동안은 눈을 뜨지 못해요.",
  "고양이의 수염은 몸이 지나갈 공간을 가늠하는 자 역할을 해요.",
  "고양이는 사람보다 약 6배 어두운 곳에서도 사물을 볼 수 있어요.",
  "꾹꾹이는 어릴 적 엄마 젖을 먹던 습관이 남은 거예요.",
  "고양이는 입천장의 야콥슨 기관으로 냄새를 '맛보듯' 읽어요.",
  "고양이의 가청 범위는 사람보다 훨씬 넓어서 초음파까지 들을 수 있어요.",
  "고양이는 하루에 2~3시간 이상을 스스로 그루밍하는 데 써요.",
  "고양이가 배를 보여주는 건 큰 신뢰의 표시예요. 그래도 덥석 만지진 마세요.",
  "터키시 반처럼 물을 즐기는 품종도 있어서 '수영하는 고양이'라고 불려요.",
  "고양이는 발바닥 젤리에서 땀이 나요. 더울 때 발자국이 촉촉해지는 이유예요.",
  "귀를 뒤로 납작하게 눕히면 경계·화남의 신호예요.",
  "실내에서만 자라는 고양이의 평균 수명은 약 15년이에요.",
  "고양이는 얼굴 분비선으로 자기 영역과 친한 존재를 표시해요.",
  "성묘들끼리는 거의 야옹거리지 않아요. 야옹은 주로 사람에게 말을 거는 소리예요.",
  "고양이가 머리를 비비는 건 '너는 내 가족'이라는 표시예요.",
  "수컷 고양이는 왼발잡이, 암컷 고양이는 오른발잡이가 더 많다는 연구가 있어요.",
  "고양이의 심장은 분당 140~220회로 사람의 약 2배 빠르게 뛰어요.",
  "고양이의 후각 세포는 사람보다 약 14배 더 많아요.",
  "생후 한 달이 안 된 새끼는 체온을 지키기 어려워 어미의 온기가 꼭 필요해요.",
  "고양이의 귀는 각각 따로 최대 180도 회전할 수 있어요.",
  "고양이 한 마리를 TNR하면 한 해에 수십 마리의 추가 번식을 막을 수 있어요.",
  "고양이의 혀는 케라틴 돌기로 덮여 있어 까끌까끌해요. 털 빗질과 고기 발라내기에 쓰여요.",
  "⚠️ 츄르는 구내염·치아질환을 유발할 수 있어요. 무염 삶은 닭가슴살이나 건사료가 훨씬 안전해요.",
  "⚠️ 우유는 절대 주지 마세요. 고양이 대부분은 유당불내증이라 설사·탈수로 위험해질 수 있어요.",
  "⚠️ 한번 밥을 주기 시작했으면 꾸준히 줘야 해요. 갑자기 끊으면 다른 먹이를 찾지 못해 굶어 죽을 수 있어요.",
  "길고양이에게 밥을 줄 때는 같은 시간, 같은 장소가 좋아요. 규칙적인 급식이 스트레스를 줄여줘요.",
  "참치캔은 염분이 높아 주식이 될 수 없어요. 가끔 간식으로만 주세요.",
];

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
  if (temp <= 30) return "#C47E5A";
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
export default function HomeAuthed({ hotSlot }: { hotSlot?: React.ReactNode } = {}) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [fact, setFact] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);

  // 다크모드 초기화
  useEffect(() => {
    const saved = localStorage.getItem("dosigongzon_dark");
    if (saved === "1") {
      document.documentElement.classList.add("dark");
      setIsDark(true);
    }
  }, []);

  const toggleDark = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("dosigongzon_dark", next ? "1" : "0");
  };
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [weatherError, setWeatherError] = useState("");
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [activity, setActivity] = useState<MyActivitySummary | null>(null);
  const [achievementToasts, setAchievementToasts] = useState<ToastData[]>([]);
  const [rescueCount, setRescueCount] = useState(0);
  const [levelInfo, setLevelInfo] = useState<LevelInfo | null>(null);
  const [popularPosts, setPopularPosts] = useState<Post[]>([]);
  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [allCats, setAllCats] = useState<Cat[]>([]);
  const [myRegions, setMyRegions] = useState<ActivityRegion[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [streakInfo, setStreakInfo] = useState<StreakInfo | null>(null);
  const [caretakerRank, setCaretakerRank] = useState<CaretakerRank[]>([]);
  const [popularCats, setPopularCats] = useState<PopularCat[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [anniversaries, setAnniversaries] = useState<Anniversary[]>([]);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);

  // 데이터 로드
  useEffect(() => {
    listNews().then(setNewsItems);
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

  // 온보딩 dismissal 상태 복원
  useEffect(() => {
    if (!user) return;
    try {
      const key = `dosigongzon_onboarding_dismissed_${user.id}`;
      setOnboardingDismissed(localStorage.getItem(key) === "1");
    } catch { /* localStorage 차단 등 무시 */ }
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

  // 실시간 피드 로드 + 60초 폴링
  useEffect(() => {
    const primary = myRegions.find((r) => r.is_primary) ?? myRegions[0] ?? null;
    let cancelled = false;
    const refresh = () => {
      getRecentFeed({ region: primary, limit: 10, hours: 24 })
        .then((list) => { if (!cancelled) setFeed(list); })
        .catch(() => {});
    };
    refresh();
    const interval = setInterval(refresh, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [myRegions]);

  // 알림 카운트 로드 + 30초 폴링
  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }
    let cancelled = false;
    const refresh = () => {
      getUnreadNotificationCount()
        .then((n) => { if (!cancelled) setUnreadCount(n); })
        .catch(() => {});
    };
    refresh();
    const interval = setInterval(refresh, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
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

  // 온보딩 체크
  useEffect(() => {
    try {
      if (!localStorage.getItem("dosigongzon_onboarded")) {
        router.push("/onboarding");
        return;
      }
    } catch {}
    setOnboardingChecked(true);
  }, [router]);

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
            color: "#C47E5A",
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

    if (!navigator.geolocation) {
      // 위치 서비스 미지원 → IP 기반으로 서버에서 처리
      fetchWeather();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => fetchWeather(pos.coords.latitude, pos.coords.longitude),
      () => {
        // GPS 거부 → IP 기반으로 서버에서 처리
        fetchWeather();
      },
      { timeout: 5000 },
    );
  }, [onboardingChecked, authLoading, user]);

  // 로딩 중이거나 auth 체크 전 → 스플래시 로딩 화면
  if (!onboardingChecked || authLoading || !user || !mounted) {
    return <SplashLoading />;
  }

  return (
    <div className="px-5 pt-12 pb-4">
      {/* ══════ 헤더 ══════ */}
      <div className="flex items-start justify-between mb-7">
        <div>
          {/* 브랜드 타이틀 */}
          <h1 className="text-[32px] font-black tracking-[-0.04em] leading-none mb-2.5">
            <span className="text-text-main">도시</span>
            <span className="text-primary">공존</span>
          </h1>
          {/* 서브타이틀 + 디바이더 */}
          <div className="flex items-center gap-2">
            <div
              className="w-5 h-[2px] rounded-full"
              style={{ backgroundColor: "#C47E5A", opacity: 0.6 }}
            />
            <p className="text-[12.5px] font-extrabold text-text-sub tracking-[-0.01em]">
              길 위의 아이들
            </p>
            <span
              className="text-[9px] font-bold tracking-[0.15em]"
              style={{ color: "#C47E5A", opacity: 0.5 }}
            >
              FOR STRAY CATS
            </span>
          </div>
          {/* 개인화 인사 — 시간대 + 이름 */}
          {user && (() => {
            const h = new Date(
              new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }),
            ).getHours();
            const greet =
              h < 5 ? "늦은 밤에도 수고 많으세요"
              : h < 11 ? "좋은 아침이에요"
              : h < 14 ? "점심은 드셨어요?"
              : h < 18 ? "오늘도 고생하세요"
              : h < 22 ? "좋은 저녁이에요"
              : "편안한 밤 되세요";
            const name =
              (user.user_metadata?.nickname as string | undefined) ??
              (user.user_metadata?.full_name as string | undefined) ??
              user.email?.split("@")[0] ??
              "";
            return (
              <p className="text-[11.5px] font-bold text-text-sub mt-2 tracking-tight">
                {greet}{name ? `, ${name}님` : ""} 💛
              </p>
            );
          })()}
          {/* 레벨 진행률 미니 바 — sunk cost 원리로 투자감 시각화 */}
          {user && levelInfo && (
            <div className="mt-2 flex items-center gap-2 max-w-[220px]">
              <span
                className="text-[10px] font-extrabold tracking-tight shrink-0 flex items-center gap-0.5"
                style={{ color: "#C47E5A" }}
              >
                <span>{levelInfo.emoji}</span>
                <span>Lv.{levelInfo.level}</span>
              </span>
              <div
                className="flex-1 h-1.5 rounded-full overflow-hidden"
                style={{ background: "rgba(196,126,90,0.15)" }}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.max(levelInfo.progress * 100, 4)}%`,
                    background: "linear-gradient(90deg, #C47E5A 0%, #E8B040 100%)",
                  }}
                />
              </div>
              <span className="text-[9.5px] font-bold text-text-light shrink-0">
                {levelInfo.next ? `${levelInfo.next - levelInfo.score}점` : "MAX"}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleDark}
            className="w-10 h-10 rounded-2xl bg-surface-alt flex items-center justify-center active:scale-90 transition-transform"
            aria-label="다크모드 전환"
          >
            {isDark ? <SunMedium size={18} className="text-warning" /> : <Moon size={18} className="text-text-sub" />}
          </button>
          {user && (
            <Link
              href="/notifications"
              className="relative w-10 h-10 rounded-2xl bg-surface-alt flex items-center justify-center active:scale-90 transition-transform"
              aria-label="알림"
            >
              <Bell size={18} className={unreadCount > 0 ? "text-primary" : "text-text-sub"} />
              {unreadCount > 0 && (
                <span
                  className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center text-[10px] font-extrabold text-white"
                  style={{
                    background: "linear-gradient(135deg, #E86B8C 0%, #D85555 100%)",
                    boxShadow: "0 2px 6px rgba(216,85,85,0.4)",
                  }}
                >
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>
          )}
          <Link
            href="/mypage"
            className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center active:scale-90 transition-transform"
          >
            <User size={20} className="text-primary" />
          </Link>
        </div>
      </div>



      {/* ══════ 사회적 증명 (오늘 활동 이웃 수) ══════ */}
      <SocialProofStrip />

      {/* ══════ 긴급 구조 배너 (scarcity/urgency) ══════ */}
      {user && rescueCount > 0 && <RescueBanner count={rescueCount} />}

      {/* ══════ 오늘 해볼 것 체크리스트 (Zeigarnik) ══════ */}
      {user && activity && (
        <TodayChecklist
          activity={activity}
          hasTodayCare={streakInfo?.hasToday ?? false}
          unreadCount={unreadCount}
          rescueCount={rescueCount}
        />
      )}

      {/* ══════ 이번 주 HOT 게시글 (SSR) ══════ */}
      {hotSlot}

      {/* ══════ 온보딩 가이드 (신규 유저용) ══════ */}
      {user && activity && !onboardingDismissed && (
        <OnboardingCard
          hasActivityRegion={myRegions.length > 0}
          hasMyCat={activity.catCount > 0}
          hasCareLog={activity.careLogCount > 0}
          onDismiss={handleDismissOnboarding}
        />
      )}

      {/* ══════ 기능 가이드 팁 (개인화) ══════ */}
      {user && activity && onboardingDismissed && (
        <FeatureTipsCard activity={activity} regions={myRegions} />
      )}

      {/* ══════ 돌봄 연속 일수 + 이번 주 ══════ */}
      {user && streakInfo && (streakInfo.streak > 0 || streakInfo.weekly.count > 0 || !streakInfo.hasToday) && (() => {
        const s = streakInfo.streak;
        const hasToday = streakInfo.hasToday;
        const weekly = streakInfo.weekly;
        const progress = Math.min(100, Math.round((weekly.count / weekly.goal) * 100));
        const fireCount = s >= 30 ? 3 : s >= 7 ? 2 : s >= 1 ? 1 : 0;
        const accent =
          s >= 30 ? "#D85555" :
          s >= 7  ? "#E88D5A" :
          s >= 1  ? "#C47E5A" : "#A38E7A";
        const headline = s === 0
          ? (hasToday ? "오늘 돌봄을 시작했어요" : "오늘 첫 돌봄을 기록해보세요")
          : hasToday
            ? `${s}일 연속 돌봄 중!`
            : `${s}일 연속 — 오늘도 이어가볼까요?`;
        const kstHourForSubline = new Date(
          new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }),
        ).getHours();
        const urgentSubline = !hasToday && s >= 2 && kstHourForSubline >= 18;
        const subline = s === 0
          ? "1건만 기록해도 연속 일수가 시작돼요"
          : urgentSubline
            ? `${s}일 연속 기록이 오늘 끊길 수 있어요. 한 줄이면 돼요!`
            : !hasToday
              ? "아직 오늘 기록이 없어요. 끊기지 않게 💛"
              : s >= 7
                ? "대단해요! 꾸준함이 아이들을 지켜요"
                : "매일 조금씩이 가장 큰 힘이에요";

        const dayLabels = ["월", "화", "수", "목", "금", "토", "일"];
        const kstNowForStreak = new Date(
          new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }),
        );
        const todayIdx = (kstNowForStreak.getDay() + 6) % 7;
        const kstHour = kstNowForStreak.getHours();
        // 손실 회피 강화: streak >= 2, 오늘 안 함, 18시 이후 → 위험 상태
        const atRisk = !hasToday && s >= 2 && kstHour >= 18;
        const hoursLeft = atRisk ? Math.max(1, 24 - kstHour) : 0;

        return (
          <Link
            href="/map"
            className="block mb-4 active:scale-[0.99] transition-transform"
          >
            <div
              className="p-5 relative"
              style={{
                background: atRisk
                  ? "linear-gradient(135deg, #FFF1F1 0%, #FFE5E5 100%)"
                  : hasToday
                    ? `linear-gradient(135deg, ${accent}18 0%, ${accent}08 100%)`
                    : "#FFFFFF",
                borderRadius: 22,
                border: atRisk
                  ? "1.5px solid #D85555"
                  : `1px solid ${hasToday ? `${accent}30` : "rgba(0,0,0,0.05)"}`,
                boxShadow: atRisk
                  ? "0 4px 16px rgba(216,85,85,0.18)"
                  : "0 4px 16px rgba(0,0,0,0.05)",
              }}
            >
              {/* 위험 배지 — 끊기 직전 */}
              {atRisk && (
                <div
                  className="absolute -top-2 right-4 px-2.5 py-1 rounded-full flex items-center gap-1"
                  style={{
                    background: "linear-gradient(135deg, #E85555 0%, #C43838 100%)",
                    boxShadow: "0 4px 10px rgba(216,85,85,0.45)",
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full animate-pulse"
                    style={{ background: "#FFF" }}
                  />
                  <span className="text-[10px] font-extrabold text-white tracking-tight">
                    ⏰ {hoursLeft}시간 남음
                  </span>
                </div>
              )}
              <div className="flex items-start gap-3 mb-3">
                <div
                  className="flex items-center justify-center shrink-0"
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 18,
                    background: s >= 1
                      ? `linear-gradient(135deg, #FF9A3C 0%, #E8652A 100%)`
                      : "#F0EBE3",
                    boxShadow: s >= 1 ? "0 6px 16px rgba(255,154,60,0.35)" : "none",
                    fontSize: 26,
                  }}
                >
                  <span style={{ filter: s === 0 ? "grayscale(1)" : "none", opacity: s === 0 ? 0.5 : 1 }}>
                    {fireCount === 3 ? "🔥🔥🔥" : fireCount === 2 ? "🔥🔥" : "🔥"}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-extrabold tracking-[0.12em]" style={{ color: accent }}>
                    STREAK
                  </p>
                  <p className="text-[16px] font-extrabold text-text-main tracking-tight leading-tight mt-0.5">
                    {headline}
                  </p>
                  <p className="text-[11.5px] text-text-sub mt-1 leading-snug">
                    {subline}
                  </p>
                  {/* 스트릭 프리즈 쿠폰 (streak ≥ 2 + 오늘 미기록 조건 내부에서 필터) */}
                  <StreakFreezeButton
                    streak={s}
                    hasToday={hasToday}
                    onUsed={() => {
                      // 재조회해서 카드 즉시 갱신
                      getMyStreakInfo().then(setStreakInfo).catch(() => {});
                    }}
                  />
                </div>
              </div>

              {/* 이번 주 진행률 */}
              <div className="mt-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-text-sub">이번 주 돌봄</span>
                  <span className="text-[12px] font-extrabold" style={{ color: accent }}>
                    {weekly.count}/{weekly.goal}
                    {progress >= 100 && <span className="ml-1">🎉</span>}
                  </span>
                </div>
                <div
                  className="w-full h-2 rounded-full overflow-hidden"
                  style={{ background: "rgba(0,0,0,0.06)" }}
                >
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${progress}%`,
                      background: `linear-gradient(90deg, ${accent} 0%, ${accent}CC 100%)`,
                    }}
                  />
                </div>
                {/* 요일 도트 */}
                <div className="flex items-center justify-between mt-2.5">
                  {weekly.byDay.map((done, i) => {
                    const isToday = i === todayIdx;
                    return (
                      <div key={i} className="flex flex-col items-center gap-1" style={{ width: 32 }}>
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-extrabold"
                          style={{
                            background: done ? accent : isToday ? `${accent}25` : "rgba(0,0,0,0.05)",
                            color: done ? "#fff" : isToday ? accent : "#B0A89C",
                            border: isToday && !done ? `1.5px dashed ${accent}` : "none",
                          }}
                        >
                          {done ? "✓" : ""}
                        </div>
                        <span
                          className="text-[9px] font-bold"
                          style={{ color: isToday ? accent : "#A38E7A" }}
                        >
                          {dayLabels[i]}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* 역대 최장 기록 */}
                {streakInfo.longestStreak >= 2 && (
                  <div
                    className="mt-3 px-3 py-2 rounded-lg flex items-center justify-between"
                    style={{
                      background: streakInfo.isRecord
                        ? "linear-gradient(135deg, #FFF4DC 0%, #FFE9C5 100%)"
                        : "rgba(0,0,0,0.035)",
                      border: streakInfo.isRecord
                        ? "1px solid #E8B84A55"
                        : "none",
                    }}
                  >
                    <span
                      className="text-[10.5px] font-bold"
                      style={{
                        color: streakInfo.isRecord ? "#A67B1E" : "#8C7B6A",
                      }}
                    >
                      {streakInfo.isRecord
                        ? `🎉 역대 최장 기록 갱신 중! (${streakInfo.longestStreak}일)`
                        : `🏆 역대 최장 ${streakInfo.longestStreak}일 · 돌파까지 ${streakInfo.longestStreak - s + 1}일`}
                    </span>
                  </div>
                )}

                {/* 보상 힌트 */}
                <div
                  className="mt-3 px-3 py-2 rounded-lg flex items-center justify-between"
                  style={{ background: `${accent}12` }}
                >
                  <span className="text-[10.5px] font-bold" style={{ color: accent }}>
                    {progress >= 100
                      ? "🏆 주간 개근 달성! +5점 · 업적 잠금 해제"
                      : s >= 100
                      ? "👑 100일 연속 · +100점 유지 중"
                      : s >= 30
                      ? "🔥🔥 30일 연속 · +30점 · 다음 목표: 100일"
                      : s >= 7
                      ? "🔥 7일 연속 · +10점 · 다음 목표: 30일"
                      : `7일 연속 달성 시 🔥 +10점 · 주간 개근 +5점`}
                  </span>
                </div>
              </div>
            </div>
          </Link>
        );
      })()}

      {/* ══════ 오늘의 기념일 ══════ */}
      {anniversaries.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-3 px-1">
            <div className="w-1 h-4 rounded-full" style={{ backgroundColor: "#E86B8C" }} />
            <h2 className="text-[14px] font-extrabold text-text-main tracking-tight">
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
                      borderRadius: 20,
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
                        className="px-2.5 py-1 rounded-full flex items-center gap-1"
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

      {/* ══════ 내 활동 요약 ══════ */}
      {activity && levelInfo && (() => {
        const lc = getLevelColor(levelInfo.level);
        return (
        <Link
          href="/mypage"
          className="block mb-5 active:scale-[0.98] transition-transform"
        >
          <div
            className="p-5 dark-card-level"
            style={{
              background: "#FFFFFF",
              borderRadius: 22,
              boxShadow: "0 8px 28px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.03)",
              border: "1px solid rgba(0,0,0,0.04)",
            }}
          >
            {/* 레벨 + 이름 */}
            <div className="flex items-center gap-3.5 mb-4">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background: `linear-gradient(135deg, ${lc}20 0%, ${lc}10 100%)`, border: `2px solid ${lc}30` }}
              >
                <span className="text-[28px]">{levelInfo.emoji}</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-[18px] font-extrabold text-text-main tracking-tight">{levelInfo.title}</p>
                  <span
                    className="text-[10px] font-extrabold px-2 py-0.5 rounded-lg text-white"
                    style={{ backgroundColor: lc }}
                  >
                    Lv.{levelInfo.level}
                  </span>
                </div>
                {/* 경험치 바 */}
                <div className="flex items-center gap-2.5 mt-2">
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: "#F0EBE4" }}>
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
              <ChevronRight size={16} className="text-text-light shrink-0" />
            </div>

            {/* 스탯 4칸 */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "고양이", value: activity.catCount, color: "#C47E5A", icon: "🐱" },
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
          </div>
        </Link>
        );
      })()}

      {/* ══════ 실시간 날씨 위젯 ══════ */}
      <div
        className="p-5 mb-5 dark-card-level"
        style={{
          background: "linear-gradient(135deg, #FFFFFF 0%, #FDF9F2 100%)",
          borderRadius: 22,
          boxShadow: "0 8px 24px rgba(74,123,168,0.08), 0 1px 3px rgba(0,0,0,0.03)",
          border: "1px solid rgba(0,0,0,0.04)",
        }}
      >
        {weatherLoading ? (
          /* 로딩 */
          <div className="flex items-center justify-center py-6 gap-2">
            <Loader2 size={20} className="text-primary animate-spin" />
            <span className="text-[13px] text-text-sub">날씨 정보를 불러오는 중...</span>
          </div>
        ) : weatherError ? (
          /* 에러 */
          <div className="flex items-center gap-3 py-3">
            <div className="w-10 h-10 rounded-2xl bg-surface-alt flex items-center justify-center shrink-0">
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
            {/* 상단: 날짜 + 지역 */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[11px] text-text-sub font-medium">
                  {new Date().toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "long" })}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  <MapPin size={12} className="text-primary" />
                  <span className="text-[13px] font-bold text-text-main">{weather.city}</span>
                </div>
              </div>
              <p className="text-[12px] text-text-sub capitalize">{weather.weatherDesc}</p>
            </div>

            {/* 중앙: 큰 온도 + 아이콘 */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-end gap-1">
                <span
                  className="text-[48px] font-extrabold leading-none tracking-tight"
                  style={{ color: getTempColor(weather.temp) }}
                >
                  {weather.temp}
                </span>
                <span className="text-[20px] font-bold text-text-light mb-1.5">°C</span>
              </div>
              {(() => {
                const WeatherIcon = WEATHER_ICONS[weather.weatherMain] ?? Cloud;
                return (
                  <WeatherIcon
                    size={48}
                    className="text-text-light"
                    strokeWidth={1.3}
                  />
                );
              })()}
            </div>

            {/* 하단: 체감 · 습도 · 바람 */}
            <div className="grid grid-cols-3 gap-2">
              <div className="flex items-center gap-1.5 bg-surface-alt rounded-xl px-3 py-2">
                <Thermometer size={14} className="text-text-muted shrink-0" />
                <div>
                  <p className="text-[10px] text-text-muted">체감</p>
                  <p className="text-[13px] font-bold text-text-main">{weather.feelsLike}°</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 bg-surface-alt rounded-xl px-3 py-2">
                <Droplets size={14} className="text-text-muted shrink-0" />
                <div>
                  <p className="text-[10px] text-text-muted">습도</p>
                  <p className="text-[13px] font-bold text-text-main">{weather.humidity}%</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 bg-surface-alt rounded-xl px-3 py-2">
                <Wind size={14} className="text-text-muted shrink-0" />
                <div>
                  <p className="text-[10px] text-text-muted">바람</p>
                  <p className="text-[13px] font-bold text-text-main">{weather.windSpeed}m/s</p>
                </div>
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

              return tips.length > 0 ? (
                <div className="mt-3 space-y-1.5">
                  {tips.map((tip, i) => (
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
                </div>
              ) : null;
            })()}
          </>
        ) : null}
      </div>

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
          className="w-11 h-11 rounded-[14px] flex items-center justify-center shrink-0"
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

      {/* ══════ AI 집사 ══════ */}
      <div
        className="px-5 py-4 mb-6"
        style={{
          background: "#FFFFFF",
          borderRadius: 22,
          boxShadow: "0 6px 20px rgba(196,126,90,0.10), 0 1px 3px rgba(0,0,0,0.03)",
          border: "1px solid rgba(0,0,0,0.04)",
        }}
      >
        <div className="flex items-center gap-3.5 mb-3.5">
          <div
            className="w-11 h-11 rounded-[14px] flex items-center justify-center shrink-0"
            style={{
              background: "linear-gradient(135deg, #C47E5A 0%, #A8684A 100%)",
              boxShadow: "0 5px 12px rgba(196,126,90,0.35), inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -2px 4px rgba(0,0,0,0.08)",
            }}
          >
            <Bot size={20} color="#fff" strokeWidth={2.3} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <p className="text-[15px] font-extrabold text-text-main tracking-tight">
                AI 집사
              </p>
              <span className="text-[9px] font-bold tracking-[0.15em]" style={{ color: "#C47E5A", opacity: 0.5 }}>
                BETA
              </span>
            </div>
            <p className="text-[11.5px] text-text-sub mt-0.5">
              길고양이 돌봄이 궁금하다면 물어보세요
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setChatOpen(true)}
            className="flex-1 rounded-xl px-4 py-2.5 text-[12.5px] text-text-muted text-left transition-all active:scale-[0.98]"
            style={{
              backgroundColor: "#F6F1EA",
              border: "1px solid #E3DCD3",
            }}
          >
            예: 새끼 고양이를 발견했어요...
          </button>
          <button
            onClick={() => setChatOpen(true)}
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 active:scale-90 transition-transform"
            style={{
              background: "linear-gradient(135deg, #C47E5A 0%, #A8684A 100%)",
              boxShadow: "0 4px 10px rgba(196,126,90,0.35), inset 0 1px 0 rgba(255,255,255,0.3)",
            }}
          >
            <Send size={15} color="white" />
          </button>
        </div>
      </div>

      <AIChatModal open={chatOpen} onClose={() => setChatOpen(false)} />

      {/* 레벨업 / 업적 잠금 해제 토스트 */}
      <AchievementToast
        toasts={achievementToasts}
        onDismiss={(id) =>
          setAchievementToasts((prev) => prev.filter((t) => t.id !== id))
        }
      />

      {/* ══════ 내 동네 소식 ══════ */}
      {user && (
        <div className="mb-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 px-1">
              <div className="w-1 h-4 rounded-full" style={{ backgroundColor: "#C47E5A" }} />
              <h2 className="text-[14px] font-extrabold text-text-main tracking-tight">
                내 동네 소식
              </h2>
              {primaryRegion && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg" style={{ background: "rgba(196,126,90,0.12)", color: "#C47E5A" }}>
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
                  background: "linear-gradient(135deg, rgba(196,126,90,0.08) 0%, rgba(168,104,74,0.04) 100%)",
                  borderRadius: 18,
                  border: "1px dashed rgba(196,126,90,0.3)",
                }}
              >
                <div
                  className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: "rgba(196,126,90,0.15)" }}
                >
                  <MapPin size={18} color="#C47E5A" strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-extrabold text-text-main">활동 지역을 설정해보세요</p>
                  <p className="text-[11px] text-text-sub mt-0.5">우리 동네 고양이 소식을 모아 볼 수 있어요</p>
                </div>
                <ChevronRight size={16} style={{ color: "#C47E5A" }} />
              </div>
            </Link>
          ) : (
            <div className="space-y-2.5">
              {/* 우리 동네 고양이 */}
              {neighborhoodCats.length > 0 ? (
                <Link
                  href="/map"
                  className="block active:scale-[0.99] transition-transform"
                >
                  <div
                    className="px-4 py-3.5"
                    style={{
                      background: "#FFFFFF",
                      borderRadius: 18,
                      boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
                      border: "1px solid rgba(0,0,0,0.04)",
                    }}
                  >
                    <div className="flex items-center justify-between mb-2.5">
                      <p className="text-[12px] font-extrabold text-text-main">
                        🐾 우리 동네 고양이 <span className="text-primary">{neighborhoodCats.length}</span>
                      </p>
                      <span className="text-[10px] text-text-light">
                        반경 {primaryRegion.radius_m >= 1000 ? `${primaryRegion.radius_m / 1000}km` : `${primaryRegion.radius_m}m`}
                      </span>
                    </div>
                    <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
                      {neighborhoodCats.map((c) => (
                        <div
                          key={c.id}
                          className="shrink-0 text-center"
                          style={{ width: 56 }}
                        >
                          <div
                            className="w-12 h-12 rounded-full mx-auto"
                            style={{
                              backgroundImage: `url('${sanitizeImageUrl(c.photo_url, "https://placehold.co/100x100/EEEAE2/2A2A28?text=%3F")}')`,
                              backgroundSize: "cover",
                              backgroundPosition: "center",
                              border: "2px solid #fff",
                              boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
                            }}
                          />
                          <p className="text-[10px] font-bold text-text-main mt-1 truncate">
                            {c.name}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </Link>
              ) : (
                <div
                  className="px-4 py-3 text-center"
                  style={{
                    background: "#FFFFFF",
                    borderRadius: 18,
                    boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
                    border: "1px solid rgba(0,0,0,0.04)",
                  }}
                >
                  <p className="text-[11.5px] text-text-sub">
                    아직 우리 동네에 등록된 고양이가 없어요 🐾
                  </p>
                </div>
              )}

              {/* 우리 동네 글 */}
              {neighborhoodPosts.length > 0 && (
                <div
                  className="px-4 py-3"
                  style={{
                    background: "#FFFFFF",
                    borderRadius: 18,
                    boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
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
                          style={{ backgroundColor: "rgba(196,126,90,0.12)", color: "#C47E5A" }}
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

      {/* ══════ 실시간 동네 피드 ══════ */}
      {feed.length > 0 && (() => {
        const primary = myRegions.find((r) => r.is_primary) ?? myRegions[0] ?? null;
        return (
          <div className="mb-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 px-1">
                <div className="w-1 h-4 rounded-full" style={{ backgroundColor: "#48A59E" }} />
                <h2 className="text-[14px] font-extrabold text-text-main tracking-tight">
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
                borderRadius: 20,
                boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
                border: "1px solid rgba(72,165,158,0.12)",
              }}
            >
              {feed.map((f, i) => {
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

      {/* ══════ 이번 주 돌봄 왕 TOP 3 ══════ */}
      {caretakerRank.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 px-1">
              <div className="w-1 h-4 rounded-full" style={{ backgroundColor: "#E8B040" }} />
              <h2 className="text-[14px] font-extrabold text-text-main tracking-tight">
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
                      borderRadius: 14,
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
                          : "linear-gradient(135deg, #C47E5A 0%, #A8684A 100%)",
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
      {popularCats.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 px-1">
              <div className="w-1 h-4 rounded-full" style={{ backgroundColor: "#E86B8C" }} />
              <h2 className="text-[14px] font-extrabold text-text-main tracking-tight">
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
                    className="absolute bottom-1.5 right-1.5 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full"
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

      {/* ══════ 인기 커뮤니티 글 ══════ */}
      {popularPosts.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 px-1">
              <div className="w-1 h-4 rounded-full" style={{ backgroundColor: "#E88D5A" }} />
              <h2 className="text-[14px] font-extrabold text-text-main tracking-tight">
                인기 게시글
              </h2>
            </div>
            <Link
              href="/community"
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
                    borderRadius: 16,
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

      {/* ══════ 고양이 사회 소식 & 일정 ══════ */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 px-1">
            <div className="w-1 h-4 rounded-full bg-primary" />
            <h2 className="text-[14px] font-extrabold text-text-main tracking-tight">
              고양이 사회 소식
            </h2>
            <span className="text-[9px] font-bold tracking-[0.15em]" style={{ color: "#C47E5A", opacity: 0.5 }}>
              NEWS &amp; EVENTS
            </span>
          </div>
          <Link
            href="/community"
            className="flex items-center gap-0.5 text-[12px] font-semibold text-primary"
          >
            전체보기 <ChevronRight size={14} />
          </Link>
        </div>

        <div className="space-y-4">
          {newsItems.length === 0 && (
            <div
              className="p-6 text-center text-[13px] text-text-sub"
              style={{
                background: "#FFFFFF",
                borderRadius: 22,
                boxShadow: "0 4px 16px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.03)",
                border: "1px solid rgba(0,0,0,0.04)",
              }}
            >
              아직 등록된 소식이 없어요.
            </div>
          )}
          {newsItems.map((item) => {
            const preset = BADGE_PRESETS[item.badge_type];
            const ddayLabel = resolveDdayLabel(item);
            const isUpcoming = !!ddayLabel && ddayLabel.startsWith("D-") && ddayLabel !== "D-day";
            const isToday = ddayLabel === "D-day";
            const isEnded = ddayLabel === "종료";
            return (
              <Link
                key={item.id}
                href={`/news/${item.id}`}
                className="block overflow-hidden active:scale-[0.98] transition-transform"
                style={{
                  background: "#FFFFFF",
                  borderRadius: 22,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.03)",
                  border: "1px solid rgba(0,0,0,0.04)",
                }}
              >
                {/* 이미지 영역 (16:9) */}
                <div className="relative aspect-[16/9] overflow-hidden" style={{ background: preset.gradient }}>
                  {item.image_url && (
                    <Image
                      src={item.image_url}
                      alt={item.title}
                      fill
                      sizes="(max-width: 720px) 100vw, 600px"
                      style={{ objectFit: "cover" }}
                    />
                  )}
                  {/* 하단 그라데이션 오버레이 */}
                  <div
                    className="absolute inset-0"
                    style={{ background: "linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 50%)" }}
                  />
                  {/* 카테고리 뱃지 (좌상단) */}
                  <span
                    className="absolute top-3 left-3 text-[11px] font-bold px-2.5 py-1 rounded-xl backdrop-blur-sm"
                    style={{
                      color: preset.color,
                      backgroundColor: `${preset.bg}dd`,
                    }}
                  >
                    {preset.label}
                  </span>
                  {/* D-Day 뱃지 (우상단) */}
                  {ddayLabel && (
                    <span
                      className="absolute top-3 right-3 text-[11px] font-bold px-2.5 py-1 rounded-xl backdrop-blur-sm"
                      style={{
                        color: isEnded ? "#8B7562" : isToday ? "#fff" : isUpcoming ? "#B84545" : "#6B8E6F",
                        backgroundColor: isEnded
                          ? "rgba(230,222,214,0.9)"
                          : isToday
                          ? "rgba(216,85,85,0.95)"
                          : isUpcoming
                          ? "rgba(238,227,222,0.9)"
                          : "rgba(232,236,229,0.9)",
                      }}
                    >
                      {ddayLabel}
                    </span>
                  )}
                  {/* 이미지 위 설명 */}
                  {item.description && (
                    <p className="absolute bottom-3 left-4 right-4 text-white text-[13px] font-semibold leading-snug drop-shadow-md">
                      {item.description}
                    </p>
                  )}
                </div>

                {/* 텍스트 영역 */}
                <div className="bg-white px-4 py-3.5">
                  <p className="text-[16px] font-bold text-text-main leading-snug mb-1">
                    {item.title}
                  </p>
                  {item.date_label && (
                    <p className="text-[13px] text-text-light">{item.date_label}</p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
