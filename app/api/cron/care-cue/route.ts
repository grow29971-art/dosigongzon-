// 돌봄 일일 cue 푸시 — Vercel Cron 매일 18:00 KST (09:00 UTC).
// 대상: 마케팅 푸시 동의 + 고양이 보유 + 최근 7일 돌봄 기록 0건인 유저.
//        (= 스트릭이 없는 신규/끊긴 케이스. streak-reminder가 안 잡는 audience를 보완.)
// 목적: "앱을 열게 하는 트리거" 부재 해소 → 홈 MyCatsQuickCare 카드에서 1탭 로깅.

import webpush from "web-push";
import { createServiceClient } from "@/lib/supabase/service";

export const maxDuration = 300;

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

  const supabase = createServiceClient();

  // 1) 마케팅 푸시 동의 유저
  const { data: optedIn } = await supabase
    .from("profiles")
    .select("id")
    .eq("marketing_push_enabled", true);
  const optedInIds = ((optedIn ?? []) as { id: string }[]).map((p) => p.id);
  if (optedInIds.length === 0) {
    return Response.json({ ok: true, sent: 0, reason: "no opt-in users" });
  }

  // 2) 그중 고양이 보유 유저 (caretaker_id 기준)
  const { data: catRows } = await supabase
    .from("cats")
    .select("caretaker_id")
    .in("caretaker_id", optedInIds);
  const haveCats = new Set(((catRows ?? []) as { caretaker_id: string | null }[]).map((c) => c.caretaker_id).filter(Boolean) as string[]);
  if (haveCats.size === 0) {
    return Response.json({ ok: true, sent: 0, reason: "no cat owners opted in" });
  }

  // 3) 그중 최근 7일 돌봄 기록 있는 유저 → 제외(스트릭 사람들은 streak-reminder가 담당)
  const sinceIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentLogs } = await supabase
    .from("care_logs")
    .select("author_id")
    .in("author_id", Array.from(haveCats))
    .gte("logged_at", sinceIso);
  const recentLoggers = new Set(((recentLogs ?? []) as { author_id: string }[]).map((r) => r.author_id));

  const targetIds = Array.from(haveCats).filter((id) => !recentLoggers.has(id));
  if (targetIds.length === 0) {
    return Response.json({ ok: true, sent: 0, reason: "all cat owners logged recently" });
  }

  // 4) 대상자 push 구독
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth")
    .in("user_id", targetIds);
  if (!subs || subs.length === 0) {
    return Response.json({ ok: true, sent: 0, reason: "no subscribers", targets: targetIds.length });
  }

  // 5) 발송
  // 2026-07-22 심리 회의: "한 끼" 프레임(안 주면 굶는다는 암시) 제거 — 죄책감 없는 안부 톤.
  // 딥링크는 홈 최상단 실기록 지점(#my-cats)으로 — 약속("탭 한 번")과 랜딩 일치.
  const payload = JSON.stringify({
    title: "🍚 오늘도 잘 지내나 볼까요?",
    body: "쓰담 한 번, 안부 한 줄 — 탭 한 번이면 끝나요.",
    url: "/#my-cats",
  });

  let sent = 0;
  let failed = 0;
  for (const sub of subs as Array<{
    id: string;
    user_id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
  }>) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
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
    optedIn: optedInIds.length,
    catOwners: haveCats.size,
    recentLoggers: recentLoggers.size,
    targets: targetIds.length,
    subscribers: subs.length,
    sent,
    failed,
  });
}

export const GET = POST;
