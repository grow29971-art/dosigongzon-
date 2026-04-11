import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  // 인증 체크: 로그인 유저만
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  const apiKey = process.env.OPENWEATHERMAP_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "OPENWEATHERMAP_API_KEY가 설정되지 않았습니다.", debug: ".env.local에 OPENWEATHERMAP_API_KEY를 추가하세요." },
      { status: 500 },
    );
  }

  const { searchParams } = new URL(request.url);
  const rawLat = searchParams.get("lat");
  const rawLon = searchParams.get("lon");

  // 숫자 검증: 범위 체크로 URL 주입/오동작 차단
  function parseCoord(raw: string | null, min: number, max: number): number | null {
    if (raw === null) return null;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < min || n > max) return null;
    return n;
  }

  let lat = parseCoord(rawLat, -90, 90);
  let lon = parseCoord(rawLon, -180, 180);

  // 쿼리에 값은 있는데 검증 실패 → 400
  if ((rawLat !== null || rawLon !== null) && (lat === null || lon === null)) {
    return Response.json({ error: "lat/lon이 올바르지 않아요." }, { status: 400 });
  }

  // GPS 좌표가 없으면 IP 기반 위치 추정 (HTTPS)
  if (lat === null || lon === null) {
    try {
      const ipRes = await fetch("https://ip-api.com/json/?fields=lat,lon,city,regionName&lang=ko");
      const ipData = await ipRes.json();
      console.log("[Weather API] IP 기반 위치:", ipData);

      const ipLat = parseCoord(ipData?.lat != null ? String(ipData.lat) : null, -90, 90);
      const ipLon = parseCoord(ipData?.lon != null ? String(ipData.lon) : null, -180, 180);

      if (ipLat !== null && ipLon !== null) {
        lat = ipLat;
        lon = ipLon;
      } else {
        return Response.json(
          { error: "위치를 확인할 수 없습니다." },
          { status: 500 },
        );
      }
    } catch (err) {
      console.error("[Weather API] IP 위치 확인 실패:", err);
      return Response.json(
        { error: "위치 확인 실패" },
        { status: 500 },
      );
    }
  }

  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&lang=kr&appid=${apiKey}`;
    console.log("[Weather API] 요청:", { lat, lon });

    const res = await fetch(url);
    const data = await res.json();

    console.log("[Weather API] 응답:", res.status, data.name || data.message);

    if (!res.ok) {
      console.error("[Weather API] upstream error:", res.status, data?.message);
      return Response.json(
        { error: "날씨 정보를 가져올 수 없습니다." },
        { status: res.status },
      );
    }

    return Response.json({
      city: data.name,
      temp: Math.round(data.main.temp),
      feelsLike: Math.round(data.main.feels_like),
      humidity: data.main.humidity,
      weatherMain: data.weather?.[0]?.main ?? "Clear",
      weatherDesc: data.weather?.[0]?.description ?? "",
      windSpeed: data.wind?.speed ?? 0,
    });
  } catch (err) {
    console.error("[Weather API] 호출 실패:", err);
    return Response.json(
      { error: "날씨 API 호출 실패" },
      { status: 500 },
    );
  }
}
