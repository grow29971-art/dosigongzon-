import { createClient } from "@/lib/supabase/server";

// 저장된 endpoint는 서버가 webpush.sendNotification()으로 POST하는 대상이 된다.
// 검증 없이 저장하면 내부망(127.0.0.1, 169.254.169.254 등)으로 향하는 Stored SSRF가
// 되므로, https + 실제 푸시 서비스 호스트만 허용한다.
const PUSH_HOST_SUFFIXES = [
  ".googleapis.com",              // FCM (fcm.googleapis.com)
  ".push.services.mozilla.com",   // Firefox (updates.push.services.mozilla.com)
  ".notify.windows.com",          // WNS (Edge/Windows)
  ".push.apple.com",              // Safari/APNs
];

function isAllowedPushEndpoint(endpoint: string): boolean {
  let u: URL;
  try {
    u = new URL(endpoint);
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false;
  const host = u.hostname.toLowerCase();
  return PUSH_HOST_SUFFIXES.some((s) => host === s.slice(1) || host.endsWith(s));
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "로그인 필요" }, { status: 401 });

  let subscription: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  try {
    ({ subscription } = await request.json());
  } catch {
    return Response.json({ error: "잘못된 요청" }, { status: 400 });
  }
  if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
    return Response.json({ error: "잘못된 구독" }, { status: 400 });
  }
  if (!isAllowedPushEndpoint(subscription.endpoint)) {
    return Response.json({ error: "지원하지 않는 푸시 엔드포인트예요." }, { status: 400 });
  }

  const { error } = await supabase.from("push_subscriptions").upsert({
    user_id: user.id,
    endpoint: subscription.endpoint,
    p256dh: subscription.keys.p256dh,
    auth: subscription.keys.auth,
  }, { onConflict: "user_id,endpoint" });

  // DB 에러 원문은 서버 로그로만 — 클라이언트에 내부 구조 노출 금지
  if (error) {
    console.error("[push/subscribe] upsert 실패:", error.message);
    return Response.json({ error: "구독 저장 실패" }, { status: 500 });
  }
  return Response.json({ success: true });
}
