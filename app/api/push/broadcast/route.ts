import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!vapidPublic || !vapidPrivate || !supabaseUrl || !supabaseServiceKey) {
    return Response.json({ error: "서버 설정 미완료" }, { status: 500 });
  }

  // 관리자 인증
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return Response.json({ error: "인증 필요" }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // 토큰으로 유저 확인
  const token = authHeader.slice(7);
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return Response.json({ error: "인증 실패" }, { status: 401 });
  }

  // 관리자 확인
  const { data: admin } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!admin) {
    return Response.json({ error: "관리자 권한 필요" }, { status: 403 });
  }

  const { title, body, url } = await request.json();
  if (!body) {
    return Response.json({ error: "body 필수" }, { status: 400 });
  }

  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL || "noreply@dosigongzon.com"}`,
    vapidPublic,
    vapidPrivate,
  );

  // 전체 구독자 조회
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("*");

  if (!subs || subs.length === 0) {
    return Response.json({ sent: 0, total: 0 });
  }

  let sent = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ title: title || "도시공존", body, url: url || "/" }),
      );
      sent++;
    } catch (err: any) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        await supabase.from("push_subscriptions").delete().eq("id", sub.id);
      }
    }
  }

  return Response.json({ sent, total: subs.length });
}
