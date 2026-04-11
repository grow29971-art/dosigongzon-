"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
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
} from "lucide-react";
import AIChatModal from "@/app/components/AIChatModal";
import SplashLoading from "@/app/components/SplashLoading";
import { useAuth } from "@/lib/auth-context";
import {
  listNews,
  BADGE_PRESETS,
  type NewsItem,
} from "@/lib/news-repo";

/* ═══ 냥식 ═══ */
const CAT_FACTS = [
  "고양이는 하루 평균 14시간 이상 잠을 자요.",
  "고양이의 골골송은 뼈 재생을 돕는 주파수와 비슷해요.",
  "고양이의 코 무늬는 사람의 지문처럼 모두 달라요.",
  "고양이가 눈을 천천히 깜빡이면 '사랑해'라는 뜻이에요.",
  "고양이는 자기 키의 5배 높이를 점프할 수 있어요.",
  "삼색 고양이는 99% 확률로 암컷이에요.",
  "꼬리를 바짝 세우고 다가오는 건 반갑다는 뜻이에요.",
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
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [weatherError, setWeatherError] = useState("");
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);

  // 뉴스 목록 가져오기
  useEffect(() => {
    listNews().then(setNewsItems);
  }, []);

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

  // 온보딩 통과 후 auth 확인 → 로그인 안 되어 있으면 로그인 페이지로
  useEffect(() => {
    if (!onboardingChecked) return;
    if (authLoading) return;
    if (!user) {
      router.push("/login");
    }
  }, [onboardingChecked, authLoading, user, router]);

  useEffect(() => {
    if (!onboardingChecked || authLoading || !user) return;

    setMounted(true);
    setFact(CAT_FACTS[Math.floor(Math.random() * CAT_FACTS.length)]);

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
      // 위치 서비스 미지원 → IP 기반 위치로 날씨 조회
      fetchWeather();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => fetchWeather(pos.coords.latitude, pos.coords.longitude),
      () => {
        // GPS 거부 또는 HTTP 환경 → IP 기반 위치로 폴백
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
          <button className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center shadow-[0_2px_12px_rgba(0,0,0,0.04)] active:scale-90 transition-transform">
            <Bell size={20} className="text-text-sub" />
          </button>
          <Link
            href="/mypage"
            className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center active:scale-90 transition-transform"
          >
            <User size={20} className="text-primary" />
          </Link>
        </div>
      </div>

      {/* ══════ 실시간 날씨 위젯 ══════ */}
      <div
        className="p-5 mb-5"
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
