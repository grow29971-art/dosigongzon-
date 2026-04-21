// 돌봄 스트릭 위험 알림 — Vercel Cron 매일 21:30 KST (12:30 UTC)
// 스트릭 2일↑인데 오늘 아직 돌봄 기록이 없는 유저에게 푸시.
// 하루 놓치면 연속 기록이 끊기므로 잠들기 전 마지막 리마인더.

import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 300;

// KST 날짜 문자열 "YYYY-MM-DD"
function toKstDate(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!vapidPublic || !vapidPrivate || !supabaseUrl || !supabaseServiceKey) {
    return Response.json({ error: "서버 설정 미완료" }, { status: 500 });
  }

  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL || "noreply@dosigongzon.com"}`,
    vapidPublic,
    vapidPrivate,
  );

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const today = toKstDate(new Date());

  // 1. 마케팅 푸시 동의 유저 목록
  const { data: optedIn } = await supabase
    .from("profiles")
    .select("id")
    .eq("marketing_push_enabled", true);
  const optedInIds = ((optedIn ?? []) as { id: string }[]).map((p) => p.id);
  if (optedInIds.length === 0) {
    return Response.json({ ok: true, sent: 0, reason: "no opt-in users" });
  }

  // 2. 옵트인 유저의 최근 60일 care_logs (스트릭 계산용)
  const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
  const { data: logs } = await supabase
    .from("care_logs")
    .select("author_id, logged_at")
    .in("author_id", optedInIds)
    .gte("logged_at", since);

  const userDays = new Map<string, Set<string>>();
  for (const row of (logs ?? []) as { author_id: string; logged_at: string }[]) {
    const kstDay = toKstDate(row.logged_at);
    if (!userDays.has(row.author_id)) userDays.set(row.author_id, new Set());
    userDays.get(row.author_id)!.add(kstDay);
  }

  // 3. 스트릭 위험군 추출: streak >= 2 AND !hasToday
  const atRisk: Array<{ userId: string; streak: number }> = [];
  for (const userId of optedInIds) {
    const days = userDays.get(userId);
    if (!days || days.size === 0) continue;
    if (days.has(today)) continue; // 오늘 이미 기록함 → skip

    // 어제부터 거슬러 올라가며 연속 일수
    let streak = 0;
    const cursor = new Date();
    cursor.setDate(cursor.getDate() - 1);
    for (let i = 0; i < 366; i++) {
      if (days.has(toKstDate(cursor))) {
        streak += 1;
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }
    if (streak >= 2) atRisk.push({ userId, streak });
  }

  if (atRisk.length === 0) {
    return Response.json({ ok: true, sent: 0, reason: "no at-risk users" });
  }

  // 4. 대상자의 push 구독 가져오기
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("*")
    .in("user_id", atRisk.map((x) => x.userId));
  if (!subs || subs.length === 0) {
    return Response.json({ ok: true, sent: 0, reason: "no subscribers", atRisk: atRisk.length });
  }

  const streakByUser = new Map(atRisk.map((x) => [x.userId, x.streak]));

  // 5. 발송 — 스트릭 수에 따라 메시지 다변화
  let sent = 0;
  let failed = 0;
  for (const sub of subs as Array<{
    id: string;
    user_id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
  }>) {
    const streak = streakByUser.get(sub.user_id) ?? 0;
    const title =
      streak >= 30
        ? `🔥🔥🔥 ${streak}일 스트릭이 위험해요!`
        : streak >= 7
          ? `🔥🔥 ${streak}일 연속 — 오늘만 이어가면 돼요`
          : `🔥 ${streak}일 스트릭 · 오늘 한 줄 남기면 이어져요`;
    const body =
      streak >= 30
        ? "한 달 넘게 이어온 기록, 오늘 단 한 줄로 지킬 수 있어요."
        : streak >= 7
          ? "일주일 넘게 꾸준히 챙겼어요. 오늘도 한 번만 들러볼까요?"
          : "오늘 안부 한 줄이면 연속 기록이 이어져요 💛";
    const url = "/map";

    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ title, body, url }),
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

  return Response.json({
    ok: true,
    atRisk: atRisk.length,
    subscribers: subs.length,
    sent,
    failed,
  });
}

export const GET = POST;
