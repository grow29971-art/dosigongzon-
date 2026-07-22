// 혹한·폭염 급식 경보 푸시 — daily-dispatch 경유 매일 09:00 KST (2026-07-22 리텐션 회의).
// 도메인 근거: 폭염(그늘·시원한 물)과 혹한(물 결빙, 하루 2회 교체)은 캣맘에게
// 실제 행동 변화를 요구하는 이벤트 — "도움 되는 알림"이라 옵트인 명분이 강하다.
// 지역별 조건 분기 필수(서울 기준 일괄 발송 금지 — 신뢰 붕괴): 유저의 고양이 좌표를
// 그리드(0.2도≈22km)로 묶어 그리드별 실측 날씨로 판정한다.
// 평온한 날씨엔 아무것도 안 보낸다 — 조건 미충족 시 발송 0이 정상.

import webpush from "web-push";
import { createServiceClient } from "@/lib/supabase/service";

export const maxDuration = 300;

// 경보 임계값 (체감온도 기준)
const HEAT_FEELS_LIKE = 33; // 이상 → 폭염 경보
const COLD_FEELS_LIKE = -8; // 이하 → 혹한 경보
const MAX_WEATHER_CALLS = 10; // OpenWeatherMap 무료 쿼터 보호 — 그리드 상한

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const owmKey = process.env.OPENWEATHERMAP_API_KEY;
  if (!vapidPublic || !vapidPrivate || !owmKey) {
    return Response.json({ error: "서버 설정 미완료" }, { status: 500 });
  }
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL || "noreply@dosigongzon.com"}`,
    vapidPublic,
    vapidPrivate,
  );

  const supabase = createServiceClient();

  // 1) 마케팅 동의 유저의 고양이 좌표 — 유저별 첫 고양이 기준
  const { data: optedIn } = await supabase
    .from("profiles")
    .select("id")
    .eq("marketing_push_enabled", true);
  const optedInIds = ((optedIn ?? []) as { id: string }[]).map((p) => p.id);
  if (optedInIds.length === 0) {
    return Response.json({ ok: true, sent: 0, reason: "no opt-in users" });
  }

  const { data: catRows } = await supabase
    .from("cats")
    .select("caretaker_id, lat, lng")
    .in("caretaker_id", optedInIds)
    .not("lat", "is", null);

  // 유저 → 대표 좌표(첫 고양이), 그리드 키로 묶기
  const userCoord = new Map<string, { lat: number; lng: number }>();
  for (const c of (catRows ?? []) as { caretaker_id: string | null; lat: number; lng: number }[]) {
    if (c.caretaker_id && !userCoord.has(c.caretaker_id)) {
      userCoord.set(c.caretaker_id, { lat: c.lat, lng: c.lng });
    }
  }
  if (userCoord.size === 0) {
    return Response.json({ ok: true, sent: 0, reason: "no located cat owners" });
  }

  const gridKey = (lat: number, lng: number) =>
    `${Math.round(lat / 0.2) * 0.2},${Math.round(lng / 0.2) * 0.2}`;
  const grids = new Map<string, { lat: number; lng: number; userIds: string[] }>();
  for (const [uid, { lat, lng }] of userCoord) {
    const key = gridKey(lat, lng);
    const g = grids.get(key) ?? { lat, lng, userIds: [] };
    g.userIds.push(uid);
    grids.set(key, g);
  }

  // 2) 그리드별 실측 날씨 → 경보 판정 (유저 많은 그리드 우선, 쿼터 상한)
  const sorted = Array.from(grids.values())
    .sort((a, b) => b.userIds.length - a.userIds.length)
    .slice(0, MAX_WEATHER_CALLS);

  type Alert = { userIds: string[]; title: string; body: string };
  const alerts: Alert[] = [];
  for (const g of sorted) {
    try {
      const res = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${g.lat}&lon=${g.lng}&appid=${owmKey}&units=metric&lang=kr`,
        { cache: "no-store", signal: AbortSignal.timeout(6000) },
      );
      if (!res.ok) continue;
      const w = (await res.json()) as { main?: { feels_like?: number } };
      const feels = w.main?.feels_like;
      if (typeof feels !== "number") continue;
      const t = Math.round(feels);
      if (feels >= HEAT_FEELS_LIKE) {
        alerts.push({
          userIds: g.userIds,
          title: `🥵 폭염 급식 경보 · 체감 ${t}°`,
          body: "물그릇을 그늘로 옮기고, 시원한 물로 자주 갈아주세요. 습식은 빨리 상해요.",
        });
      } else if (feels <= COLD_FEELS_LIKE) {
        alerts.push({
          userIds: g.userIds,
          title: `🥶 혹한 급식 경보 · 체감 ${t}°`,
          body: "물이 얼어요 — 미지근한 물로 하루 2번 교체하고, 바람막이를 확인해주세요.",
        });
      }
    } catch {
      /* 그리드 하나 실패는 스킵 */
    }
  }
  if (alerts.length === 0) {
    return Response.json({ ok: true, sent: 0, reason: "no extreme weather", grids: sorted.length });
  }

  // 3) 발송 — 경보 걸린 그리드 유저의 push 구독만
  const alertUserIds = alerts.flatMap((a) => a.userIds);
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth")
    .in("user_id", alertUserIds);
  if (!subs || subs.length === 0) {
    return Response.json({ ok: true, sent: 0, reason: "no subscribers", targets: alertUserIds.length });
  }

  const alertByUser = new Map<string, Alert>();
  for (const a of alerts) for (const uid of a.userIds) alertByUser.set(uid, a);

  let sent = 0;
  let failed = 0;
  for (const sub of subs as Array<{ id: string; user_id: string; endpoint: string; p256dh: string; auth: string }>) {
    const alert = alertByUser.get(sub.user_id);
    if (!alert) continue;
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ title: alert.title, body: alert.body, url: "/map" }),
      );
      sent++;
      await new Promise((r) => setTimeout(r, 80));
    } catch (err: unknown) {
      failed++;
      const statusCode = (err as { statusCode?: number })?.statusCode;
      if (statusCode === 410 || statusCode === 404) {
        await supabase.from("push_subscriptions").delete().eq("id", sub.id);
      }
    }
  }

  return Response.json({ ok: true, sent, failed, alerts: alerts.length, grids: sorted.length });
}

// 디스패처는 POST로 호출하지만, 수동 GET 테스트도 동일 처리
export const GET = POST;
