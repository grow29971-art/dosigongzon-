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
  BookOpen,
  Stethoscope,
  Gift,
  Bot,
  Send,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import AIChatModal from "@/app/components/AIChatModal";
import { NEWS_ITEMS } from "@/lib/news";

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

/* ═══ 퀵 액션 데이터 ═══ */
const QUICK_ACTIONS = [
  { label: "보호지침", href: "/protection", icon: BookOpen, bg: "#EAE6E8", color: "#7A6B8E" },
  { label: "병원 찾기", href: "/hospitals", icon: Stethoscope, bg: "#EEE8E0", color: "#C47E5A" },
  { label: "나눔 장터", href: "/community", icon: Gift, bg: "#E8ECE5", color: "#6B8E6F" },
  { label: "동네 소식", href: "/neighborhood", icon: MapPin, bg: "#E5E8ED", color: "#5B7A8F" },
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

function getGreeting() {
  const h = new Date().getHours();
  if (h < 6) return "좋은 새벽이에요";
  if (h < 12) return "좋은 아침이에요";
  if (h < 18) return "좋은 오후예요";
  return "좋은 저녁이에요";
}

/* ═══ 페이지 ═══ */
export default function HomePage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [fact, setFact] = useState("");
  const [greeting, setGreeting] = useState("안녕하세요");
  const [chatOpen, setChatOpen] = useState(false);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [weatherError, setWeatherError] = useState("");

  useEffect(() => {
    // 처음 방문자 → 온보딩으로 리다이렉트
    try {
      if (!localStorage.getItem("dosigongzon_onboarded")) {
        router.push("/onboarding");
        return;
      }
    } catch {}

    setMounted(true);
    setFact(CAT_FACTS[Math.floor(Math.random() * CAT_FACTS.length)]);
    setGreeting(getGreeting());

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
  }, []);

  if (!mounted) return null;

  return (
    <div className="px-5 pt-12 pb-4">
      {/* ══════ 헤더 ══════ */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <MapPin size={14} className="text-primary" />
            <span className="text-[12px] font-semibold text-primary">인천시 남동구</span>
          </div>
          <h1 className="text-[22px] font-extrabold text-text-main tracking-tight">
            {greeting}, 성우님
          </h1>
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
      <div className="card-glass rounded-[24px] p-5 mb-5">
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

      {/* ══════ 냥식 ══════ */}
      <div className="bg-white rounded-[24px] p-4 mb-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
          <Sparkles size={16} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold text-primary mb-0.5">오늘의 냥식</p>
          <p className="text-[14px] font-medium text-text-main leading-relaxed">{fact}</p>
        </div>
      </div>

      {/* ══════ 퀵 액션 ══════ */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {QUICK_ACTIONS.map((action) => (
          <Link
            key={action.label}
            href={action.href}
            className="flex flex-col items-center gap-2 active:scale-95 transition-transform"
          >
            <div
              className="w-14 h-14 rounded-[20px] flex items-center justify-center"
              style={{ backgroundColor: action.bg }}
            >
              <action.icon size={24} color={action.color} strokeWidth={1.8} />
            </div>
            <span className="text-[11px] font-semibold text-text-main">{action.label}</span>
          </Link>
        ))}
      </div>

      {/* ══════ AI 집사 ══════ */}
      <div className="bg-white rounded-[24px] p-5 mb-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
            <Bot size={20} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-bold text-text-main">AI 집사</p>
            <p className="text-[11px] text-text-sub">길고양이 돌봄이 궁금하다면 물어보세요</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setChatOpen(true)}
            className="flex-1 bg-surface-alt rounded-2xl px-4 py-3 text-[13px] text-text-muted text-left"
          >
            예: 새끼 고양이를 발견했어요...
          </button>
          <button
            onClick={() => setChatOpen(true)}
            className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center shrink-0 active:scale-90 transition-transform"
          >
            <Send size={16} color="white" />
          </button>
        </div>
      </div>

      <AIChatModal open={chatOpen} onClose={() => setChatOpen(false)} />

      {/* ══════ 고양이 사회 소식 & 일정 ══════ */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[16px] font-extrabold text-text-main">
            고양이 사회 소식 & 일정
          </h2>
          <Link
            href="/community"
            className="flex items-center gap-0.5 text-[12px] font-semibold text-primary"
          >
            전체보기 <ChevronRight size={14} />
          </Link>
        </div>

        <div className="space-y-4">
          {NEWS_ITEMS.map((item) => (
            <Link
              key={item.id}
              href={`/news/${item.id}`}
              className="block rounded-[24px] overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.06)] active:scale-[0.98] transition-transform"
            >
              {/* 이미지 영역 (16:9) */}
              <div className="relative aspect-[16/9] overflow-hidden">
                <img
                  src={item.image}
                  alt={item.title}
                  className="w-full h-full object-cover"
                />
                {/* 하단 그라데이션 오버레이 */}
                <div
                  className="absolute inset-0"
                  style={{ background: "linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 50%)" }}
                />
                {/* 카테고리 뱃지 (좌상단 플로팅) */}
                <span
                  className="absolute top-3 left-3 text-[11px] font-bold px-2.5 py-1 rounded-xl backdrop-blur-sm"
                  style={{
                    color: item.badgeColor,
                    backgroundColor: `${item.badgeBg}dd`,
                  }}
                >
                  {item.badge}
                </span>
                {/* D-Day 뱃지 (우상단) */}
                <span
                  className="absolute top-3 right-3 text-[11px] font-bold px-2.5 py-1 rounded-xl backdrop-blur-sm"
                  style={{
                    color: item.dday.startsWith("D-") ? "#B84545" : "#6B8E6F",
                    backgroundColor: item.dday.startsWith("D-") ? "rgba(238,227,222,0.9)" : "rgba(232,236,229,0.9)",
                  }}
                >
                  {item.dday}
                </span>
                {/* 이미지 위 제목 (하단) */}
                <p className="absolute bottom-3 left-4 right-4 text-white text-[13px] font-semibold leading-snug drop-shadow-md">
                  {item.desc}
                </p>
              </div>

              {/* 텍스트 영역 */}
              <div className="bg-white px-4 py-3.5">
                <p className="text-[16px] font-bold text-text-main leading-snug mb-1">
                  {item.title}
                </p>
                <p className="text-[13px] text-text-light">{item.date}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
