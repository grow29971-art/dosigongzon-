// 주간 회고 디지털 엽서 푸시 — 일요일 11:00 UTC = 일요일 20:00 KST.
// 잔잔한 시적 톤으로 한 주 활동을 정리해 보냅니다.
// 마케팅 푸시 동의자만 대상.

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

  // 이번 주 KST 월요일 00:00 → UTC
  const kstNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const day = kstNow.getDay();
  const daysFromMonday = (day + 6) % 7;
  const mondayKst = new Date(kstNow);
  mondayKst.setDate(mondayKst.getDate() - daysFromMonday);
  mondayKst.setHours(0, 0, 0, 0);
  const weekStartUtc = new Date(mondayKst.getTime() - 9 * 60 * 60 * 1000).toISOString();

  // 마케팅 푸시 동의자만
  const { data: optedIn } = await supabase
    .from("profiles")
    .select("id")
    .eq("marketing_push_enabled", true);
  const optedIds = ((optedIn ?? []) as { id: string }[]).map((p) => p.id);
  if (optedIds.length === 0) {
    return Response.json({ ok: true, sent: 0, reason: "no opt-in users" });
  }

  // 푸시 구독 인덱싱
  const { data: subsAll } = await supabase
    .from("push_subscriptions")
    .select("user_id, endpoint, p256dh, auth")
    .in("user_id", optedIds);
  const subsByUser = new Map<string, Array<{ endpoint: string; p256dh: string; auth: string }>>();
  for (const s of (subsAll ?? []) as { user_id: string; endpoint: string; p256dh: string; auth: string }[]) {
    if (!subsByUser.has(s.user_id)) subsByUser.set(s.user_id, []);
    subsByUser.get(s.user_id)!.push({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth });
  }
  const targetIds = optedIds.filter((id) => subsByUser.has(id));
  if (targetIds.length === 0) {
    return Response.json({ ok: true, sent: 0, reason: "no subscribers" });
  }

  // 이번 주 활동 일괄 조회 (전체 유저 한 번에)
  const [careLogsRes, commentsRes] = await Promise.all([
    supabase
      .from("care_logs")
      .select("author_id, cat_id, logged_at")
      .in("author_id", targetIds)
      .gte("logged_at", weekStartUtc),
    supabase
      .from("cat_comments")
      .select("author_id")
      .in("author_id", targetIds)
      .gte("created_at", weekStartUtc),
  ]);

  type CareRow = { author_id: string; cat_id: string };
  type CommentRow = { author_id: string };

  // user별 집계
  const byUser = new Map<string, { careCount: number; uniqueCats: Map<string, number>; commentCount: number }>();
  for (const id of targetIds) {
    byUser.set(id, { careCount: 0, uniqueCats: new Map(), commentCount: 0 });
  }
  for (const r of (careLogsRes.data ?? []) as CareRow[]) {
    const u = byUser.get(r.author_id);
    if (!u) continue;
    u.careCount++;
    u.uniqueCats.set(r.cat_id, (u.uniqueCats.get(r.cat_id) ?? 0) + 1);
  }
  for (const r of (commentsRes.data ?? []) as CommentRow[]) {
    const u = byUser.get(r.author_id);
    if (u) u.commentCount++;
  }

  // 가장 자주 만난 고양이 이름 일괄 조회
  const allCatIds = new Set<string>();
  byUser.forEach((u) => {
    let topId: string | null = null;
    let topCount = 0;
    u.uniqueCats.forEach((cnt, id) => {
      if (cnt > topCount) {
        topId = id;
        topCount = cnt;
      }
    });
    if (topId) allCatIds.add(topId);
  });
  const catNameMap = new Map<string, string>();
  if (allCatIds.size > 0) {
    const { data: catsRes } = await supabase
      .from("cats")
      .select("id, name")
      .in("id", Array.from(allCatIds));
    for (const c of (catsRes ?? []) as { id: string; name: string }[]) {
      catNameMap.set(c.id, c.name);
    }
  }

  // 메시지 빌더 — 활동 강도별 톤 다르게
  function buildMessage(
    care: number,
    cats: number,
    topCatName: string | null,
    comments: number,
  ): { title: string; body: string } | null {
    if (care === 0 && cats === 0 && comments === 0) {
      // 활동 0 — 잔잔하게 안부만
      return {
        title: "🌙 이번 주, 잠시 쉬셨네요",
        body: "다음 주 동네에서 다시 만나요. 친구들이 기다리고 있어요.",
      };
    }
    const top = topCatName ? `${topCatName}이(가) 가장 자주 발걸음을 멈춘 자리였어요. ` : "";
    if (care + comments < 4) {
      return {
        title: "🌙 조용한 한 주였어요",
        body: `${top}작은 발걸음 하나하나가 동네에 따스한 흔적을 남겼어요.`,
      };
    }
    if (care + comments < 10) {
      return {
        title: "🌙 꾸준한 한 주",
        body: care > 0
          ? `${care}번의 돌봄으로 ${cats}마리 친구를 챙기셨어요. ${top}수고 많으셨어요.`
          : `${comments}번의 응원이 동네에 흩어졌어요. 다음 주에도 함께해요.`,
      };
    }
    if (care + comments < 25) {
      return {
        title: "🌙 정말 많이 다녀오셨어요",
        body: `${care}번의 돌봄·${comments}개의 댓글. ${top}당신의 발걸음이 동네의 안전망이 됐어요.`,
      };
    }
    return {
      title: "🌙 이번 주의 등불",
      body: `${care}번의 돌봄과 ${comments}개의 응원. ${top}당신 덕분에 동네가 따뜻한 곳으로 바뀌고 있어요.`,
    };
  }

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const uid of targetIds) {
    const stats = byUser.get(uid)!;
    let topCatId: string | null = null;
    let topCount = 0;
    stats.uniqueCats.forEach((cnt, id) => {
      if (cnt > topCount) {
        topId: id;
        topCatId = id;
        topCount = cnt;
      }
    });
    const topCatName = topCatId ? (catNameMap.get(topCatId) ?? null) : null;

    const msg = buildMessage(stats.careCount, stats.uniqueCats.size, topCatName, stats.commentCount);
    if (!msg) {
      skipped++;
      continue;
    }

    const subs = subsByUser.get(uid) ?? [];
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ title: msg.title, body: msg.body, url: "/mypage/journey" }),
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
  }

  return Response.json({
    ok: true,
    targets: targetIds.length,
    sent,
    failed,
    skipped,
    weekStart: weekStartUtc,
  });
}

export const GET = POST;
