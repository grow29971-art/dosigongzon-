// ══════════════════════════════════════════
// 날씨 API
//
// ⚠️ 위치정보법(무신고 구성) — 좌표는 절대 URL에 싣지 않는다.
// 클라이언트가 보내는 좌표는 이미 약 5km 격자로 스냅된 값이지만, 쿼리스트링에
// 실으면 우리 애플리케이션이 저장하지 않아도 플랫폼(Vercel) 액세스 로그에 남는다.
// 로그는 코드 통제 밖이라 "위치정보를 수집하지 않는다"는 구성이 형식적으로 무너진다.
// → 좌표를 넘기는 경로는 POST(body)로만 받는다. GET은 좌표를 아예 읽지 않는다.
//   (2026-08-05 LBS 균열 봉합)
// ══════════════════════════════════════════

import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { reportError } from "@/lib/error-report";

const SEOUL = { lat: 37.5665, lon: 126.978 };

// 숫자 검증: 범위 체크로 URL 주입/오동작 차단
function parseCoord(raw: unknown, min: number, max: number): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

// 좌표가 없을 때 클라이언트 IP로 대략 위치 추정
async function resolveByIp(request: Request): Promise<{ lat: number; lon: number }> {
  try {
    // getClientIp는 Vercel이 직접 설정해 클라이언트가 덮어쓸 수 없는 헤더를 우선한다.
    // (cf-connecting-ip는 우리 경로의 어떤 프록시도 설정하지 않아 위조 가능 → 사용 금지)
    const clientIp = getClientIp(request);
    // IPv4/IPv6 형식 검증 (path injection 방어)
    const ipValid =
      /^[0-9.:a-fA-F]+$/.test(clientIp) && clientIp !== "::1" && clientIp !== "127.0.0.1";
    const ipParam = ipValid ? `/${clientIp}` : "";
    // ip-api는 https 유료 플랜만 지원. 무료 HTTP 유지하되 응답 검증만 강화.
    const ipRes = await fetch(
      `http://ip-api.com/json${ipParam}?fields=lat,lon,city,regionName&lang=ko`,
    );
    const ipData = await ipRes.json();

    const ipLat = parseCoord(ipData?.lat, -90, 90);
    const ipLon = parseCoord(ipData?.lon, -180, 180);
    if (ipLat !== null && ipLon !== null) return { lat: ipLat, lon: ipLon };
  } catch {
    // 아래 기본 좌표로 폴백
  }
  return SEOUL;
}

async function respondWeather(
  lat: number,
  lon: number,
  cacheHeader: string,
): Promise<Response> {
  const apiKey = process.env.OPENWEATHERMAP_API_KEY;
  if (!apiKey) {
    // 원인은 서버 로그로만 — 응답에 env 변수명/설정 힌트 노출 금지(CLAUDE.md 보안 규칙).
    console.error("[Weather API] OPENWEATHERMAP_API_KEY 미설정");
    return Response.json({ error: "날씨 정보를 일시적으로 제공할 수 없어요." }, { status: 500 });
  }

  try {
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&lang=kr&appid=${apiKey}`,
    );
    const data = await res.json();

    if (!res.ok) {
      console.error("[Weather API] upstream error:", res.status, data?.message);
      return Response.json({ error: "날씨 정보를 가져올 수 없습니다." }, { status: res.status });
    }

    return Response.json(
      {
        city: data.name,
        temp: Math.round(data.main.temp),
        feelsLike: Math.round(data.main.feels_like),
        humidity: data.main.humidity,
        weatherMain: data.weather?.[0]?.main ?? "Clear",
        weatherDesc: data.weather?.[0]?.description ?? "",
        windSpeed: data.wind?.speed ?? 0,
      },
      { headers: { "Cache-Control": cacheHeader } },
    );
  } catch (err) {
    reportError("weather", err);
    return Response.json({ error: "날씨 API 호출 실패" }, { status: 500 });
  }
}

// IP당 분당 10회 — OpenWeatherMap 무료 quota(분당 60) 보호
function overLimit(request: Request): boolean {
  return !rateLimit(`weather:${getClientIp(request)}`, { max: 10, windowMs: 60_000 });
}

// ── GET: 좌표 없이 IP 기반 추정 전용 ──
// 좌표 쿼리는 읽지 않는다(위 주석 참조). 구버전 클라이언트가 ?lat=..를 붙여 보내도
// 무시하고 IP 기반으로 응답한다 — 실패가 아니라 조용한 폴백.
export async function GET(request: Request) {
  if (overLimit(request)) {
    return Response.json({ error: "잠시 후 다시 시도해주세요." }, { status: 429 });
  }
  const { lat, lon } = await resolveByIp(request);
  // IP마다 결과가 다르므로 공유 캐시(s-maxage) 금지 — 첫 요청자의 지역 날씨가
  // 다른 사용자에게 그대로 나가는 것을 막는다.
  return respondWeather(lat, lon, "private, max-age=600");
}

// ── POST: 격자 스냅된 좌표를 body로 받는 경로 ──
export async function POST(request: Request) {
  if (overLimit(request)) {
    return Response.json({ error: "잠시 후 다시 시도해주세요." }, { status: 429 });
  }

  let body: { lat?: unknown; lon?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    // 본문 없음/파손 → IP 기반으로 폴백
  }

  const lat = parseCoord(body.lat, -90, 90);
  const lon = parseCoord(body.lon, -180, 180);

  // 값은 왔는데 검증 실패 → 400 (조용히 다른 지역을 보여주지 않는다)
  if ((body.lat != null || body.lon != null) && (lat === null || lon === null)) {
    return Response.json({ error: "lat/lon이 올바르지 않아요." }, { status: 400 });
  }

  if (lat === null || lon === null) {
    const byIp = await resolveByIp(request);
    return respondWeather(byIp.lat, byIp.lon, "private, max-age=600");
  }
  return respondWeather(lat, lon, "private, max-age=600");
}
