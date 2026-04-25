// 온보딩 너지 — 가입 후 7일+ / 고양이 0마리 유저에게 첫 등록 유도 푸시.
// Vercel Cron 매주 토요일 11:00 KST (02:00 UTC).
// "행동을 안 한 유저"에게만 푸시 → 일반 broadcast보다 클릭률·전환 ↑

import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 300;

const STALE_DAYS = 7;
const MAX_DAYS = 30; // 30일 넘은 유저는 이미 이탈 → 푸시 생략 (스팸 방지)

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

  // 1) 가입 7~30일 + marketing_push_enabled=true 유저
  const since = new Date(Date.now() - MAX_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const before = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data: candidates } = await supabase
    .from("profiles")
    .select("id, created_at")
    .eq("marketing_push_enabled", true)
    .gte("created_at", since)
    .lte("created_at", before);
  const candidateIds = ((candidates ?? []) as { id: string }[]).map((c) => c.id);
  if (candidateIds.length === 0) {
    return Response.json({ ok: true, sent: 0, reason: "no candidates" });
  }

  // 2) 그 중 고양이 0마리인 유저만 추림
  const { data: caretakerCats } = await supabase
    .from("cats")
    .select("caretaker_id")
    .in("caretaker_id", candidateIds);
  const haveCatsSet = new Set(
    ((caretakerCats ?? []) as { caretaker_id: string | null }[])
      .map((c) => c.caretaker_id)
      .filter((v): v is string => !!v),
  );
  const targetIds = candidateIds.filter((id) => !haveCatsSet.has(id));
  if (targetIds.length === 0) {
    return Response.json({ ok: true, sent: 0, reason: "all candidates have cats" });
  }

  // 3) 그 중 push_subscriptions 있는 유저
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("*")
    .in("user_id", targetIds);
  const subsArr = (subs ?? []) as Array<{
    id: string; user_id: string; endpoint: string; p256dh: string; auth: string;
  }>;
  if (subsArr.length === 0) {
    return Response.json({ ok: true, sent: 0, reason: "no subscriptions" });
  }

  // 4) 발송
  const title = "🐾 도시공존";
  const body = "동네 캣맘·캣대디들이 기다리고 있어요. 첫 길고양이 등록은 1분이면 끝나요.";
  const url = "/map";

  let sent = 0;
  let failed = 0;
  for (const sub of subsArr) {
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
    candidates: candidateIds.length,
    targets: targetIds.length,
    sent,
    failed,
  });
}

export const GET = POST;
