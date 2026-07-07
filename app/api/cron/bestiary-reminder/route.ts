// 도감(PVE 컬렉션) 재접속 알림 — Vercel Cron 매주 화요일 19:00 KST (10:00 UTC)
// 카드가 있는데(=이미 배틀 시스템을 발견한) 도감을 아직 다 못 채운 유저에게,
// 남은 미발견 종 수를 알려줘서 재접속 동기를 만든다. 다 채운 유저는 대상에서 제외.

import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 300;

const TOTAL_BESTIARY = 23; // PVE_BESTIARY 22종 + 보스 1 (lib/pve-bestiary.ts와 동기화 유지)

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

  // 1. 마케팅 푸시 동의 + 도감 컬럼 보유 유저(마이그레이션 전이면 컬럼 자체가 없어 빈 배열로 옴)
  const { data: optedIn, error: profileErr } = await supabase
    .from("profiles")
    .select("id,pve_seen_keys")
    .eq("marketing_push_enabled", true);
  if (profileErr) {
    // box/supabase_pve_bestiary_migration.sql 실행 전이면 컬럼이 없어 여기서 에러 — 조용히 스킵
    return Response.json({ ok: true, sent: 0, reason: "bestiary columns not migrated yet" });
  }
  const rows = (optedIn ?? []) as { id: string; pve_seen_keys: string[] | null }[];

  // 2. 카드(=배틀 시스템 발견 이력) 있는 유저만 추림
  const { data: catOwners } = await supabase
    .from("cats")
    .select("caretaker_id")
    .not("card_generated_at", "is", null)
    .not("caretaker_id", "is", null);
  const catOwnerIds = new Set(((catOwners ?? []) as { caretaker_id: string }[]).map((c) => c.caretaker_id));

  // 3. 대상: 카드 보유 + 도감 미완성(23종 중 일부만 발견)
  const targets = rows.filter((r) => catOwnerIds.has(r.id) && (r.pve_seen_keys?.length ?? 0) < TOTAL_BESTIARY);
  if (targets.length === 0) {
    return Response.json({ ok: true, sent: 0, reason: "no incomplete-bestiary users" });
  }
  const remainingByUser = new Map(targets.map((r) => [r.id, TOTAL_BESTIARY - (r.pve_seen_keys?.length ?? 0)]));

  // 4. 구독 조회 + 발송
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("*")
    .in("user_id", targets.map((t) => t.id));
  if (!subs || subs.length === 0) {
    return Response.json({ ok: true, sent: 0, targets: targets.length, reason: "no subscribers" });
  }

  let sent = 0;
  let failed = 0;
  for (const sub of subs as Array<{ id: string; user_id: string; endpoint: string; p256dh: string; auth: string }>) {
    const remaining = remainingByUser.get(sub.user_id) ?? 0;
    if (remaining <= 0) continue;
    const title = `🐾 아직 못 만난 동네 불청객 ${remaining}마리`;
    const body = remaining <= 3
      ? `도감 완성까지 ${remaining}마리 남았어요! 배틀 몇 판이면 채울 수 있어요.`
      : `동네 도감이 아직 ${remaining}마리 비어있어요. PVE 배틀로 채워보세요.`;
    const url = "/mypage/cards";

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

  return Response.json({ ok: true, targets: targets.length, subscribers: subs.length, sent, failed });
}

// Vercel Cron은 GET으로 호출할 수도 있음
export const GET = POST;
