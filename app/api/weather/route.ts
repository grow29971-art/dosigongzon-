export async function GET(request: Request) {
  const apiKey = process.env.OPENWEATHERMAP_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "OPENWEATHERMAP_API_KEY가 설정되지 않았습니다.", debug: ".env.local에 OPENWEATHERMAP_API_KEY를 추가하세요." },
      { status: 500 },
    );
  }

  const { searchParams } = new URL(request.url);
  let lat = searchParams.get("lat");
  let lon = searchParams.get("lon");

  // GPS 좌표가 없으면 IP 기반 위치 추정
  if (!lat || !lon) {
    try {
      const ipRes = await fetch("http://ip-api.com/json/?fields=lat,lon,city,regionName&lang=ko");
      const ipData = await ipRes.json();
      console.log("[Weather API] IP 기반 위치:", ipData);

      if (ipData.lat && ipData.lon) {
        lat = String(ipData.lat);
        lon = String(ipData.lon);
      } else {
        return Response.json(
          { error: "위치를 확인할 수 없습니다.", debug: "IP 위치 추정 실패" },
          { status: 500 },
        );
      }
    } catch (err) {
      return Response.json(
        { error: "위치 확인 실패", debug: err instanceof Error ? err.message : String(err) },
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
      return Response.json(
        { error: "날씨 정보를 가져올 수 없습니다.", debug: `${res.status}: ${data.message}` },
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
    return Response.json(
      { error: "날씨 API 호출 실패", debug: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
