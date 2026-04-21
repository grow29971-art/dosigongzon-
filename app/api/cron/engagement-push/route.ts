// 주기적 재참여 푸시 — Vercel Cron 매주 수요일 19:00 KST (10:00 UTC)
// 이번 주 동네 활동 요약을 전체 구독자에게 broadcast

import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

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

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // 이번 주 신규 고양이·긴급 돌봄 수 집계
  const [newCatsRes, urgentRes] = await Promise.all([
    supabase.from("cats").select("*", { count: "exact", head: true }).gte("created_at", weekAgo),
    supabase.from("cats").select("*", { count: "exact", head: true }).eq("health_status", "danger"),
  ]);

  const newCats = newCatsRes.count ?? 0;
  const urgent = urgentRes.count ?? 0;

  // 메시지 선택 — 콘텐츠가 부족한 날에도 적절한 CTA
  const title = "🐾 도시공존";
  const body = urgent > 0 && newCats > 0
    ? `이번 주 새 고양이 ${newCats}마리 · 지금 도움이 필요한 아이 ${urgent}마리. 동네 한번 들러주세요.`
    : newCats > 0
    ? `이번 주 동네에 새 친구 ${newCats}마리가 등록됐어요. 안부 보러 오실래요?`
    : urgent > 0
    ? `지금 도움이 필요한 아이 ${urgent}마리. 한 번 둘러봐주세요 💛`
    : `오늘도 아이들을 챙겨주셔서 감사해요. 지도에서 새 소식 확인하러 가볼까요?`;

  const url = "/map";

  // 마케팅 푸시 동의한 유저만 대상 (정보통신망법 옵트인)
  const { data: optedIn } = await supabase
    .from("profiles")
    .select("id")
    .eq("marketing_push_enabled", true);
  const optedInIds = new Set(((optedIn ?? []) as { id: string }[]).map((p) => p.id));
  if (optedInIds.size === 0) {
    return Response.json({ ok: true, sent: 0, total: 0, reason: "no opt-in users" });
  }

  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("*")
    .in("user_id", Array.from(optedInIds));
  if (!subs || subs.length === 0) {
    return Response.json({ ok: true, sent: 0, total: 0, reason: "no subscribers" });
  }

  let sent = 0;
  let failed = 0;
  for (const sub of subs as Array<{ id: string; endpoint: string; p256dh: string; auth: string }>) {
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
    total: subs.length,
    sent,
    failed,
    snapshot: { newCats, urgent },
    message: body,
  });
}

// Vercel Cron은 GET으로 호출할 수도 있음
export const GET = POST;
