// Circle 채팅 새 메시지 알림 — 다른 멤버에게 push.
// POST 본문: { circleId, messagePreview }
// 인증: Bearer 토큰 (사용자가 본인 메시지 알림 트리거)

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

const VAPID_PUBLIC = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "").trim();
const VAPID_PRIVATE = (process.env.VAPID_PRIVATE_KEY ?? "").trim();
const VAPID_SUBJECT = (process.env.VAPID_SUBJECT ?? "mailto:grow29971@gmail.com").trim();
const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
}

export async function POST(req: Request) {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE || !SUPABASE_URL || !SERVICE_KEY) {
    return NextResponse.json({ ok: false, error: "env missing" }, { status: 500 });
  }

  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const token = auth.slice(7);

  // 본문
  let body: { circleId?: string; messagePreview?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }
  const circleId = body.circleId?.trim();
  const preview = body.messagePreview?.trim() || "새 메시지";
  if (!circleId) {
    return NextResponse.json({ ok: false, error: "circleId required" }, { status: 400 });
  }

  // 호출 유저 확인
  const userClient = createClient(SUPABASE_URL, SERVICE_KEY, {
    global: { headers: { Authorization: auth } },
  });
  const { data: userRes } = await userClient.auth.getUser(token);
  const senderId = userRes.user?.id;
  if (!senderId) {
    return NextResponse.json({ ok: false, error: "auth failed" }, { status: 401 });
  }

  // 서비스 키로 멤버 + 푸시 구독 조회 (RLS 우회 가능 — 본인 메시지 알림이라 안전)
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // 서클의 owner와 accepted 멤버 모두 조회 (sender 제외)
  const [{ data: circleRow }, { data: members }] = await Promise.all([
    admin.from("caretaker_circles").select("owner_id").eq("id", circleId).maybeSingle(),
    admin
      .from("circle_members")
      .select("member_id")
      .eq("circle_id", circleId)
      .eq("status", "accepted"),
  ]);

  if (!circleRow) {
    return NextResponse.json({ ok: false, error: "circle not found" }, { status: 404 });
  }
  const ownerId = (circleRow as { owner_id: string }).owner_id;
  const memberIds = ((members ?? []) as { member_id: string }[]).map((m) => m.member_id);
  const allUserIds = Array.from(new Set([ownerId, ...memberIds])).filter((id) => id !== senderId);
  if (allUserIds.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, total: 0 });
  }

  // 발신자 닉네임
  const { data: senderProfile } = await admin
    .from("profiles")
    .select("nickname")
    .eq("id", senderId)
    .maybeSingle();
  const senderName = (senderProfile as { nickname: string | null } | null)?.nickname ?? "이웃";

  // 멤버 푸시 구독 조회 (서클 채팅 알림은 서비스 필수 알림 — 마케팅 동의 불필요)
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth")
    .in("user_id", allUserIds);

  type Sub = { id: string; user_id: string; endpoint: string; p256dh: string; auth: string };
  const subList = (subs ?? []) as Sub[];

  const title = `🛡 ${senderName}님이 서클에 메시지`;
  const url = `/circle/${circleId}/chat`;
  let sent = 0;
  let failed = 0;

  for (const sub of subList) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ title, body: preview, url }),
      );
      sent++;
      await new Promise((r) => setTimeout(r, 50));
    } catch (err: unknown) {
      failed++;
      const statusCode = (err as { statusCode?: number })?.statusCode;
      if (statusCode === 410 || statusCode === 404) {
        await admin.from("push_subscriptions").delete().eq("id", sub.id);
      }
    }
  }

  return NextResponse.json({ ok: true, sent, failed, total: subList.length });
}
