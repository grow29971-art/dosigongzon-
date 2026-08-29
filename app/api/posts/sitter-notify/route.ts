// 돌봄 부탁(sitter) 글 → 같은 동네 활동 유저에게 푸시 1회.
// health-alert-push 크론 선례를 따른다: user_activity_regions.name 정확 일치,
// marketing_push_enabled 동의자만, 상한 20명. 글 작성자 본인이 작성 직후에만 호출 가능.

import webpush from "web-push";
import { createServiceClient } from "@/lib/supabase/service";
import { rateLimit } from "@/lib/rate-limit";

const MAX_RECIPIENTS = 20;
const MAX_POST_AGE_MS = 30 * 60 * 1000; // 작성 후 30분 이내만 (지난 글 재발송 방지)

export async function POST(request: Request) {
  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  if (!vapidPublic || !vapidPrivate) {
    return Response.json({ error: "서버 설정 미완료" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return Response.json({ error: "인증 필요" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.slice(7));
  if (authError || !user) {
    return Response.json({ error: "인증 실패" }, { status: 401 });
  }

  // 유저당 일 2회 — 부탁 글 자체가 드문 이벤트, 재시도 1회 여유만 둔다
  if (!rateLimit(`sitter-notify:${user.id}`, { max: 2, windowMs: 24 * 60 * 60 * 1000 })) {
    return Response.json({ error: "오늘은 더 보낼 수 없어요" }, { status: 429 });
  }

  const { postId } = await request.json();
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (typeof postId !== "string" || !UUID_RE.test(postId)) {
    return Response.json({ error: "postId 형식 오류" }, { status: 400 });
  }

  const { data: post } = await supabase
    .from("posts")
    .select("id, category, author_id, title, region, created_at")
    .eq("id", postId)
    .maybeSingle();

  const p = post as { id: string; category: string; author_id: string | null; title: string; region: string | null; created_at: string } | null;
  if (!p) return Response.json({ error: "글 없음" }, { status: 404 });
  if (p.category !== "sitter") return Response.json({ error: "돌봄 부탁 글이 아니에요" }, { status: 400 });
  if (p.author_id !== user.id) return Response.json({ error: "권한 없음" }, { status: 403 });
  if (Date.now() - new Date(p.created_at).getTime() > MAX_POST_AGE_MS) {
    return Response.json({ error: "작성 직후에만 알릴 수 있어요" }, { status: 400 });
  }
  const region = p.region?.trim();
  if (!region) return Response.json({ sent: 0, reason: "no region" });

  // 같은 동네 활동 유저 (크론과 동일: name 정확 일치)
  const { data: nearby } = await supabase
    .from("user_activity_regions")
    .select("user_id")
    .eq("name", region);
  const candidateIds = new Set(((nearby ?? []) as { user_id: string }[]).map((r) => r.user_id));
  candidateIds.delete(user.id);
  if (candidateIds.size === 0) return Response.json({ sent: 0, reason: "no neighbors" });

  // 마케팅 푸시 동의자만
  const { data: optedIn } = await supabase
    .from("profiles")
    .select("id")
    .eq("marketing_push_enabled", true)
    .in("id", Array.from(candidateIds).slice(0, 200));
  const targets = ((optedIn ?? []) as { id: string }[]).map((r) => r.id).slice(0, MAX_RECIPIENTS);
  if (targets.length === 0) return Response.json({ sent: 0, reason: "no opted-in neighbors" });

  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("user_id, endpoint, p256dh, auth")
    .in("user_id", targets);
  if (!subs || subs.length === 0) return Response.json({ sent: 0, reason: "no subscriptions" });

  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL || "noreply@dosigongzon.com"}`,
    vapidPublic,
    vapidPrivate,
  );

  const title = `🤝 ${region} 돌봄 부탁`;
  const body = p.title.length > 60 ? p.title.slice(0, 60) + "…" : p.title;
  const url = `/community/${p.id}`;

  let sent = 0;
  let failed = 0;
  for (const sub of subs as { endpoint: string; p256dh: string; auth: string }[]) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ title, body, url }),
      );
      sent++;
      await new Promise((r) => setTimeout(r, 60));
    } catch (err: unknown) {
      failed++;
      const statusCode = (err as { statusCode?: number })?.statusCode;
      if (statusCode === 410 || statusCode === 404) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      }
    }
  }

  return Response.json({ sent, failed, neighbors: targets.length });
}
