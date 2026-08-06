// 예약 푸시 발송 — Vercel Cron 매일 13:00 KST (04:00 UTC).
// scheduled_at이 지난 pending 예약을 찾아 전체 구독자에게 발송한다.
//
// Vercel Hobby는 크론이 하루 1회라 체크포인트가 하루 한 번이다.
// → 예약 시각은 "그 시각 이후 첫 체크포인트에 나간다"는 의미로 UI에 명시돼 있다.
//
// 동시 실행/중복 발송 방어: 조건부 UPDATE(pending → sending)로 선점한 건만 처리한다.
// 선점에 실패한 행은 다른 실행이 이미 가져간 것이므로 건너뛴다.

import webpush from "web-push";
import { createServiceClient } from "@/lib/supabase/service";
import { safePgError } from "@/lib/log-sanitize";

export const maxDuration = 300;

interface PushSubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  if (!vapidPublic || !vapidPrivate) {
    console.error("[cron/scheduled-push] VAPID 키 미설정");
    return Response.json({ error: "서버 설정 미완료" }, { status: 500 });
  }
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL || "noreply@dosigongzon.com"}`,
    vapidPublic,
    vapidPrivate,
  );

  const svc = createServiceClient();
  const nowIso = new Date().toISOString();

  // 0. 좌초 회수 — 선점(sending)한 채로 함수가 죽으면 다음 실행이 영영 못 잡는다.
  //    1시간 넘게 sending인 건은 실패로 확정해 관리자가 목록에서 알아볼 수 있게 한다.
  const staleIso = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  await svc
    .from("scheduled_pushes")
    .update({ status: "failed", error_note: "발송 중 중단(좌초 회수)" })
    .eq("status", "sending")
    .lt("scheduled_at", staleIso);

  // 1. 발송 시각이 지난 대기 건 (오래된 것부터)
  const { data: due, error: dueError } = await svc
    .from("scheduled_pushes")
    .select("id, title, body, url")
    .eq("status", "pending")
    .lte("scheduled_at", nowIso)
    .order("scheduled_at", { ascending: true })
    .limit(10);

  if (dueError) {
    console.error("[cron/scheduled-push] 대기 목록 조회 실패:", safePgError(dueError));
    return Response.json({ error: "조회 실패" }, { status: 500 });
  }
  if (!due || due.length === 0) {
    return Response.json({ ok: true, processed: 0 });
  }

  // 2. 구독자 조회 — 마케팅 푸시에 동의한 유저만.
  //    다른 크론(care-cue·streak-reminder 등)과 같은 규칙이며, 관리자 화면도
  //    "마케팅 옵트인자 대상"이라고 표기하고 있다. (2026-08-06)
  const { data: optedIn, error: optError } = await svc
    .from("profiles")
    .select("id")
    .eq("marketing_push_enabled", true);
  if (optError) {
    console.error("[cron/scheduled-push] 옵트인 조회 실패:", safePgError(optError));
    return Response.json({ error: "조회 실패" }, { status: 500 });
  }
  const optedInIds = (optedIn ?? []).map((p) => p.id as string);
  if (optedInIds.length === 0) {
    return Response.json({ ok: true, processed: 0, reason: "옵트인 대상 없음" });
  }

  const { data: subs, error: subError } = await svc
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", optedInIds);
  if (subError) {
    console.error("[cron/scheduled-push] 구독자 조회 실패:", safePgError(subError));
    return Response.json({ error: "조회 실패" }, { status: 500 });
  }
  const subscribers = (subs ?? []) as PushSubscriptionRow[];

  const results: Array<{ id: string; sent: number; total: number }> = [];

  for (const item of due) {
    // 2-1. 원자적 선점 — pending인 동안만 성공. 중복 실행이 같은 건을 두 번 보내지 못한다.
    const { data: claimed } = await svc
      .from("scheduled_pushes")
      .update({ status: "sending" })
      .eq("id", item.id)
      .eq("status", "pending")
      .select("id");
    if (!claimed || claimed.length === 0) continue;

    let sent = 0;
    for (const sub of subscribers) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({
            title: item.title || "도시공존",
            body: item.body,
            url: item.url || "/",
          }),
        );
        sent++;
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        // 만료·삭제된 구독은 정리 (브로드캐스트 라우트와 동일 규칙)
        if (statusCode === 410 || statusCode === 404) {
          await svc.from("push_subscriptions").delete().eq("id", sub.id);
        }
      }
    }

    const { error: markError } = await svc
      .from("scheduled_pushes")
      .update({
        status: "sent",
        sent_count: sent,
        total_count: subscribers.length,
        sent_at: new Date().toISOString(),
      })
      .eq("id", item.id);
    if (markError) {
      // 발송은 됐는데 기록 실패 — 재발송을 막기 위해 상태는 sending으로 남는다(수동 확인 대상)
      console.error("[cron/scheduled-push] 발송 후 상태 기록 실패:", safePgError(markError), item.id);
    }

    results.push({ id: item.id, sent, total: subscribers.length });
  }

  return Response.json({ ok: true, processed: results.length, results });
}

// Vercel Cron은 GET으로 호출한다 (다른 크론 라우트와 동일 규칙)
export async function GET(request: Request) {
  return POST(request);
}
