"use client";

import { useEffect, useState } from "react";
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
} from "lucide-react";
import AIChatModal from "@/app/components/AIChatModal";
import SplashLoading from "@/app/components/SplashLoading";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import {
  listNews,
  BADGE_PRESETS,
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
import type { Post } from "@/lib/types";

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

/* ═══ 페이지 ═══ */
export default function HomePage() {
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
  const [levelInfo, setLevelInfo] = useState<LevelInfo | null>(null);
  const [popularPosts, setPopularPosts] = useState<Post[]>([]);

  // 데이터 로드
  useEffect(() => {
    listNews().then(setNewsItems);
    listPosts().then((posts) => {
      const sorted = [...posts].sort(
        (a, b) => (b.likeCount * 3 + b.commentCount * 2 + b.viewCount) - (a.likeCount * 3 + a.commentCount * 2 + a.viewCount),
      );
      setPopularPosts(sorted.slice(0, 3));
    });
  }, []);

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

    // 내 활동 요약 + 레벨
    getMyActivitySummary().then((s) => {
      setActivity(s);
      setLevelInfo(computeLevel(computeScore(s)));
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
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleDark}
            className="w-10 h-10 rounded-2xl bg-surface-alt flex items-center justify-center active:scale-90 transition-transform"
            aria-label="다크모드 전환"
          >
            {isDark ? <SunMedium size={18} className="text-warning" /> : <Moon size={18} className="text-text-sub" />}
          </button>
          <Link
            href="/mypage"
            className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center active:scale-90 transition-transform"
          >
            <User size={20} className="text-primary" />
          </Link>
        </div>
      </div>



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
            const isDday = item.dday?.startsWith("D-") ?? false;
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
                    <img
                      src={item.image_url}
                      alt={item.title}
                      className="w-full h-full object-cover"
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
                  {item.dday && (
                    <span
                      className="absolute top-3 right-3 text-[11px] font-bold px-2.5 py-1 rounded-xl backdrop-blur-sm"
                      style={{
                        color: isDday ? "#B84545" : "#6B8E6F",
                        backgroundColor: isDday ? "rgba(238,227,222,0.9)" : "rgba(232,236,229,0.9)",
                      }}
                    >
                      {item.dday}
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
