import { NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";
import { createClient as createUserClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";

export const maxDuration = 15;

export async function POST(request: Request) {
  const supabase = await createUserClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // 유저당 1시간 3회 — 정상 흐름은 신규 카드 생성 직후 딱 1번만 호출됨.
  // 제한이 없으면 본인 소유 레어/레전드 카드로 이 엔드포인트를 반복 호출해서
  // 같은 동네 유저 전원에게 푸시 알림 스팸을 계속 보낼 수 있었음.
  if (!rateLimit(`rare-alert:${user.id}`, { max: 3, windowMs: 60 * 60 * 1000 })) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const { cat_id } = await request.json();
  if (!cat_id) return NextResponse.json({ error: "missing cat_id" }, { status: 400 });

  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!vapidPublic || !vapidPrivate || !supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: "config" }, { status: 500 });
  }

  const admin = createClient(supabaseUrl, supabaseServiceKey);

  // 고양이 정보 (등록자 본인 것만)
  const { data: cat } = await admin
    .from("cats")
    .select("id,name,region,card_rarity,card_name,caretaker_id")
    .eq("id", cat_id)
    .eq("caretaker_id", user.id)
    .maybeSingle();

  if (!cat) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!["rare", "legendary"].includes(cat.card_rarity ?? "")) {
    return NextResponse.json({ skipped: true });
  }

  // 같은 지역 케어테이커 찾기 (최근 180일 내 고양이 등록한 유저)
  const { data: regionCaretakers } = await admin
    .from("cats")
    .select("caretaker_id")
    .eq("region", cat.region)
    .not("caretaker_id", "is", null)
    .neq("caretaker_id", user.id)
    .gte("created_at", new Date(Date.now() - 180 * 86400_000).toISOString());

  const nearbyUserIds = [...new Set((regionCaretakers ?? []).map(r => r.caretaker_id as string))];

  if (nearbyUserIds.length === 0) return NextResponse.json({ sent: 0 });

  // 구독 정보 조회
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("*")
    .in("user_id", nearbyUserIds);

  if (!subs || subs.length === 0) return NextResponse.json({ sent: 0 });

  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL || "noreply@dosigongzon.com"}`,
    vapidPublic,
    vapidPrivate,
  );

  const rarityEmoji = cat.card_rarity === "legendary" ? "🌟" : "✨";
  const rarityLabel = cat.card_rarity === "legendary" ? "레전드" : "레어";
  const title = `${rarityEmoji} ${rarityLabel} 고양이 출현!`;
  const body = `${cat.region ?? "동네"}에 ${cat.card_name ?? cat.name} 카드가 등장했어요`;

  let sent = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ title, body, url: `/cats/${cat.id}` }),
      );
      sent++;
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number })?.statusCode;
      if (statusCode === 410 || statusCode === 404) {
        await admin.from("push_subscriptions").delete().eq("id", sub.id);
      }
    }
  }

  return NextResponse.json({ sent });
}
