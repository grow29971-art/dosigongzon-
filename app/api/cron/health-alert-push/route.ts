// 위급 고양이 자동 알림 — Vercel Cron 매일 15:00 KST (06:00 UTC).
// health_status caution/danger 고양이 중 최근 3일 돌봄 없는 아이를
// 같은 동네 활동 유저에게 푸시. 마케팅 푸시 동의 유저만.

import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 300;

const STALE_DAYS = 3; // 마지막 돌봄이 N일 넘으면 위험
const MAX_CATS_PER_RUN = 30; // 1회 실행에서 다룰 위급 고양이 상한
const MAX_USERS_PER_CAT = 20; // 고양이 1마리당 알림 받는 동네 유저 상한
const DEDUP_HOURS = 24; // 같은 (user, cat) 페어로 N시간 내 중복 푸시 차단

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
  const staleAt = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // 1) 위급 상태 고양이
  const { data: cats } = await supabase
    .from("cats")
    .select("id, name, region, health_status, caretaker_id")
    .in("health_status", ["caution", "danger"])
    .not("region", "is", null)
    .order("created_at", { ascending: false })
    .limit(MAX_CATS_PER_RUN * 3);

  if (!cats || cats.length === 0) {
    return Response.json({ ok: true, reason: "no urgent cats", sent: 0 });
  }

  // 2) 각 고양이의 마지막 돌봄 시각 — stale한 것만 통과
  const catIds = (cats as { id: string }[]).map((c) => c.id);
  const { data: lastCares } = await supabase
    .from("care_logs")
    .select("cat_id, logged_at")
    .in("cat_id", catIds)
    .order("logged_at", { ascending: false });

  const lastCareByCat = new Map<string, string>();
  for (const r of (lastCares ?? []) as { cat_id: string; logged_at: string }[]) {
    if (!lastCareByCat.has(r.cat_id)) lastCareByCat.set(r.cat_id, r.logged_at);
  }

  type UrgentCat = { id: string; name: string; region: string; health_status: string; caretaker_id: string | null };
  const targetCats: UrgentCat[] = [];
  for (const c of cats as UrgentCat[]) {
    const last = lastCareByCat.get(c.id);
    if (!last) {
      targetCats.push(c); // 돌봄 기록 한 번도 없음 → 즉시 대상
    } else if (last < staleAt) {
      targetCats.push(c);
    }
    if (targetCats.length >= MAX_CATS_PER_RUN) break;
  }

  if (targetCats.length === 0) {
    return Response.json({ ok: true, reason: "all urgent cats recently cared", sent: 0 });
  }

  // 3) 마케팅 푸시 동의 + 푸시 구독 있는 유저 캐시
  const { data: optedIn } = await supabase
    .from("profiles")
    .select("id")
    .eq("marketing_push_enabled", true);
  const optedSet = new Set(((optedIn ?? []) as { id: string }[]).map((p) => p.id));

  const { data: subsAll } = await supabase
    .from("push_subscriptions")
    .select("user_id, endpoint, p256dh, auth")
    .in("user_id", Array.from(optedSet));
  const subsByUser = new Map<string, Array<{ endpoint: string; p256dh: string; auth: string }>>();
  for (const s of (subsAll ?? []) as { user_id: string; endpoint: string; p256dh: string; auth: string }[]) {
    if (!subsByUser.has(s.user_id)) subsByUser.set(s.user_id, []);
    subsByUser.get(s.user_id)!.push({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth });
  }

  // 4) 고양이별로 같은 동 활동 유저 조회 → 푸시
  let sentTotal = 0;
  let failedTotal = 0;
  let catsAlerted = 0;
  const sentLog: Array<{ catId: string; catName: string; region: string; users: number; skipped: number }> = [];
  const dedupSinceIso = new Date(Date.now() - DEDUP_HOURS * 60 * 60 * 1000).toISOString();
  const insertLogRows: Array<{ user_id: string; cat_id: string; alert_type: string }> = [];

  for (const cat of targetCats) {
    const { data: nearby } = await supabase
      .from("user_activity_regions")
      .select("user_id")
      .eq("name", cat.region);
    const candidateIds = new Set(((nearby ?? []) as { user_id: string }[]).map((r) => r.user_id));
    if (cat.caretaker_id) candidateIds.delete(cat.caretaker_id); // 본인 제외

    const targets = Array.from(candidateIds)
      .filter((uid) => optedSet.has(uid) && subsByUser.has(uid))
      .slice(0, MAX_USERS_PER_CAT);

    if (targets.length === 0) continue;

    // dedup — 이 cat에 대해 24h 내 푸시받은 user 제외
    const { data: recentLogs } = await supabase
      .from("push_alert_log")
      .select("user_id")
      .eq("cat_id", cat.id)
      .eq("alert_type", "urgent_in_area")
      .gte("sent_at", dedupSinceIso);
    const recentlyNotified = new Set(((recentLogs ?? []) as { user_id: string }[]).map((r) => r.user_id));
    const filteredTargets = targets.filter((uid) => !recentlyNotified.has(uid));
    const skippedCount = targets.length - filteredTargets.length;

    if (filteredTargets.length === 0) {
      if (skippedCount > 0) {
        sentLog.push({ catId: cat.id, catName: cat.name, region: cat.region, users: 0, skipped: skippedCount });
      }
      continue;
    }

    const last = lastCareByCat.get(cat.id);
    const daysSince = last
      ? Math.max(STALE_DAYS, Math.floor((Date.now() - new Date(last).getTime()) / 86400000))
      : null;
    const severity = cat.health_status === "danger" ? "위험" : "주의";
    const title = `🐾 ${severity} 상태 ${cat.name}`;
    const body = daysSince
      ? `${cat.region}의 ${cat.name}이(가) ${daysSince}일째 안부가 없어요. 한 번 들러주실 수 있나요?`
      : `${cat.region}의 ${cat.name}이(가) ${severity} 상태인데 아직 돌봄 기록이 없어요.`;
    const url = `/cats/${cat.id}`;

    let sentForCat = 0;
    for (const uid of filteredTargets) {
      const subs = subsByUser.get(uid) ?? [];
      let userGotPush = false;
      for (const sub of subs) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            JSON.stringify({ title, body, url }),
          );
          sentTotal++;
          sentForCat++;
          userGotPush = true;
          await new Promise((r) => setTimeout(r, 60));
        } catch (err: unknown) {
          failedTotal++;
          const statusCode = (err as { statusCode?: number })?.statusCode;
          if (statusCode === 410 || statusCode === 404) {
            await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
          }
        }
      }
      // 1개 이상 디바이스에 성공했을 때만 dedup 로그 기록
      if (userGotPush) {
        insertLogRows.push({ user_id: uid, cat_id: cat.id, alert_type: "urgent_in_area" });
      }
    }
    if (sentForCat > 0) {
      catsAlerted++;
      sentLog.push({ catId: cat.id, catName: cat.name, region: cat.region, users: sentForCat, skipped: skippedCount });
    }
  }

  // dedup 로그 일괄 INSERT
  if (insertLogRows.length > 0) {
    await supabase.from("push_alert_log").insert(insertLogRows);
  }

  return Response.json({
    ok: true,
    catsConsidered: targetCats.length,
    catsAlerted,
    sent: sentTotal,
    failed: failedTotal,
    log: sentLog,
  });
}

export const GET = POST;
