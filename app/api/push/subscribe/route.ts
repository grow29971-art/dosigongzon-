import { createClient } from "@/lib/supabase/server";

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
