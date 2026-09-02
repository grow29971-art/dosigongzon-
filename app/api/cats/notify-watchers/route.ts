// 하트(지켜보기) 소식 푸시 — 돌봄 기록이 남으면 그 고양이에 하트 누른 유저들에게 push.
// POST 본문: { catId, careType }
// 인증: Bearer 토큰. 구조는 /api/circle/notify-message 패턴을 따른다.
//
// 위조 방지: 호출자가 이 고양이에 "방금(5분 내) 실제 돌봄 기록"을 남겼는지 서버에서 검증.
// 이게 없으면 아무 계정이나 임의 catId로 하트 유저들에게 가짜 알림을 뿌릴 수 있다.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";
import webpush from "web-push";
import { rateLimit } from "@/lib/rate-limit";

const VAPID_PUBLIC = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "").trim();
const VAPID_PRIVATE = (process.env.VAPID_PRIVATE_KEY ?? "").trim();
const VAPID_SUBJECT = (process.env.VAPID_SUBJECT ?? "mailto:grow29971@gmail.com").trim();
const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
}

const CARE_LABEL: Record<string, string> = {
  feed: "밥", water: "물", treat: "간식", health: "건강 체크",
  tnr: "TNR", hospital: "병원 방문", shelter: "쉼터 관리", other: "돌봄",
};

export async function POST(req: Request) {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE || !SUPABASE_URL || !SERVICE_KEY) {
    return NextResponse.json({ ok: false, error: "env missing" }, { status: 500 });
  }

  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const token = auth.slice(7);

  let body: { catId?: string; careType?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }
  const catId = body.catId?.trim();
  if (!catId) {
    return NextResponse.json({ ok: false, error: "catId required" }, { status: 400 });
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

  // 유저당 분당 6회 + 고양이당 3시간 2회 — 같은 아이 밥·물·간식 연타로 하트 유저에게
  // 푸시가 몰리는 걸 막는다 (인메모리라 인스턴스 경계는 느슨하지만 볼륨이 작아 충분).
  if (!rateLimit(`cat-watch-notify:user:${senderId}`, { max: 6, windowMs: 60 * 1000 })) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }
  if (!rateLimit(`cat-watch-notify:cat:${catId}`, { max: 2, windowMs: 3 * 60 * 60 * 1000 })) {
    return NextResponse.json({ ok: true, sent: 0, skipped: "cat_cooldown" });
  }

  const admin = createServiceClient();

  // 위조 방지 — 5분 내 실제 돌봄 기록(비밀글 제외) 존재 검증
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data: recentLog } = await admin
    .from("care_logs")
    .select("id, care_type, author_name")
    .eq("cat_id", catId)
    .eq("author_id", senderId)
    .gte("created_at", fiveMinAgo)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!recentLog) {
    return NextResponse.json({ ok: false, error: "no_recent_care_log" }, { status: 403 });
  }

  // 고양이 확인 — 공개 고양이만 (비공개·서클 전환된 아이의 소식은 밖으로 내보내지 않음)
  const { data: catRow } = await admin
    .from("cats")
    .select("id, name, visibility, caretaker_id, memorial_at")
    .eq("id", catId)
    .maybeSingle();
  const cat = catRow as { id: string; name: string | null; visibility: string | null; caretaker_id: string | null; memorial_at: string | null } | null;
  if (!cat) {
    return NextResponse.json({ ok: false, error: "cat not found" }, { status: 404 });
  }
  if ((cat.visibility ?? "public") !== "public" || cat.memorial_at) {
    return NextResponse.json({ ok: true, sent: 0, skipped: "not_public" });
  }

  // 수신자: 하트 누른 유저 − 기록 작성자 − 주인(주인은 기존 소유자 알림이 따로 감)
  const { data: likeRows } = await admin
    .from("cat_likes")
    .select("user_id")
    .eq("cat_id", catId);
  const watcherIds = Array.from(
    new Set(((likeRows ?? []) as { user_id: string }[]).map((r) => r.user_id)),
  ).filter((id) => id !== senderId && id !== cat.caretaker_id);
  if (watcherIds.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, total: 0 });
  }

  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth")
    .in("user_id", watcherIds);

  type Sub = { id: string; user_id: string; endpoint: string; p256dh: string; auth: string };
  const subList = (subs ?? []) as Sub[];

  const log = recentLog as { care_type: string | null; author_name: string | null };
  const careType = body.careType?.trim() || log.care_type || "other";
  const label = CARE_LABEL[careType] ?? "돌봄";
  const authorName = log.author_name ?? "이웃";
  const catName = cat.name ?? "지켜보는 아이";

  const title = `❤️ ${catName} 소식`;
  const msg = `${authorName}님이 ${catName}에게 ${label}을 챙겨줬어요.`;
  const url = `/cats/${catId}`;
  let sent = 0;
  let failed = 0;

  for (const sub of subList) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ title, body: msg, url }),
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
