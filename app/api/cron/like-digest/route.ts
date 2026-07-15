// 좋아요 묶음 알림 — Vercel Cron 매일 12:00 KST (03:00 UTC)
// 어제 이후 늘어난 좋아요를 작성자별로 묶어서 푸시 1개씩 발송.
// 발송 후 posts.like_count_snapshot을 현재 like_count로 갱신.

import webpush from "web-push";
import { createServiceClient } from "@/lib/supabase/service";

export const maxDuration = 300;

interface PostRow {
  id: string;
  title: string;
  author_id: string;
  like_count: number;
  like_count_snapshot: number;
}

interface PushSub {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

async function handle(request: Request): Promise<Response> {
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

  // 좋아요가 늘어난 글들 (저자 있음, 숨김 아님)
  const { data: postsRaw } = await supabase
    .from("posts")
    .select("id, title, author_id, like_count, like_count_snapshot")
    .not("author_id", "is", null)
    .eq("hidden", false);

  const candidates: PostRow[] = (postsRaw as PostRow[] | null ?? []).filter(
    (p) => p.like_count > p.like_count_snapshot,
  );

  if (candidates.length === 0) {
    return Response.json({ ok: true, candidates: 0, recipients: 0, sent: 0 });
  }

  // 작성자별 그룹화
  const byAuthor = new Map<
    string,
    { posts: PostRow[]; deltaTotal: number }
  >();
  for (const p of candidates) {
    const delta = p.like_count - p.like_count_snapshot;
    const cur = byAuthor.get(p.author_id) ?? { posts: [], deltaTotal: 0 };
    cur.posts.push(p);
    cur.deltaTotal += delta;
    byAuthor.set(p.author_id, cur);
  }

  // 푸시 구독 조회
  const authorIds = Array.from(byAuthor.keys());
  const { data: subsRaw } = await supabase
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth")
    .in("user_id", authorIds);
  const subsByUser = new Map<string, PushSub[]>();
  for (const s of (subsRaw as PushSub[] | null) ?? []) {
    const arr = subsByUser.get(s.user_id) ?? [];
    arr.push(s);
    subsByUser.set(s.user_id, arr);
  }

  let sent = 0;
  let failed = 0;
  let recipients = 0;

  for (const [authorId, info] of byAuthor.entries()) {
    const subs = subsByUser.get(authorId);
    if (!subs || subs.length === 0) continue;
    recipients++;

    const postCount = info.posts.length;
    const deltaTotal = info.deltaTotal;
    const single = postCount === 1 ? info.posts[0] : null;

    const title = "❤️ 도시공존";
    const body =
      single
        ? `"${truncate(single.title, 40)}" 글에 새 좋아요 ${deltaTotal}개가 달렸어요`
        : `내 글 ${postCount}개에 새 좋아요 ${deltaTotal}개가 달렸어요`;
    const url = single ? `/community/${single.id}` : `/mypage`;

    for (const sub of subs) {
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
  }

  // 발송 결과 무관하게 스냅샷은 갱신 (다음 사이클에서 같은 좋아요로 두 번 알림 안 가도록)
  const nowIso = new Date().toISOString();
  for (const p of candidates) {
    await supabase
      .from("posts")
      .update({
        like_count_snapshot: p.like_count,
        like_snapshot_at: nowIso,
      })
      .eq("id", p.id);
  }

  return Response.json({
    ok: true,
    candidates: candidates.length,
    recipients,
    sent,
    failed,
  });
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

export async function POST(request: Request) {
  return handle(request);
}

export async function GET(request: Request) {
  return handle(request);
}
