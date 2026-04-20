import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";
import { rateLimit } from "@/lib/rate-limit";

/**
 * 푸시 발송. 인증된 유저가 호출하지만 수신자와 발신자 사이에
 * 합법적 관계(내 고양이 돌봄/댓글, 내 쪽지, 내 커뮤니티 댓글)가 있을 때만 허용.
 * 임의 스팸·피싱 푸시 방어.
 */
export async function POST(request: Request) {
  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!vapidPublic || !vapidPrivate || !supabaseUrl || !supabaseServiceKey) {
    return Response.json({ error: "서버 설정 미완료" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return Response.json({ error: "인증 필요" }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const token = authHeader.slice(7);
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return Response.json({ error: "인증 실패" }, { status: 401 });
  }

  // Rate limit: 발신자당 분당 30건
  if (!rateLimit(`push:${user.id}`, { max: 30, windowMs: 60_000 })) {
    return Response.json({ error: "요청이 너무 많아요" }, { status: 429 });
  }

  const { userId, title, body, url } = await request.json();
  if (!userId || !body) {
    return Response.json({ error: "userId, body 필수" }, { status: 400 });
  }

  // 자기 자신에게 푸시는 OK (시스템/테스트)
  // 타인에게 푸시는 관계 검증 필수
  if (userId !== user.id) {
    const allowed = await hasLegitRelation(supabase, user.id, userId);
    if (!allowed) {
      return Response.json({ error: "권한 없음" }, { status: 403 });
    }
  }

  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL || "noreply@dosigongzon.com"}`,
    vapidPublic,
    vapidPrivate,
  );

  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("*")
    .eq("user_id", userId);

  if (!subs || subs.length === 0) {
    return Response.json({ sent: 0 });
  }

  let sent = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ title: title || "도시공존", body, url: url || "/messages" }),
      );
      sent++;
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number })?.statusCode;
      if (statusCode === 410 || statusCode === 404) {
        await supabase.from("push_subscriptions").delete().eq("id", sub.id);
      }
    }
  }

  return Response.json({ sent });
}

/**
 * senderId가 recipientId에게 푸시를 보낼 수 있는 정당한 맥락이 있는지 확인.
 * 최근 24시간 내 다음 중 하나 성립 시 허용:
 * - 내가 소유한 고양이에 recipient가 댓글/돌봄/경보를 남겼음 → 반대로 내가 알림 보낼 수 있음(돌봄·댓글 상호)
 * - senderId가 소유한 고양이에 recipient가 댓글/돌봄/경보를 남겼음 → sender가 recipient에게 답변 형식으로 push
 *   (이 케이스는 "내 고양이 주인(recipient) 대상 알림"과 동일: sender의 고양이면 자기 자신)
 * - recipient가 소유한 고양이에 sender가 댓글/돌봄/경보를 남겼음 → 정당한 trigger
 * - 최근 24시간 내 sender가 recipient에게 DM 전송
 * - 최근 24시간 내 sender가 recipient의 커뮤니티 글에 댓글 남김
 * - 초대 이벤트 (sender가 recipient를 초대했거나 반대)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function hasLegitRelation(
  supabase: any,
  senderId: string,
  recipientId: string,
): Promise<boolean> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // recipient 소유 고양이
  const { data: recipientCats } = await supabase
    .from("cats")
    .select("id")
    .eq("caretaker_id", recipientId);
  const recipientCatIds = (recipientCats ?? []).map((c: { id: string }) => c.id);

  if (recipientCatIds.length > 0) {
    // sender가 최근에 recipient 고양이에 댓글/돌봄 남겼나?
    const [{ count: cc }, { count: cl }] = await Promise.all([
      supabase
        .from("cat_comments")
        .select("*", { count: "exact", head: true })
        .in("cat_id", recipientCatIds)
        .eq("author_id", senderId)
        .gte("created_at", since),
      supabase
        .from("care_logs")
        .select("*", { count: "exact", head: true })
        .in("cat_id", recipientCatIds)
        .eq("author_id", senderId)
        .gte("created_at", since),
    ]);
    if ((cc ?? 0) > 0 || (cl ?? 0) > 0) return true;
  }

  // sender가 최근 recipient에게 DM 보냈나?
  const { count: dmCount } = await supabase
    .from("direct_messages")
    .select("*", { count: "exact", head: true })
    .eq("sender_id", senderId)
    .eq("receiver_id", recipientId)
    .gte("created_at", since);
  if ((dmCount ?? 0) > 0) return true;

  // recipient 소유 게시글에 sender가 최근 댓글
  const { data: recipientPosts } = await supabase
    .from("posts")
    .select("id")
    .eq("author_id", recipientId);
  const recipientPostIds = (recipientPosts ?? []).map((p: { id: string }) => p.id);
  if (recipientPostIds.length > 0) {
    const { count: pc } = await supabase
      .from("post_comments")
      .select("*", { count: "exact", head: true })
      .in("post_id", recipientPostIds)
      .eq("author_id", senderId)
      .gte("created_at", since);
    if ((pc ?? 0) > 0) return true;
  }

  // 초대 관계 (양방향)
  const { count: inviteCount } = await supabase
    .from("invite_events")
    .select("*", { count: "exact", head: true })
    .or(
      `and(inviter_id.eq.${senderId},invitee_id.eq.${recipientId}),and(inviter_id.eq.${recipientId},invitee_id.eq.${senderId})`,
    );
  if ((inviteCount ?? 0) > 0) return true;

  return false;
}
